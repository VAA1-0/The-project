"use client";

import { Search, MoreHorizontal, Upload, RefreshCw, FileVideo, Loader2, AlertCircle } from "lucide-react";
import { useState, useEffect } from "react";
import { VideoService } from "@/lib/video-service";
import VideoItem from "@/components/VideoItem";
import { deleteVideoBlob } from "@/lib/blob-store";
import { Button } from "@/components/ui/button";

interface ProjectPanelProps {
  onVideoSelect?: (id: string) => void;
}

export default function ProjectPanel({ onVideoSelect }: ProjectPanelProps) {
  const [libraryVideos, setLibraryVideos] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [refreshing, setRefreshing] = useState(false);
  const [selectedVideoId, setSelectedVideoId] = useState<string | null>(null);

  const loadVideos = async (showRefresh = false) => {
    if (showRefresh) {
      setRefreshing(true);
    } else {
      setLoading(true);
    }
    setError(null);
    
    try {
      const list = await VideoService.list();
      setLibraryVideos(list);
      console.log(`Loaded ${list.length} videos`);
    } catch (e) {
      console.error("Failed to load videos:", e);
      setError("Failed to load videos. Please try again.");
      setLibraryVideos([]);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => {
    loadVideos();
    
    const handler = () => loadVideos(true);
    window.addEventListener("video-uploaded", handler);
    
    return () => {
      window.removeEventListener("video-uploaded", handler);
    };
  }, []);

  // Delete a video
  const handleDeleteVideo = async (id: string) => {
    if (!confirm("Delete this video? This cannot be undone.")) return;
    
    try {
      const backup = libraryVideos.find((v) => v.id === id);
      setLibraryVideos((prev) => prev.filter((v) => v.id !== id));
      
      if (selectedVideoId === id) {
        setSelectedVideoId(null);
        onVideoSelect?.("");
      }

      try {
        await VideoService.delete(id);
      } catch (err) {
        // Rollback on failure
        console.error("Delete failed, restoring item", err);
        if (backup) {
          setLibraryVideos((prev) => [backup, ...prev]);
          if (backup.id) {
            setSelectedVideoId(backup.id);
            onVideoSelect?.(backup.id);
          }
        }
        alert("Failed to delete video: " + String(err));
        return;
      }

      // Clean up local blob
      try {
        await deleteVideoBlob(id);
      } catch (e) {
        console.warn("Failed to delete local blob", e);
      }
      
      console.log(`Deleted video: ${id}`);
    } catch (err) {
      console.error(err);
      alert("Failed to delete video: " + String(err));
    }
  };

  // Rename video
  const handleRenameVideo = async (id: string, newName: string) => {
    try {
      const orig = await VideoService.get(id);
      let finalName = newName;
      
      if (orig?.name) {
        const dot = orig.name.lastIndexOf(".");
        const origExt = dot >= 0 ? orig.name.slice(dot) : "";
        if (origExt) {
          const userDot = newName.lastIndexOf(".");
          const base = userDot >= 0 ? newName.slice(0, userDot) : newName;
          finalName = base + origExt;
        }
      }

      const prev = libraryVideos.find((v) => v.id === id)?.name;
      setLibraryVideos((prevList) =>
        prevList.map((v) =>
          v.id === id ? { ...v, name: finalName } : v
        )
      );

      try {
        await VideoService.rename(id, finalName);
      } catch (err) {
        // Rollback
        setLibraryVideos((prevList) =>
          prevList.map((v) =>
            v.id === id ? { ...v, name: prev ?? v.name } : v
          )
        );
        console.error(err);
        alert("Failed to rename video: " + String(err));
      }
    } catch (err) {
      console.error(err);
      alert("Failed to rename video: " + String(err));
    }
  };

  // Update video tag
  const handleUpdateVideoTag = async (id: string, newTag: string) => {
    try {
      const prev = libraryVideos.find((v) => v.id === id)?.tag ?? null;
      setLibraryVideos((prevList) =>
        prevList.map((v) =>
          v.id === id ? { ...v, tag: newTag } : v
        )
      );
      
      try {
        await VideoService.updateTag(id, newTag);
      } catch (err) {
        // Rollback
        setLibraryVideos((prevList) =>
          prevList.map((v) =>
            v.id === id ? { ...v, tag: prev } : v
          )
        );
        throw err;
      }
    } catch (err) {
      console.error(err);
      alert("Failed to update video tag: " + String(err));
    }
  };

  const handleVideoSelect = (id: string) => {
    setSelectedVideoId(id);
    onVideoSelect?.(id);
    console.log("Selected video ID:", id);
  };

  const handleUploadNew = () => {
    const event = new CustomEvent('trigger-upload');
    window.dispatchEvent(event);
  };

  const StatusBadge = ({ status }: { status: string }) => {
    const config = {
      completed: { color: "bg-green-500/20 text-green-300", label: "Completed" },
      processing: { color: "bg-yellow-500/20 text-yellow-300", label: "Processing" },
      uploaded: { color: "bg-blue-500/20 text-blue-300", label: "Uploaded" },
      error: { color: "bg-red-500/20 text-red-300", label: "Error" },
    };

    const cfg = config[status as keyof typeof config] || config.uploaded;
    
    return (
      <span className={`text-xs px-2 py-0.5 rounded ${cfg.color}`}>
        {cfg.label}
      </span>
    );
  };

  return (
    <div className="bg-[#232323] flex-1 flex flex-col overflow-hidden">
      {/* Header */}
      <div className="bg-[#1a1a1a] px-3 py-2 border-b border-[#0a0a0a] flex items-center justify-between">
        <span className="text-[#b8b8b8] text-[12px]">Project</span>
        <div className="flex items-center gap-1">
          <button 
            onClick={() => loadVideos(true)}
            disabled={refreshing}
            className="p-1 hover:bg-[#2a2a2a] rounded disabled:opacity-50"
            title="Refresh"
          >
            {refreshing ? (
              <Loader2 className="size-3.5 text-[#b8b8b8] animate-spin" />
            ) : (
              <RefreshCw className="size-3.5 text-[#b8b8b8]" />
            )}
          </button>
          <button 
            onClick={handleUploadNew}
            className="p-1 hover:bg-[#2a2a2a] rounded"
            title="Upload new video"
          >
            <Upload className="size-3.5 text-[#b8b8b8]" />
          </button>
          <button className="p-1 hover:bg-[#2a2a2a] rounded">
            <Search className="size-3.5 text-[#b8b8b8]" />
          </button>
          <button className="p-1 hover:bg-[#2a2a2a] rounded">
            <MoreHorizontal className="size-3.5 text-[#b8b8b8]" />
          </button>
        </div>
      </div>
      
      {/* Column headers */}
      <div className="px-2 py-1.5 border-b border-[#1a1a1a] flex items-center text-[10px] text-[#6a6a6a] bg-[#1e1e1e]">
        <span className="flex-1">Name</span>
        <span className="text-[9px] w-20 text-center">Status</span>
        <span className="text-[9px] w-12 text-right">Actions</span>
      </div>

      {/* Content area */}
      <div className="flex-1 overflow-y-auto">
        {loading ? (
          <div className="flex flex-col items-center justify-center h-64">
            <Loader2 className="size-8 text-slate-400 animate-spin mb-4" />
            <div className="text-slate-400">Loading videos...</div>
          </div>
        ) : error ? (
          <div className="flex flex-col items-center justify-center h-64 p-4">
            <AlertCircle className="size-12 text-red-400 mb-4" />
            <div className="text-slate-300 text-center mb-2">{error}</div>
            <Button
              variant="outline"
              onClick={() => loadVideos(true)}
              className="mt-2"
            >
              <RefreshCw className="size-4 mr-2" />
              Try Again
            </Button>
          </div>
        ) : libraryVideos.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-64 p-4">
            <FileVideo className="size-16 text-slate-400 mb-4" />
            <div className="text-slate-300 text-lg mb-2">No Videos</div>
            <div className="text-slate-500 text-sm text-center mb-4">
              Upload your first video to get started
            </div>
            <Button
              onClick={handleUploadNew}
              className="bg-blue-600 hover:bg-blue-700"
            >
              <Upload className="size-4 mr-2" />
              Upload Video
            </Button>
          </div>
        ) : (
          <div className="space-y-1 p-2">
            <div className="text-xs text-slate-500 mb-2 px-2">
              {libraryVideos.length} video{libraryVideos.length !== 1 ? 's' : ''}
            </div>
            
            {libraryVideos.map((vid: any) => (
              <div
                key={vid.id}
                className={`p-3 rounded-md flex items-center justify-between cursor-pointer transition-colors ${
                  selectedVideoId === vid.id
                    ? 'bg-blue-900/30 border border-blue-700/50'
                    : 'bg-slate-900/30 hover:bg-slate-900/50'
                }`}
                onClick={() => handleVideoSelect(vid.id)}
              >
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <FileVideo className="size-4 text-slate-400 flex-shrink-0" />
                    <div className="font-medium text-slate-200 truncate">
                      {vid.name}
                    </div>
                  </div>
                  <div className="text-xs text-slate-400 mt-1">
                    ID: <span className="font-mono">{vid.id.substring(0, 8)}...</span>
                    {vid.cvatID && (
                      <span className="ml-2">CVAT: {vid.cvatID}</span>
                    )}
                  </div>
                </div>

                <div className="w-20 flex justify-center">
                  <StatusBadge status={vid.status} />
                </div>

                <div className="w-12 flex justify-end">
                  <VideoItem
                    vid={vid}
                    onView={() => handleVideoSelect(vid.id)}
                    onDelete={handleDeleteVideo}
                    onRename={handleRenameVideo}
                    onUpdateTag={handleUpdateVideoTag}
                  />
                </div>
              </div>
            ))}
          </div>
        )}

        {/* Debug info */}
        {process.env.NODE_ENV === 'development' && libraryVideos.length > 0 && (
          <div className="p-2 border-t border-slate-800">
            <div className="text-xs text-slate-500">
              Backend: {process.env.NEXT_PUBLIC_API_URL || 'localhost:8000'}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
