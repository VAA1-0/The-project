// src/frontend/app/V2components/components/PanelManager.tsx
"use client";

import { useState } from "react";
import ProjectPanel from "./panels/ProjectPanel";
import VideoPanel from "./panels/VideoPanel";
import ToolsPanel from "./panels/ToolsPanel";
import SpeechToTextPanel from "./panels/SpeechToTextPanel";
import DownloadPanel from "./panels/DownloadPanel";

export default function PanelManager() {
  const [selectedVideoId, setSelectedVideoId] = useState<string | null>(null);

  const handleVideoSelect = (id: string) => {
    setSelectedVideoId(id);
  };

  return (
    <div className="flex-1 flex overflow-hidden">
      {/* Left sidebar - Project Panel */}
      <div className="w-80 border-r border-slate-700 flex flex-col">
        <div className="h-1/2">
          <ProjectPanel onVideoSelect={handleVideoSelect} />
        </div>
        <div className="h-1/2 border-t border-slate-700">
          <DownloadPanel videoId={selectedVideoId} />
        </div>
      </div>

      {/* Middle - Video and Tools Panels */}
      <div className="flex-1 flex flex-col">
        {/* Top - Video Panel */}
        <div className="h-96 border-b border-slate-700">
          <VideoPanel videoId={selectedVideoId} />
        </div>

        {/* Bottom - Tools Panel */}
        <div className="flex-1">
          <ToolsPanel videoId={selectedVideoId} />
        </div>
      </div>

      {/* Right sidebar - Speech Panel */}
      <div className="w-96 border-l border-slate-700 flex flex-col">
        <div className="flex-1 overflow-auto">
          <SpeechToTextPanel videoId={selectedVideoId} />
        </div>
      </div>
    </div>
  );
}
