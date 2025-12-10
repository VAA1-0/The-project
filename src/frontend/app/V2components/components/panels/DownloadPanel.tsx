"use client";

import { useEffect, useState } from "react";
import { Download, RefreshCcw } from "lucide-react";

const API_BASE = "http://localhost:8000";

type FileType =
  | "video"
  | "yolo_csv"
  | "ocr_csv"
  | "summary_json"
  | "audio"
  | "transcript";

const FILE_TYPES: FileType[] = [
  "video",
  "yolo_csv",
  "ocr_csv",
  "summary_json",
  "audio",
  "transcript",
];

const FILE_LABELS: Record<FileType, string> = {
  video: "Annotated Video (annotated_video.mp4)",
  yolo_csv: "YOLO Detections (yolo_detections.csv)",
  ocr_csv: "OCR Text (ocr_text.csv)",
  summary_json: "Visual Summary (analysis_summary.json)",
  audio: "Extracted Audio (extracted_audio.wav)",
  transcript: "Transcript (transcript.json)",
};

export default function DownloadPanel() {
  const [analysisId, setAnalysisId] = useState<string | null>(null);
  const [available, setAvailable] = useState<Record<string, boolean>>({});
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // ✅ Use BACKEND_WORKING behavior
  useEffect(() => {
    const interval = setInterval(() => {
      const saved =
        localStorage.getItem("analysisId") ||
        localStorage.getItem("backend_analysis_id");

      if (saved && saved !== analysisId) {
        setAnalysisId(saved);
      }
    }, 500);

    return () => clearInterval(interval);
  }, [analysisId]);

  // ✅ Refresh detection
  async function refreshFiles() {
    if (!analysisId) return;

    setLoading(true);
    setError(null);

    try {
      const res = await fetch(
        `${API_BASE}/api/status/${analysisId}`,
        { cache: "no-store" }
      );

      if (!res.ok) {
        throw new Error("Status endpoint failed");
      }

      const data = await res.json();
      const links = data.download_links || {};

      const map: Record<string, boolean> = {};
      FILE_TYPES.forEach((type) => {
        map[type] = Boolean(links[type]);
      });

      setAvailable(map);
    } catch (e: any) {
      setError(e?.message ?? "Failed to refresh");
    } finally {
      setLoading(false);
    }
  }

  // ✅ Download logic
  async function downloadFile(type: FileType) {
    if (!analysisId) return;

    try {
      const res = await fetch(
        `${API_BASE}/api/download/${analysisId}/${type}`
      );

      if (!res.ok) throw new Error("File not ready");

      const blob = await res.blob();
      const url = window.URL.createObjectURL(blob);

      const a = document.createElement("a");
      a.href = url;
      a.download = fileName(type);
      document.body.appendChild(a);
      a.click();
      a.remove();
      window.URL.revokeObjectURL(url);

    } catch (e) {
      console.error(e);
    }
  }

  function fileName(type: FileType) {
    switch (type) {
      case "video":
        return "annotated_video.mp4";
      case "yolo_csv":
        return "yolo_detections.csv";
      case "ocr_csv":
        return "ocr_text.csv";
      case "summary_json":
        return "analysis_summary.json";
      case "audio":
        return "extracted_audio.wav";
      default:
        return "transcript.json";
    }
  }

  // ✅ Download all 6
  async function downloadAll() {
    for (const t of FILE_TYPES) {
      if (available[t]) {
        await downloadFile(t);
      }
    }
  }

  return (
    <div className="bg-[#232323] flex flex-col h-full w-full">
      <div className="bg-[#1a1a1a] px-3 py-2 border-b border-[#0a0a0a] flex items-center justify-between">
        <span className="text-[#b8b8b8] text-[13px]">
          Analysis Outputs
        </span>

        <div className="flex gap-2">
          <button
            onClick={refreshFiles}
            disabled={!analysisId}
            className="p-1 hover:bg-[#2a2a2a] rounded"
          >
            <RefreshCcw className="size-3.5 text-[#b8b8b8]" />
          </button>

          <button
            onClick={downloadAll}
            disabled={!analysisId}
            className="text-[11px] text-blue-400 hover:underline disabled:opacity-40"
          >
            Download All
          </button>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto p-2">
        {!analysisId && (
          <div className="text-[12px] text-yellow-400 p-2">
            Waiting for backend analysis…
          </div>
        )}

        {error && (
          <div className="text-[11px] text-red-400 p-2">
            {error}
          </div>
        )}

        {FILE_TYPES.map((type) => (
          <div
            key={type}
            className="flex items-center gap-2 px-2 py-2 rounded hover:bg-[#2a2a2a]"
          >
            <span className="text-[#b8b8b8] text-[11px] flex-1 truncate">
              {FILE_LABELS[type]}
            </span>

            <button
              disabled={!available[type]}
              onClick={() => downloadFile(type)}
              className={`p-1 rounded ${
                available[type]
                  ? "hover:bg-[#3a3a3a]"
                  : "opacity-30 cursor-not-allowed"
              }`}
            >
              <Download className="size-3.5 text-blue-400" />
            </button>
          </div>
        ))}

        {loading && (
          <div className="text-[11px] text-slate-400 p-2">
            Checking files…
          </div>
        )}
      </div>
    </div>
  );
}


