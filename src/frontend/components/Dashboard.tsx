"use client";

import { useRouter } from "next/navigation";
import React, { useCallback, useState } from "react";
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

export const Dashboard: React.FC = () => {
  const router = useRouter();
  const [files, setFiles] = useState<FileList | null>(null);
  const [uploading, setUploading] = useState(false);
  const [tab, setTab] = useState<"upload" | "library">("upload");

  // Callback when files are selected
  const onFilesSelected = useCallback((f: FileList | null) => {
    setFiles(f);
  }, []);

  // Handle file input change
  const handleFileInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    onFilesSelected(e.target.files);
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

  // Simulated upload function
  const handleUpload = async () => {
    if (!files || files.length === 0) return;
    setUploading(true);
    await new Promise((res) => setTimeout(res, 900));
    setUploading(false);
    alert(`Uploaded ${files.length} file(s) — integrate your API here.`);
    setFiles(null);
  };
  
  // Navigate to analyze results page, later navigates to specific video analysis with file ID/name
  const handleView = () => {
    router.push("/analyze-results");
  }

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
            <span className="text-sm text-slate-200">Light Mode</span>
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
                <CardContent className="flex items-center gap-4">
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
                      <div className="text-sm text-slate-400">
                        Supports MP4, MOV, AVI, WebM up to 500MB
                      </div>
                    </div>
                  </div>

                  <div className="flex flex-col sm:flex-row gap-3 mt-3">
                    <label className="cursor-pointer">
                      <input
                        type="file"
                        accept="video/*"
                        onChange={handleFileInputChange}
                        className="sr-only"
                        multiple
                      />
                      <Button className="bg-blue-600">Choose File</Button>
                    </label>

                    <Button
                      disabled={!files || uploading}
                      onClick={handleUpload}
                      className="bg-white text-slate-900"
                    >
                      {uploading
                        ? "Uploading..."
                        : files
                        ? `Upload ${files.length} file(s)`
                        : "Upload"}
                    </Button>
                  </div>

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

          {tab === "library" && (
            <Card className="bg-slate-800/50 border-slate-700 w-full">
              <CardHeader>
                <CardTitle>Video Library</CardTitle>
                <CardDescription>Manage uploaded videos</CardDescription>
              </CardHeader>

              <CardContent className="space-y-3">
                <div className="flex items-center justify-between">
                  <Input placeholder="Search…" />
                </div>

                <div className="space-y-2">
                  <div className="p-3 bg-slate-900/30 rounded-md flex items-center justify-between">
                    <div>
                      <div className="font-medium">video_2025-10-01.mp4</div>
                      <div className="text-xs text-slate-400">Analyzed • 91% confidence</div>
                    </div>
                    <div className="flex gap-2">
                      <Button onClick={handleView} variant="ghost">View</Button>
                      <Button variant="ghost">Delete</Button>
                    </div>
                  </div>
                  <div className="p-3 bg-slate-900/30 rounded-md flex items-center justify-between">
                    <div>
                      <div className="font-medium">my_gameplay.mov</div>
                      <div className="text-xs text-slate-400">Processing</div>
                    </div>
                    <div className="flex gap-2">
                      <Button onClick={handleView} variant="ghost">View</Button>
                      <Button variant="ghost">Delete</Button>
                    </div>
                  </div>
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
