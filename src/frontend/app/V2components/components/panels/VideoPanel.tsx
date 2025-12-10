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
        // Load video blob - ONLY VideoPanel handles this
        let blob = await getVideoBlob(videoId);
        if (!blob) {
          blob = await VideoService.getBlob(videoId);
        }
        
        if (blob) {
          // Clean up previous URL if exists
          if (lastObjectUrl.current) {
            URL.revokeObjectURL(lastObjectUrl.current);
            lastObjectUrl.current = null;
          }
          
          const url = URL.createObjectURL(blob);
          lastObjectUrl.current = url;
          setVideoUrl(url);
          setBlobMissing(false);
          console.log("VideoPanel: Created object URL for video blob");
        } else {
          setBlobMissing(true);
          setVideoUrl(null);
        }
      } catch (err) {
        console.error("VideoPanel: Failed to load video:", err);
        setBlobMissing(true);
        setVideoUrl(null);
      } finally {
        setIsLoading(false);
      }
    }

    load();

    // Cleanup function to revoke object URL when component unmounts or videoId changes
    return () => {
      if (lastObjectUrl.current) {
        URL.revokeObjectURL(lastObjectUrl.current);
        lastObjectUrl.current = null;
        console.log("VideoPanel: Cleaned up object URL");
      }
    };
  }, [videoId]);

  return (
    <div className="h-full flex flex-col">
      <div className="px-4 py-3 border-b border-slate-700">
        <h2 className="text-lg font-semibold text-slate-300">Video Panel</h2>
        {videoId && (
          <div className="text-sm text-slate-400 mt-1">
            Video ID: <span className="font-mono">{videoId}</span>
          </div>
        )}
      </div>

      <div className="flex-1 flex items-center justify-center bg-black m-4 rounded-lg overflow-hidden">
        {isLoading ? (
          <div className="text-slate-400">Loading video...</div>
        ) : videoUrl ? (
          <video
            key={videoUrl} // Force re-render when URL changes
            src={videoUrl}
            controls
            className="w-full h-full object-contain"
            onError={() => {
              console.error("VideoPanel: Video failed to load");
              setBlobMissing(true);
            }}
          />
        ) : blobMissing ? (
          <div className="text-slate-400 p-4 text-center">
            <div className="text-lg mb-2">Video Not Available</div>
            <div className="text-sm">The video could not be loaded.</div>
          </div>
        ) : (
          <div className="text-slate-400 p-4 text-center">
            <div className="text-lg mb-2">No Video Selected</div>
            <div className="text-sm">Select a video from the Project Panel</div>
          </div>
        )}
      </div>
    </div>
  );
}
