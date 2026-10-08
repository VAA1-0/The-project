from src.backend.analysis.language_pack_policy import (
    associate_detected_language_morphologies,
    build_language_pack_policy,
)
from src.backend.analysis import language_utils
from src.backend.analysis.morphology_catalog import list_morphology_catalog


def test_three_slot_morphology_policy_preserves_requested_order():
    policy = build_language_pack_policy(
        morphology_pack_policy="plus_3",
        morphology_languages="fi,de,sv",
    )

    assert policy["policy"] == "plus_3"
    assert policy["slot_limit"] == 3
    assert policy["policy_label"] == "English + 3 morphology languages"
    assert [item["code"] for item in policy["selected_languages"]] == ["fi", "de", "sv"]
    assert policy["commercial_extension_required"] is False


def test_three_slot_morphology_policy_deduplicates_without_reordering():
    policy = build_language_pack_policy(
        morphology_pack_policy="plus_3",
        morphology_languages="Finnish,fi,German,Swedish",
    )

    assert [item["code"] for item in policy["selected_languages"]] == ["fi", "de", "sv"]


def test_morphology_catalog_exposes_full_whisper_registry_alphabetically():
    catalog = list_morphology_catalog()
    names = [item["name"] for item in catalog]

    assert len(catalog) >= 90
    assert names == sorted(names, key=str.lower)
    assert {"Finnish", "German", "Swedish"}.issubset(names)


def test_timeline_sampling_does_not_let_opening_sentence_choose_primary(monkeypatch):
    def fake_infer(text):
        code = "en" if "OPENING" in text else "sv"
        return {"code": code, "name": code, "confidence": 0.8, "method": "test", "token_count": 20}

    monkeypatch.setattr(language_utils, "infer_text_language", fake_infer)
    segments = [
        {"start": index, "end": index + 1, "text": "OPENING" if index == 0 else "SVENSKA"}
        for index in range(18)
    ]

    profile = language_utils.build_language_profile("en", "OPENING", segments=segments)

    assert profile["code"] == "sv"
    assert profile["source"] == "timeline_over_whisper"
    assert profile["timeline_distribution"]["sample_count"] == 9


def test_significant_secondary_and_tertiary_volumes_get_associated_morphologies():
    policy = build_language_pack_policy(
        morphology_pack_policy="plus_3",
        morphology_languages="fi,de,sv",
    )
    profile = {
        "timeline_distribution": {
            "language_volumes": [],
            "significant_languages": [
                {"code": "sv", "share": 0.55, "sample_count": 5},
                {"code": "fi", "share": 0.27, "sample_count": 3},
                {"code": "de", "share": 0.18, "sample_count": 2},
            ],
        }
    }

    routed = associate_detected_language_morphologies(policy, profile)

    assert [item["code"] for item in routed["associated_morphologies"]] == ["sv", "fi", "de"]
    assert [item["role"] for item in routed["associated_morphologies"]] == [
        "primary",
        "secondary",
        "tertiary",
    ]
    assert all(item["routing"] == "configured_slot" for item in routed["associated_morphologies"])


def test_primary_morphology_falls_back_to_whole_file_when_samples_are_inconclusive():
    routed = associate_detected_language_morphologies(
        build_language_pack_policy(),
        {"code": "en", "timeline_distribution": {"significant_languages": []}},
    )

    assert routed["video_primary_morphology"]["code"] == "en"
    assert routed["video_primary_morphology"]["source"] == "whole_file_language_fallback"
