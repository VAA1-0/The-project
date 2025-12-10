"use client";

import { useState } from "react";
import ProjectPanel from "./panels/ProjectPanel";
import VideoPanel from "./panels/VideoPanel";
import ToolsPanel from "./panels/ToolsPanel";
import SpeechToTextPanel from "./panels/SpeechToTextPanel";
import DownloadPanel from "./panels/DownloadPanel";
import { panelStateManager } from "@/lib/panel-state-manager";

export default function PanelManager() {
  const [selectedVideoId, setSelectedVideoId] = useState<string | null>(null);

  // Handle video selection from ProjectPanel
  const handleVideoSelect = (videoId: string) => {
    setSelectedVideoId(videoId);
    panelStateManager.setVideoId(videoId);
  };

  return (
    <div className="flex-1 flex overflow-hidden">
      {/* Left sidebar - Project Panel */}
      <div className="w-80 border-r border-slate-700">
        <ProjectPanel onVideoSelect={handleVideoSelect} />
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

      {/* Right sidebar - Content Panels */}
      <div className="w-96 border-l border-slate-700 flex flex-col">
        {/* Tab selector */}
        <div className="flex border-b border-slate-700">
          <button className="flex-1 py-2 px-4 text-sm font-medium text-slate-300 hover:bg-slate-800 border-r border-slate-700">
            Speech to Text
          </button>
          <button className="flex-1 py-2 px-4 text-sm font-medium text-slate-300 hover:bg-slate-800 bg-slate-800">
            Download Results
          </button>
        </div>

        {/* Content area - Always show DownloadPanel */}
        <div className="flex-1 overflow-auto">
          <DownloadPanel videoId={selectedVideoId} />
        </div>
      </div>
    </div>
  );
}