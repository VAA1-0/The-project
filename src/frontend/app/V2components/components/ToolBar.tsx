"use client";

import {
  Home,
  Save,
  Scissors,
  Copy,
  Folder,
  FileVideo,
  Search,
  Play,
  Pause,
  SkipForward,
  SkipBack,
  Upload,
} from "lucide-react";

export function Toolbar() {
  return (
    <div className="bg-[#2a2a2a] h-12 flex items-center px-3 gap-1 border-b border-[#1a1a1a]">
      <button className="p-2 hover:bg-[#3a3a3a] transition-colors text-[#b8b8b8]">
        <Home className="size-4" />
      </button>
      <button className="p-2 hover:bg-[#3a3a3a] transition-colors text-[#b8b8b8]">
        <Save className="size-4" />
      </button>
      <div className="w-px h-6 bg-[#1a1a1a] mx-1" />
      <button className="p-2 hover:bg-[#3a3a3a] transition-colors text-[#b8b8b8]">
        <Scissors className="size-4" />
      </button>
      <button className="p-2 hover:bg-[#3a3a3a] transition-colors text-[#b8b8b8]">
        <Copy className="size-4" />
      </button>
      <div className="w-px h-6 bg-[#1a1a1a] mx-1" />
      <button className="p-2 hover:bg-[#3a3a3a] transition-colors text-[#b8b8b8]">
        <Folder className="size-4" />
      </button>
      <button className="p-2 hover:bg-[#3a3a3a] transition-colors text-[#b8b8b8]">
        <FileVideo className="size-4" />
      </button>
      <div className="flex-1" />
      <div className="flex items-center gap-2 bg-[#1a1a1a] px-3 py-1.5 rounded border border-[#0a0a0a]">
        <Search className="size-3.5 text-[#6a6a6a]" />
        <input
          type="text"
          placeholder="Search"
          className="bg-transparent border-none outline-none text-[#b8b8b8] text-[12px] w-40 placeholder:text-[#6a6a6a]"
        />
      </div>
    </div>
  );
}
