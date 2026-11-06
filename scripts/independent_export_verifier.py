#!/usr/bin/env python3
"""Independent, standard-library verifier for Datascene publication ZIPs.

This file deliberately imports no Datascene exporter, importer, schema helper,
or canonicalization implementation.
"""

from __future__ import annotations

import argparse
import hashlib
import io
import json
from pathlib import Path, PurePosixPath
import sys
import zipfile
from typing import Any


MAX_FILES = 20_000
MAX_UNCOMPRESSED_BYTES = 20 * 1024**3


class VerificationError(ValueError):
    pass


def _sha(data: bytes) -> str:
    return hashlib.sha256(data).hexdigest()


def _sha_file(path: Path) -> str:
    digest = hashlib.sha256()
    with path.open("rb") as handle:
        for chunk in iter(lambda: handle.read(8 * 1024 * 1024), b""):
            digest.update(chunk)
    return digest.hexdigest()


def _matches_sha(data: bytes, declared: Any) -> bool:
    value = str(declared or "")
    return value in {_sha(data), f"sha256:{_sha(data)}"}


def _canonical(value: Any) -> bytes:
    return json.dumps(value, ensure_ascii=False, sort_keys=True, separators=(",", ":")).encode("utf-8")


def _required(mapping: dict[str, Any], names: tuple[str, ...], context: str) -> None:
    missing = [name for name in names if mapping.get(name) in (None, "")]
    if missing:
        raise VerificationError(f"{context} missing required fields: {', '.join(missing)}")


def _open_archive(source: Path | bytes) -> zipfile.ZipFile:
    return zipfile.ZipFile(io.BytesIO(source) if isinstance(source, bytes) else source)


def _safe_inventory(archive: zipfile.ZipFile) -> list[str]:
    infos = archive.infolist()
    names = [item.filename for item in infos]
    if len(names) > MAX_FILES:
        raise VerificationError("archive exceeds the independent file-count limit")
    if len(names) != len(set(names)):
        raise VerificationError("archive contains duplicate paths")
    if sum(item.file_size for item in infos) > MAX_UNCOMPRESSED_BYTES:
        raise VerificationError("archive exceeds the independent uncompressed-size limit")
    for item in infos:
        parts = PurePosixPath(item.filename).parts
        if item.flag_bits & 0x1:
            raise VerificationError("encrypted entries are unsupported")
        if item.filename.startswith(("/", "\\")) or ".." in parts or "\\" in item.filename:
            raise VerificationError(f"unsafe archive path: {item.filename}")
    return names


def _json(archive: zipfile.ZipFile, name: str) -> dict[str, Any]:
    try:
        value = json.loads(archive.read(name))
    except KeyError as exc:
        raise VerificationError(f"required JSON file missing: {name}") from exc
    except (UnicodeDecodeError, json.JSONDecodeError) as exc:
        raise VerificationError(f"invalid JSON file: {name}") from exc
    if not isinstance(value, dict):
        raise VerificationError(f"JSON root must be an object: {name}")
    return value


def _verify_integrity(archive: zipfile.ZipFile, names: list[str], manifest: dict[str, Any], root_name: str) -> int:
    integrity = manifest.get("integrity")
    if not isinstance(integrity, dict) or integrity.get("algorithm") != "sha256":
        raise VerificationError("integrity algorithm must be sha256")
    entries = integrity.get("entries")
    if not isinstance(entries, list) or not entries:
        raise VerificationError("integrity entry inventory is empty")
    declared: set[str] = set()
    for index, entry in enumerate(entries):
        if not isinstance(entry, dict):
            raise VerificationError(f"integrity entry {index} is not an object")
        _required(entry, ("archive_path", "checksum", "byte_length", "media_type"), f"integrity entry {index}")
        name = str(entry["archive_path"])
        if name in declared or name not in names:
            raise VerificationError(f"integrity path is duplicate or missing: {name}")
        content = archive.read(name)
        if not _matches_sha(content, entry["checksum"]) or len(content) != entry["byte_length"]:
            raise VerificationError(f"integrity mismatch: {name}")
        declared.add(name)
    actual_payload = {name for name in names if name != root_name and not name.endswith("/")}
    if declared != actual_payload:
        raise VerificationError("integrity inventory does not exactly cover archive payload files")
    if not _matches_sha(_canonical(entries), integrity.get("content_identity")):
        raise VerificationError("content identity does not match the integrity inventory")
    return len(entries)


