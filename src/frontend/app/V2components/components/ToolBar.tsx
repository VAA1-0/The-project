"use client";

import {
  Home,
  Save,
  Scissors,
  Copy,
  Folder,
  FileVideo,
  Search,
  Play,
  Pause,
  SkipForward,
  SkipBack,
  Upload,
} from "lucide-react";

<<<<<<< HEAD
import { useState } from "react";
import { VideoService } from "@/lib/video-service";
import { createVideoTask, getCvatHealth, listJobs } from "@/cvat-api/client";

export function Toolbar() {
  const [file, setFile] = useState<File | null>(null);
  const [files, setFiles] = useState<File[] | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);
  const [tab, setTab] = useState<"upload" | "library">("upload");
  const [libraryVideos, setLibraryVideos] = useState<any[]>([]);

  // Upload handler (frontend-only): persist blob to IndexedDB and metadata to local Library
  const handleUpload = async () => {
    const selected = files || (file ? ([file] as any) : null);
    if (!selected || selected.length === 0)
      return alert("Select a video first");
    setUploading(true);
    let cvatID = null;
    try {
      //=========Upload to CVAT==================

      for (const video of selected) {
        let taskName = `Task-${Date.now()}`;
        console.log("🎬 Creating video task...");
        let result = await createVideoTask(taskName, video);
        cvatID = result.taskId;
        alert(cvatID);
        alert(`✅ Task created successfully!\nTask ID: ${result.taskId}`);
      }
      //<=============================================>
      try {
        const arr = Array.from(selected as any) as File[];
        for (const f of arr) {
          // compute actual duration (in seconds) from the file
          const length = await getVideoDuration(f);
          // use VideoService to upload (saves blob + metadata)
          const res = await VideoService.upload(f, cvatID, length);
          console.log(res);
        }

        // refresh local view
        const list = await VideoService.list();
        setLibraryVideos(list);
        setFiles(null);
        setFile(null);
        setPreviewUrl(null);
        alert("Upload successful (saved in browser storage)");
      } catch (err) {
        console.error(err);
        alert("Upload failed: " + ((err as any)?.message ?? String(err)));
      }
    } catch (err) {
      console.log("Video uploading to CVAT failed. Try again!");
      alert("Upload failed: " + ((err as any)?.message ?? String(err)));
    } finally {
      setUploading(false);
    }
  };

  // Read duration (in seconds) from a video File using a temporary HTMLVideoElement
  async function getVideoDuration(file: File): Promise<number> {
    return new Promise((resolve) => {
      try {
        const url = URL.createObjectURL(file);
        const v = document.createElement("video");
        v.preload = "metadata";
        v.src = url;
        v.onloadedmetadata = () => {
          URL.revokeObjectURL(url);
          const d = v.duration;
          resolve(Number.isFinite(d) ? Math.round(d) : 0);
        };
        v.onerror = () => {
          URL.revokeObjectURL(url);
          resolve(0);
        };
      } catch (e) {
        resolve(0);
      }
    });
  }

  return (
    <div className="bg-[#2a2a2a] h-12 flex items-center px-3 gap-1 border-b border-[#1a1a1a]">
      <div className="w-px h-6 bg-[#1a1a1a] mx-1" />
      <button
        className="p-2 hover:bg-[#3a3a3a] transition-colors text-[#b8b8b8]"
        title="Upload Video"
        onClick={() => handleUpload()}
      >
        <Upload className="size-4" />
      </button>
      <div className="w-px h-6 bg-[#1a1a1a] mx-1" />
=======
export function Toolbar() {
  return (
    <div className="bg-[#2a2a2a] h-[48px] flex items-center px-3 gap-1 border-b border-[#1a1a1a]">
      <button className="p-2 hover:bg-[#3a3a3a] transition-colors text-[#b8b8b8]">
        <Home className="size-4" />
      </button>
      <button className="p-2 hover:bg-[#3a3a3a] transition-colors text-[#b8b8b8]">
        <Save className="size-4" />
      </button>
      <div className="w-px h-6 bg-[#1a1a1a] mx-1" />
      <button className="p-2 hover:bg-[#3a3a3a] transition-colors text-[#b8b8b8]">
        <Scissors className="size-4" />
      </button>
      <button className="p-2 hover:bg-[#3a3a3a] transition-colors text-[#b8b8b8]">
        <Copy className="size-4" />
      </button>
      <div className="w-px h-6 bg-[#1a1a1a] mx-1" />
      <button className="p-2 hover:bg-[#3a3a3a] transition-colors text-[#b8b8b8]">
        <Folder className="size-4" />
      </button>
      <button className="p-2 hover:bg-[#3a3a3a] transition-colors text-[#b8b8b8]">
        <FileVideo className="size-4" />
      </button>
>>>>>>> 2e2d0f4e0810f1746ac9f8098bfb210d2aef5040
      <div className="flex-1" />
      <div className="flex items-center gap-2 bg-[#1a1a1a] px-3 py-1.5 rounded border border-[#0a0a0a]">
        <Search className="size-3.5 text-[#6a6a6a]" />
        <input
          type="text"
          placeholder="Search"
          className="bg-transparent border-none outline-none text-[#b8b8b8] text-[12px] w-40 placeholder:text-[#6a6a6a]"
        />
      </div>
    </div>
  );
}
