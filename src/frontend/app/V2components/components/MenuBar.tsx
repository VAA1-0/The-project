"use client";
import { useState, useEffect } from "react";
import { VideoService } from "@/lib/video-service";
import { saveVideoBlob, deleteVideoBlob } from "@/lib/blob-store";
import { createVideoTask } from "@/cvat-api/client";
import { useLayoutHost } from "./LayoutHost";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";

export function MenuBar() {
  const { openPanel } = useLayoutHost();

  const [openMenu, setOpenMenu] = useState<number | null>(null);
  const [file, setFile] = useState<File | null>(null);
  const [files, setFiles] = useState<File[] | null>(null);
  const [uploading, setUploading] = useState(false);
  const [libraryVideos, setLibraryVideos] = useState<any[]>([]);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);

  // Read duration (in seconds) from a video File using a temporary HTMLVideoElement
  async function getVideoDuration(file: File): Promise<number> {
    return new Promise((resolve) => {
      try {
        const url = URL.createObjectURL(file);
        const v = document.createElement("video");
        v.preload = "metadata";
        v.src = url;
        v.onloadedmetadata = () => {
          URL.revokeObjectURL(url);
          const d = v.duration;
          resolve(Number.isFinite(d) ? Math.round(d) : 0);
        };
        v.onerror = () => {
          URL.revokeObjectURL(url);
          resolve(0);
        };
      } catch (e) {
        resolve(0);
      }
    });
  }

  // Upload handler: show file selector and upload video
  const handleUpload = async () => {
    // Create a hidden file input
    const input = document.createElement("input");
    input.type = "file";
    input.accept = "video/*";
    input.multiple = true;
    input.style.display = "none";

    input.onchange = async (e: any) => {
      const selectedFiles = Array.from(e.target.files) as File[];
      if (!selectedFiles || selectedFiles.length === 0) {
        alert("Select a video first");
        return;
      }

      setUploading(true);
      let cvatID = null;

      try {
        console.log("Uploading to CVAT");

        // Create CVAT tasks
        for (const video of selectedFiles) {
          let taskName = `Task-${Date.now()}`;
          console.log("🎬 Creating video task...");
          let result = await createVideoTask(taskName, video);
          cvatID = result.taskId;
          console.log(`✅Task ID: ${result.taskId}`);
        }

        // Upload & save locally
        try {
          for (const f of selectedFiles) {
            const length = await getVideoDuration(f);
            const res = await VideoService.upload(f, cvatID, length);
            console.log(res);

            try {
              const videoBlob = new Blob([f], { type: f.type });
              await saveVideoBlob(res.analysis_id, videoBlob);
              console.log(
                `Saved original video blob to IndexedDB for ${res.analysis_id}`
              );
            } catch (storageErr) {
              console.warn("Failed to save video to IndexedDB:", storageErr);
            }
          }

          const list = await VideoService.list();
          setLibraryVideos(list);
          setFiles(null);
          setFile(null);
          setPreviewUrl(null);
          window.dispatchEvent(new CustomEvent("video-uploaded"));

          alert("✅Upload successful!");
        } catch (err) {
          console.error(err);
          alert("Upload failed: " + ((err as any)?.message ?? String(err)));
        }
      } catch (err) {
        console.log("Video uploading to CVAT failed. Try again!");
        alert("Upload failed: " + ((err as any)?.message ?? String(err)));
      } finally {
        setUploading(false);
      }
    };

    // ⬇️ This MUST be outside input.onchange
    document.body.appendChild(input);
    input.click();
    document.body.removeChild(input);
  };

  const menuItems = [
    {
      label: "File",
      submenu: [
        {
          label: "Upload New File",
          onClick: () => {
            handleUpload();
          },
        },
      ],
    },
    {
      label: "Lenses",
      submenu: [
        {
          label: "Transcript Lens",
          onClick: () => {
            openPanel("Transcript");
          },
        },
        {
          label: "POS analysis Lens",
          onClick: () => {
            openPanel("POS");
          },
        },
        {
          label: "Quantitative Analysis",
          onClick: () => {
            openPanel("Quant");
          },
        },
      ],
    },
    {
      label: "Window",
      submenu: [
        {
          label: "Project Explorer",
          onClick: () => {
            openPanel("ProjectPanel");
          },
        },
        {
          label: "Download Manager",
          onClick: () => {
            openPanel("DownloadPanel");
          },
        },
        {
          label: "Video Player",
          onClick: () => {
            openPanel("VideoPanel");
          },
        },
        {
          label: "Toolbox",
          onClick: () => {
            openPanel("ToolsPanel");
          },
        },
        {
          label: "Transcript Lens",
          onClick: () => {
            openPanel("Transcript");
          },
        },
        {
          label: "POS analysis Lens",
          onClick: () => {
            openPanel("POS");
          },
        },
        {
          label: "Quantitative Analysis",
          onClick: () => {
            openPanel("Quant");
          },
        },
      ],
    },
    {
      label: "Help",
      submenu: [
        {
          label: "Go to our GitHub",
          onClick: () => {
            // Open GitHub in a new tab
            window.open("https://github.com/VAA1-0/The-project", "_blank");
          },
        },
      ],
    },
  ];

  // Click ourside to close menu
  useEffect(() => {
    const close = () => setOpenMenu(null);
    window.addEventListener("click", close);
    return () => window.removeEventListener("click", close);
  }, []);

  // Click menu item to toggle submenu
  const handleMenuClick = (e: React.MouseEvent, index: number) => {
    e.stopPropagation();
    setOpenMenu(openMenu === index ? null : index);
  };

  const handleSubClick = (e: React.MouseEvent, fn?: () => void) => {
    e.stopPropagation();
    setOpenMenu(null);
    fn?.();
  };

  return (
    <div className="bg-[#191919] h-8 flex items-center px-2 text-[#b8b8b8] text-[12px] border-b border-[#0a0a0a]">
      {menuItems.map((item, index) => (
        <div key={item.label} className="relative">
          {/* Top Menu Bar */}
          <button
            onClick={(e) => handleMenuClick(e, index)}
            className={`px-3 py-1 transition-colors ${
              openMenu === index ? "bg-[#2f2f2f]" : "hover:bg-[#2f2f2f]"
            }`}
          >
            {item.label}
          </button>

          {/* Sub Menu */}
          {item.submenu && openMenu === index && (
            <div
              className="absolute left-0 top-full bg-[#2a2a2a] 
                          border border-[#0a0a0a] shadow-lg z-50 w-40"
              onClick={(e) => e.stopPropagation()} // Prevent closing when clicking the submenu
            >
              {item.submenu.map((sub, subIndex) => (
                <button
                  key={subIndex}
                  onClick={(e) => handleSubClick(e, sub.onClick)}
                  className="w-full text-left px-3 py-1 hover:bg-[#3a3a3a] transition-colors"
                >
                  {sub.label}
                </button>
              ))}
            </div>
          )}
        </div>
      ))}
    </div>
  );
}
