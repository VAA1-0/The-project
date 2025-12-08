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

import { useState, useEffect } from "react";
import { VideoService } from "@/lib/video-service";
import VideoItem from "@/components/VideoItem";
import { saveVideoBlob, deleteVideoBlob } from "@/lib/blob-store";

interface ProjectPanelProps {
  onVideoSelect?: (id: string) => void;
}

export default function ProjectPanel({ onVideoSelect }: ProjectPanelProps) {
  const [libraryVideos, setLibraryVideos] = useState<any[]>([]);
  const [metadata, setMetadata] = useState<any>(null);

  useEffect(() => {
    // Load persisted library metadata via VideoService
    let mounted = true;
    (async () => {
      try {
        const list = await VideoService.list();
        if (mounted) setLibraryVideos(list);
      } catch (e) {
        if (mounted) setLibraryVideos([]);
      }
    })();
    return () => {
      mounted = false;
    };
  }, []);

  // Delete a video: remove blob from IndexedDB and metadata from Library
  const handleDeleteVideo = async (id: string) => {
    if (!confirm("Delete this video? This cannot be undone.")) return;
    try {
      // Optimistic: remove from UI immediately and keep a backup for rollback
      const backup = libraryVideos.find((v) => v.id === id);
      setLibraryVideos((prev) => prev.filter((v) => v.id !== id));

      try {
        await VideoService.delete(id);
      } catch (err) {
        // rollback on failure
        console.error("Delete failed, restoring item", err);
        if (backup) setLibraryVideos((prev) => [backup, ...(prev || [])]);
        alert("Failed to delete video: " + String(err));
        return;
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
          v.id === id ? { ...v, name: finalName, status: "pending" } : v
        )
      );
      try {
        await VideoService.rename(id, finalName);
        setLibraryVideos((prevList) =>
          prevList.map((v) => (v.id === id ? { ...v, status: "synced" } : v))
        );
      } catch (err) {
        // rollback
        setLibraryVideos((prevList) =>
          prevList.map((v) =>
            v.id === id ? { ...v, name: prev ?? v.name, status: "failed" } : v
          )
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
          v.id === id ? { ...v, tag: newTag, status: "pending" } : v
        )
      );
      try {
        await VideoService.updateTag(id, newTag);
        setLibraryVideos((prevList) =>
          prevList.map((v) => (v.id === id ? { ...v, status: "synced" } : v))
        );
      } catch (err) {
        // rollback
        setLibraryVideos((prevList) =>
          prevList.map((v) =>
            v.id === id ? { ...v, tag: prev, status: "failed" } : v
          )
        );
        throw err;
      }
    } catch (err) {
      console.error(err);
      alert("Failed to update video tag: " + String(err));
    }
  };

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
              className="p-3 bg-slate-900/30 rounded-md flex items-center justify-between cursor-pointer hover:bg-slate-900/50"
              onClick={() => {
                onVideoSelect?.(vid.id);
                console.log("Selected video ID:", vid.id);
              }}
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

              <div className="flex gap-2">
                <VideoItem
                  vid={vid}
                  onView={() => {}}
                  onDelete={handleDeleteVideo}
                  onRename={handleRenameVideo}
                  onUpdateTag={handleUpdateVideoTag}
                />
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
