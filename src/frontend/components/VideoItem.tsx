"use client";

import React, { useState } from "react";
import { Button } from "./ui/button";
import { Input } from "./ui/input";

type Props = {
  vid: any;
  onView: (id?: string) => void;
  onDelete: (id: string) => void;
  onRename: (id: string, newName: string) => Promise<void> | void;
  onUpdateTag: (id: string, newTag: string) => Promise<void> | void;
};

// VideoItem component representing a single video entry with actions in Video Library
const VideoItem: React.FC<Props> = ({
  vid,
  onView,
  onDelete,
  onRename,
  onUpdateTag,
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
        <div className="flex items-center gap-2 mb-2">
          <div className="flex items-stretch rounded-md overflow-hidden border border-slate-700">
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
              className="h-8 w-full rounded-none"
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
      ) : (
        <div>
          <div className="font-medium">{vid.name}</div>
          <div className="text-xs text-slate-400">
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
      )}

      <div className="flex gap-2">
        {tagEdit ? (
          <div className="flex items-center gap-2">
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
              className="h-8 w-40"
              autoFocus
              aria-label="Edit tag"
            />

            <Button
              size="sm"
              className="cursor-pointer h-8 hover:bg-slate-700/40 transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500"
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
              className="cursor-pointer h-8 hover:bg-slate-700/40 transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500"
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
            className="cursor-pointer h-8 hover:bg-slate-700/40 transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500"
            onClick={() => {
              setTagEdit(true);
              setTagValue(vid.tag ?? "");
            }}
            aria-label="Edit tag"
          >
            Edit Tag
          </Button>
        )}

        <Button
          variant="ghost"
          className="cursor-pointer h-8 hover:bg-slate-700/40 transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500"
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
          className="cursor-pointer h-8 hover:bg-slate-700/40 transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-red-500"
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
