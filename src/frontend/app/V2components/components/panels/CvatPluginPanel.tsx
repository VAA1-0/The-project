"use client";

import React, { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { CvatCanvas } from "@/cvat-api/components/CvatCanvas";
import {
  createVideoTask,
  getCvatHealth,
  listJobs,
  loginToCvat,
} from "@/cvat-api/client";
import { getVideoBlob } from "@/lib/blob-store";
import { apiService } from "@/lib/api-service";
import { eventBus } from "@/lib/golden-layout-lib/eventBus";
import { VideoService, type VideoMetadata } from "@/lib/video-service";

type SyncInfo = {
  status?: string;
  job_id?: number;
  mapped_at?: string;
  object_annotation_count?: number;
  track_annotation_count?: number;
} | null;

type CvatPluginPanelProps = {
  forcedVideoId?: string;
  compact?: boolean;
  hideHeader?: boolean;
};

export default function CvatPluginPanel({
  forcedVideoId = "",
  compact = false,
  hideHeader = false,
}: CvatPluginPanelProps) {
  const [videoId, setVideoId] = useState("");
  const [metadata, setMetadata] = useState<VideoMetadata | null>(null);
  const [selectedJob, setSelectedJob] = useState<any>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [syncInfo, setSyncInfo] = useState<SyncInfo>(null);
  const [syncMessage, setSyncMessage] = useState<string | null>(null);
  const [isSyncing, setIsSyncing] = useState(false);

  useEffect(() => {
    const handler = (nextId: string) => {
      setVideoId(nextId || "");
    };
    eventBus.on("videoIdChanged", handler);
    return () => {
      eventBus.off("videoIdChanged", handler);
    };
  }, []);

  useEffect(() => {
    if (forcedVideoId) {
      setVideoId(forcedVideoId);
    }
  }, [forcedVideoId]);

  useEffect(() => {
    async function loadPluginState() {
      if (!videoId) {
        setMetadata(null);
        setSelectedJob(null);
        setSyncInfo(null);
        setError(null);
        return;
      }

      setIsLoading(true);
      setError(null);
      try {
        const videoMeta = await VideoService.get(videoId);
        setMetadata(videoMeta);
        const statusSnapshot = await apiService.getStatus(videoId);
        setSyncInfo(statusSnapshot?.cvat_ingest || null);
        const taskId = await ensureCvatTask(videoId, videoMeta);
        const jobs = await waitForJobs(taskId);
        if (jobs.length > 0) {
          setSelectedJob(jobs[0]);
        } else {
          setSelectedJob(null);
          setError("CVAT job is not ready yet.");
        }
      } catch (err) {
        setError(err instanceof Error ? err.message : "Could not load CVAT plugin.");
      } finally {
        setIsLoading(false);
      }
    }

    void loadPluginState();
  }, [videoId]);

  async function ensureCvatTask(
    analysisId: string,
    videoMeta: VideoMetadata,
  ): Promise<number> {
    if (videoMeta?.cvatID && Number(videoMeta.cvatID) > 0) {
      return Number(videoMeta.cvatID);
    }

    const health = await getCvatHealth().catch(() => ({
      ok: false,
      tokenValid: false,
    }));
    if (!health?.tokenValid) {
      const auth = await loginToCvat("admin", "admin123");
      if (!auth?.ok) {
        throw new Error("CVAT sign-in failed.");
      }
    }

    const blob = await getVideoBlob(analysisId);
    if (!blob) {
      throw new Error("No stored source video is available for CVAT.");
    }

    const filename = videoMeta?.name || `analysis-${analysisId}.mp4`;
    const file = new File([blob], filename, {
      type: blob.type || "video/mp4",
      lastModified: Date.now(),
    });
    const taskName = `VAA1-${filename.replace(/\.[^.]+$/, "")}-${analysisId.slice(0, 8)}`;
    const task = await createVideoTask(taskName, file);
    const taskId = Number(task?.taskId);

    if (!Number.isFinite(taskId) || taskId <= 0) {
      throw new Error("CVAT task creation returned an invalid task ID.");
    }

    await VideoService.updateCvatLink(analysisId, taskId);
    setMetadata((previous) =>
      previous
        ? {
            ...previous,
            cvatID: taskId,
          }
        : previous,
    );

    return taskId;
  }

  async function waitForJobs(taskId: number): Promise<any[]> {
    for (let attempt = 0; attempt < 60; attempt += 1) {
      const result = await listJobs(taskId);
      const jobList = Array.isArray(result) ? result : result.results || [];
      if (jobList.length > 0) {
        return jobList;
      }
      await new Promise((resolve) => window.setTimeout(resolve, 2000));
    }
    return [];
  }

  async function handleSyncToVaa1() {
    if (!videoId || !selectedJob?.id) {
      return;
    }

    setIsSyncing(true);
    setSyncMessage(null);
    try {
      const result = await apiService.syncCvatAnnotations(videoId, {
        task_id: metadata?.cvatID,
        job_id: selectedJob.id,
      });
      setSyncInfo({
        status: result.status,
        job_id: result.job_id,
        mapped_at: new Date().toISOString(),
        object_annotation_count: result.object_annotation_count,
        track_annotation_count: result.track_annotation_count,
      });
      setSyncMessage(
        `Synced ${result.object_annotation_count} object / ${result.track_annotation_count} track`,
      );
    } catch (err) {
      setSyncMessage(
        err instanceof Error ? err.message : "Could not sync CVAT annotations.",
      );
    } finally {
      setIsSyncing(false);
    }
  }

  return (
    <div className="flex h-full flex-col bg-[#111111] text-slate-200">
      {!hideHeader && (
      <div className="border-b border-white/10 px-3 py-2">
        <div className="flex items-center justify-between gap-3">
          <div className="min-w-0">
            <div className="text-[11px] uppercase tracking-[0.16em] text-slate-400">
              CVAT plugin
            </div>
            <div className="truncate text-xs text-slate-500">
              {metadata?.name || "No analysis selected"}
            </div>
          </div>
          <Button
            type="button"
            onClick={() => void handleSyncToVaa1()}
            disabled={!selectedJob?.id || isSyncing}
            className="h-8 bg-blue-600 px-2 text-xs text-white hover:bg-blue-700"
          >
            {isSyncing ? "Syncing" : "Sync"}
          </Button>
        </div>
        {(syncInfo || syncMessage) && (
          <div className="mt-2 flex flex-wrap gap-3 text-[10px] text-slate-400">
            {syncInfo?.object_annotation_count !== undefined && (
              <span>Objects {syncInfo.object_annotation_count}</span>
            )}
            {syncInfo?.track_annotation_count !== undefined && (
              <span>Tracks {syncInfo.track_annotation_count}</span>
            )}
            {syncMessage && <span>{syncMessage}</span>}
          </div>
        )}
        {videoId && (
          <div className="mt-2 flex flex-wrap gap-2">
            <Button
              type="button"
              variant="outline"
              className="h-7 border-white/10 bg-transparent px-2 text-[10px] text-slate-300 hover:bg-white/5"
              onClick={() => {
                if (!videoId) return;
                window.location.href = `/annotate/${videoId}`;
              }}
            >
              Open annotation
            </Button>
            <Button
              type="button"
              variant="outline"
              className="h-7 border-white/10 bg-transparent px-2 text-[10px] text-slate-300 hover:bg-white/5"
              onClick={() => {
                eventBus.emit("openPanelRequest", { panelType: "ToolsPanel" });
                window.setTimeout(() => {
                  eventBus.emit("toolsSectionFocus", "annotation");
                }, 60);
              }}
            >
              Open tools
            </Button>
            <Button
              type="button"
              variant="outline"
              className="h-7 border-white/10 bg-transparent px-2 text-[10px] text-slate-300 hover:bg-white/5"
              onClick={() => {
                eventBus.emit("openPanelRequest", { panelType: "Transcript" });
              }}
            >
              Transcript
            </Button>
            <Button
              type="button"
              variant="outline"
              className="h-7 border-white/10 bg-transparent px-2 text-[10px] text-slate-300 hover:bg-white/5"
              onClick={() => {
                eventBus.emit("openPanelRequest", {
                  panelType: "Audio",
                  panelProps: videoId ? { videoId } : {},
                });
              }}
            >
              Audio
            </Button>
            <Button
              type="button"
              variant="outline"
              className="h-7 border-white/10 bg-transparent px-2 text-[10px] text-slate-300 hover:bg-white/5"
              onClick={() => {
                eventBus.emit("workspacePresetRequest", "annotation");
                window.setTimeout(() => {
                  eventBus.emit("videoIdChanged", videoId);
                }, 120);
              }}
            >
              Restore workspace
            </Button>
          </div>
        )}
      </div>
      )}

      {!videoId ? (
        <div className="flex flex-1 items-center justify-center text-sm text-slate-500">
          Select an analysis to load CVAT.
        </div>
      ) : isLoading ? (
        <div className="flex flex-1 items-center justify-center text-sm text-slate-500">
          Loading CVAT plugin...
        </div>
      ) : error ? (
        <div className="flex flex-1 items-center justify-center p-4 text-center text-sm text-rose-300">
          {error}
        </div>
      ) : selectedJob && metadata?.cvatID ? (
        <div className={`min-h-0 flex-1 ${compact ? "border-t border-white/8" : ""}`}>
          <CvatCanvas
            jobId={selectedJob.id}
            taskId={Number(metadata.cvatID)}
            compact={compact}
          />
        </div>
      ) : (
        <div className="flex flex-1 items-center justify-center text-sm text-slate-500">
          No CVAT job available.
        </div>
      )}
    </div>
  );
}
