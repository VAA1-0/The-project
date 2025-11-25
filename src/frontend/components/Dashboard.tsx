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
import { GameRunLogo } from "./ProjectLogo";
import { Library } from "@/lib/local-library";
import { saveVideoBlob, getVideoBlob, deleteVideoBlob, listBlobKeys } from "@/lib/blob-store";

export const Dashboard: React.FC = () => {
  const router = useRouter();
  const [file, setFile] = useState<File | null>(null);
  const [files, setFiles] = useState<File[] | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);
  const [tab, setTab] = useState<"upload" | "library">("upload");
  const [libraryVideos, setLibraryVideos] = useState<any[]>([]);
  
  const [renameId, setRenameId] = useState<string | null>(null);
  const [renameValue, setRenameValue] = useState<string>("");
  const [tagEditId, setTagEditId] = useState<string | null>(null);
  const [tagEditValue, setTagEditValue] = useState<string>("");

  const [searchString, setSearchString] = useState<string>("");

  useEffect(() => {
    // Load persisted library metadata from local-library
    try {
      setLibraryVideos(Library.getAll().videos);
    } catch (e) {
      setLibraryVideos([]);
    }
  }, []);

  useEffect(() => {
    // Filter library videos based on search string
    const allVideos = Library.getAll().videos;
    if (searchString.trim() === "") {
      setLibraryVideos(allVideos);
    } else {
      const filtered = allVideos.filter(v => 
        v.name.toLowerCase().includes(searchString.toLowerCase()) ||
        (v.tag && v.tag.toLowerCase().includes(searchString.toLowerCase())));
      setLibraryVideos(filtered);
    }
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

    setFiles(prev => {
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
    const selected = files || (file ? [file] as any : null);
    if (!selected || selected.length === 0) return alert("Select a video first");
    setUploading(true);
    try {
      const arr = Array.from(selected as any) as File[];
      for (const f of arr) {
        const id = `${Date.now()}-${Math.random().toString(36).slice(2,8)}`;
        // compute actual duration (in seconds) from the file
        const length = await getVideoDuration(f);
        // save blob to IndexedDB
        await saveVideoBlob(id, f);
        // register metadata in Library
        Library.addVideo({ id, name: f.name, length: length, tag: null, analysis: null });
      }

      // refresh local view
      setLibraryVideos(Library.getAll().videos);
      setFiles(null);
      setFile(null);
      setPreviewUrl(null);
      alert("Upload successful (saved in browser storage)");
    } catch (err) {
      console.error(err);
      alert("Upload failed: " + (((err as any)?.message) ?? String(err)));
    } finally {
      setUploading(false);
    }
  };
  
  // Navigate to analyze results page, later navigates to specific video analysis with file ID/name
  const handleView = async (id?: string) => {
    router.push(`/analyze-results/${id}`);
  }

  // Delete a video: remove blob from IndexedDB and metadata from Library
  const handleDeleteVideo = async (id: string) => {
    if (!confirm("Delete this video? This cannot be undone.")) return;
    try {
      // remove blob (best-effort)
      try {
        await deleteVideoBlob(id);
      } catch (e) {
        console.warn("Failed to delete blob from IndexedDB", e);
      }

      // remove metadata
      Library.deleteVideo(id);
      setLibraryVideos(Library.getAll().videos);
    } catch (err) {
      console.error(err);
      alert("Failed to delete video: " + String(err));
    }
  }

  // Rename video: edit metadata in Library
  const handleRenameVideo = async (id: string, newName: string) => {
  try {
    Library.updateVideoName(id, { name: newName });
    setLibraryVideos(Library.getAll().videos);
    setRenameId(null);
    setRenameValue("");
  } catch (err) {
    console.error(err);
    alert("Failed to rename video: " + String(err));
  }
};

  // Update video tag: edit metadata in Library
  const handleUpdateVideoTag = async (id: string, newTag: string) => {
    try {
      Library.updateVideoTag(id, { tag: newTag });
      setLibraryVideos(Library.getAll().videos);
    } catch (err) {
      console.error(err);
      alert("Failed to update video tag: " + String(err));
    }
  };

  // Simulated sign out function
  const handleSignOut = () => {
    router.push("/");
  };

  // Sample stats data
  const stats = [
    { id: "total", title: "Total Videos", value: 3, colorBg: "bg-blue-600/20" },
    { id: "analyzed", title: "Analyzed", value: 2, colorBg: "bg-emerald-600/20" },
    { id: "processing", title: "Processing", value: 1, colorBg: "bg-yellow-600/20" },
    { id: "confidence", title: "Avg Confidence", value: "91%", colorBg: "bg-purple-600/20" },
  ];

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 text-slate-100">

      {/* Header */}
      <header className="max-w-8xl mx-auto px-6 py-5 flex items-center justify-between bg-slate-800/50 border-b border-slate-700">
        <div className="flex items-center gap-3">
          <GameRunLogo size="md" />
          <div className="text-xl font-semibold">Dashboard</div>
        </div>

        <div className="flex items-center gap-3">
          <div className="hidden sm:flex items-center gap-2 bg-neutral-800/30 px-3 py-2 rounded-lg border border-slate-700">
            <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none">
              <path d="M12 2L3 14h7l-1 8 10-12h-7l1-8z" fill="currentColor" />
            </svg>
            <span className="text-sm text-slate-200">
                Light Mode
            </span>
          </div>

          <Button onClick={handleSignOut} variant="ghost" className="hidden sm:inline-flex">
            Sign Out
          </Button>
        </div>
      </header>

      {/* Main Container */}
      <main className="max-w-7xl mx-auto px-6 py-10 flex flex-col items-center">
        <section className="w-full space-y-8">

          {/* Stats cards */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 w-full">
            {stats.map((s) => (
              <Card key={s.id} className="bg-slate-800/50 border-slate-700 overflow-hidden">
                <CardContent className="flex items-center gap-4 py-6">
                  <div className={`p-3 rounded-lg ${s.colorBg}`}>
                    <svg className="w-6 h-6" viewBox="0 0 24 24" fill="none">
                      <circle cx="12" cy="12" r="8" fill="currentColor" />
                    </svg>
                  </div>
                  <div>
                    <div className="text-sm text-slate-400">{s.title}</div>
                    <div className="text-lg font-semibold text-white">{s.value}</div>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>

          {/* Toggle buttons */}
          <div className="flex">
            <div className="inline-flex rounded-md overflow-hidden border border-slate-700">
              <Button
                onClick={() => setTab("upload")}
                variant="ghost"
                className={`px-6 py-2 rounded-none ${tab === "upload" ? "bg-slate-700" : ""}`}
              >
                Upload Video
              </Button>

              <Button
                onClick={() => setTab("library")}
                variant="ghost"
                className={`px-6 py-2 rounded-none ${tab === "library" ? "bg-slate-700" : ""}`}
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
                      <svg className="w-8 h-8 text-blue-400" viewBox="0 0 24 24" fill="none">
                        <path d="M5 3v18l15-9L5 3z" fill="currentColor" />
                      </svg>
                    </div>

                    <div className="text-center">
                      <div className="text-white font-medium">Drop your video here or click to browse</div>
                      <div className="text-sm text-slate-400">Supports MP4, MOV, AVI, WebM up to 500MB</div>
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
                        className="bg-blue-600"
                        onClick={() => document.getElementById("videoUpload")?.click()}
                      >
                        Choose File
                      </Button>
                    </label>

                    <Button
                      disabled={!files || uploading}
                      onClick={handleUpload}
                      className="bg-white text-slate-900"
                    >
                      {previewUrl && <video src={previewUrl} controls className="w-full mt-2 max-h-40" />}
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
                        <div className="text-slate-300 mb-2">Files selected:</div>
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
                    <Input placeholder="Search…" value={searchString} onChange={handleSearchChange} />
                  </div>

                {/* Video list */}
                  <div className="space-y-2">

                    {/* Placeholder item */}
                      <div className="p-3 bg-slate-900/30 rounded-md flex items-center justify-between">
                        <div>
                          <div className="font-medium">video_2025-10-01.mp4</div>
                          <div className="text-xs text-slate-400">Analyzed • 91% confidence</div>
                        </div>
                        <div className="flex gap-2">
                          <Button onClick={() => handleView()} variant="ghost">View</Button>
                          <Button variant="ghost">Delete</Button>
                        </div>
                      </div>

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
                          </div>
                        </div>

                        <div className="flex gap-2">
                          {tagEditId === vid.id ? (
                            <div className="flex items-center gap-2">
                              <Input
                                value={tagEditValue}
                                onChange={(e) => setTagEditValue(e.target.value)}
                                onKeyDown={(e) => {
                                if (e.key === "Enter") {
                                  handleUpdateVideoTag(vid.id, tagEditValue);
                                  setTagEditId(null);
                                  setTagEditValue("");
                                }
                                if (e.key === "Escape") {
                                  setTagEditId(null);
                                  setTagEditValue("");
                                }
                              }}
                                className="h-8 w-40"
                                autoFocus
                              />
                          </div>
                          ) : (
                            <Button
                              variant="ghost"
                              onClick={() => {
                                  setTagEditId(vid.id);
                                  setTagEditValue(vid.tag ?? ""); // prefill (ensure string)
                                }}
                            >
                              Edit Tag
                            </Button>
                          )}

                          {renameId === vid.id ? (
                            <div className="flex items-center gap-2">
                              <Input
                                value={renameValue}
                                onChange={(e) => setRenameValue(e.target.value)}
                                onKeyDown={(e) => {
                                if (e.key === "Enter") {
                                  handleRenameVideo(vid.id, renameValue);
                                }
                                if (e.key === "Escape") {
                                  setRenameId(null);
                                  setRenameValue("");
                                }
                              }}
                                className="h-8 w-40"
                                autoFocus
                              />

                              <Button
                                size="sm"
                                className="h-8"
                                onClick={() => handleRenameVideo(vid.id, renameValue)}
                              >
                                Save
                              </Button>

                              <Button
                                size="sm"
                                variant="ghost"
                                className="h-8"
                                onClick={() => {
                                  setRenameId(null);
                                  setRenameValue("");
                                }}
                              >
                                Cancel
                              </Button>
                            </div>
                          ) : (
                            <Button
                              variant="ghost"
                              onClick={() => {
                                setRenameId(vid.id);
                                setRenameValue(vid.name); // prefill
                              }}
                            >
                              Rename
                            </Button>
                          )}

                          <Button onClick={() => handleView(vid.id)} variant="ghost">
                            View analysis
                          </Button>

                          <Button onClick={() => handleDeleteVideo(vid.id)} variant="ghost">
                            Delete
                          </Button>
                        </div>
                      </div>
                      ))}

                  </div>
              </CardContent>
            </Card>
          )}
        </section>
      </main>
    </div>
  );
};

export default Dashboard;
