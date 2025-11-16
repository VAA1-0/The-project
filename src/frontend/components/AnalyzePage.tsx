"use client"; // ⚠️ This component uses client-side hooks, review it

// Not the exact same as Figma, needs some refactoring later

import React, { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "./ui/button";
import { Input } from "./ui/input";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardDescription,
} from "./ui/card";
import { Separator } from "./ui/separator";
import { GameRunLogo } from "./ProjectLogo";

// AnalyzePage — rewritten to use the shared UI components (Card, Button, Input)
// Layout choices:
// - Header at top (Back / Export / Share)
// - Two-column content: left = video + timeline, right = insights + transcript
// - Cards used for each major area for visual consistency with Dashboard

export default function AnalyzePage() {
  const router = useRouter();
  const [search, setSearch] = useState("");

  // Example transcript / timeline data — replace with real data when available
  const transcript = [
    { t: "00:00", speaker: "Speaker 1", text: "Welcome to GameRun's comprehensive video analysis platform." },
    { t: "00:35", speaker: "Speaker 1", text: "Our advanced algorithms analyze every frame, detecting objects, emotions, and key moments." },
    { t: "01:00", speaker: "Speaker 2", text: "The platform uses cutting-edge machine learning models to understand context." },
    { t: "01:23", speaker: "Speaker 2", text: "Let's dive into the product demonstration." },
    { t: "01:45", speaker: "Speaker 1", text: "Notice how the AI identifies not just what's in the video, but also the emotional tone." },
  ];

  const insights = [
    { id: "ins-1", title: "Top Moments", body: "Detected 12 highlights across the video" },
    { id: "ins-2", title: "Avg Confidence", body: "91% average model confidence across predictions" },
    { id: "ins-3", title: "People Present", body: "3 distinct speakers detected" },
  ];

  function handleBack() {
    router.push("/dashboard");
  }

  function handleExport() {
    // Hook your export logic here
    alert("Exporting analysis (stub)");
  }

  function handleShare() {
    // Hook share logic (copy link / open modal)
    alert("Open share modal (stub)");
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 text-slate-100">
      {/* Header */}
      <header className="w-full border-b border-slate-700 bg-slate-800/50">
        <div className="max-w-7xl mx-auto px-6 py-4 flex items-center justify-between">
          <div className="flex items-center gap-4">
            <button onClick={handleBack} className="inline-flex items-center gap-2 text-sm text-slate-200 hover:text-white">
              <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none"><path d="M15 18l-6-6 6-6" stroke="currentColor" strokeWidth={1.5} strokeLinecap="round" strokeLinejoin="round"/></svg>
              Back
            </button>

            <div className="flex items-center gap-3">
              <GameRunLogo size="sm" />
              <div className="text-lg font-semibold">Analyze Results</div>
            </div>
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

            <Button variant="ghost" onClick={handleShare}>Share</Button>
            <Button variant="ghost" onClick={handleExport}>Export</Button>
          </div>
        </div>
      </header>

      {/* Main content */}
      <main className="max-w-7xl mx-auto px-6 py-10">
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
          {/* Left column - Video preview + timeline (col-span 8) */}
          <div className="lg:col-span-8 space-y-6">
            <Card className="bg-slate-800/50 border-slate-700">
              <CardContent className="p-0">
                <div className="bg-slate-900 rounded-tl-lg rounded-tr-lg h-[420px] flex items-center justify-center">
                  {/* Placeholder video preview area — replace with <video> player and controls */}
                  <div className="flex flex-col items-center text-center gap-4">
                    <div className="w-28 h-28 bg-blue-600/20 rounded-full flex items-center justify-center">
                      <svg className="w-10 h-10 text-blue-400" viewBox="0 0 24 24" fill="none"><path d="M5 3v18l15-9L5 3z" fill="currentColor"/></svg>
                    </div>
                    <div className="text-white font-semibold">Video Preview</div>
                    <div className="text-sm text-slate-400">Use a video player here (e.g., <code>&lt;video&gt;</code> or react-player)</div>
                  </div>
                </div>

                {/* Basic playback controls + meta */}
                <div className="p-4 flex items-center justify-between">
                  <div className="flex items-center gap-4">
                    <div className="text-sm text-slate-400">Duration: 0:25 - 2:45</div>
                    <div className="text-sm text-slate-400">Confidence: 96% • Present: 78%</div>
                  </div>

                  <div className="flex items-center gap-2">
                    <Button size="sm" variant="outline">Prev</Button>
                    <Button size="sm" className="bg-blue-600">Play</Button>
                    <Button size="sm" variant="outline">Next</Button>
                  </div>
                </div>

                <Separator />
                
                {/* Timeline / highlights */}
                <div className="p-4">
                  <div className="text-sm text-slate-300 mb-3">Highlights</div>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                    <div className="p-3 bg-slate-700/30 rounded-lg">
                      <div className="text-sm text-slate-200 font-medium">Highlight: Product demo</div>
                      <div className="text-xs text-slate-400">01:23 — Detected strong engagement</div>
                    </div>
                    <div className="p-3 bg-slate-700/30 rounded-lg">
                      <div className="text-sm text-slate-200 font-medium">Highlight: Audience reaction</div>
                      <div className="text-xs text-slate-400">02:01 — Peaks in attention</div>
                    </div>
                  </div>
                </div>
                
              </CardContent>
            </Card>

            {/* Transcription / Timeline detailed list */}
            <Card className="bg-slate-800/50 border-slate-700">
              <CardHeader>
                <CardTitle>Transcript</CardTitle>
                <CardDescription>Speech-to-text with speaker labels and timestamps</CardDescription>
              </CardHeader>

              <CardContent className="p-4">
                <div className="space-y-3 max-h-[340px] overflow-y-auto">
                  {transcript.map((row) => (
                    <div key={row.t} className="p-3 bg-slate-700/30 rounded-md">
                      <div className="flex items-start gap-3">
                        <div className="w-12 flex-shrink-0">
                          <div className="text-xs text-cyan-300 font-medium">{row.t}</div>
                          <div className="text-xs text-slate-400">{row.speaker}</div>
                        </div>
                        <div className="flex-1 text-slate-300">{row.text}</div>
                        <div className="ml-4 flex items-center gap-2">
                          <Button size="sm" variant="ghost" onClick={() => alert(`Jump to ${row.t} (stub)`)}>Jump</Button>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Right column - Insights, metrics, controls (col-span 4) */}
          <aside className="lg:col-span-4 space-y-6">
                        <Card className="bg-slate-800/50 border-slate-700">
              <CardHeader>
                <CardTitle>Metadata</CardTitle>
                <CardDescription>Basic information about this video</CardDescription>
              </CardHeader>

              <CardContent>
                <div className="text-sm text-slate-300 space-y-1">
                  <div><span className="text-slate-400">Filename:</span> product_demo.mp4</div>
                  <div><span className="text-slate-400">Uploaded:</span> Oct 1, 2025</div>
                  <div><span className="text-slate-400">Duration:</span> 2:45</div>
                </div>
              </CardContent>
            </Card>

            {/* Object Detection Section */}
            <Card className="bg-slate-800/50 border-slate-700">
              <CardHeader>
                <div className="flex items-center justify-between">
                  <CardTitle>Detected Objects</CardTitle>
                  <div className="px-2 py-1 rounded-lg border border-slate-600 text-xs text-slate-300">
                    8 Found
                  </div>
                </div>
                <CardDescription>Click to jump to first appearance in video</CardDescription>
              </CardHeader>

              <CardContent className="space-y-3 max-h-[500px] overflow-y-auto pr-2">
                {/* Sample objects */}
                {[
                  { name: "Person", time: "0:00", count: "15x", confidence: "98%", present: "100%" },
                  { name: "Laptop", time: "0:20", count: "8x", confidence: "95%", present: "72%" },
                  { name: "Phone", time: "0:45", count: "5x", confidence: "92%", present: "50%" },
                  { name: "Coffee Cup", time: "0:15", count: "4x", confidence: "88%", present: "42%" },
                  { name: "Monitor", time: "0:25", count: "7x", confidence: "94%", present: "78%" },
                ].map((obj) => (
                  <Card key={obj.name} className="bg-slate-700/30 border-slate-600">
                    <CardContent className="p-4 space-y-2">
                      <div className="flex items-center justify-between">
                        <div className="font-medium text-white">{obj.name}</div>
                        <div className="text-xs text-slate-300 border border-slate-600 px-2 py-0.5 rounded-lg">
                          {obj.count}
                        </div>
                      </div>

                      <div className="text-xs text-blue-400">First seen at {obj.time}</div>

                      <div className="flex justify-between text-xs text-slate-400">
                        <span>Confidence: {obj.confidence}</span>
                        <span>Present: {obj.present}</span>
                      </div>

                      <div className="h-1 w-full bg-slate-700 rounded-full overflow-hidden">
                        <div className="h-1 bg-blue-400" style={{ width: obj.present }} />
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </CardContent>
            </Card>
            <Card className="bg-slate-800/50 border-slate-700">
              <CardHeader>
                <CardTitle>Insights</CardTitle>
                <CardDescription>Summarized recommendations from the analysis</CardDescription>
              </CardHeader>

              <CardContent>
                <div className="space-y-3">
                  {insights.map((ins) => (
                    <div key={ins.id} className="p-3 bg-slate-700/30 rounded-md">
                      <div className="text-sm text-slate-200 font-medium">{ins.title}</div>
                      <div className="text-xs text-slate-400">{ins.body}</div>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>

            <Card className="bg-slate-800/50 border-slate-700">
              <CardHeader>
                <CardTitle>Quick Controls</CardTitle>
                <CardDescription>Tools for working with this analysis</CardDescription>
              </CardHeader>

              <CardContent>
                <div className="flex flex-col gap-3">
                  <Input placeholder="Search transcript…" value={search} onChange={(e) => setSearch(e.target.value)} />

                  <div className="flex gap-2">
                    <Button onClick={() => alert("Add note (stub)")}>Add Note</Button>
                    <Button variant="ghost" onClick={() => alert("Export clips (stub)")}>Export Clips</Button>
                  </div>
                </div>
              </CardContent>
            </Card>

          </aside>
        </div>
      </main>
    </div>
  );
}
