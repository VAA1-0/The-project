"use client"; // ⚠️ This component uses client-side hooks, review it

// Not the exact same as Figma, needs some refactoring later

import { useRouter } from "next/navigation";
import React, { use, useCallback, useEffect, useState } from "react";
import { Button } from "./ui/button";
import { Input } from "./ui/input";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "./ui/card";
import { Separator } from "./ui/separator";
import { VideoService } from "@/lib/video-service";
import VideoItem from "./VideoItem";
import { saveVideoBlob, deleteVideoBlob } from "@/lib/blob-store";
import { AnalyzeResultsPanel } from "./AnalyzeResultsPanel";
import { createVideoTask, getCvatHealth, listJobs } from "@/cvat-api/client";
import AnalyzePageV2 from "@/app/V2components/components/AnalyzePageV2";

export const Dashboard: React.FC = () => {
  const router = useRouter();
  const [file, setFile] = useState<File | null>(null);
  const [files, setFiles] = useState<File[] | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);
  const [tab, setTab] = useState<"upload" | "library">("upload");
  const [libraryVideos, setLibraryVideos] = useState<any[]>([]);

  // Per-item edit UI is handled inside `VideoItem` now.

  const [searchString, setSearchString] = useState<string>("");

  /*const [isLoggedIn, setIsLoggedIn] = useState(false);

  //<===============CVAT HEALTH CHECK==========>
  useEffect(() => {
    console.log("Health Check!");
    getCvatHealth()
      .then(health => {
        if (health.ok && health.tokenValid) {
          console.log("✅ Already authenticated");
          setIsLoggedIn(true);
        }
      })
      .catch(err => {
        console.warn("Health check failed:", err);
      });
  }, []);

  //<================================================>*/

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

  useEffect(() => {
    // Filter library videos based on search string (query backend/local list each time)
    let mounted = true;
    (async () => {
      try {
        const all = await VideoService.list();
        if (!mounted) return;
        if (searchString.trim() === "") {
          setLibraryVideos(all as any[]);
          return;
        }
        const filtered = (all as any[]).filter(
          (v: any) =>
            v.name.toLowerCase().includes(searchString.toLowerCase()) ||
            (v.tag && v.tag.toLowerCase().includes(searchString.toLowerCase()))
        );
        setLibraryVideos(filtered);
      } catch (e) {
        if (mounted) setLibraryVideos([]);
      }
    })();
    return () => {
      mounted = false;
    };
  }, [searchString]);

  // Handle search input change
  const handleSearchChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setSearchString(e.target.value);
  };

  // Callback when files are selected
  const onFilesSelected = useCallback((f: FileList | null) => {
    setFiles(f ? Array.from(f) : null);
  }, []);

  // Handle file input change
  const handleFileInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const selected = e.target.files;
    if (!selected || selected.length === 0) return;

    setFiles((prev) => {
      const arr = prev ? prev : [];
      return [...arr, ...Array.from(selected)];
    });
  };

  // Handle file drop
  const handleDrop = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    onFilesSelected(e.dataTransfer.files);
  };

  // Prevent default behavior for drag over
  const handleDragOver = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
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

  // Upload handler (frontend-only): persist blob to IndexedDB and metadata to local Library
  const handleUpload = async () => {
    const selected = files || (file ? ([file] as any) : null);
    if (!selected || selected.length === 0)
      return alert("Select a video first");
    setUploading(true);
    let cvatID = null;
    try {
      //=========Upload to CVAT==================
        
      console.log("Uploading to CVAT");
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
          const res = await VideoService.upload(f, 1, length);
          console.log(res);

          // Store the original video blob in IndexedDB for instant preview on analyze page
          try {
            const videoBlob = new Blob([f], { type: f.type });
            await saveVideoBlob(res.analysis_id, videoBlob);
            console.log(
              `Saved original video blob to IndexedDB for ${res.analysis_id}`
            );
          } catch (storageErr) {
            console.warn(
              "Failed to save video to IndexedDB (preview may be unavailable):",
              storageErr
            );
          }
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

  // Navigate to analyze results page, later navigates to specific video analysis with file ID/name
  const handleView = async (id?: string) => {
    // Use an absolute path so navigation isn't resolved relative to the current route.
    // Also encode the id to be safe for URLs and handle missing id gracefully.
    const base = "/dashboard/analyze-results";
    const target = id ? `${base}/${encodeURIComponent(id)}` : base;
    await router.push(target);
  };

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
    <div className="min-h-screen bg-linear-to-br from-slate-900 via-slate-800 to-slate-900 text-slate-100">
      {/* Main Container */}
      <main className="max-w-7xl mx-auto px-6 py-10 flex flex-col items-center">
        <section className="w-full space-y-8">
          {/* Toggle buttons */}
          <div className="flex">
            <div className="inline-flex rounded-md overflow-hidden border border-slate-700">
              <Button
                onClick={() => setTab("upload")}
                variant="ghost"
                className={`cursor-pointer px-6 py-2 rounded-none ${
                  tab === "upload" ? "bg-slate-700" : ""
                }`}
              >
                Upload Video
              </Button>

              <Button
                onClick={() => setTab("library")}
                variant="ghost"
                className={`cursor-pointer px-6 py-2 rounded-none ${
                  tab === "library" ? "bg-slate-700" : ""
                }`}
              >
                Video Library
              </Button>
            </div>
          </div>

          {/* Conditional content */}
          {tab === "upload" && (
            <Card className="bg-slate-800/50 border-slate-700 w-full">
              <CardHeader>
                <CardTitle>Upload New Video</CardTitle>
                <CardDescription>
                  Upload your video to get AI-powered analysis and insights.
                </CardDescription>
              </CardHeader>

              <CardContent>
                <div
                  onDrop={handleDrop}
                  onDragOver={handleDragOver}
                  className="border-2 border-dashed border-slate-700 rounded-xl p-8 flex flex-col items-center justify-center gap-4 bg-slate-900/20"
                >
                  <div className="flex items-center gap-4">
                    <div className="p-3 rounded-lg bg-blue-600/20">
                      <svg
                        className="w-8 h-8 text-blue-400"
                        viewBox="0 0 24 24"
                        fill="none"
                      >
                        <path d="M5 3v18l15-9L5 3z" fill="currentColor" />
                      </svg>
                    </div>

                    <div className="text-center">
                      <div className="text-white font-medium">
                        Drop your video here or click to browse
                      </div>
                      <div className="text-sm text-slate-400">
                        Supports MP4, MOV, AVI, WebM up to 500MB
                      </div>
                    </div>
                  </div>

                  <div className="flex flex-col sm:flex-row gap-3 mt-3">
                    <label className="cursor-pointer">
                      {/* Hidden file input */}
                      <input
                        id="videoUpload"
                        type="file"
                        accept="video/mp4, video/mov, video/avi, video/webm"
                        onChange={handleFileInputChange}
                        className="hidden"
                        multiple
                      />

                      <Button
                        className="cursor-pointer bg-blue-600"
                        onClick={() =>
                          document.getElementById("videoUpload")?.click()
                        }
                      >
                        Choose File
                      </Button>
                    </label>

                    <Button
                      disabled={!files || uploading}
                      onClick={handleUpload}
                      className="cursor-pointer bg-white text-slate-900"
                    >
                      {previewUrl && (
                        <video
                          src={previewUrl}
                          controls
                          className="w-full mt-2 max-h-40"
                        />
                      )}
                      {uploading
                        ? "Uploading..."
                        : files
                        ? `Upload ${files.length} file(s)`
                        : "Upload"}
                    </Button>
                  </div>

                  {/* Selected files list */}
                  {files && files.length > 0 && (
                    <>
                      <Separator className="my-4" />
                      <div className="w-full max-w-2xl text-sm">
                        <div className="text-slate-300 mb-2">
                          Files selected:
                        </div>
                        <ul className="list-disc pl-6 text-slate-200">
                          {Array.from(files).map((f) => (
                            <li key={f.name}>
                              {f.name} • {(f.size / 1024 / 1024).toFixed(2)} MB
                            </li>
                          ))}
                        </ul>
                      </div>
                    </>
                  )}
                </div>
              </CardContent>
            </Card>
          )}

          {/* Video Library */}
          {tab === "library" && (
            <Card className="bg-slate-800/50 border-slate-700 w-full">
              <CardHeader>
                <CardTitle>Video Library</CardTitle>
                <CardDescription>Manage uploaded videos</CardDescription>
              </CardHeader>

              <CardContent className="space-y-3">
                {/* Search bar */}
                <div className="flex items-center justify-between">
                  <Input
                    placeholder="Search…"
                    value={searchString}
                    onChange={handleSearchChange}
                  />
                </div>

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
                            <span className="ml-2 text-yellow-300">
                              • Pending
                            </span>
                          )}
                          {vid.status === "synced" && (
                            <span className="ml-2 text-emerald-300">
                              • Synced
                            </span>
                          )}
                          {vid.status === "failed" && (
                            <span className="ml-2 text-red-400">• Failed</span>
                          )}
                        </div>
                      </div>

                      <div className="flex gap-2">
                        <VideoItem
                          vid={vid}
                          onView={handleView}
                          onDelete={handleDeleteVideo}
                          onRename={handleRenameVideo}
                          onUpdateTag={handleUpdateVideoTag}
                        />
                      </div>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          )}
        </section>
      </main>

      <AnalyzePageV2 />
    </div>
  );
};

export default Dashboard;
