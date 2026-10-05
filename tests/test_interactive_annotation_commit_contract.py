from pathlib import Path


ROOT = Path(__file__).parents[1]


def test_annotation_endpoint_runs_outside_the_async_event_loop():
    source = (ROOT / "api_server.py").read_text(encoding="utf-8")
    assert "def update_annotation_corrections(" in source
    assert "async def update_annotation_corrections(" not in source
    assert "def get_annotation_corrections(" in source


def test_dashboard_fallback_does_not_rewrite_the_analysis_record():
    source = (
        ROOT
        / "src/frontend/app/api/local-analysis/[analysisId]/download/[fileType]/route.ts"
    ).read_text(encoding="utf-8")
    post_source = source.split("export async function POST", 1)[1]
    assert "analysisRecordPath(analysisId)" not in post_source
    assert '"annotation_corrections.json"' in post_source
    assert "fs.rename(temporaryPath, outputPath)" in post_source
    get_source = source.split("export async function GET", 1)[1].split(
        "export async function POST", 1
    )[0]
    assert 'fileType === "annotation_corrections"' in get_source
    assert get_source.index('fileType === "annotation_corrections"') < get_source.index(
        "readRecord(analysisId)"
    )


def test_annotation_client_commits_and_verifies_the_canonical_sidecar():
    source = (ROOT / "src/frontend/lib/api-service.ts").read_text(encoding="utf-8")
    save_source = source.split("async saveAnnotationCorrections", 1)[1].split(
        "private getMimeType", 1
    )[0]
    assert "const artifactUrl" in save_source
    assert 'method: "POST"' in save_source
    assert "verificationResponse" in save_source
    assert "readback did not match the committed version" in save_source
    assert "/api/annotation-corrections/" not in save_source


def test_annotation_hydration_cannot_fall_back_to_stale_analysis_record_bundle():
    source = (ROOT / "src/frontend/lib/api-service.ts").read_text(encoding="utf-8")
    read_source = source.split("async getAnnotationCorrections", 1)[1].split(
        "async saveAnnotationCorrections", 1
    )[0]
    assert "localAnalysisUrl(" in read_source
    assert '"/download/annotation_corrections"' in read_source
    assert "/api/annotation-corrections/" not in read_source
    assert 'cache: "no-store"' in read_source

    route = (
        ROOT
        / "src/frontend/app/api/local-analysis/[analysisId]/download/[fileType]/route.ts"
    ).read_text(encoding="utf-8")
    post_source = route.split("export async function POST", 1)[1]
    assert "mergeAnnotationCorrections(existing, incoming)" in post_source
    assert "withCorrectionWriteLock" in post_source


def test_annotation_hydration_merges_all_sources_and_canonical_sidecar_wins_ties():
    route = (
        ROOT
        / "src/frontend/app/api/local-analysis/[analysisId]/download/[fileType]/route.ts"
    ).read_text(encoding="utf-8")
    read_source = route.split("async function readRichestAnnotationCorrections", 1)[1].split(
        "function transcriptPayloadHasTimingAuthority", 1
    )[0]
    assert "correctionDocumentTime" in read_source
    assert "left.priority - right.priority" in read_source
    assert ".reduce(" in read_source
    assert "mergeAnnotationCorrections(merged, candidate.value)" in read_source


def test_foreground_commit_does_not_reload_analysis_or_rebroadcast_video_selection():
    correction_events = (
        ROOT / "src/frontend/lib/annotation-corrections.ts"
    ).read_text(encoding="utf-8")
    broadcast = correction_events.split(
        "export function broadcastAnalysisCorrectionRefresh", 1
    )[1].split("export function removeCorrectionRule", 1)[0]
    assert 'eventBus.emit("analysisCorrectionCommitted"' in broadcast
    assert 'eventBus.emit("analysisCorrectionsChanged"' not in broadcast
    assert 'eventBus.emit("videoIdChanged"' not in broadcast

    video_panel = (
        ROOT
        / "src/frontend/app/V2components/components/panels/VideoPanel.tsx"
    ).read_text(encoding="utf-8")
    assert "VideoService.refreshAnalysis(" not in video_panel


def test_heavy_analysis_admission_reserves_interactive_memory():
    source = (ROOT / "api_server.py").read_text(encoding="utf-8")
    assert "VAA1_INTERACTIVE_MEMORY_HEADROOM_BYTES" in source
    assert "memory_headroom = interactive_memory_headroom()" in source
    assert 'if not memory_headroom["accepted"]:' in source


def test_in_progress_visual_checkpoint_is_available_without_analysis_record():
    route = (
        ROOT
        / "src/frontend/app/api/local-analysis/[analysisId]/download/[fileType]/route.ts"
    ).read_text(encoding="utf-8")
    get_source = route.split("export async function GET", 1)[1].split(
        "export async function POST", 1
    )[0]
    assert 'fileType === "visual_frame_scan_checkpoint"' in get_source
    assert get_source.index('fileType === "visual_frame_scan_checkpoint"') < get_source.index(
        "readRecord(analysisId)"
    )

    service = (ROOT / "src/frontend/lib/video-service.ts").read_text(encoding="utf-8")
    incomplete = service.split('if (status.status !== "completed")', 1)[1].split(
        "const cached =", 1
    )[0]
    assert "getVisualFrameCheckpoint(id)" in incomplete
    assert "detectedObjects: mergedCheckpointObjects" in incomplete
    assert "manualVisualObjects" in incomplete
    assert "ocr: checkpointOcr" in incomplete
