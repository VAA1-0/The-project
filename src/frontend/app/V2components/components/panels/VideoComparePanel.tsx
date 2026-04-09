"use client";

import React, { useEffect, useMemo, useRef, useState } from "react";
import { eventBus } from "@/lib/golden-layout-lib/eventBus";
import { VideoService, type VideoMetadata } from "@/lib/video-service";
import { getVideoBlob } from "@/lib/blob-store";

const VIDEO_COMPARE_VIEW_KEY = "vaa1.video.compare-view";

type CompareSide = {
  videoId: string;
  name: string;
  time: number;
};

type CompareSelection = {
  left: CompareSide;
  right: CompareSide;
};

type LoadedSide = CompareSide & {
  metadata: VideoMetadata | null;
  videoUrl: string | null;
  blobMissing: boolean;
};

function formatTime(value: number): string {
  if (!Number.isFinite(value) || value < 0) {
    return "0:00";
  }
  const minutes = Math.floor(value / 60);
  const seconds = Math.floor(value % 60);
  return `${minutes}:${String(seconds).padStart(2, "0")}`;
}

async function loadCompareSide(side: CompareSide): Promise<LoadedSide> {
  const metadata = await VideoService.get(side.videoId);
  let blob = await getVideoBlob(side.videoId);
  if (!blob) {
    blob = await VideoService.getBlob(side.videoId);
  }

  return {
    ...side,
    metadata,
    videoUrl: blob ? URL.createObjectURL(blob) : null,
    blobMissing: !blob,
  };
}

function CompareVideo({
  label,
  side,
  videoRef,
  onVideoReady,
}: {
  label: string;
  side: LoadedSide | null;
  videoRef: React.RefObject<HTMLVideoElement | null>;
  onVideoReady: () => void;
}) {
  return (
    <div className="flex min-h-0 flex-1 flex-col rounded-lg border border-slate-800 bg-[#141414]">
      <div className="border-b border-slate-800 px-3 py-2">
        <div className="text-[10px] uppercase tracking-[0.14em] text-[var(--ui-passive-text)]">
          {label}
        </div>
        <div
          className="mt-1 truncate text-sm text-[var(--ui-passive-text)]"
          title={side?.name || "No source selected"}
        >
          {side?.name || "No source selected"}
        </div>
        {side && (
          <div className="mt-1 text-[11px] text-[var(--ui-passive-text)]">
            Ref {formatTime(side.time)}
            {side.metadata?.status ? ` • ${side.metadata.status}` : ""}
          </div>
        )}
      </div>

      <div className="flex min-h-0 flex-1 items-center justify-center bg-black">
        {!side ? (
          <div className="text-sm text-[var(--ui-passive-text)]">
            No source selected
          </div>
        ) : side.videoUrl ? (
          <video
            ref={videoRef}
            src={side.videoUrl}
            controls
            className="h-full w-full object-contain"
            onLoadedMetadata={onVideoReady}
          />
        ) : (
          <div className="p-4 text-center text-sm text-[var(--ui-passive-text)]">
            Video preview unavailable for this source.
          </div>
        )}
      </div>
    </div>
  );
}