def _verify_video_archive(source: Path | bytes) -> dict[str, Any]:
    with _open_archive(source) as archive:
        names = _safe_inventory(archive)
        root = "Publication Manifest.json"
        manifest = _json(archive, root)
        _required(manifest, ("schema_version", "package_type", "package_id", "edition_id", "project_id"), "publication manifest")
        if manifest["schema_version"] != "1.0.0" or manifest["package_type"] != "video_publication":
            raise VerificationError("unsupported video publication schema or package type")
        entry_count = _verify_integrity(archive, names, manifest, root)
        package = manifest.get("video_package")
        if not isinstance(package, dict):
            raise VerificationError("video_package is missing")
        identity = package.get("video_identity") or {}
        clock = package.get("source_clock") or {}
        _required(identity, ("video_id", "title", "source_identity", "media_checksum"), "video identity")
        _required(clock, ("clock_id", "video_id", "timebase", "duration_ms"), "source clock")
        if clock["video_id"] != identity["video_id"] or clock["timebase"] not in {"milliseconds", "seconds", "frames", "samples"}:
            raise VerificationError("source clock identity or unit is inconsistent")
        data_book = _json(archive, "Data Book/Data Book.json")
        report = _json(archive, "Scientific Report/Scientific Report.json")
        for document, label in ((data_book, "Data Book"), (report, "scientific report")):
            if document.get("edition_id") != manifest["edition_id"] or document.get("video_id") != identity["video_id"]:
                raise VerificationError(f"{label} identity does not match the manifest")
        chapters = data_book.get("chapters")
        order = data_book.get("chapter_order")
        if not isinstance(chapters, list) or not isinstance(order, list) or order != [item.get("chapter_id") for item in chapters]:
            raise VerificationError("Data Book chapter order is incomplete or inconsistent")
        missingness = 0
        records = 0
        chapter_ids = set(order)
        associated_ids = {item.get("file_id") for item in package.get("associated_files") or [] if isinstance(item, dict)}
        for chapter in chapters:
            _required(chapter, ("chapter_id", "title", "video_id", "content_state", "content", "completeness"), "chapter")
            if chapter["video_id"] != identity["video_id"]:
                raise VerificationError("chapter crosses video identity")
            content = chapter["content"]
            rows = content.get("records") if isinstance(content, dict) else None
            if not isinstance(rows, list) or content.get("record_count") != len(rows):
                raise VerificationError("chapter record count is inconsistent")
            if not rows:
                missingness += 1
                if not isinstance(chapter.get("empty_state"), dict):
                    raise VerificationError("empty chapter does not explain missingness")
            for row in rows:
                _required(row, ("record_id", "record_type", "video_id", "source_coordinates", "maturity_state", "authority", "provenance"), "Data Book record")
                if "unit" not in row or (row["unit"] is not None and not isinstance(row["unit"], str)):
                    raise VerificationError("Data Book record unit must be explicit text or null/not-applicable")
                if row["video_id"] != identity["video_id"]:
                    raise VerificationError("record crosses video identity")
                records += 1
            if not set(chapter.get("associated_file_refs") or []).issubset(associated_ids):
                raise VerificationError("chapter references an undeclared associated file")
        for section in report.get("sections") or []:
            if not set(section.get("chapter_refs") or []).issubset(chapter_ids):
                raise VerificationError("report references an unknown chapter")
            for sentence in section.get("sentences") or []:
                _required(sentence, ("sentence_id", "text", "eligibility_status"), "report sentence")
        history = package.get("history")
        if not isinstance(history, list) or not history:
            raise VerificationError("decision/publication history is missing")
        return {
            "package_type": "video_publication",
            "project_id": manifest["project_id"],
            "edition_id": manifest["edition_id"],
            "video_ids": [identity["video_id"]],
            "chapter_count": len(chapters),
            "record_count": records,
            "explained_empty_chapter_count": missingness,
            "history_event_count": len(history),
            "integrity_entry_count": entry_count,
        }


