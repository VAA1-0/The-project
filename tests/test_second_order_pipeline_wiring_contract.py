from pathlib import Path
import unittest


ROOT = Path(__file__).resolve().parents[1]
API_SERVER = (ROOT / "api_server.py").read_text(encoding="utf-8")
API_SERVICE = (ROOT / "src/frontend/lib/api-service.ts").read_text(encoding="utf-8")
CONFIG = (ROOT / "src/frontend/lib/config.ts").read_text(encoding="utf-8")
TIME_BANK_PANEL = (
    ROOT / "src/frontend/app/V2components/components/panels/TimeBankPanel.tsx"
).read_text(encoding="utf-8")


class SecondOrderPipelineWiringContractTest(unittest.TestCase):
    def test_backend_pipeline_writes_second_order_artifacts(self) -> None:
        self.assertIn("write_dependency_sfl_stage1_artifact", API_SERVER)
        self.assertIn("write_multimodal_meaning_stage1_artifact", API_SERVER)
        self.assertIn("write_agent_persistence_artifact_for_status", API_SERVER)
        self.assertIn("build_agent_persistence_feature_event", API_SERVER)
        self.assertIn(
            "from src.backend.analysis.agent_persistence_manager import AgentPersistenceManager",
            API_SERVER,
        )
        self.assertIn("write_second_order_label_proliferation_plan", API_SERVER)
        self.assertIn("def write_second_order_meaning_artifacts_for_status", API_SERVER)
        self.assertIn("write_second_order_meaning_artifacts_for_status(status)", API_SERVER)
        self.assertIn('"created_during": "status_refresh"', API_SERVER)
        self.assertIn("def resolve_transcript_for_meaning", API_SERVER)
        self.assertIn('output_files.get("transcript")', API_SERVER)
        self.assertIn('_transcript.json"', API_SERVER)
        self.assertIn("def should_run_agent_persistence_for_status", API_SERVER)
        self.assertIn('status["results"] = results', API_SERVER)
        self.assertIn("if should_run_agent_persistence_for_status(status):", API_SERVER)
        self.assertIn('"agent_persistence_skipped"', API_SERVER)

    def test_backend_status_exposes_second_order_plan_and_errors(self) -> None:
        self.assertIn(
            '"second_order_label_proliferation": status.get("second_order_label_proliferation")',
            API_SERVER,
        )
        self.assertIn('"second_order_label_proliferation_error"', API_SERVER)
        self.assertIn('"second_order_label_proliferation_created"', API_SERVER)

    def test_backend_downloads_include_second_order_artifacts(self) -> None:
        for file_type in (
            "dependency_sfl_stage1",
            "multimodal_meaning_stage1",
            "agent_persistence_scene_cut",
            "second_order_label_proliferation",
        ):
            self.assertIn(file_type, API_SERVER)

    def test_frontend_download_registry_includes_second_order_artifacts(self) -> None:
        for file_type in (
            "dependency_sfl_stage1",
            "multimodal_meaning_stage1",
            "second_order_label_proliferation",
        ):
            self.assertIn(file_type, API_SERVICE)
            self.assertIn(file_type, CONFIG)

    def test_time_bank_surfaces_second_order_meaning_as_navigable_evidence(self) -> None:
        self.assertIn('meaning: "Meaning"', TIME_BANK_PANEL)
        self.assertIn('analysisData.secondOrderLabelProliferation?.instructions', TIME_BANK_PANEL)
        self.assertIn('object_type: "second_order_label_candidate"', TIME_BANK_PANEL)
        self.assertIn("source_evidence_refs", TIME_BANK_PANEL)
        self.assertIn("seekTo(row.id, anchor?.t_start_ms)", TIME_BANK_PANEL)


if __name__ == "__main__":
    unittest.main()
