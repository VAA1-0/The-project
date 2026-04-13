"use client";

import React, { useState } from "react";
import { Button } from "./ui/button";
import { Input } from "./ui/input";
import type { VideoMetadata } from "@/lib/video-service";

type LibraryVideo = VideoMetadata & {
  tag?: string | null;
  analysis?: unknown;
};

type Props = {
  vid: LibraryVideo;
  onView: (id?: string) => void;
  onDelete: (id: string) => void;
  onRename: (id: string, newName: string) => Promise<void> | void;
  onUpdateTag: (id: string, newTag: string) => Promise<void> | void;
  showHeader?: boolean;
};

// VideoItem component representing a single video entry with actions in Video Library
const VideoItem: React.FC<Props> = ({
  vid,
  onDelete,
  onRename,
  onUpdateTag,
  showHeader = true,
}) => {
  const [tagEdit, setTagEdit] = useState(false);
  const [tagValue, setTagValue] = useState<string>(vid.tag ?? "");

  const [renameMode, setRenameMode] = useState(false);
  const [renameValue, setRenameValue] = useState<string>(
    vid.name.replace(/\.[^.]+$/, "")
  );

  return (
    <>
      {renameMode ? (
        <div className="mb-2 flex min-w-0 items-center gap-2 overflow-hidden">
          <div className="flex min-w-0 flex-1 items-stretch overflow-hidden rounded-md border border-slate-700">
            <Input
              value={renameValue}
              onChange={(e) => setRenameValue(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") {
                  onRename(vid.id, renameValue);
                  setRenameMode(false);
                }
                if (e.key === "Escape") {
                  setRenameMode(false);
                  setRenameValue(vid.name.replace(/\.[^.]+$/, ""));
                }
              }}
              placeholder={vid.name}
              className="h-8 w-full min-w-0 rounded-none"
              autoFocus
            />
            <div className="px-3 py-1 bg-slate-700 text-slate-300 text-sm flex items-center">
              {vid.name.match(/\.[^.]+$/)
                ? vid.name.match(/\.[^.]+$/)![0]
                : ""}
            </div>
          </div>

          <Button
            size="sm"
            className="cursor-pointer h-8 hover:bg-slate-700/40 transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500"
            onClick={() => {
              onRename(vid.id, renameValue);
              setRenameMode(false);
            }}
            aria-label="Save new name"
          >
            Save
          </Button>

          <Button
            size="sm"
            variant="ghost"
            className="cursor-pointer h-8 hover:bg-slate-700/40 transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500"
            onClick={() => {
              setRenameMode(false);
              setRenameValue(vid.name.replace(/\.[^.]+$/, ""));
            }}
            aria-label="Cancel rename"
          >
            Cancel
          </Button>
        </div>
      ) : showHeader ? (
        <div>
          <div className="font-medium">{vid.name}</div>
          <div className="text-xs text-[var(--ui-passive-text)]">
            {vid.analysis ? "Analyzed" : "Uploaded"}
            {vid.status === "pending" && (
              <span className="ml-2 text-yellow-300">• Pending</span>
            )}
            {vid.status === "synced" && (
              <span className="ml-2 text-emerald-300">• Synced</span>
            )}
            {vid.status === "failed" && (
              <span className="ml-2 text-red-400">• Failed</span>
            )}
          </div>
        </div>
      ) : null
      }

      <div className="flex min-w-0 flex-wrap gap-2 overflow-hidden">
        {tagEdit ? (
          <div className="flex min-w-0 flex-wrap items-center gap-2 overflow-hidden">
            <Input
              value={tagValue}
              onChange={(e) => setTagValue(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") {
                  onUpdateTag(vid.id, tagValue);
                  setTagEdit(false);
                }
                if (e.key === "Escape") {
                  setTagEdit(false);
                  setTagValue(vid.tag ?? "");
                }
              }}
              className="h-8 w-40 min-w-0 max-w-full"
              autoFocus
              aria-label="Edit tag"
            />

            <Button
              size="sm"
              className="h-7 cursor-pointer text-[10px] text-slate-300 hover:bg-slate-800/50 transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500"
              onClick={() => {
                onUpdateTag(vid.id, tagValue);
                setTagEdit(false);
              }}
              aria-label="Save tag"
            >
              Save
            </Button>

            <Button
              size="sm"
              variant="ghost"
              className="h-7 cursor-pointer text-[10px] text-[var(--ui-passive-text)] hover:bg-slate-800/50 transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500"
              onClick={() => {
                setTagEdit(false);
                setTagValue(vid.tag ?? "");
              }}
              aria-label="Cancel tag edit"
            >
              Cancel
            </Button>
          </div>
        ) : (
          <Button
            variant="ghost"
            className="h-6 cursor-pointer px-2 text-[10px] text-[var(--ui-passive-text)] hover:bg-slate-800/40 hover:text-slate-300 transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500"
            onClick={() => {
              setTagEdit(true);
              setTagValue(vid.tag ?? "");
            }}
            aria-label="Edit tag"
          >
            Tag
          </Button>
        )}

        <Button
          variant="ghost"
          className="h-6 cursor-pointer px-2 text-[10px] text-[var(--ui-passive-text)] hover:bg-slate-800/40 hover:text-slate-300 transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500"
          onClick={() => {
            setRenameMode(true);
            setRenameValue(vid.name.replace(/\.[^.]+$/, ""));
          }}
          disabled={renameMode}
          aria-label="Rename video"
        >
          Rename
        </Button>

        {/*         <Button className="cursor-pointer h-8 hover:bg-slate-700/40 transition" onClick={() => onView(vid.id)} variant="ghost">
          View analysis
        </Button> */}

        <Button
          className="h-6 cursor-pointer px-2 text-[10px] text-[var(--ui-passive-text)] hover:bg-slate-800/40 hover:text-red-300 transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-red-500"
          onClick={() => onDelete(vid.id)}
          variant="ghost"
          aria-label="Delete video"
        >
          Delete
        </Button>
      </div>
    </>
  );
};

export default VideoItem;