def verify_export(path: Path) -> dict[str, Any]:
    path = Path(path)
    if not path.is_file():
        raise VerificationError("export archive does not exist")
    archive_sha = _sha_file(path)
    with zipfile.ZipFile(path) as archive:
        names = _safe_inventory(archive)
        if "Publication Manifest.json" in names:
            summary = _verify_video_archive(path)
        elif "Corpus Publication Manifest.json" in names:
            manifest = _json(archive, "Corpus Publication Manifest.json")
            _required(manifest, ("schema_version", "package_type", "package_id", "edition_id", "project_id"), "corpus manifest")
            if manifest["schema_version"] != "1.0.0" or manifest["package_type"] != "corpus_publication":
                raise VerificationError("unsupported corpus publication schema or package type")
            entry_count = _verify_integrity(archive, names, manifest, "Corpus Publication Manifest.json")
            refs = (manifest.get("corpus_package") or {}).get("video_publications")
            if not isinstance(refs, list) or not refs:
                raise VerificationError("corpus has no video publication references")
            child_summaries = []
            for ref in refs:
                _required(ref, ("video_id", "archive_path", "manifest_path", "data_book_path", "report_path", "source_clock_id"), "corpus video reference")
                for field in ("archive_path", "manifest_path", "data_book_path", "report_path"):
                    if ref[field] not in names:
                        raise VerificationError(f"corpus reference is missing: {ref[field]}")
                child = _verify_video_archive(archive.read(ref["archive_path"]))
                if child["video_ids"] != [ref["video_id"]] or child["project_id"] != manifest["project_id"]:
                    raise VerificationError("nested video identity or project is inconsistent")
                child_summaries.append(child)
            history = (manifest.get("corpus_package") or {}).get("history")
            if not isinstance(history, list) or not history:
                raise VerificationError("corpus publication history is missing")
            summary = {
                "package_type": "corpus_publication",
                "project_id": manifest["project_id"],
                "edition_id": manifest["edition_id"],
                "video_ids": [item["video_ids"][0] for item in child_summaries],
                "video_count": len(child_summaries),
                "chapter_count": sum(item["chapter_count"] for item in child_summaries),
                "record_count": sum(item["record_count"] for item in child_summaries),
                "explained_empty_chapter_count": sum(item["explained_empty_chapter_count"] for item in child_summaries),
                "history_event_count": len(history) + sum(item["history_event_count"] for item in child_summaries),
                "integrity_entry_count": entry_count + sum(item["integrity_entry_count"] for item in child_summaries),
            }
        else:
            raise VerificationError("archive has no recognized root publication manifest")
    return {
        "schema": "vaa1.independent_export_verification.v1",
        "verifier": "standalone_stdlib_reader_v1",
        "status": "verified",
        "archive": str(path),
        "archive_sha256": archive_sha,
        "reader_summary": summary,
        "datascene_runtime_required": False,
    }


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("archive", type=Path)
    parser.add_argument("--output", type=Path)
    args = parser.parse_args()
    try:
        result = verify_export(args.archive)
    except (OSError, zipfile.BadZipFile, VerificationError) as exc:
        result = {"schema": "vaa1.independent_export_verification.v1", "status": "rejected", "error": str(exc)}
        code = 1
    else:
        code = 0
    rendered = json.dumps(result, indent=2, ensure_ascii=False)
    if args.output:
        args.output.write_text(rendered + "\n", encoding="utf-8")
    print(rendered)
    return code


if __name__ == "__main__":
    raise SystemExit(main())
