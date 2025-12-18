// src/frontend/app/V2components/components/panels/DownloadPanel.tsx

import {
  Download,
  RefreshCw,
  CheckCircle,
  AlertCircle,
  Clock,
  Loader2,
  Bug,
  Folder,
  FileVideo,
  FileSpreadsheet,
  FileJson,
  AudioLines,
  FileText,
} from "lucide-react";
import { useState, useEffect } from "react";
import { eventBus } from "@/lib/golden-layout-lib/eventBus";
import { VideoService } from "@/lib/video-service";
import { API_CONFIG, getFileTypeConfig, getDownloadUrl } from "@/lib/config";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";

interface DownloadFile {
  name: string;
  type: string;
  downloadUrl: string;
  icon: React.ReactNode;
  description: string;
  available: boolean;
  size?: string;
}

const StatusBadge = ({ status }: { status: string }) => {
  const config = {
    completed: {
      color: "bg-green-500/20 text-green-300 border-green-500/30",
      icon: CheckCircle,
      label: "Ready",
    },
    processing: {
      color: "bg-yellow-500/20 text-yellow-300 border-yellow-500/30",
      icon: Clock,
      label: "Processing",
    },
    uploaded: {
      color: "bg-blue-500/20 text-blue-300 border-blue-500/30",
      icon: Clock,
      label: "Uploaded",
    },
    error: {
      color: "bg-red-500/20 text-red-300 border-red-500/30",
      icon: AlertCircle,
      label: "Error",
    },
  };

  const cfg = config[status as keyof typeof config] || config.uploaded;
  const Icon = cfg.icon;

  return (
    <div
      className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs border ${cfg.color}`}
    >
      <Icon className="size-3" />
      <span>{cfg.label}</span>
    </div>
  );
};

// Helper function to format seconds into h/m/s display
const formatTime = (seconds: number): string => {
  const hours = Math.floor(seconds / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);
  const secs = Math.floor(seconds % 60);

  const parts = [];
  if (hours > 0) parts.push(`${hours}h`);
  if (minutes > 0) parts.push(`${minutes}m`);
  if (secs > 0 || parts.length === 0) parts.push(`${secs}s`);

  return parts.join(" ");
};

export default function DownloadPanel() {
  const [videoId, setVideoId] = useState("");

  const [availableFiles, setAvailableFiles] = useState<DownloadFile[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [analysisStatus, setAnalysisStatus] = useState<any>(null);
  const [refreshing, setRefreshing] = useState(false);
  const [debugInfo, setDebugInfo] = useState<string>("");
  const [showDebug, setShowDebug] = useState(false);

  // Listen for video ID changes via event bus
  useEffect(() => {
    const handler = (id: string) => {
      setVideoId(id);
    };
    eventBus.on("textChanged", handler);

    return () => {
      eventBus.off("textChanged", handler);
    };
  }, []);

  // Helper function to get file icon
  const getFileIcon = (fileType: string, className: string = "size-4") => {
    const config = getFileTypeConfig(fileType);
    const iconColors = {
      video: "text-blue-400",
      yolo_csv: "text-green-400",
      ocr_csv: "text-purple-400",
      summary_json: "text-yellow-400",
      audio: "text-pink-400",
      transcript: "text-cyan-400",
    };

    const colorClass =
      iconColors[fileType as keyof typeof iconColors] || "text-gray-400";

    // Map icon names to components
    const iconMap = {
      video: FileVideo,
      spreadsheet: FileSpreadsheet,
      json: FileJson,
      audio: AudioLines,
      text: FileText,
    };

    const IconComponent =
      iconMap[config.icon as keyof typeof iconMap] || FileText;

    return <IconComponent className={`${className} ${colorClass}`} />;
  };

  const loadAnalysisData = async () => {
    if (!videoId) {
      setAvailableFiles([]);
      setAnalysisStatus(null);
      setDebugInfo("");
      return;
    }

    setIsLoading(true);
    let debugLog = `=== DownloadPanel Debug Log ===\n`;
    debugLog += `Timestamp: ${new Date().toISOString()}\n`;
    debugLog += `Video ID: ${videoId}\n`;

    try {
      // Try direct API call first (most reliable)
      debugLog += `\n1. Direct API call to FastAPI...\n`;
      debugLog += `   URL: http://localhost:8000/api/status/${videoId}\n`;

      let apiStatus = null;
      try {
        const response = await fetch(
          `http://localhost:8000/api/status/${videoId}`,
          {
            headers: {
              Accept: "application/json",
            },
          }
        );

        debugLog += `   Response: ${response.status} ${response.statusText}\n`;

        if (response.ok) {
          apiStatus = await response.json();
          debugLog += `   ✅ Success! Got status: ${apiStatus.status}\n`;
          debugLog += `   Progress: ${apiStatus.progress || 0}%\n`;

          if (apiStatus.download_links) {
            const links = Object.keys(apiStatus.download_links);
            debugLog += `   Download links (${links.length}): ${links.join(
              ", "
            )}\n`;
          }
        } else {
          const errorText = await response.text();
          debugLog += `   ❌ API Error: ${errorText}\n`;
        }
      } catch (apiError) {
        debugLog += `   ❌ API Connection Error: ${apiError}\n`;
      }

      // If direct API failed, try VideoService
      if (!apiStatus) {
        debugLog += `\n2. Falling back to VideoService...\n`;
        try {
          const vsStatus = await VideoService.get(videoId);
          debugLog += `   VideoService status: ${vsStatus.status}\n`;

          apiStatus = {
            analysis_id: videoId,
            status: vsStatus.status,
            progress: vsStatus.progress || 0,
            filename: vsStatus.name || "Unknown",
            pipeline_type: vsStatus.pipelineType || "full",
            cvatID: vsStatus.cvatID,
            error: vsStatus.error,
          };
        } catch (vsError) {
          debugLog += `   ❌ VideoService Error: ${vsError}\n`;
        }
      }

      // Set the status
      if (apiStatus) {
        setAnalysisStatus(apiStatus);
        debugLog += `\n3. Analysis Status Set:\n`;
        debugLog += `   Status: ${apiStatus.status}\n`;
        debugLog += `   Progress: ${apiStatus.progress}\n`;
        debugLog += `   Filename: ${apiStatus.filename}\n`;
        debugLog += `   Pipeline: ${apiStatus.pipeline_type}\n`;

        // Build file list for ALL 6 expected file types
        debugLog += `\n4. Building file list for all 6 file types...\n`;
        const files: DownloadFile[] = [];
        const downloadLinks = apiStatus.download_links || {};

        for (const fileType of API_CONFIG.EXPECTED_FILE_TYPES) {
          const config = getFileTypeConfig(fileType);
          const originalName = apiStatus.filename || "video";
          const baseName = originalName.replace(/\.[^/.]+$/, "");

          const isAvailable =
            downloadLinks[fileType] ||
            (apiStatus.status === "completed" &&
              apiStatus.pipeline_type?.includes(
                fileType.includes("audio") ? "audio" : "visual"
              ));

          if (isAvailable) {
            debugLog += `   ✅ ${fileType}: AVAILABLE\n`;
            const downloadUrl =
              downloadLinks[fileType] || `/api/download/${videoId}/${fileType}`;

            // Add file to the list with proper icon
            files.push({
              name: `${baseName}_${config.name.replace(/\s+/g, "_")}${
                config.extension
              }`,
              type: fileType,
              downloadUrl: downloadUrl,
              icon: getFileIcon(fileType, "size-5"),
              description: config.description,
              available: true,
              size:
                fileType === "video"
                  ? "~50MB"
                  : fileType === "audio"
                  ? "~5MB"
                  : "~1MB",
            });
          } else {
            debugLog += `   ⚠️ ${fileType}: NOT AVAILABLE\n`;
            files.push({
              name: `${config.name} (Pending)`,
              type: fileType,
              downloadUrl: "",
              icon: getFileIcon(fileType, "size-5"),
              description: `${config.description} - ${
                apiStatus.status === "processing"
                  ? "Will be generated when analysis completes"
                  : "Not generated in this analysis"
              }`,
              available: false,
            });
          }
        }

        setAvailableFiles(files);
        debugLog += `\n5. File list built: ${
          files.filter((f) => f.available).length
        } available, ${files.length} total\n`;
      } else {
        debugLog += `\n❌ FAILED: Could not get any status data\n`;
      }
    } catch (error) {
      const errorMsg = `DownloadPanel: Critical error: ${error}`;
      console.error(errorMsg);
      debugLog += `\n❌ CRITICAL ERROR: ${errorMsg}\n`;

      // Last resort: set minimal status
      setAnalysisStatus({
        analysis_id: videoId,
        status: "error",
        progress: 0,
        filename: "Unknown",
        error: "Failed to load analysis data",
      });
    } finally {
      setIsLoading(false);
      setRefreshing(false);
      setDebugInfo(debugLog);
      console.log(debugLog);
    }
  };

  const handleRefresh = async () => {
    if (!videoId || refreshing) return;
    setRefreshing(true);
    await loadAnalysisData();
  };

  useEffect(() => {
    if (!videoId) {
      setAvailableFiles([]);
      setAnalysisStatus(null);
      return;
    }

    loadAnalysisData();

    // Auto-refresh when processing
    let interval: NodeJS.Timeout;
    if (analysisStatus?.status === "processing") {
      interval = setInterval(() => {
        if (!refreshing) {
          handleRefresh();
        }
      }, API_CONFIG.POLLING.PROGRESS);
    }

    return () => {
      if (interval) clearInterval(interval);
    };
  }, [videoId]);

  const handleDownload = async (
    fileType: string,
    downloadUrl: string,
    fileName: string
  ) => {
    if (!videoId || !downloadUrl) {
      alert("File not available for download");
      return;
    }

    try {
      console.log(`Downloading ${fileType}: ${fileName}`);
      console.log(`Download URL: ${downloadUrl}`);

      // Check if downloadUrl is a relative path or full URL
      let finalDownloadUrl = downloadUrl;

      // If it's a relative path (starts with /api/), prepend the FastAPI backend URL
      if (downloadUrl.startsWith("/api/")) {
        finalDownloadUrl = `http://localhost:8000${downloadUrl}`;
      }
      // If it doesn't start with http:// or https://, prepend the backend URL
      else if (
        !downloadUrl.startsWith("http://") &&
        !downloadUrl.startsWith("https://")
      ) {
        finalDownloadUrl = `http://localhost:8000${downloadUrl}`;
      }

      console.log(`Final download URL: ${finalDownloadUrl}`);

      const response = await fetch(finalDownloadUrl);

      if (!response.ok) {
        const errorText = await response.text();
        console.error(
          "Download response error:",
          response.status,
          response.statusText,
          errorText
        );
        throw new Error(
          `Download failed: ${response.status} ${response.statusText} - ${errorText}`
        );
      }

      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = fileName;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      window.URL.revokeObjectURL(url);

      console.log(`Download completed: ${fileName}`);
    } catch (error) {
      console.error("Download failed:", error);
      alert(
        `Failed to download ${fileName}. Please try again.\nError: ${error}`
      );
    }
  };

  const handleDownloadAll = async () => {
    if (!videoId || availableFiles.length === 0) return;

    const downloadableFiles = availableFiles.filter((file) => file.available);
    if (downloadableFiles.length === 0) {
      alert("No files available for download");
      return;
    }

    if (!confirm(`Download ${downloadableFiles.length} file(s)?`)) return;

    try {
      for (const file of downloadableFiles) {
        await handleDownload(file.type, file.downloadUrl, file.name);
        // Small delay between downloads
        await new Promise((resolve) => setTimeout(resolve, 300));
      }
      alert(`Successfully downloaded ${downloadableFiles.length} file(s)!`);
    } catch (error) {
      console.error("Batch download failed:", error);
      alert("Failed to download files. Please try again.");
    }
  };

  const getAvailableFileCount = () => {
    return availableFiles.filter((f) => f.available).length;
  };

  const getTotalFileCount = () => {
    return API_CONFIG.EXPECTED_FILE_TYPES.length;
  };

  return (
    <TooltipProvider delayDuration={200}>
      <div className="h-full flex flex-col bg-[#1a1a1a]">
        <div className="px-4 py-3 border-b border-slate-700 flex items-center justify-between">
          <div>
            <h2 className="text-m font-semibold text-slate-300">
              Download Results
            </h2>
            {videoId && (
              <div className="text-xs text-slate-500 mt-1">
                Video ID:{" "}
                <span className="font-mono">{videoId.substring(0, 8)}...</span>
              </div>
            )}
          </div>
          <div className="flex items-center gap-2">
            <Tooltip>
              <TooltipTrigger asChild>
                <button
                  onClick={() => setShowDebug(!showDebug)}
                  className="p-2 hover:bg-slate-800 rounded text-slate-400 hover:text-slate-300 transition-colors"
                >
                  <Bug className="size-4" />
                </button>
              </TooltipTrigger>
              <TooltipContent>
                <p>Show debug info</p>
              </TooltipContent>
            </Tooltip>
            {videoId && (
              <Tooltip>
                <TooltipTrigger asChild>
                  <button
                    onClick={handleRefresh}
                    disabled={refreshing}
                    className="p-2 hover:bg-slate-800 rounded text-slate-400 hover:text-slate-300 disabled:opacity-50 transition-colors"
                  >
                    {refreshing ? (
                      <Loader2 className="size-4 animate-spin" />
                    ) : (
                      <RefreshCw className="size-4" />
                    )}
                  </button>
                </TooltipTrigger>
                <TooltipContent>
                  <p>Refresh status</p>
                </TooltipContent>
              </Tooltip>
            )}
            {getAvailableFileCount() > 0 && (
              <Tooltip>
                <TooltipTrigger asChild>
                  <button
                    onClick={handleDownloadAll}
                    className="px-3 py-2 text-sm bg-blue-600 hover:bg-blue-700 rounded flex items-center gap-2 transition-colors disabled:opacity-50"
                    disabled={getAvailableFileCount() === 0}
                  >
                    <Download className="size-4" />
                    Download All ({getAvailableFileCount()})
                  </button>
                </TooltipTrigger>
                <TooltipContent>
                  <p>Download all available files</p>
                </TooltipContent>
              </Tooltip>
            )}
          </div>
        </div>

        {analysisStatus && (
          <div className="px-4 py-3 border-b border-slate-700 bg-slate-900/50">
            <div className="flex items-center justify-between mb-2">
              <div className="flex items-center gap-2">
                <StatusBadge status={analysisStatus.status} />
                <span className="text-xs text-slate-300 truncate max-w-xs">
                  {analysisStatus.filename}
                </span>
              </div>
              {analysisStatus.progress !== undefined && (
                <span className="text-xs font-medium text-slate-300">
                  {analysisStatus.progress}%
                </span>
              )}
            </div>

            {analysisStatus.status === "processing" && (
              <div className="mt-2">
                <div className="flex justify-between text-xs text-slate-400 mb-1">
                  <span>Analysis in progress...</span>
                  <span>{analysisStatus.progress}%</span>
                </div>
                <div className="w-full bg-slate-700 rounded-full h-2">
                  <div
                    className="bg-green-500 h-2 rounded-full transition-all duration-500"
                    style={{ width: `${analysisStatus.progress || 0}%` }}
                  />
                </div>
              </div>
            )}

            <div className="flex items-center justify-between mt-3 text-xs">
              <div className="text-slate-400">
                {getAvailableFileCount()} of {getTotalFileCount()} files ready
              </div>
              <div className="flex items-center justify-between">
                {analysisStatus.processing_time && (
                  <div className="text-xs text-slate-500">
                    Processed in{" "}
                    {formatTime(analysisStatus.processing_time / 1000000)}
                  </div>
                )}
              </div>
              <div className="flex items-center gap-3 text-slate-500">
                {analysisStatus.pipeline_type && (
                  <span>Pipeline: {analysisStatus.pipeline_type}</span>
                )}
                {analysisStatus.cvatID && (
                  <span>CVAT: {analysisStatus.cvatID}</span>
                )}
              </div>
            </div>

            {analysisStatus.error && (
              <div className="mt-3 p-2 bg-red-500/10 border border-red-500/30 rounded text-xs text-red-300">
                <div className="font-medium">Error:</div>
                <div>{analysisStatus.error}</div>
              </div>
            )}
          </div>
        )}

        {/* Debug Panel */}
        {showDebug && debugInfo && (
          <div className="border-b border-slate-700 bg-slate-900">
            <div className="px-4 py-2 flex justify-between items-center bg-slate-800">
              <h3 className="text-sm font-semibold text-slate-300">
                Debug Information
              </h3>
              <div className="flex items-center gap-2">
                <button
                  onClick={() => {
                    navigator.clipboard.writeText(debugInfo);
                    alert("Debug info copied to clipboard!");
                  }}
                  className="text-xs text-slate-400 hover:text-slate-300"
                >
                  Copy
                </button>
                <button
                  onClick={() => setShowDebug(false)}
                  className="text-xs text-slate-400 hover:text-slate-300"
                >
                  Hide
                </button>
              </div>
            </div>
            <pre className="text-xs text-slate-300 p-4 max-h-64 overflow-auto font-mono bg-black/30 whitespace-pre-wrap">
              {debugInfo}
            </pre>
          </div>
        )}

        <div className="flex-1 overflow-y-auto p-4">
          {isLoading ? (
            <div className="flex flex-col items-center justify-center h-64">
              <Loader2 className="size-8 text-slate-400 animate-spin mb-4" />
              <div className="text-slate-400">Loading analysis data...</div>
              <div className="text-xs text-slate-500 mt-2">
                Connecting to FastAPI backend...
              </div>
            </div>
          ) : !videoId ? (
            <div className="flex flex-col items-center justify-center h-64">
              <Folder className="size-12 text-slate-400 mb-4" />
              <div className="text-slate-400 text-lg mb-2">
                No Video Selected
              </div>
              <div className="text-slate-500 text-sm text-center max-w-xs">
                Select a video from the Project Panel to view and download
                analysis results
              </div>
            </div>
          ) : analysisStatus?.status === "error" ? (
            <div className="flex flex-col items-center justify-center h-64 p-4">
              <AlertCircle className="size-12 text-red-400 mb-4" />
              <div className="text-slate-300 text-lg mb-2 text-center">
                Analysis Error
              </div>
              <div className="text-sm text-slate-400 text-center mb-4">
                {analysisStatus.error || "An error occurred during analysis"}
              </div>
              <button
                onClick={handleRefresh}
                className="px-4 py-2 text-sm bg-slate-700 hover:bg-slate-600 rounded flex items-center gap-2"
              >
                <RefreshCw className="size-4" />
                Try Again
              </button>
            </div>
          ) : analysisStatus?.status !== "completed" ? (
            <div className="flex flex-col items-center justify-center h-64 p-4">
              <Clock className="size-12 text-yellow-400 mb-4 animate-pulse" />
              <div className="text-slate-300 text-lg mb-2">
                {analysisStatus?.status === "processing"
                  ? "Analysis in Progress..."
                  : "Analysis Not Complete"}
              </div>
              <div className="text-sm text-slate-500 text-center max-w-sm">
                {analysisStatus?.progress !== undefined && (
                  <div className="mb-3">
                    <div className="text-slate-300 font-medium mb-1">
                      {analysisStatus.progress}% complete
                    </div>
                    <div className="w-48 bg-slate-700 rounded-full h-2">
                      <div
                        className="bg-green-500 h-2 rounded-full transition-all duration-500"
                        style={{ width: `${analysisStatus.progress}%` }}
                      />
                    </div>
                  </div>
                )}
                <p className="mb-2">
                  All {getTotalFileCount()} file types will be generated when
                  analysis completes:
                </p>
                <div className="grid grid-cols-2 gap-1 text-xs">
                  {API_CONFIG.EXPECTED_FILE_TYPES.map((type, idx) => (
                    <div
                      key={idx}
                      className="text-slate-400 flex items-center gap-1"
                    >
                      <div className="size-2 rounded-full bg-blue-500/50"></div>
                      {getFileTypeConfig(type).name}
                    </div>
                  ))}
                </div>
              </div>
            </div>
          ) : (
            <div className="space-y-4">
              {availableFiles.map((file, index) => (
                <div
                  key={index}
                  className={`flex items-center gap-4 p-4 rounded-lg border transition-all ${
                    file.available
                      ? "border-slate-700 hover:bg-slate-800/50 hover:border-slate-600 cursor-pointer group"
                      : "border-slate-800 opacity-60 cursor-not-allowed"
                  }`}
                  onClick={() =>
                    file.available &&
                    handleDownload(file.type, file.downloadUrl, file.name)
                  }
                >
                  <div
                    className={`shrink-0 p-3 rounded-lg ${
                      file.available
                        ? "bg-slate-800 group-hover:bg-slate-700"
                        : "bg-slate-900"
                    }`}
                  >
                    {file.icon}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between mb-1 text-xs flex-wrap">
                      <div
                        className={`font-medium truncate ${
                          file.available
                            ? "text-slate-300 group-hover:text-white"
                            : "text-slate-500"
                        }`}
                      >
                        {file.name}
                      </div>
                      <span
                        className={`text-xs px-2 py-1 rounded ${
                          file.available
                            ? "text-green-400 bg-green-500/10"
                            : "text-slate-600 bg-slate-900/50"
                        }`}
                      >
                        {file.available ? "Ready" : "Pending"}
                      </span>
                    </div>
                    <div className="text-xs text-slate-500 mb-1">
                      {file.description}
                    </div>
                    <div className="flex items-center gap-3 text-xs text-slate-600">
                      <span className="font-mono">{file.type}</span>
                      {file.size && <span>• {file.size}</span>}
                    </div>
                  </div>
                  {file.available ? (
                    <button
                      className="p-3 hover:bg-slate-700 rounded-lg transition-all shrink-0 group-hover:bg-blue-600/20"
                      onClick={(e) => {
                        e.stopPropagation();
                        handleDownload(file.type, file.downloadUrl, file.name);
                      }}
                      title={`Download ${file.name}`}
                    >
                      <Download className="size-5 text-blue-400 group-hover:text-blue-300" />
                    </button>
                  ) : (
                    <div className="text-xs text-slate-500 italic px-3 py-2 border border-slate-700 rounded">
                      Not generated
                    </div>
                  )}
                </div>
              ))}

              {getAvailableFileCount() < getTotalFileCount() && (
                <div className="p-4 bg-slate-900/50 rounded-lg border border-slate-700">
                  <h4 className="text-sm font-medium text-slate-300 mb-2 flex items-center gap-2">
                    <AlertCircle className="size-4 text-yellow-500" />
                    Some files not generated
                  </h4>
                  <p className="text-xs text-slate-400 mb-3">
                    Not all expected files were generated. This could be
                    because:
                  </p>
                  <ul className="text-xs text-slate-500 space-y-1">
                    <li>
                      • The analysis pipeline type didn't include all modules
                    </li>
                    <li>
                      • Certain analysis steps failed (check backend logs)
                    </li>
                    <li>
                      • The video didn't contain content for all analysis types
                    </li>
                    <li>• Backend processing is still in progress</li>
                  </ul>
                  <div className="mt-3 pt-3 border-t border-slate-700">
                    <button
                      onClick={() =>
                        window.open("http://localhost:8000/docs", "_blank")
                      }
                      className="text-xs text-blue-400 hover:text-blue-300"
                    >
                      Check FastAPI Docs →
                    </button>
                  </div>
                </div>
              )}

              <div className="text-xs text-slate-500 pt-4 border-t border-slate-700">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <div className="size-2 rounded-full bg-green-500"></div>
                    <span>
                      Backend: <span className="font-mono">localhost:8000</span>
                    </span>
                  </div>
                  <div className="flex items-center gap-3">
                    <button
                      onClick={handleRefresh}
                      className="text-slate-400 hover:text-slate-300 flex items-center gap-1"
                    >
                      <RefreshCw className="size-3" />
                      Refresh
                    </button>
                    <button
                      onClick={() => setShowDebug(!showDebug)}
                      className="text-blue-400 hover:text-blue-300"
                    >
                      {showDebug ? "Hide Debug" : "Show Debug"}
                    </button>
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </TooltipProvider>
  );
}
