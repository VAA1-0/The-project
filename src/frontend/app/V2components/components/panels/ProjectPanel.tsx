import {
  File,
  Folder,
  ChevronRight,
  ChevronDown,
  Search,
  List,
  Grid3x3,
  MoreHorizontal,
} from "lucide-react";

import { useState } from "react";

export default function PanelA() {
  const [file, setFile] = useState<File | null>(null);
  const [files, setFiles] = useState<File[] | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);
  const [tab, setTab] = useState<"upload" | "library">("upload");
  const [libraryVideos, setLibraryVideos] = useState<any[]>([]);

  return (
    <div className="bg-[#232323] flex-1 flex flex-col overflow-hidden">
      <div className="bg-[#1a1a1a] px-3 py-2 border-b border-[#0a0a0a] flex items-center justify-between">
        <span className="text-[#b8b8b8] text-[12px]">Project</span>
        <div className="flex items-center gap-1">
          <button className="p-1 hover:bg-[#2a2a2a] rounded">
            <Search className="size-3.5 text-[#b8b8b8]" />
          </button>
          <button className="p-1 hover:bg-[#2a2a2a] rounded">
            <MoreHorizontal className="size-3.5 text-[#b8b8b8]" />
          </button>
        </div>
      </div>
      <div className="px-2 py-1.5 border-b border-[#1a1a1a] flex items-center text-[10px] text-[#6a6a6a] bg-[#1e1e1e]">
        <span className="flex-1">Name</span>
        <span className="text-[9px]">Media End</span>
      </div>
      <div className="flex-1 overflow-y-auto">
        {/* Video list */}
        <div className="space-y-2">
          {/* Real mapped videos */}
          {libraryVideos.length === 0 && (
            <div className="text-sm text-slate-400 p-3">
              No videos uploaded yet.
            </div>
          )}

          {libraryVideos.map((vid: any) => (
            <div
              key={vid.id}
              className="p-3 bg-slate-900/30 rounded-md flex items-center justify-between"
            >
              <div>
                <div className="font-medium">{vid.name}</div>
                <div className="text-xs text-slate-400">
                  {vid.analysis ? "Analyzed" : "Uploaded"}
                  {vid.status === "pending" && (
                    <span className="ml-2 text-yellow-300">• Pending</span>
                  )}
                  {vid.status === "synced" && (
                    <span className="ml-2 text-emerald-300">• Synced</span>
                  )}
                  {vid.status === "failed" && (
                    <span className="ml-2 text-red-400">• Failed</span>
                  )}
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