export default function VideoComparePanel() {
  const [selection, setSelection] = useState<CompareSelection | null>(null);
  const [leftSide, setLeftSide] = useState<LoadedSide | null>(null);
  const [rightSide, setRightSide] = useState<LoadedSide | null>(null);
  const [linkedPlayback, setLinkedPlayback] = useState(true);
  const [isLoading, setIsLoading] = useState(false);
  const leftVideoRef = useRef<HTMLVideoElement | null>(null);
  const rightVideoRef = useRef<HTMLVideoElement | null>(null);
  const syncLockRef = useRef(false);

  useEffect(() => {
    const loadSelection = (incoming?: CompareSelection | null) => {
      if (incoming) {
        setSelection(incoming);
        return;
      }
      try {
        const raw = localStorage.getItem(VIDEO_COMPARE_VIEW_KEY);
        setSelection(raw ? JSON.parse(raw) : null);
      } catch {
        setSelection(null);
      }
    };

    loadSelection();
    const handler = (payload: CompareSelection) => loadSelection(payload);
    eventBus.on("videoCompareSelectionChanged", handler);
    return () => {
      eventBus.off("videoCompareSelectionChanged", handler);
    };
  }, []);

  useEffect(() => {
    let cancelled = false;

    async function load() {
      if (!selection?.left || !selection?.right) {
        setLeftSide(null);
        setRightSide(null);
        return;
      }

      setIsLoading(true);
      try {
        const [left, right] = await Promise.all([
          loadCompareSide(selection.left),
          loadCompareSide(selection.right),
        ]);
        if (!cancelled) {
          setLeftSide(left);
          setRightSide(right);
        } else {
          if (left.videoUrl) URL.revokeObjectURL(left.videoUrl);
          if (right.videoUrl) URL.revokeObjectURL(right.videoUrl);
        }
      } catch (error) {
        console.error("VideoComparePanel: Failed to load compare sources", error);
        if (!cancelled) {
          setLeftSide(null);
          setRightSide(null);
        }
      } finally {
        if (!cancelled) {
          setIsLoading(false);
        }
      }
    }

    void load();

    return () => {
      cancelled = true;
      setLeftSide((previous) => {
        if (previous?.videoUrl) URL.revokeObjectURL(previous.videoUrl);
        return null;
      });
      setRightSide((previous) => {
        if (previous?.videoUrl) URL.revokeObjectURL(previous.videoUrl);
        return null;
      });
    };
  }, [selection]);

  const anchorOffset = useMemo(() => {
    if (!selection) {
      return 0;
    }
    return selection.right.time - selection.left.time;
  }, [selection]);

  const syncToReferences = () => {
    if (!selection) {
      return;
    }
    if (leftVideoRef.current) {
      leftVideoRef.current.currentTime = selection.left.time;
    }
    if (rightVideoRef.current) {
      rightVideoRef.current.currentTime = selection.right.time;
    }
  };

  const syncFromSide = (source: "left" | "right") => {
    if (!linkedPlayback || syncLockRef.current || !leftVideoRef.current || !rightVideoRef.current) {
      return;
    }

    syncLockRef.current = true;
    if (source === "left") {
      const nextRightTime = Math.max(
        0,
        leftVideoRef.current.currentTime + anchorOffset,
      );
      rightVideoRef.current.currentTime = nextRightTime;
    } else {
      const nextLeftTime = Math.max(
        0,
        rightVideoRef.current.currentTime - anchorOffset,
      );
      leftVideoRef.current.currentTime = nextLeftTime;
    }
    window.setTimeout(() => {
      syncLockRef.current = false;
    }, 0);
  };

  const mirrorPlaybackState = (source: "left" | "right", action: "play" | "pause") => {
    if (!linkedPlayback || syncLockRef.current || !leftVideoRef.current || !rightVideoRef.current) {
      return;
    }

    syncLockRef.current = true;
    const target = source === "left" ? rightVideoRef.current : leftVideoRef.current;
    if (action === "play") {
      void target.play().catch(() => {});
    } else {
      target.pause();
    }
    window.setTimeout(() => {
      syncLockRef.current = false;
    }, 0);
  };

  useEffect(() => {
    const left = leftVideoRef.current;
    const right = rightVideoRef.current;
    if (!left || !right) {
      return;
    }

    const handleLeftTime = () => syncFromSide("left");
    const handleRightTime = () => syncFromSide("right");
    const handleLeftPlay = () => mirrorPlaybackState("left", "play");
    const handleRightPlay = () => mirrorPlaybackState("right", "play");
    const handleLeftPause = () => mirrorPlaybackState("left", "pause");
    const handleRightPause = () => mirrorPlaybackState("right", "pause");

    left.addEventListener("seeked", handleLeftTime);
    right.addEventListener("seeked", handleRightTime);
    left.addEventListener("play", handleLeftPlay);
    right.addEventListener("play", handleRightPlay);
    left.addEventListener("pause", handleLeftPause);
    right.addEventListener("pause", handleRightPause);

    return () => {
      left.removeEventListener("seeked", handleLeftTime);
      right.removeEventListener("seeked", handleRightTime);
      left.removeEventListener("play", handleLeftPlay);
      right.removeEventListener("play", handleRightPlay);
      left.removeEventListener("pause", handleLeftPause);
      right.removeEventListener("pause", handleRightPause);
    };
  }, [anchorOffset, linkedPlayback, leftSide?.videoUrl, rightSide?.videoUrl]);

  return (
    <main className="flex h-full flex-col bg-[#111111]">
      <div className="border-b border-slate-800 px-4 py-3">
        <div className="text-[11px] uppercase tracking-[0.16em] text-[var(--ui-passive-text)]">
          Video compare
        </div>
        <div className="mt-1 text-[11px] text-[var(--ui-passive-text)]">
          Compare two sources side by side using saved anchor times.
        </div>
      </div>

      <div className="border-b border-slate-800 px-4 py-2">
        <div className="flex flex-wrap items-center gap-2 text-[10px] text-[var(--ui-passive-text)]">
          <button
            type="button"
            className="rounded border border-slate-800 px-2 py-1 hover:bg-slate-800/40 hover:text-slate-300"
            onClick={syncToReferences}
            disabled={!selection}
          >
            Sync to references
          </button>
          <button
            type="button"
            className={`rounded border px-2 py-1 ${
              linkedPlayback
                ? "border-slate-600 bg-slate-800/80 text-slate-200"
                : "border-slate-800 text-[var(--ui-passive-text)] hover:bg-slate-800/40 hover:text-slate-300"
            }`}
            onClick={() => setLinkedPlayback((value) => !value)}
          >
            {linkedPlayback ? "Linked playback on" : "Linked playback off"}
          </button>
          {selection && (
            <span>
              Offset {selection.left.name} → {selection.right.name}: {formatTime(Math.abs(anchorOffset))}
            </span>
          )}
        </div>
      </div>

      <div className="flex-1 min-h-0 p-4">
        {isLoading ? (
          <div className="flex h-full items-center justify-center text-[var(--ui-passive-text)]">
            Loading compare sources...
          </div>
        ) : !selection ? (
          <div className="flex h-full items-center justify-center text-[var(--ui-passive-text)]">
            No compare selection yet. Set a compare anchor in Video Panel, then open another source and choose Open Compare View.
          </div>
        ) : (
          <div className="grid h-full min-h-0 grid-cols-2 gap-4">
            <CompareVideo
              label="Reference source"
              side={leftSide}
              videoRef={leftVideoRef}
              onVideoReady={syncToReferences}
            />
            <CompareVideo
              label="Current source"
              side={rightSide}
              videoRef={rightVideoRef}
              onVideoReady={syncToReferences}
            />
          </div>
        )}
      </div>
    </main>
  );
}
