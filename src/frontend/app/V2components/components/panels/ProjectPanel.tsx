import {
  Search,
  FolderOpen,
  Copy,
  ChevronRight,
  ChevronDown,
} from "lucide-react";

import { useState, useEffect } from "react";
import { eventBus } from "@/lib/golden-layout-lib/eventBus";
import { VideoService, type VideoMetadata } from "@/lib/video-service";
import { useLayoutHost } from "../LayoutHost";
import {
  apiService,
  type WorkspaceInfo,
  type WorkspacePathType,
  type SourceMediaMetadata,
} from "@/lib/api-service";
import VideoItem from "@/components/VideoItem";
import { deleteVideoBlob } from "@/lib/blob-store";
import { Button } from "@/components/ui/button";
import {
  Collapsible,
  CollapsibleContent,
} from "@/components/ui/collapsible";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";

const ANALYSIS_QUEUE_STORAGE_KEY = "vaa1.analysis.queue.v1";

export default function ProjectPanel() {
  const { openPanel } = useLayoutHost();
  const [libraryVideos, setLibraryVideos] = useState<VideoMetadata[]>([]);
  const [searchQuery, setSearchQuery] = useState("");
  const [workspaceInfo, setWorkspaceInfo] = useState<WorkspaceInfo | null>(null);
  const [copiedPath, setCopiedPath] = useState<string | null>(null);
  const [showWorkspaceLeafs, setShowWorkspaceLeafs] = useState(false);
  const [queuedAnalysisIds, setQueuedAnalysisIds] = useState<string[]>([]);
  const [activeQueuedAnalysisId, setActiveQueuedAnalysisId] = useState<
    string | null
  >(null);
  const [queuePaused, setQueuePaused] = useState(false);
  const [coolingMinutes, setCoolingMinutes] = useState("2");
  const [coolingUntil, setCoolingUntil] = useState<number | null>(null);
  const [coolingNow, setCoolingNow] = useState(Date.now());
  const [queueHydrated, setQueueHydrated] = useState(false);

  // Event bus video id state
  const [videoId, setVideoId] = useState("");

  useEffect(() => {
    try {
      const saved = JSON.parse(window.localStorage.getItem(ANALYSIS_QUEUE_STORAGE_KEY) || "{}");
      if (Array.isArray(saved.queuedAnalysisIds)) {
        setQueuedAnalysisIds(saved.queuedAnalysisIds.filter((item: unknown) => typeof item === "string"));
      }
      if (typeof saved.activeQueuedAnalysisId === "string") {
        setActiveQueuedAnalysisId(saved.activeQueuedAnalysisId);
      }
      if (typeof saved.queuePaused === "boolean") setQueuePaused(saved.queuePaused);
      if (typeof saved.coolingMinutes === "string") setCoolingMinutes(saved.coolingMinutes);
      if (typeof saved.coolingUntil === "number") setCoolingUntil(saved.coolingUntil);
    } catch {
      window.localStorage.removeItem(ANALYSIS_QUEUE_STORAGE_KEY);
    } finally {
      setQueueHydrated(true);
    }
  }, []);

  useEffect(() => {
    if (!queueHydrated) return;
    window.localStorage.setItem(
      ANALYSIS_QUEUE_STORAGE_KEY,
      JSON.stringify({
        queuedAnalysisIds,
        activeQueuedAnalysisId,
        queuePaused,
        coolingMinutes,
        coolingUntil,
      }),
    );
  }, [
    activeQueuedAnalysisId,
    coolingMinutes,
    coolingUntil,
    queueHydrated,
    queuePaused,
    queuedAnalysisIds,
  ]);

  const downloadTextFile = (filename: string, contents: string, type: string) => {
    const blob = new Blob([contents], { type });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = filename;
    document.body.appendChild(anchor);
    anchor.click();
    document.body.removeChild(anchor);
    window.setTimeout(() => URL.revokeObjectURL(url), 1000);
  };

  useEffect(() => {
    let mounted = true;
    async function loadListSafe() {
      try {
        const list = await VideoService.list(50);
        if (mounted) setLibraryVideos(list);
      } catch {
        if (mounted) setLibraryVideos([]);
      }
    }
    loadListSafe();
    // Listen for video-uploaded event to refresh list
    const handler = () => loadListSafe();
    window.addEventListener("video-uploaded", handler);
    return () => {
      mounted = false;
      window.removeEventListener("video-uploaded", handler);
    };
  }, []);

  useEffect(() => {
    if (!activeQueuedAnalysisId && queuedAnalysisIds.length === 0 && !coolingUntil) {
      return;
    }

    let mounted = true;
    const refreshList = async () => {
      try {
        const list = await VideoService.list(50);
        if (mounted) {
          setLibraryVideos(list);
        }
      } catch {
        // Keep current list if refresh fails; queue should stay calm.
      }
    };

    void refreshList();
    const interval = window.setInterval(() => {
      void refreshList();
    }, 5000);

    return () => {
      mounted = false;
      window.clearInterval(interval);
    };
  }, [activeQueuedAnalysisId, queuedAnalysisIds, coolingUntil]);

  useEffect(() => {
    if (!coolingUntil) {
      return;
    }

    setCoolingNow(Date.now());
    const interval = window.setInterval(() => {
      setCoolingNow(Date.now());
    }, 1000);

    return () => {
      window.clearInterval(interval);
    };
  }, [coolingUntil]);

  useEffect(() => {
    let mounted = true;

    async function loadWorkspaceInfo() {
      try {
        const info = await apiService.getWorkspaceInfo();
        if (mounted) {
          setWorkspaceInfo(info);
        }
      } catch {
        if (mounted) {
          setWorkspaceInfo(null);
        }
      }
    }

    loadWorkspaceInfo();
    return () => {
      mounted = false;
    };
  }, []);

  const filteredVideos = libraryVideos.filter((video) =>
    video.name?.toLowerCase().includes(searchQuery.toLowerCase()),
  );

  const selectVideo = (id: string) => {
    setVideoId(id);
    eventBus.emit("videoIdChanged", id);
  };

  const formatTimestamp = (value?: string) => {
    if (!value) return null;
    const parsed = new Date(value);
    if (Number.isNaN(parsed.getTime())) return value;
    return parsed.toLocaleString();
  };

  const describeStatus = (video: VideoMetadata) => {
    if (video.status === "completed") {
      return video.analysisCompletedAt ? "Saved analysis" : "Completed";
    }
    if (video.status === "processing") {
      return `Processing ${video.progress ?? 0}%`;
    }
    if (video.status === "error") {
      return "Needs review";
    }
    return "Uploaded";
  };

  const copyPath = async (pathValue: string) => {
    try {
      await navigator.clipboard.writeText(pathValue);
      setCopiedPath(pathValue);
      window.setTimeout(() => setCopiedPath(null), 1500);
    } catch (error) {
      console.error("Copy path failed:", error);
      alert("Could not copy that folder path.");
    }
  };

  const revealPath = async (pathType: WorkspacePathType) => {
    try {
      await apiService.revealWorkspacePath(pathType);
    } catch (error) {
      console.error("Reveal workspace path failed:", error);
      alert("Could not open that folder in Finder.");
    }
  };

  // Delete a video: remove blob from IndexedDB and metadata from Library
  const handleDeleteVideo = async (id: string) => {
    const confirmed = window.confirm(
      "Move this analysis out of the project? This removes its saved results from VAA1. All crew members are safe."
    );
    if (!confirmed) return;
    try {
      // Optimistic: remove from UI immediately and keep a backup for rollback
      const backup = libraryVideos.find((v) => v.id === id);
      setLibraryVideos((prev) => prev.filter((v) => v.id !== id));

      try {
        await VideoService.delete(id);
      } catch (err) {
        const message = String(err);
        if (message.includes("404")) {
          console.warn("Analysis was already gone on the backend, keeping UI calm.");
        } else {
        // rollback on failure
          console.error("Delete failed, restoring item", err);
          if (backup) setLibraryVideos((prev) => [backup, ...(prev || [])]);
          alert(
            "Could not remove that analysis cleanly. Please try once more."
          );
          return;
        }
      }

      // ensure local blob is removed
      try {
        await deleteVideoBlob(id);
      } catch (e) {
        console.warn("Failed to delete local blob", e);
      }
    } catch (err) {
      console.error(err);
      alert("Failed to delete video: " + String(err));
    }
  };

  // Rename video: edit metadata in Library
  const handleRenameVideo = async (id: string, newName: string) => {
    try {
      // Preserve the original file extension. If the original name had an extension,
      // strip any extension from the newName and append the original extension.
      const orig = await VideoService.get(id);
      let finalName = newName;
      if (orig && orig.name) {
        const dot = orig.name.lastIndexOf(".");
        const origExt = dot >= 0 ? orig.name.slice(dot) : "";
        if (origExt) {
          // remove extension from user input if present
          const userDot = newName.lastIndexOf(".");
          const base = userDot >= 0 ? newName.slice(0, userDot) : newName;
          finalName = base + origExt;
        }
      }

      // Optimistic update
      const prev = libraryVideos.find((v) => v.id === id)?.name;
      setLibraryVideos((prevList) =>
        prevList.map((v) =>
          v.id === id ? { ...v, name: finalName, status: "pending" } : v,
        ),
      );
      try {
        await VideoService.rename(id, finalName);
        setLibraryVideos((prevList) =>
          prevList.map((v) => (v.id === id ? { ...v, status: "synced" } : v)),
        );
      } catch (err) {
        // rollback
        setLibraryVideos((prevList) =>
          prevList.map((v) =>
            v.id === id ? { ...v, name: prev ?? v.name, status: "failed" } : v,
          ),
        );
        console.error(err);
        alert("Failed to rename video: " + String(err));
        return;
      }
      // per-item UI state is managed in VideoItem; no local clear needed here
    } catch (err) {
      console.error(err);
      alert("Failed to rename video: " + String(err));
    }
  };

  // Update video tag: edit metadata in Library
  const handleUpdateVideoTag = async (id: string, newTag: string) => {
    try {
      const prev = libraryVideos.find((v) => v.id === id)?.tag ?? null;
      setLibraryVideos((prevList) =>
        prevList.map((v) =>
          v.id === id ? { ...v, tag: newTag, status: "pending" } : v,
        ),
      );
      try {
        await VideoService.updateTag(id, newTag);
        setLibraryVideos((prevList) =>
          prevList.map((v) => (v.id === id ? { ...v, status: "synced" } : v)),
        );
      } catch (err) {
        // rollback
        setLibraryVideos((prevList) =>
          prevList.map((v) =>
            v.id === id ? { ...v, tag: prev, status: "failed" } : v,
          ),
        );
        throw err;
      }
    } catch (err) {
      console.error(err);
      alert("Failed to update video tag: " + String(err));
    }
  };

  const exportMediaCatalog = async (format: "json" | "csv") => {
    try {
      const records = await Promise.all(
        libraryVideos.map((video) => apiService.getSourceMediaMetadata(video.id)),
      );
      const catalog = records.map((record: SourceMediaMetadata) => ({
        analysis_id: record.analysis_id || "",
        original_filename: record.original_filename || "",
        source_video_path: record.source_video_path || "",
        duration_seconds: record.duration_seconds ?? "",
        size_bytes: record.size_bytes ?? "",
        video_codec: record.video_codec || "",
        audio_codec: record.audio_codec || "",
        width: record.width ?? "",
        height: record.height ?? "",
        fps: record.fps ?? "",
        format_name: record.format_name || "",
        editor_notes: record.user_annotations?.editor_notes || "",
        source_context: record.user_annotations?.source_context || "",
        provenance_notes: record.user_annotations?.provenance_notes || "",
      }));

      if (format === "json") {
        downloadTextFile(
          "source_media_catalog.json",
          JSON.stringify({ saved_at: new Date().toISOString(), records: catalog }, null, 2),
          "application/json",
        );
        return;
      }

      const header = Object.keys(catalog[0] || {
        analysis_id: "",
        original_filename: "",
        source_video_path: "",
        duration_seconds: "",
        size_bytes: "",
        video_codec: "",
        audio_codec: "",
        width: "",
        height: "",
        fps: "",
        format_name: "",
        editor_notes: "",
        source_context: "",
        provenance_notes: "",
      });
      const csv = [header, ...catalog.map((record) => header.map((key) => record[key as keyof typeof record] ?? ""))]
        .map((row) => row.map((value) => `"${String(value).replace(/"/g, '""')}"`).join(","))
        .join("\n");
      downloadTextFile("source_media_catalog.csv", `\uFEFF${csv}`, "text/csv;charset=utf-8");
    } catch (error) {
      console.error("Export media catalog failed:", error);
      alert("Could not export the source media catalog.");
    }
  };

  const openSourceMetadata = (id: string) => {
    selectVideo(id);
    openPanel("SourceMediaMetadata", { videoId: id });
  };

  const startAnalysisForVideo = async (id: string, notify = true) => {
    selectVideo(id);
    const current = await VideoService.get(id);
    await VideoService.startAnalysis(id, "full", {
      analysisTier: (current.analysisTier as
        | "quick_sweep"
        | "science_scan"
        | "forensic_sensor") || "science_scan",
      modalityFocus: (current.modalityFocus as
        | "multimodal"
        | "graphics"
        | "audio"
        | "images"
        | "text") || "multimodal",
      morphologyPackPolicy:
        (current.languagePackPolicy?.policy as
          | "core_only"
          | "plus_1"
          | "plus_2") || "core_only",
      morphologyLanguages:
        current.languagePackPolicy?.selected_languages
          ?.map((item) => item.code || "")
          .filter(Boolean) || [],
      specialUseMorphologyLanguage:
        current.languagePackPolicy?.special_use_language?.code ||
        current.languagePackPolicy?.special_use_language?.name ||
        "",
      allowRoughInterpretation:
        current.languagePackPolicy?.allow_rough_interpretation ?? true,
      applyFaceAnonymization: Boolean(current.applyFaceAnonymization),
      faceMessageStyle: current.faceMessageStyle || "plain",
      faceRequiresPersonDetection: Boolean(current.faceRequiresPersonDetection),
    });

    setLibraryVideos((prev) =>
      prev.map((video) =>
        video.id === id ? { ...video, status: "processing", progress: 5 } : video,
      ),
    );

    if (notify) {
      alert("Analysis started.");
    }
  };

  const analyzeVideo = async (id: string) => {
    try {
      await startAnalysisForVideo(id, true);
    } catch (error) {
      console.error("Analyze from project panel failed:", error);
      alert(
        "Could not start analysis: " +
          (error instanceof Error ? error.message : String(error)),
      );
    }
  };

  const toggleQueueVideo = (id: string) => {
    setQueuedAnalysisIds((previous) =>
      previous.includes(id)
        ? previous.filter((item) => item !== id)
        : [...previous, id],
    );
  };

  const clearQueue = () => {
    setQueuedAnalysisIds([]);
    setActiveQueuedAnalysisId(null);
    setCoolingUntil(null);
    setQueuePaused(false);
  };

  useEffect(() => {
    if (!queueHydrated) return;
    if (queuePaused) {
      return;
    }

    const currentStatus = activeQueuedAnalysisId
      ? libraryVideos.find((video) => video.id === activeQueuedAnalysisId)?.status
      : null;
    const currentMissionStage = activeQueuedAnalysisId
      ? libraryVideos.find((video) => video.id === activeQueuedAnalysisId)?.missionStage
      : null;

    if (activeQueuedAnalysisId) {
      if (currentStatus === "uploaded" && currentMissionStage === "interrupted") {
        const interruptedId = activeQueuedAnalysisId;
        setActiveQueuedAnalysisId(null);
        setQueuedAnalysisIds((previous) =>
          previous.includes(interruptedId) ? previous : [interruptedId, ...previous],
        );
        return;
      }
      if (currentStatus === "completed" || currentStatus === "error") {
        setActiveQueuedAnalysisId(null);
        const coolingMs = Math.max(0, Number(coolingMinutes) || 0) * 60 * 1000;
        setCoolingUntil(coolingMs > 0 ? Date.now() + coolingMs : null);
      }
      return;
    }

    if (coolingUntil && coolingUntil > Date.now()) {
      return;
    }

    if (coolingUntil && coolingUntil <= Date.now()) {
      setCoolingUntil(null);
    }

    if (queuedAnalysisIds.length === 0) {
      return;
    }

    const anyProcessing = libraryVideos.some((video) => video.status === "processing");
    if (anyProcessing) {
      return;
    }

    const nextId = queuedAnalysisIds[0];
    setQueuedAnalysisIds((previous) => previous.slice(1));
    setActiveQueuedAnalysisId(nextId);
    void startAnalysisForVideo(nextId, false).catch((error) => {
      console.error("Queued analysis start failed:", error);
      setActiveQueuedAnalysisId(null);
      alert(
        "Could not start one queued analysis: " +
          (error instanceof Error ? error.message : String(error)),
      );
    });
  }, [
    activeQueuedAnalysisId,
    coolingMinutes,
    coolingUntil,
    libraryVideos,
    queuePaused,
    queuedAnalysisIds,
    queueHydrated,
  ]);

  const coolingSecondsRemaining = coolingUntil
    ? Math.max(0, Math.ceil((coolingUntil - coolingNow) / 1000))
    : 0;

  return (
    <TooltipProvider delayDuration={200}>
      <div className="bg-[#232323] flex h-full min-w-0 flex-1 flex-col overflow-hidden">
        <div className="bg-[#1a1a1a] min-w-0 overflow-x-hidden px-3 py-2 border-b border-[#0f0f0f] flex items-center gap-2 overflow-hidden">
          <span className="text-[#8f8f8f] text-[11px] uppercase tracking-[0.14em]">
            Saved Work
          </span>
          {workspaceInfo && (
            <button
              type="button"
              aria-label={showWorkspaceLeafs ? "Hide workspace" : "Show workspace"}
              onClick={() => setShowWorkspaceLeafs((value) => !value)}
              className="rounded p-1 hover:bg-[#2a2a2a] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500"
            >
              {showWorkspaceLeafs ? (
                <ChevronDown className="size-3 text-[#7a7a7a]" />
              ) : (
                <ChevronRight className="size-3 text-[#7a7a7a]" />
              )}
            </button>
          )}
          <div className="ml-auto min-w-0">
            <div className="flex min-w-0 items-center gap-2">
              <button
                type="button"
                onClick={() => {
                  void exportMediaCatalog("json");
                }}
                className="rounded border border-[#2a2a2a] px-2 py-1 text-[10px] text-[#6f6f6f] hover:bg-[#232323] hover:text-[#a8a8a8]"
              >
                Media JSON
              </button>
              <button
                type="button"
                onClick={() => {
                  void exportMediaCatalog("csv");
                }}
                className="rounded border border-[#2a2a2a] px-2 py-1 text-[10px] text-[#6f6f6f] hover:bg-[#232323] hover:text-[#a8a8a8]"
              >
                Media CSV
              </button>
              <Tooltip>
                <TooltipTrigger asChild>
                  <div className="flex items-center gap-2 rounded bg-[#202020] px-2 py-1">
                    <Search className="size-3.5 text-[#8e8e8e]" />
                    <input
                      value={searchQuery}
                      onChange={(e) => setSearchQuery(e.target.value)}
                      placeholder="Search"
                      aria-label="Search analyses"
                      className="w-24 bg-transparent text-[11px] text-[#b8b8b8] outline-none placeholder:text-[#666666]"
                    />
                  </div>
                </TooltipTrigger>
                <TooltipContent>
                  <p>Search analyses</p>
                </TooltipContent>
              </Tooltip>
            </div>
          </div>
        </div>
        {workspaceInfo && (
          <Collapsible
            open={showWorkspaceLeafs}
            onOpenChange={setShowWorkspaceLeafs}
            className="border-b border-[#131313] bg-[#171717]"
          >
            <CollapsibleContent className="px-2 pb-2">
              {[
                {
                  key: "imports",
                  label: "Video sources",
                  path: workspaceInfo.imported_work_dir,
                },
                {
                  key: "results",
                  label: "Saved data",
                  path: workspaceInfo.results_dir,
                },
              ].map((item) => (
                <div
                  key={item.key}
                  className="group flex items-center gap-2 rounded px-3 py-1.5 hover:bg-[#1d1d1d]"
                >
                  <div className="min-w-0 flex-1 overflow-hidden">
                    <div className="text-[10px] uppercase tracking-[0.12em] text-[#919191]">
                      {item.label}
                    </div>
                    <div
                      className="truncate text-[10px] text-[#666666]"
                      title={item.path}
                    >
                      {item.path}
                    </div>
                  </div>
                  <div className="flex items-center gap-1 opacity-80 group-hover:opacity-100">
                    <Button
                      type="button"
                      size="sm"
                      variant="ghost"
                      className="h-6 px-2 text-[10px] text-[#7f7f7f]"
                      onClick={() => {
                        void copyPath(item.path);
                      }}
                    >
                      <Copy className="size-3" />
                      {copiedPath === item.path ? "Copied" : "Copy"}
                    </Button>
                    <Button
                      type="button"
                      size="sm"
                      variant="ghost"
                      className="h-6 px-2 text-[10px] text-[#7f7f7f]"
                      onClick={() => {
                        void revealPath(item.key as WorkspacePathType);
                      }}
                    >
                      <FolderOpen className="size-3" />
                      Open
                    </Button>
                  </div>
                </div>
              ))}
              <div className="px-3 pt-1 text-[10px] text-[#5d5d5d]">
                {workspaceInfo.downloads_note}
              </div>
            </CollapsibleContent>
          </Collapsible>
        )}
        <div className="flex-1 min-h-0 min-w-0 overflow-hidden">
          <div className="border-b border-[#131313] bg-[#181818] px-3 py-2">
            <div className="flex flex-wrap items-center gap-2 text-[10px] text-[#8d8d8d]">
              <span className="uppercase tracking-[0.12em] text-[#7a7a7a]">
                Analysis queue
              </span>
              <span>
                {activeQueuedAnalysisId
                  ? "Running 1 job"
                  : queuedAnalysisIds.length > 0
                    ? `${queuedAnalysisIds.length} queued`
                    : "Idle"}
              </span>
              {coolingUntil && coolingSecondsRemaining > 0 ? (
                <span>{`Cooling ${coolingSecondsRemaining}s`}</span>
              ) : null}
              <div className="ml-auto flex flex-wrap items-center gap-2">
                <label className="flex items-center gap-2">
                  <span className="text-[#6f6f6f]">Cool-down</span>
                  <select
                    value={coolingMinutes}
                    onChange={(e) => setCoolingMinutes(e.target.value)}
                    className="rounded border border-[#2a2a2a] bg-[#202020] px-2 py-1 text-[10px] text-[#b8b8b8]"
                  >
                    <option value="0">0 min</option>
                    <option value="2">2 min</option>
                    <option value="5">5 min</option>
                    <option value="10">10 min</option>
                  </select>
                </label>
                <button
                  type="button"
                  onClick={() => setQueuePaused((value) => !value)}
                  className="rounded border border-[#2a2a2a] px-2 py-1 text-[10px] text-[#7f7f7f] hover:bg-[#232323] hover:text-[#a8a8a8]"
                >
                  {queuePaused ? "Resume queue" : "Pause queue"}
                </button>
                <button
                  type="button"
                  onClick={clearQueue}
                  disabled={
                    queuedAnalysisIds.length === 0 &&
                    !activeQueuedAnalysisId &&
                    !coolingUntil
                  }
                  className="rounded border border-[#2a2a2a] px-2 py-1 text-[10px] text-[#7f7f7f] hover:bg-[#232323] hover:text-[#a8a8a8] disabled:opacity-40"
                >
                  Clear queue
                </button>
              </div>
            </div>
          </div>
          {/* Scrollable Video list */}
          <div className="h-full max-h-full flex-1 space-y-2 overflow-x-hidden overflow-y-auto p-2">
            {/* Real mapped videos */}
            {filteredVideos.length === 0 && (
              <div className="p-3 text-[11px] text-[var(--ui-passive-text)]">
                {searchQuery
                  ? "No saved analyses match that search."
                  : "No saved analyses yet."}
              </div>
            )}

            {filteredVideos.map((vid, idx: number) => (
              <div
                key={vid.id}
                role="button"
                aria-label={`Select video ${vid.name}`}
                tabIndex={0}
                className={`min-w-0 overflow-hidden p-2.5 rounded-md cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 ${
                  videoId === vid.id
                    ? "bg-blue-950/25 ring-1 ring-blue-900/60"
                    : "bg-slate-950/20 hover:bg-slate-900/35"
                }`}
                onClick={() => {
                  console.log("ProjectPanel: video selected", vid.id);
                  selectVideo(vid.id);
                }}
                onKeyDown={(e) => {
                  if (e.key === "Enter" || e.key === " ") {
                    selectVideo(vid.id);
                    e.preventDefault();
                  } else if (e.key === "ArrowDown") {
                    const items = Array.from(
                      (e.currentTarget.parentElement as HTMLElement).children,
                    ) as HTMLElement[];
                    const next = Math.min(idx + 1, items.length - 1);
                    items[next]?.focus();
                    e.preventDefault();
                  } else if (e.key === "ArrowUp") {
                    const items = Array.from(
                      (e.currentTarget.parentElement as HTMLElement).children,
                    ) as HTMLElement[];
                    const prev = Math.max(idx - 1, 0);
                    items[prev]?.focus();
                    e.preventDefault();
                  }
                }}
              >
                <div
                  className="flex min-w-0 gap-2 overflow-hidden"
                  onClick={(e) => {
                    selectVideo(vid.id);
                    e.stopPropagation();
                  }}
                >
                  <div className="min-w-0 flex-1 space-y-2 overflow-hidden">
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <div className="truncate text-xs font-medium text-slate-300">
                          {vid.name}
                        </div>
                        <div className="mt-1 text-[11px] text-[var(--ui-passive-text)]">
                          {describeStatus(vid)}
                          {vid.pipelineType && ` • ${vid.pipelineType}`}
                        </div>
                        <div className="mt-1 text-[10px] text-[var(--ui-passive-text)]">
                          {formatTimestamp(vid.analysisCompletedAt)
                            ? `Completed ${formatTimestamp(vid.analysisCompletedAt)}`
                            : formatTimestamp(vid.uploadedAt)
                              ? `Uploaded ${formatTimestamp(vid.uploadedAt)}`
                              : "Saved run available"}
                        </div>
                      </div>
                      <button
                        type="button"
                        className="rounded border border-slate-700 px-2 py-1 text-[10px] text-slate-400 hover:bg-slate-800"
                        onClick={(e) => {
                          e.stopPropagation();
                          selectVideo(vid.id);
                        }}
                      >
                        Open
                      </button>
                    </div>

                    <div className="flex items-center gap-2">
                      <button
                        type="button"
                        className="rounded border border-slate-800 px-2 py-1 text-[10px] text-[var(--ui-passive-text)] hover:bg-slate-800/50 hover:text-slate-300 disabled:opacity-40"
                        onClick={(e) => {
                          e.stopPropagation();
                          void analyzeVideo(vid.id);
                        }}
                        disabled={vid.status === "processing" || vid.status === "completed"}
                      >
                        Analyze
                      </button>
                      <button
                        type="button"
                        className="rounded border border-slate-800 px-2 py-1 text-[10px] text-[var(--ui-passive-text)] hover:bg-slate-800/50 hover:text-slate-300 disabled:opacity-40"
                        onClick={(e) => {
                          e.stopPropagation();
                          toggleQueueVideo(vid.id);
                        }}
                        disabled={vid.status === "processing" || vid.status === "completed"}
                      >
                        {queuedAnalysisIds.includes(vid.id) ? "Queued" : "Queue"}
                      </button>
                      <button
                        type="button"
                        className="rounded border border-slate-800 px-2 py-1 text-[10px] text-[var(--ui-passive-text)] hover:bg-slate-800/50 hover:text-slate-300"
                        onClick={(e) => {
                          e.stopPropagation();
                          openSourceMetadata(vid.id);
                        }}
                      >
                        Media
                      </button>
                    </div>

                    {activeQueuedAnalysisId === vid.id ||
                    queuedAnalysisIds.includes(vid.id) ? (
                      <div className="text-[10px] text-[#8c8c8c]">
                        {activeQueuedAnalysisId === vid.id
                          ? "Queued run active"
                          : `Queued position ${queuedAnalysisIds.indexOf(vid.id) + 1}`}
                      </div>
                    ) : null}

                    <VideoItem
                      vid={vid}
                      onView={() => {}}
                      onDelete={handleDeleteVideo}
                      onRename={handleRenameVideo}
                      onUpdateTag={handleUpdateVideoTag}
                      showHeader={false}
                    />
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </TooltipProvider>
  );
}
