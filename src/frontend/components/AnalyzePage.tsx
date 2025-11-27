"use client"; // ⚠️ This component uses client-side hooks, review it

// Not the exact same as Figma, needs some refactoring later

import React, { useState } from "react";
import { useRouter, useParams } from "next/navigation";

import { getVideoBlob } from "@/lib/blob-store";
import { Library } from "@/lib/local-library";

import { Button } from "./ui/button";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardDescription,
} from "./ui/card";
import { Separator } from "./ui/separator";
import {Toggle, toggleVariants} from "./ui/toggle";

export default function AnalyzePage() {
  const router = useRouter();

  const { id } = useParams() as { id: string };

  const [videoUrl, setVideoUrl] = useState<string | null>(null);
  const [metadata, setMetadata] = useState<any>(null);

  // Helper: format seconds into H:MM:SS or M:SS
  function formatDuration(sec?: number | null) {
    if (sec == null || isNaN(Number(sec))) return "…";
    const s = Math.max(0, Math.floor(sec));
    const h = Math.floor(s / 3600);
    const m = Math.floor((s % 3600) / 60);
    const ss = s % 60;
    const pad = (n: number) => n.toString().padStart(2, "0");
    if (h > 0) return `${h}:${pad(m)}:${pad(ss)}`;
    return `${m}:${pad(ss)}`;
  }

  // Toggle states
  const [showTranscript, setShowTranscript] = useState(true);
  const [showSummary, setShowSummary] = useState(true);
  const [showObjects, setShowObjects] = useState(true);
  const [showQuantity, setShowQuantity] = useState(true);
  const [showAnnotations, setShowAnnotations] = useState(true);

  // Expand/collapse for each module
  const [expandTranscript, setExpandTranscript] = useState(false);
  const [expandSummary, setExpandSummary] = useState(false);
  const [expandObjects, setExpandObjects] = useState(false);
  const [expandQuantity, setExpandQuantity] = useState(false);
  const [expandAnnotations, setExpandAnnotations] = useState(false);

  // Compact toggle definitions to render via map (reduces repeated JSX)
  const toggleItems = [
    { key: "transcript", label: "Speech-to-Text", pressed: showTranscript, setPressed: setShowTranscript },
    { key: "summary", label: "Summary", pressed: showSummary, setPressed: setShowSummary },
    { key: "objects", label: "Object Detection", pressed: showObjects, setPressed: setShowObjects },
    { key: "quantity", label: "Quantity Detection", pressed: showQuantity, setPressed: setShowQuantity },
    { key: "annotations", label: "Annotation", pressed: showAnnotations, setPressed: setShowAnnotations },
  ];



  // KIAVASH HERE : RAW DATA EXPORT STATES
  const [isLoading, setIsLoading] = useState(true);
  const [rawCsv, setRawCsv] = useState<string | null>(null);

  // KIAVASH HERE : LOAD RAW DATA EFFECT
  React.useEffect(() => {
    async function fetchRawData() {
      if (!id) return;
      setIsLoading(true);
      try {
        // Simulate fetching raw CSV data from backend or IndexedDB
        // Replace this with actual data fetching logic
        const simulatedCsv = `timestamp,object,confidence\n00:00,Person,0.98\n00:05,Laptop,0.95\n00:10,Person,0.97\n`;
        // Simulate network delay
        await new Promise((resolve) => setTimeout(resolve, 1000));
        setRawCsv(simulatedCsv);
      } catch (error) {
        console.error("Error fetching raw CSV data:", error);
        setRawCsv(null);
      }
      setIsLoading(false);
    }
    fetchRawData();
  }, [id]);

  //KIAVASH HERE : ANALYZE VIDEO EFFECT
  React.useEffect(() => {
    async function analyzeVideo() {
      if (!id) return;
      // Simulate video analysis process
      console.log(`Analyzing video with ID: ${id}`);
      // Add your analysis logic here
    }
    analyzeVideo();
  }, [id]);

  // KIAVASH HERE : ANALYZE VIDEO HANDLER
  function handleAnalyzeVideo() {
    alert("Starting analysis (stub)");
  }

  // KIAVASH HERE : EXPORT RAW DATA HANDLER
  function handleExport() {
    // Hook your export logic here
    alert("Exporting analysis (stub)");
  }

  
  
  // Load video and metadata on mount
  React.useEffect(() => {
    async function load() {
      if (!id) return;

      // 1. Load metadata from local library
      const m = Library.getById(id);
      setMetadata(m);

      // 2. Load blob from IndexedDB
      const blob = await getVideoBlob(id);
      if (blob) {
        setVideoUrl(URL.createObjectURL(blob));
      }
    }
    load();
  }, [id]);

  // Example transcript / timeline data — replace with real data when available
  const transcript = [
    { t: "00:00", speaker: "Speaker 1", text: "Welcome to GameRun's comprehensive video analysis platform." },
    { t: "00:35", speaker: "Speaker 1", text: "Our advanced algorithms analyze every frame, detecting objects, emotions, and key moments." },
    { t: "01:00", speaker: "Speaker 2", text: "The platform uses cutting-edge machine learning models to understand context." },
    { t: "01:23", speaker: "Speaker 2", text: "Let's dive into the product demonstration." },
    { t: "01:45", speaker: "Speaker 1", text: "Notice how the AI identifies not just what's in the video, but also the emotional tone." },
  ];

  // Example insights data — replace with real insights when available
  const insights = [
    { id: "ins-1", title: "Top Moments", body: "Detected 12 highlights across the video" },
    { id: "ins-2", title: "Avg Confidence", body: "91% average model confidence across predictions" },
    { id: "ins-3", title: "People Present", body: "3 distinct speakers detected" },
  ];

  // Placeholder objects
  const detectedObjects = [
    { name: "Person", count: "15x", time: "0:00", confidence: "98%", present: "100%" },
    { name: "Laptop", count: "8x", time: "0:20", confidence: "95%", present: "72%" },
  ];

  // Placeholder quantity info
  const quantityInfo = [
    { label: "People Count Over Time", desc: "Placeholder data for crowd detection." }
  ];

  // Placeholder annotation
  const annotations = [
    { note: "Interesting moment at 01:20", time: "01:20" }
  ];

  // Placeholder summary
  const summaryText =
    "This is a placeholder summary. When backend is connected, this section will show auto-generated short summaries.";

  return (
    <div className=" flex flex-col bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 text-slate-100">

      {/* BODY LAYOUT */}
      <div className="flex flex-1 overflow-hidden">
        
        {/* LEFT SIDEBAR */}
        <aside className="w-64 border-r border-slate-700 bg-slate-800/40 p-6 flex flex-col gap-6 overflow-y-auto">
          {/* User info placeholder */}
          <div className="flex justify-start text-center gap-2">
            <div className="w-16 h-16 rounded-lg bg-blue-700 flex items-center justify-center text-xl font-semibold">
              JD
            </div>
            <div className="flex flex-col justify-center">
              <div className="text-white font-medium">John Doe</div>
              <div className="text-xs text-slate-400">john@example.com</div>
            </div>
          </div>

          <Separator />

          {/* TOGGLES (rendered from compact config) */}
          <div className="space-y-3">
            {toggleItems.map((t) => (
              <Toggle
                key={t.key}
                pressed={t.pressed}
                // cast to any because Toggle's onPressedChange signature may be (v:boolean)=>void
                onPressedChange={t.setPressed as any}
                className="cursor-pointer w-full justify-start bg-slate-700/30 data-[state=on]:bg-blue-600/40"
              >
                {t.label}
              </Toggle>
            ))}
          </div>
        </aside>

        {/* MIDDLE SCROLLABLE AREA */}
        <main className="flex-1 overflow-y-auto p-6 space-y-6 max-w-[900px] mx-auto">

          {/* TRANSCRIPT */}
          {showTranscript && (
            <Card className="bg-slate-800/50 border-slate-700 hover:bg-slate-700/40 transition">
              <CardHeader onClick={() => setExpandTranscript(!expandTranscript)} className="cursor-pointer">
                <CardTitle>Speech-to-Text</CardTitle>
                <CardDescription>Transcript generated from audio</CardDescription>
              </CardHeader>
              {expandTranscript && (
                <CardContent className="space-y-3 max-h-[350px] overflow-y-auto">
                  {transcript.map((row) => (
                    <div key={row.t} className="p-3 bg-slate-700/30 rounded-lg">
                      <div className="text-xs text-cyan-300">{row.t} • {row.speaker}</div>
                      <div className="text-sm text-slate-200">{row.text}</div>
                    </div>
                  ))}
                </CardContent>
              )}
            </Card>
          )}

          {/* SUMMARY */}
          {showSummary && (
            <Card className="bg-slate-800/50 border-slate-700 hover:bg-slate-700/40 transition">
              <CardHeader onClick={() => setExpandSummary(!expandSummary)} className="cursor-pointer">
                <CardTitle>Summary</CardTitle>
                <CardDescription>Short breakdown of the video</CardDescription>
              </CardHeader>
              {expandSummary && (
                <CardContent>
                  <p className="text-slate-300">{summaryText}</p>
                </CardContent>
              )}
            </Card>
          )}

          {/* OBJECTS */}
          {showObjects && (
            <Card className="bg-slate-800/50 border-slate-700 hover:bg-slate-700/40 transition">
              <CardHeader onClick={() => setExpandObjects(!expandObjects)} className="cursor-pointer">
                <CardTitle>Detected Objects</CardTitle>
                <CardDescription>AI object detection results</CardDescription>
              </CardHeader>
              {expandObjects && (
                <CardContent className="space-y-3">
                  {detectedObjects.map((obj) => (
                    <div key={obj.name} className="p-3 rounded-lg bg-slate-700/30">
                      <div className="flex justify-between text-white">
                        <span>{obj.name}</span>
                        <span>{obj.count}</span>
                      </div>
                      <div className="text-xs text-slate-400">First seen at {obj.time}</div>
                    </div>
                  ))}
                </CardContent>
              )}
            </Card>
          )}

          {/* QUANTITY DETECTION */}
          {showQuantity && (
            <Card className="bg-slate-800/50 border-slate-700 hover:bg-slate-700/40 transition">
              <CardHeader onClick={() => setExpandQuantity(!expandQuantity)} className="cursor-pointer">
                <CardTitle>Quantity Detection</CardTitle>
                <CardDescription>Counts of people/objects</CardDescription>
              </CardHeader>
              {expandQuantity && (
                <CardContent>
                  {quantityInfo.map((q) => (
                    <div key={q.label} className="p-3 bg-slate-700/30 rounded-lg">
                      <div className="text-white font-medium">{q.label}</div>
                      <div className="text-xs text-slate-400">{q.desc}</div>
                    </div>
                  ))}
                </CardContent>
              )}
            </Card>
          )}

          {/* ANNOTATIONS */}
          {showAnnotations && (
            <Card className="bg-slate-800/50 border-slate-700 hover:bg-slate-700/40 transition">
              <CardHeader onClick={() => setExpandAnnotations(!expandAnnotations)} className="cursor-pointer">
                <CardTitle>Annotations</CardTitle>
                <CardDescription>User notes</CardDescription>
              </CardHeader>
              {expandAnnotations && (
                <CardContent className="space-y-3">
                  {annotations.map((a, idx) => (
                    <div key={idx} className="p-3 bg-slate-700/30 rounded-lg">
                      <div className="text-sm text-slate-200">{a.note}</div>
                      <div className="text-xs text-slate-400">{a.time}</div>
                    </div>
                  ))}
                </CardContent>
              )}
            </Card>
          )}

        </main>

        {/* FIXED RIGHT COLUMN — VIDEO PLAYER */}
        <aside className="w-[580px] border-l border-slate-700 bg-slate-800/30 p-6 flex flex-col gap-6">
          <Card className="bg-slate-900 border-slate-700">
            <CardContent className="p-0">
              <div className="h-[350px] flex items-center justify-center bg-black rounded-t-lg">
                {videoUrl ? (
                  <video src={videoUrl} controls className="w-full h-full object-contain rounded-lg" />
                ) : (
                  <div className="text-slate-400">Loading video...</div>
                )}
              </div>
            </CardContent>
          </Card>

          <Card className="bg-slate-800/50 border-slate-700">
            <CardHeader>
              <CardTitle>Video Info</CardTitle>
              <CardDescription>Basic metadata</CardDescription>
            </CardHeader>
            <CardContent className="text-sm text-slate-300 space-y-1">
              <div><span className="text-slate-400">Filename:</span> {metadata?.name ?? "…"}</div>
              <div><span className="text-slate-400">Duration:</span> {formatDuration(metadata?.length)}</div>
            </CardContent>
          </Card>


          {/* KIAVASH HERE : RAW DATA EXPORT */}
          <Card className="bg-slate-800/50 border-slate-700">
            <CardHeader>
              <div className="flex items-center justify-between w-full">
                <div>
                  <CardTitle>Raw Data</CardTitle>
                  <CardDescription>Video data from CSV file</CardDescription>
                </div>


                {/* Button to start analyzing video*/}
                <Button
                  variant="default"
                  className="bg-green-600/40 hover:bg-green-600/60 transition"
                  onClick={handleAnalyzeVideo}
                >
                  Analyze
                </Button>

                {/* Download CSV button */}
                <Button
                  variant="default"
                  className="bg-blue-600/40 hover:bg-blue-600/60 transition"
                  onClick={handleExport}
                >
                  Download
                </Button>
              </div>
            </CardHeader>

            <CardContent className="text-sm text-slate-300">

              {/* Loading indicator */}
              {isLoading && (
                <div className="text-slate-400 italic py-4">
                  Loading CSV data…
                </div>
              )}

              {/* Empty state */}
              {!isLoading && !rawCsv && (
                <div className="text-slate-400 py-4">
                  No raw data available for this video yet.
                </div>
              )}

              {/* Scrollable CSV viewer */}
              {!isLoading && rawCsv && (
                <div className="mt-2 max-h-[300px] overflow-auto rounded-lg bg-slate-900/40 p-3 border border-slate-700">
                  <pre className="whitespace-pre text-xs font-mono text-slate-200">
                    {rawCsv}
                  </pre>
                </div>
              )}
            </CardContent>
          </Card>

        </aside>

      </div>
    </div>
  );
}