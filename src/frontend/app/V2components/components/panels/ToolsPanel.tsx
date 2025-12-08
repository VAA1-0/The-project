import {
  MessageSquareText,
  Brain,
  View,
  ScanEye,
  ChartScatter,
} from "lucide-react";

interface ToolsPanelProps {
  videoId?: string | null;
}

export default function ToolsPanel({ videoId }: ToolsPanelProps) {
  const tools = [
    { icon: MessageSquareText, label: "Speech to text Tool" },
    { icon: Brain, label: "Summary" },
    { icon: View, label: "Object detection" },
    { icon: ChartScatter, label: "Quantity Detection" },
    { icon: ScanEye, label: "Annotations" },
  ];

  return (
    <div className="flex h-full">
      <div className="bg-[#232323] w-[52px] h-full border-r border-[#0a0a0a] flex flex-col items-center py-2 gap-0">
        {tools.map((tool, index) => {
          const Icon = tool.icon;
          return (
            <button
              key={index}
              className={`w-full h-11 flex items-center justify-center transition-colors hover:bg-white/10 ${
                index === 0 ? "mt-2" : ""
              }`}
              title={tool.label}
            >
              <Icon className="size-5" strokeWidth={1.5} />
            </button>
          );
        })}
      </div>
      <div>Video Id: {videoId}</div>
      <div></div>
    </div>
  );
}
