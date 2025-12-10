import { Download, RefreshCw, FileVideo, FileText, FileJson, AudioLines, FileSpreadsheet, CheckCircle, AlertCircle, Clock, Loader2, Bug } from "lucide-react";
import { useState, useEffect } from "react";
import { VideoService } from "@/lib/video-service";

interface DownloadPanelProps {
  videoId?: string | null;
}

interface DownloadFile {
  name: string;
  type: string;
  downloadUrl: string;
  icon: React.ReactNode;
  description: string;
  available: boolean;
}

const StatusBadge = ({ status }: { status: string }) => {
  const config = {
    completed: { color: "bg-green-500/20 text-green-300 border-green-500/30", icon: CheckCircle, label: "Ready" },
    processing: { color: "bg-yellow-500/20 text-yellow-300 border-yellow-500/30", icon: Clock, label: "Processing" },
    uploaded: { color: "bg-blue-500/20 text-blue-300 border-blue-500/30", icon: Clock, label: "Uploaded" },
    error: { color: "bg-red-500/20 text-red-300 border-red-500/30", icon: AlertCircle, label: "Error" },
  };

  const cfg = config[status as keyof typeof config] || config.uploaded;
  const Icon = cfg.icon;

  return (
    <div className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs border ${cfg.color}`}>
      <Icon className="size-3" />
      <span>{cfg.label}</span>
    </div>
  );
};

export default function DownloadPanel({ videoId }: DownloadPanelProps) {
  const [availableFiles, setAvailableFiles] = useState<DownloadFile[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [analysisStatus, setAnalysisStatus] = useState<any>(null);
  const [refreshing, setRefreshing] = useState(false);
  const [debugInfo, setDebugInfo] = useState<string>("");

  // All 6 file type configurations
  const fileTypeConfigs = {
    video: {
      name: "Annotated Video",
      icon: <FileVideo className="size-4 text-blue-400" />,
      description: "Video with visual annotations (YOLO + OCR)",
      extension: ".mp4"
    },
    yolo_csv: {
      name: "Object Detections",
      icon: <FileSpreadsheet className="size-4 text-green-400" />,
      description: "CSV of all detected objects",
      extension: ".csv"
    },
    ocr_csv: {
      name: "OCR Text",
      icon: <FileSpreadsheet className="size-4 text-purple-400" />,
      description: "CSV of all text detected in video",
      extension: ".csv"
    },
    summary_json: {
      name: "Analysis Summary",
      icon: <FileJson className="size-4 text-yellow-400" />,
      description: "JSON summary of analysis results",
      extension: ".json"
    },
    audio: {
      name: "Extracted Audio",
      icon: <AudioLines className="size-4 text-pink-400" />,
      description: "WAV audio file extracted from video",
      extension: ".wav"
    },
    transcript: {
      name: "Speech Transcript",
      icon: <FileText className="size-4 text-cyan-400" />,
      description: "JSON transcript with timestamps and POS analysis",
      extension: ".json"
    }
  };

  const loadAnalysisData = async () => {
    if (!videoId) {
      setAvailableFiles([]);
      setAnalysisStatus(null);
      setDebugInfo("");
      return;
    }
    
    setIsLoading(true);
    let debugLog = `Loading data for video: ${videoId}\n`;
    
    try {
      // Get analysis status from backend
      debugLog += "1. Fetching status from VideoService...\n";
      const status = await VideoService.get(videoId);
      debugLog += `   Status: ${status.status}, Progress: ${status.progress}%\n`;
      
      const analysisStatus = {
        analysis_id: videoId,
        status: status.status,
        progress: status.progress,
        filename: status.name,
        error: status.error,
        processing_time: status.processingTime,
        pipeline_type: status.pipelineType,
        cvatID: status.cvatID,
      };

      // Get download links from backend API
      let downloadLinks: Record<string, string> = {};
      let fullStatus = null;
      
      debugLog += "2. Fetching full status from backend API...\n";
      try {
        const response = await fetch(`http://localhost:8000/api/status/${videoId}`);
        debugLog += `   Response status: ${response.status} ${response.statusText}\n`;
        
        if (response.ok) {
          fullStatus = await response.json();
          debugLog += `   Got full status: ${JSON.stringify(fullStatus, null, 2).substring(0, 500)}...\n`;
          downloadLinks = fullStatus.download_links || {};
          debugLog += `   Download links keys: ${Object.keys(downloadLinks).join(', ')}\n`;
          
          // Check if visual analysis has errors
          if (fullStatus.summary) {
            debugLog += `   Summary: ${JSON.stringify(fullStatus.summary)}\n`;
          }
        } else {
          debugLog += `   ERROR: Failed to fetch status\n`;
        }
      } catch (e) {
        debugLog += `   ERROR fetching status: ${e}\n`;
      }

      setAnalysisStatus({
        ...analysisStatus,
        download_links: downloadLinks,
        full_status: fullStatus
      });

      debugLog += "3. Building file list...\n";
      // Build download files list for ALL 6 file types
      const files: DownloadFile[] = [];
      
      // Check each of the 6 file types
      const expectedFileTypes = ['video', 'yolo_csv', 'ocr_csv', 'summary_json', 'audio', 'transcript'];
      
      for (const fileType of expectedFileTypes) {
        const config = fileTypeConfigs[fileType as keyof typeof fileTypeConfigs];
        const originalName = analysisStatus.filename || "video";
        const baseName = originalName.replace(/\.[^/.]+$/, "");
        
        if (downloadLinks[fileType]) {
          debugLog += `   ✓ ${fileType}: AVAILABLE at ${downloadLinks[fileType]}\n`;
          files.push({
            name: `${baseName}_${config.name.replace(/\s+/g, "_")}${config.extension}`,
            type: fileType,
            downloadUrl: downloadLinks[fileType],
            icon: config.icon,
            description: config.description,
            available: true
          });
        } else {
          debugLog += `   ✗ ${fileType}: NOT AVAILABLE in download_links\n`;
          files.push({
            name: `${config.name} (Not Generated)`,
            type: fileType,
            downloadUrl: '',
            icon: config.icon,
            description: `${config.description} - File not generated by backend`,
            available: false
          });
        }
      }
      
      // Check for alternative file names
      debugLog += "4. Checking for alternative file names...\n";
      Object.entries(downloadLinks).forEach(([key, url]) => {
        debugLog += `   Found: "${key}" -> ${url}\n`;
      });
      
      setAvailableFiles(files);
      debugLog += `5. Set ${files.length} files (${files.filter(f => f.available).length} available)\n`;
      
      setDebugInfo(debugLog);
      console.log(debugLog);
      
    } catch (error) {
      const errorMsg = `DownloadPanel: Failed to load analysis data: ${error}`;
      console.error(errorMsg);
      setDebugInfo(debugLog + `ERROR: ${errorMsg}`);
    } finally {
      setIsLoading(false);
      setRefreshing(false);
    }
  };

  const handleRefresh = async () => {
    if (!videoId || refreshing) return;
    setRefreshing(true);
    await loadAnalysisData();
  };

  useEffect(() => {
    if (!videoId) return;

    loadAnalysisData();

    // Auto-refresh every 5 seconds when processing
    let interval: NodeJS.Timeout;
    if (analysisStatus?.status === "processing") {
      interval = setInterval(loadAnalysisData, 5000);
    }

    return () => {
      if (interval) clearInterval(interval);
    };
  }, [videoId]);

  const handleDownload = async (fileType: string, downloadUrl: string, fileName: string) => {
    if (!videoId || !downloadUrl) {
      alert("File not available for download");
      return;
    }
    
    try {
      console.log(`Downloading ${fileType}: ${fileName}`);
      await VideoService.exportFile(videoId, fileType);
    } catch (error) {
      console.error("Download failed:", error);
      alert(`Failed to download ${fileName}. Please try again.`);
    }
  };

  const handleDownloadAll = async () => {
    if (!videoId || availableFiles.length === 0) return;
    
    const downloadableFiles = availableFiles.filter(file => file.available);
    if (downloadableFiles.length === 0) {
      alert("No files available for download");
      return;
    }
    
    try {
      for (const file of downloadableFiles) {
        await handleDownload(file.type, file.downloadUrl, file.name);
        await new Promise(resolve => setTimeout(resolve, 500));
      }
      alert(`Successfully downloaded ${downloadableFiles.length} file(s)!`);
    } catch (error) {
      console.error("Batch download failed:", error);
      alert("Failed to download files. Please try again.");
    }
  };

  const [showDebug, setShowDebug] = useState(false);

  return (
    <div className="h-full flex flex-col bg-[#1a1a1a]">
      <div className="px-4 py-3 border-b border-slate-700 flex items-center justify-between">
        <div>
          <h2 className="text-lg font-semibold text-slate-300">Download Results</h2>
          {videoId && (
            <div className="text-xs text-slate-500 mt-1">
              Video ID: <span className="font-mono">{videoId}</span>
              {analysisStatus?.pipeline_type && (
                <span className="ml-2">• Pipeline: {analysisStatus.pipeline_type}</span>
              )}
            </div>
          )}
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={() => setShowDebug(!showDebug)}
            className="p-2 hover:bg-slate-800 rounded text-slate-400 hover:text-slate-300 transition-colors"
            title="Show Debug Info"
          >
            <Bug className="size-4" />
          </button>
          {videoId && (
            <button
              onClick={handleRefresh}
              disabled={refreshing}
              className="p-2 hover:bg-slate-800 rounded text-slate-400 hover:text-slate-300 disabled:opacity-50 transition-colors"
              title="Refresh"
            >
              {refreshing ? (
                <Loader2 className="size-4 animate-spin" />
              ) : (
                <RefreshCw className="size-4" />
              )}
            </button>
          )}
          {availableFiles.filter(f => f.available).length > 0 && (
            <button
              onClick={handleDownloadAll}
              className="px-3 py-2 text-sm bg-blue-600 hover:bg-blue-700 rounded flex items-center gap-2 transition-colors"
              title="Download All Available Files"
            >
              <Download className="size-4" />
              Download All
            </button>
          )}
        </div>
      </div>

      {analysisStatus && (
        <div className="px-4 py-3 border-b border-slate-700 bg-slate-900/50">
          <div className="flex items-center justify-between mb-2">
            <div className="flex items-center gap-2">
              <StatusBadge status={analysisStatus.status} />
              <span className="text-sm text-slate-300 truncate">
                {analysisStatus.filename}
              </span>
            </div>
            {analysisStatus.progress !== undefined && (
              <span className="text-sm text-slate-400">
                {analysisStatus.progress}%
              </span>
            )}
          </div>
          
          {analysisStatus.status === 'processing' && (
            <div className="w-full bg-slate-700 rounded-full h-2 mt-2">
              <div
                className="bg-green-500 h-2 rounded-full transition-all duration-300"
                style={{ width: `${analysisStatus.progress || 0}%` }}
              />
            </div>
          )}
          
          <div className="flex items-center justify-between mt-2 text-xs text-slate-500">
            <div>
              {analysisStatus.pipeline_type && (
                <span>Pipeline: {analysisStatus.pipeline_type}</span>
              )}
            </div>
            {analysisStatus.cvatID && (
              <div>
                CVAT ID: {analysisStatus.cvatID}
              </div>
            )}
          </div>
        </div>
      )}

      {/* Debug Panel */}
      {showDebug && debugInfo && (
        <div className="border-b border-slate-700 bg-slate-900">
          <div className="px-4 py-2 flex justify-between items-center">
            <h3 className="text-sm font-semibold text-slate-300">Debug Information</h3>
            <button
              onClick={() => setShowDebug(false)}
              className="text-xs text-slate-400 hover:text-slate-300"
            >
              Hide
            </button>
          </div>
          <pre className="text-xs text-slate-400 p-4 max-h-48 overflow-auto font-mono bg-black/30">
            {debugInfo}
          </pre>
        </div>
      )}

      <div className="flex-1 overflow-y-auto p-4">
        {isLoading ? (
          <div className="flex flex-col items-center justify-center h-64">
            <Loader2 className="size-8 text-slate-400 animate-spin mb-4" />
            <div className="text-slate-400">Loading analysis data...</div>
          </div>
        ) : !videoId ? (
          <div className="flex flex-col items-center justify-center h-64">
            <div className="text-slate-400 text-lg mb-2">No Video Selected</div>
            <div className="text-slate-500 text-sm">Select a video to view analysis results</div>
          </div>
        ) : analysisStatus?.status === 'error' ? (
          <div className="flex flex-col items-center justify-center h-64 p-4">
            <AlertCircle className="size-12 text-red-400 mb-4" />
            <div className="text-slate-300 text-lg mb-2 text-center">Analysis Error</div>
            <div className="text-sm text-slate-400 text-center">
              {analysisStatus.error || "An error occurred during analysis"}
            </div>
          </div>
        ) : analysisStatus?.status !== 'completed' ? (
          <div className="flex flex-col items-center justify-center h-64">
            <Clock className="size-12 text-yellow-400 mb-4" />
            <div className="text-slate-300 text-lg mb-2">
              {analysisStatus?.status === 'processing' 
                ? 'Analysis in Progress...' 
                : 'Analysis Not Complete'}
            </div>
            <div className="text-sm text-slate-500 text-center">
              {analysisStatus?.progress !== undefined && (
                <div className="mb-2">{analysisStatus.progress}% complete</div>
              )}
              All 6 file types will be generated when analysis completes
            </div>
          </div>
        ) : (
          <div className="space-y-3">
            <div className="text-sm text-slate-400 mb-4">
              {availableFiles.filter(f => f.available).length} of 6 files generated
            </div>
            
            {availableFiles.map((file, index) => (
              <div
                key={index}
                className={`flex items-center gap-4 p-4 rounded-lg border ${
                  file.available 
                    ? "border-slate-700 hover:bg-slate-800/50 cursor-pointer" 
                    : "border-slate-800 opacity-60 cursor-not-allowed"
                } transition-colors`}
                onClick={() => file.available && handleDownload(file.type, file.downloadUrl, file.name)}
              >
                <div className="flex-shrink-0">
                  {file.icon}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center justify-between mb-1">
                    <div className={`font-medium truncate ${
                      file.available ? "text-slate-300" : "text-slate-500"
                    }`}>
                      {file.name}
                    </div>
                    <span className={`text-xs px-2 py-1 rounded ${
                      file.available 
                        ? "text-slate-500 bg-slate-800/70" 
                        : "text-slate-600 bg-slate-900/50"
                    }`}>
                      {file.type}
                    </span>
                  </div>
                  <div className="text-sm text-slate-500">
                    {file.description}
                  </div>
                </div>
                {file.available ? (
                  <button
                    className="p-2 hover:bg-slate-700 rounded transition-all flex-shrink-0"
                    onClick={(e) => {
                      e.stopPropagation();
                      handleDownload(file.type, file.downloadUrl, file.name);
                    }}
                    title={`Download ${file.name}`}
                  >
                    <Download className="size-5 text-blue-400" />
                  </button>
                ) : (
                  <div className="text-xs text-slate-500 italic px-2">
                    Not generated
                  </div>
                )}
              </div>
            ))}
            
            {availableFiles.filter(f => !f.available).length > 0 && (
              <div className="p-4 bg-slate-900/50 rounded-lg border border-slate-700">
                <h4 className="text-sm font-medium text-slate-300 mb-2">⚠️ Some files not generated</h4>
                <p className="text-xs text-slate-400">
                  The visual analysis pipeline (YOLO + OCR) might have failed. Check:
                </p>
                <ul className="text-xs text-slate-500 mt-2 space-y-1">
                  <li>• Docker backend logs for errors</li>
                  <li>• Visual analysis dependencies are installed</li>
                  <li>• Video file is compatible with analysis tools</li>
                </ul>
              </div>
            )}
            
            <div className="text-xs text-slate-500 mt-4 pt-4 border-t border-slate-700">
              <div className="flex items-center justify-between">
                <div>
                  Backend: <span className="font-mono">localhost:8000</span>
                </div>
                <div>
                  <button 
                    onClick={() => setShowDebug(!showDebug)}
                    className="text-blue-400 hover:text-blue-300"
                  >
                    {showDebug ? "Hide" : "Show"} Debug Info
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}