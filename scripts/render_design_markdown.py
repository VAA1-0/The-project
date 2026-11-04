#!/usr/bin/env python3
"""Render Datascene's restrained design Markdown subset as a styled HTML file."""

from __future__ import annotations

import argparse
import html
import re
from pathlib import Path


def inline(value: str) -> str:
    value = html.escape(value.strip())
    value = re.sub(r"`([^`]+)`", r"<code>\1</code>", value)
    value = re.sub(r"\*\*([^*]+)\*\*", r"<strong>\1</strong>", value)
    value = re.sub(r"(?<!\*)\*([^*]+)\*(?!\*)", r"<em>\1</em>", value)
    return value


def is_table_separator(line: str) -> bool:
    cells = [cell.strip() for cell in line.strip().strip("|").split("|")]
    return bool(cells) and all(re.fullmatch(r":?-{3,}:?", cell) for cell in cells)


def render(markdown: str) -> str:
    lines = markdown.splitlines()
    parts: list[str] = []
    paragraph: list[str] = []
    list_kind: str | None = None
    in_quote = False
    index = 0

    def close_paragraph() -> None:
        if paragraph:
            parts.append("<p>" + inline(" ".join(paragraph)) + "</p>")
            paragraph.clear()

    def close_list() -> None:
        nonlocal list_kind
        if list_kind:
            parts.append(f"</{list_kind}>")
            list_kind = None

    def close_quote() -> None:
        nonlocal in_quote
        if in_quote:
            parts.append("</blockquote>")
            in_quote = False

    while index < len(lines):
        line = lines[index].rstrip()
        stripped = line.strip()

        if stripped.startswith("|") and index + 1 < len(lines) and is_table_separator(lines[index + 1]):
            close_paragraph()
            close_list()
            close_quote()
            headers = [cell.strip() for cell in stripped.strip("|").split("|")]
            parts.append("<table><thead><tr>" + "".join(f"<th>{inline(cell)}</th>" for cell in headers) + "</tr></thead><tbody>")
            index += 2
            while index < len(lines) and lines[index].strip().startswith("|"):
                cells = [cell.strip() for cell in lines[index].strip().strip("|").split("|")]
                parts.append("<tr>" + "".join(f"<td>{inline(cell)}</td>" for cell in cells) + "</tr>")
                index += 1
            parts.append("</tbody></table>")
            continue

        heading = re.match(r"^(#{1,4})\s+(.+)$", stripped)
        if heading:
            close_paragraph()
            close_list()
            close_quote()
            level = len(heading.group(1))
            parts.append(f"<h{level}>{inline(heading.group(2))}</h{level}>")
        elif stripped.startswith(">"):
            close_paragraph()
            close_list()
            if not in_quote:
                parts.append("<blockquote>")
                in_quote = True
            parts.append("<p>" + inline(stripped[1:].strip()) + "</p>")
        else:
            close_quote()
            bullet = re.match(r"^-\s+(.+)$", stripped)
            numbered = re.match(r"^\d+\.\s+(.+)$", stripped)
            if bullet or numbered:
                close_paragraph()
                wanted = "ul" if bullet else "ol"
                if list_kind != wanted:
                    close_list()
                    list_kind = wanted
                    parts.append(f"<{wanted}>")
                parts.append("<li>" + inline((bullet or numbered).group(1)) + "</li>")
            elif not stripped:
                close_paragraph()
                close_list()
            else:
                close_list()
                paragraph.append(stripped)
        index += 1

    close_paragraph()
    close_list()
    close_quote()
    body = "\n".join(parts)
    return f"""<!doctype html>
<html><head><meta charset="utf-8"><style>
@page {{ margin: 2.1cm; }}
body {{ color: #18232b; font-family: -apple-system, BlinkMacSystemFont, "Helvetica Neue", Arial, sans-serif; font-size: 10.5pt; line-height: 1.45; max-width: 920px; margin: 0 auto; }}
h1 {{ color: #123d50; font-size: 26pt; margin: 0 0 10pt; border-bottom: 3px solid #2b7188; padding-bottom: 8pt; }}
h2 {{ color: #174f64; font-size: 18pt; margin: 22pt 0 8pt; border-bottom: 1px solid #a9c3cc; padding-bottom: 4pt; page-break-after: avoid; }}
h3 {{ color: #245f71; font-size: 13.5pt; margin: 16pt 0 6pt; page-break-after: avoid; }}
h4 {{ color: #315f6d; font-size: 11pt; margin: 12pt 0 4pt; page-break-after: avoid; }}
p {{ margin: 0 0 8pt; }}
ul, ol {{ margin: 3pt 0 10pt 20pt; padding-left: 8pt; }}
li {{ margin: 0 0 3pt; }}
blockquote {{ border-left: 4px solid #4f8ca0; background: #eef5f7; margin: 10pt 0; padding: 8pt 12pt; font-size: 11pt; }}
blockquote p {{ margin: 0; }}
code {{ background: #edf1f3; border: 1px solid #d3dde1; border-radius: 3px; padding: 1px 3px; font-family: Menlo, Consolas, monospace; font-size: 9pt; }}
table {{ width: 100%; border-collapse: collapse; margin: 8pt 0 14pt; font-size: 8.8pt; }}
th {{ background: #dbeaf0; color: #153f4e; text-align: left; }}
th, td {{ border: 1px solid #aebfc6; padding: 5pt; vertical-align: top; }}
tr:nth-child(even) td {{ background: #f5f8f9; }}
strong {{ color: #173f4d; }}
</style></head><body>{body}</body></html>"""


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("source", type=Path)
    parser.add_argument("output", type=Path)
    args = parser.parse_args()
    args.output.write_text(render(args.source.read_text(encoding="utf-8")), encoding="utf-8")


if __name__ == "__main__":
    main()
