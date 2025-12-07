"use client";

import React, { useState } from "react";

import { VideoService } from "@/lib/video-service";

interface VideoPanelProps {
  videoId?: string | null;
}

export default function VideoPanel({ videoId }: VideoPanelProps) {
  const [libraryVideos, setLibraryVideos] = useState<any[]>([]);
  const [metadata, setMetadata] = useState<any>(null);
  const lastObjectUrl = React.useRef<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [videoUrl, setVideoUrl] = useState<string | null>(null);
  const [blobMissing, setBlobMissing] = useState<boolean>(false);
  const [analysisData, setAnalysisData] = useState<any>(null);
  const [rawCsv, setRawCsv] = useState<string | null>(null);

  React.useEffect(() => {
    async function load() {
      if (!videoId) {
        setIsLoading(false);
        return;
      }

      setIsLoading(true);

      try {
        // Load metadata
        const m = await VideoService.get(videoId);

        console.log("Loaded metadata:", m);

        setMetadata(m);

        // Load video blob (annotated video)
        const blob = await VideoService.getBlob(videoId);
        if (blob) {
          if (lastObjectUrl.current) {
            URL.revokeObjectURL(lastObjectUrl.current);
          }
          const url = URL.createObjectURL(blob);
          lastObjectUrl.current = url;

          console.log("Loaded blob for url:", url);

          setVideoUrl(url);
          setBlobMissing(false);
        } else {
          console.warn("Blob missing for videoId:", videoId);

          setBlobMissing(true);
          setVideoUrl(null);
        }

        // Load analysis data
        const analysis = await VideoService.getAnalysis(videoId);
        setAnalysisData(analysis);
        setRawCsv(analysis.rawCsv || null);
      } catch (err) {
        console.error("Failed to load data:", err);
        setBlobMissing(true);
        setVideoUrl(null);
        setAnalysisData(null);
        setRawCsv(null);
      } finally {
        setIsLoading(false);
      }
    }
    load();
  }, [videoId]);

  return (
    <main>
      <div>video Id: {videoId}</div>
      <div>video Url: {videoUrl}</div>
      <div>isLoading: {isLoading ? "true" : "false"}</div>
      <div>blobMissing: {blobMissing ? "true" : "false"}</div>
    </main>
  );
}
