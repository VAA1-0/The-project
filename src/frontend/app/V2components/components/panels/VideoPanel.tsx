"use client";

import React, { useState } from "react";

import { VideoService } from "@/lib/video-service";
import { getVideoBlob } from "@/lib/blob-store";

interface VideoPanelProps {
  videoId?: string | null;
}

export default function VideoPanel({ videoId }: VideoPanelProps) {
  const lastObjectUrl = React.useRef<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [videoUrl, setVideoUrl] = useState<string | null>(null);
  const [blobMissing, setBlobMissing] = useState<boolean>(false);

  React.useEffect(() => {
    async function load() {
      if (!videoId) {
        setIsLoading(false);
        return;
      }

      setIsLoading(true);

      try {
        // Load video blob - hybrid approach
        // 1. First try to get the original video from IndexedDB (instant preview)
        let blob = await getVideoBlob(videoId);

        if (!blob) {
          // 2. Fallback: try to get the annotated video from the backend (after analysis completes)
          blob = await VideoService.getBlob(videoId);
        }
        if (blob) {
          if (lastObjectUrl.current) {
            URL.revokeObjectURL(lastObjectUrl.current);
          }
          const url = URL.createObjectURL(blob);
          lastObjectUrl.current = url;
          setVideoUrl(url);
          setBlobMissing(false);
        } else {
          setBlobMissing(true);
          setVideoUrl(null);
        }
      } catch (err) {
        console.error("Failed to load data:", err);
        setBlobMissing(true);
        setVideoUrl(null);
      } finally {
        setIsLoading(false);
      }
    }
    load();
  }, [videoId]);

  return (
    <main className="flex-0 overflow-auto">
      <div>video Id: {videoId}</div>
      <div>video Url: {videoUrl}</div>
      <div>isLoading: {isLoading ? "true" : "false"}</div>
      <div>blobMissing: {blobMissing ? "true" : "false"}</div>
      <div className="h-[350px] flex items-center justify-center bg-black rounded-t-lg">
        {videoUrl ? (
          <video
            src={videoUrl}
            controls
            className="w-full h-full object-contain rounded-lg"
          />
        ) : blobMissing ? (
          <div className="text-slate-400">
            Video blob not found — please re-upload the video.
          </div>
        ) : (
          <div className="text-slate-400">No video selected...</div>
        )}
      </div>
    </main>
  );
}
