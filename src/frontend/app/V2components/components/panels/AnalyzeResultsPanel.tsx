import { Download, Search, MoreHorizontal } from "lucide-react";

export default function AnalyzeResultsPanel() {
  const results = [
    { name: "Video-name_Speech_to_text.csv" },
    { name: "Video-name_Summary.json" },
    { name: "Video-name_Annotated_video.mp4" },
    { name: "Video-name_Annotatedsdsdsdsdsd" },
    { name: "Video-name_Annotatedsdsdsdsdsd" },
    { name: "Video-name_Annotatedsdsdsdsdsd" },
  ];

  return (
    <div className="bg-[#1a1a1a] border-t border-[#0a0a0a] flex flex-col h-full">
      {/* Header */}
      <div className="bg-[#1a1a1a] px-3 py-2 border-b border-[#0a0a0a] flex items-center justify-between">
        <span className="text-[#b8b8b8] text-[12px]">Analyze Results</span>
        <div className="flex items-center gap-1">
          <button className="p-1 hover:bg-[#2a2a2a] rounded">
            <Search className="size-3.5 text-[#b8b8b8]" />
          </button>
          <button className="p-1 hover:bg-[#2a2a2a] rounded">
            <MoreHorizontal className="size-3.5 text-[#b8b8b8]" />
          </button>
        </div>
      </div>

      {/* Scrollable list */}
      <div className="flex-1 overflow-y-auto p-2">
        {results.map((result, index) => (
          <div
            key={index}
            className="flex items-center gap-2 px-2 py-2 hover:bg-[#2a2a2a] cursor-pointer group rounded mb-1"
          >
            <span className="text-[#b8b8b8] text-[11px] flex-1 truncate">
              {result.name}
            </span>
            <button
              className="p-1 hover:bg-[#3a3a3a] rounded opacity-0 group-hover:opacity-100 transition-opacity"
              onClick={() => console.log("download", result.name)}
            >
              <Download className="size-3.5 text-[#5391e8]" />
            </button>
          </div>
        ))}
      </div>
    </div>
  );
}
