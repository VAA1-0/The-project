import React, { useState, useEffect } from "react";
import { eventBus } from "@/lib/golden-layout-lib/eventBus";

import { VideoService } from "@/lib/video-service";
import { getVideoBlob } from "@/lib/blob-store";

import { Download, Search, MoreHorizontal } from "lucide-react";

import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";

export default function SpeechToTextPanel() {
  const [videoId, setVideoId] = useState("");

  // Event bus video time line state
  const [videoTimeLine, setVideoTimeLine] = useState<number>(0);

  const lastObjectUrl = React.useRef<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [videoUrl, setVideoUrl] = useState<string | null>(null);
  const [metadata, setMetadata] = useState<any>(null);
  const [blobMissing, setBlobMissing] = useState<boolean>(false);
  const [analysisData, setAnalysisData] = useState<any>(null);
  const [rawCsv, setRawCsv] = useState<string | null>(null);

  // Listen for video ID changes via event bus
  useEffect(() => {
    const handler = (id: string) => {
      setVideoId(id);
    };
    eventBus.on("videoIdChanged", handler);

    return () => {
      eventBus.off("videoIdChanged", handler);
    };
  }, []);

  useEffect(() => {
    async function load() {
      if (!videoId) {
        setIsLoading(false);
        return;
      }

      setIsLoading(true);

      try {
        // Load metadata
        const m = await VideoService.get(videoId);

        console.log("Loaded metadata:", m);

        setMetadata(m);

        // Load video blob - hybrid approach
        // 1. First try to get the original video from IndexedDB (instant preview)
        let blob = await getVideoBlob(videoId);

        if (!blob) {
          // 2. Fallback: try to get the annotated video from the backend (after analysis completes)
          blob = await VideoService.getBlob(videoId);
        }
        if (blob) {
          if (lastObjectUrl.current) {
            URL.revokeObjectURL(lastObjectUrl.current);
          }
          const url = URL.createObjectURL(blob);
          lastObjectUrl.current = url;
          setVideoUrl(url);
          setBlobMissing(false);
        } else {
          setBlobMissing(true);
          setVideoUrl(null);
        }

        // Load analysis data
        const analysis = await VideoService.getAnalysis(videoId);

        setAnalysisData(analysis);
        setRawCsv(analysis.rawCsv || null);
      } catch (err) {
        console.error("Failed to load data:", err);
        setBlobMissing(true);
        setVideoUrl(null);
      } finally {
        setIsLoading(false);
      }
    }
    load();
  }, [videoId]);

  // Use analysisData (fallback to empty arrays if not available)
  // const transcript = analysisData?.transcript ?? [];

  /* Mock transcript data for demonstration */
  const transcript = [
    {
      start: 0.0,
      end: 2.04,
      text: "actually happening. We asked the BBC",
    },
    {
      start: 2.04,
      end: 3.84,
      text: "pilot editor Justin Rola who sent",
    },
    {
      start: 3.84,
      end: 5.28,
      text: "this report from Brazil.",
    },
    {
      start: 6.36,
      end: 8.32,
      text: "When the world faces a big challenge",
    },
    {
      start: 8.32,
      end: 10.12,
      text: "like climate change, you would hope",
    },
    {
      start: 10.12,
      end: 12.24,
      text: "that everyone would come together to",
    },
    {
      start: 12.24,
      end: 14.04,
      text: "help fix it, wouldn't you? And that is why",
    },
    {
      start: 14.04,
      end: 16.4,
      text: "each year countries come together at",
    },
    {
      start: 16.4,
      end: 18.88,
      text: "these COP conferences, these UN",
    },
    {
      start: 18.88,
      end: 21.96,
      text: "Climate Summit to talk about solutions.",
    },
    {
      start: 23.12,
      end: 25.84,
      text: "This one is being held in a city right",
    },
    {
      start: 25.84,
      end: 28.0,
      text: "on the edge of the Amazon jungle.",
    },
    {
      start: 28.12,
      end: 31.0,
      text: "Now the problem is even after 30 of these",
    },
    {
      start: 31.0,
      end: 33.08,
      text: "meetings, emissions of carbon dioxide,",
    },
    {
      start: 33.28,
      end: 35.8,
      text: "that is the main gas warming our planet",
    },
    {
      start: 35.8,
      end: 37.8,
      text: "up are still increasing.",
    },
    {
      start: 37.96,
      end: 40.4,
      text: "So it's easy to see why lots of people",
    },
    {
      start: 40.4,
      end: 42.96,
      text: "say these talks just aren't working.",
    },
    {
      start: 43.36,
      end: 45.48,
      text: "It all comes down to energy.",
    },
    {
      start: 45.8,
      end: 47.68,
      text: "We need energy for everything we do.",
    },
    {
      start: 47.68,
      end: 49.72,
      text: "You can't make anything or go anywhere",
    },
    {
      start: 49.72,
      end: 52.32,
      text: "without it. The problem is most of the",
    },
    {
      start: 52.32,
      end: 54.44,
      text: "energy we use comes from fossil fuels,",
    },
    {
      start: 54.44,
      end: 57.6,
      text: "things like petrol, diesel, gas and coal.",
    },
    {
      start: 57.8,
      end: 60.92,
      text: "Burning them creates carbon dioxide.",
    },
    {
      start: 62.04,
      end: 64.08,
      text: "Now countries want to get rich up.",
    },
    {
      start: 64.08,
      end: 65.84,
      text: "They want to grow their economies and",
    },
    {
      start: 65.84,
      end: 68.04,
      text: "part of that means making and selling",
    },
    {
      start: 68.04,
      end: 70.04,
      text: "things. But because we rely so much",
    },
    {
      start: 70.04,
      end: 73.2,
      text: "on fossil fuels, that means more emissions.",
    },
    {
      start: 73.72,
      end: 74.6,
      text: "Let's take a look inside.",
    },
    {
      start: 77.92,
      end: 81.08,
      text: "Now this is the main hall and it is huge.",
    },
    {
      start: 81.08,
      end: 83.84,
      text: "It's more than half a mile long and they",
    },
    {
      start: 83.84,
      end: 86.04,
      text: "are still finishing putting it together.",
    },
    {
      start: 86.36,
      end: 89.72,
      text: "Now to reduce emissions, we need to switch",
    },
    {
      start: 89.72,
      end: 92.2,
      text: "to cleaner energy sources, things like",
    },
    {
      start: 92.2,
      end: 94.08,
      text: "solar, wind and nuclear and that is",
    },
    {
      start: 94.08,
      end: 95.12,
      text: "beginning to happen.",
    },
    {
      start: 95.28,
      end: 97.4,
      text: "But getting the whole world to change",
    },
    {
      start: 97.4,
      end: 99.48,
      text: "the way it does things is a big task",
    },
    {
      start: 99.64,
      end: 101.52,
      text: "and it is expensive.",
    },
    {
      start: 101.68,
      end: 104.4,
      text: "And when money's involved, it's very hard",
    },
    {
      start: 104.52,
      end: 106.0,
      text: "to get people to agree.",
    },
    {
      start: 106.12,
      end: 107.84,
      text: "Poor countries say to rich countries,",
    },
    {
      start: 107.84,
      end: 110.56,
      text: "you need to pay for us to get clean energy",
    },
    {
      start: 110.64,
      end: 113.52,
      text: "because you got rich burning fossil fuels.",
    },
    {
      start: 113.68,
      end: 115.44,
      text: "Rich countries often say, well, listen,",
    },
    {
      start: 115.56,
      end: 117.48,
      text: "we've got our own problems to worry about.",
    },
    {
      start: 117.6,
      end: 119.88,
      text: "And when one country says it's not going",
    },
    {
      start: 119.88,
      end: 123.24,
      text: "to help out, other countries say, well,",
    },
    {
      start: 123.24,
      end: 124.0,
      text: "why should I?",
    },
    {
      start: 125.44,
      end: 127.8,
      text: "The hope is that clean energy will become",
    },
    {
      start: 127.8,
      end: 129.56,
      text: "the cheapest option and that is beginning",
    },
    {
      start: 129.56,
      end: 132.0,
      text: "to happen. But switching takes time.",
    },
    {
      start: 132.2,
      end: 134.28,
      text: "The aim of getting people to meet things",
    },
    {
      start: 134.28,
      end: 136.12,
      text: "like this is to speed things up.",
    },
    {
      start: 136.16,
      end: 138.4,
      text: "But countries can only make promises and in",
    },
    {
      start: 138.4,
      end: 140.76,
      text: "reality, they often find changes more",
    },
    {
      start: 140.76,
      end: 141.88,
      text: "difficult than they thought.",
    },
    {
      start: 141.88,
      end: 144.64,
      text: "Still climate change affects everything",
    },
    {
      start: 144.64,
      end: 145.96,
      text: "and everyone on earth.",
    },
    {
      start: 146.16,
      end: 148.2,
      text: "So getting everyone together in room.",
    },
  ];

  const detectedObjects = analysisData?.detectedObjects ?? [];
  const summaryText = analysisData?.summary ?? "…";

  return (
    <TooltipProvider delayDuration={200}>
      <main className="h-full flex flex-col overflow-hidden">
        <div className="text-xs text-slate-400 px-3 py-2 shrink-0">
          video Id: {videoId}
        </div>
        <div className="flex-1 flex flex-col overflow-hidden">
          {/* Header */}
          <div className="bg-[#1a1a1a] px-3 py-2 border-b border-[#0a0a0a] flex items-center justify-between shrink-0">
            <span className="text-[#b8b8b8] text-[12px]">Analyze Results</span>
            <div className="flex items-center gap-1">
              <Tooltip>
                <TooltipTrigger asChild>
                  <button className="p-1 hover:bg-[#2a2a2a] rounded">
                    <Search className="size-3.5 text-[#b8b8b8]" />
                  </button>
                </TooltipTrigger>
                <TooltipContent>
                  <p>Search transcript</p>
                </TooltipContent>
              </Tooltip>
              <Tooltip>
                <TooltipTrigger asChild>
                  <button className="p-1 hover:bg-[#2a2a2a] rounded">
                    <MoreHorizontal className="size-3.5 text-[#b8b8b8]" />
                  </button>
                </TooltipTrigger>
                <TooltipContent>
                  <p>More actions</p>
                </TooltipContent>
              </Tooltip>
            </div>
          </div>
          {/* SUMMARY */}
          <div className="px-3 py-2 shrink-0">
            <div className="text-sm font-semibold mb-2">Summary:</div>
            {summaryText.length === 0 ? (
              <div className="p-3 rounded-lg bg-slate-700/20 text-slate-300">
                No summary available
              </div>
            ) : (
              <div className="p-3 bg-slate-700/30 rounded-lg">
                <div className="text-sm text-slate-200">{summaryText}</div>
              </div>
            )}
          </div>
          {/* Speech to text */}
          {/* Scrollable list container: flexible height with vertical scrolling */}
          <div className="min-h-0 px-3 flex flex-col">
            <div className="text-sm font-semibold mb-2 shrink-0">
              Speech to Text:
            </div>
            <div className="flex-1 overflow-y-auto space-y-2 pr-2">
              {transcript.length === 0 ? (
                <div className="p-3 rounded-lg bg-slate-700/20 text-slate-300">
                  No speech to text detected
                </div>
              ) : (
                transcript.map((row: any) => (
                  <div
                    key={row.start}
                    className="p-3 bg-slate-700/30 rounded-lg cursor-pointer hover:bg-slate-700/50"
                    // Click to seek video to object timestamp
                    onClick={() => {
                      eventBus.emit("videoTimeLineChanged", row.start);
                      console.log("Seeking video to", row.start);
                    }}
                  >
                    <div className="text-xs text-cyan-300">
                      {row.start}s ~ {row.end}s
                    </div>
                    <div className="text-sm text-slate-200">{row.text}</div>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>
      </main>
    </TooltipProvider>
  );
}
