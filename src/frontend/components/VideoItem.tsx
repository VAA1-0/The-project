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
const VideoItem: React.FC<Props> = ({ vid, onView, onDelete, onRename, onUpdateTag }) => {
  const [tagEdit, setTagEdit] = useState(false);
  const [tagValue, setTagValue] = useState<string>(vid.tag ?? "");

  const [renameMode, setRenameMode] = useState(false);
  const [renameValue, setRenameValue] = useState<string>(vid.name.replace(/\.[^.]+$/, ""));

  return (
    <div className="p-3 bg-slate-900/30 rounded-md flex items-center justify-between">

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
            />

            <Button
              size="sm"
              className="cursor-pointer h-8 hover:bg-slate-700/40 transition"
              onClick={() => {
                onUpdateTag(vid.id, tagValue);
                setTagEdit(false);
              }}
            >
              Save
            </Button>

            <Button
              size="sm"
              variant="ghost"
              className="cursor-pointer h-8 hover:bg-slate-700/40 transition"
              onClick={() => {
                setTagEdit(false);
                setTagValue(vid.tag ?? "");
              }}
            >
              Cancel
            </Button>
          </div>
        ) : (
          <Button
            variant="ghost"
            className="cursor-pointer h-8 hover:bg-slate-700/40 transition"
            onClick={() => {
              setTagEdit(true);
              setTagValue(vid.tag ?? "");
            }}
          >
            Edit Tag
          </Button>
        )}

        {renameMode ? (
          <div className="flex items-center gap-2">
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
                className="h-8 w-40 rounded-none"
                autoFocus
              />
              <div className="px-3 py-1 bg-slate-700 text-slate-300 text-sm flex items-center">
                {vid.name.match(/\.[^.]+$/) ? vid.name.match(/\.[^.]+$/)![0] : ""}
              </div>
            </div>

            <Button
              size="sm"
              className="cursor-pointer h-8 hover:bg-slate-700/40 transition"
              onClick={() => {
                onRename(vid.id, renameValue);
                setRenameMode(false);
              }}
            >
              Save
            </Button>

            <Button
              size="sm"
              variant="ghost"
              className="cursor-pointer h-8 hover:bg-slate-700/40 transition"
              onClick={() => {
                setRenameMode(false);
                setRenameValue(vid.name.replace(/\.[^.]+$/, ""));
              }}
            >
              Cancel
            </Button>
          </div>
        ) : (
          <Button
            variant="ghost"
            className="cursor-pointer h-8 hover:bg-slate-700/40 transition"
            onClick={() => {
              setRenameMode(true);
              setRenameValue(vid.name.replace(/\.[^.]+$/, ""));
            }}
          >
            Rename
          </Button>
        )}

        <Button className="cursor-pointer h-8 hover:bg-slate-700/40 transition" onClick={() => onView(vid.id)} variant="ghost">
          View analysis
        </Button>

        <Button className="cursor-pointer h-8 hover:bg-slate-700/40 transition" onClick={() => onDelete(vid.id)} variant="ghost">
          Delete
        </Button>
      </div>
    </div>
  );
};

export default VideoItem;
