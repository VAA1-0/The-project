"use client";
import { useState, useEffect } from "react";
import { apiService } from "@/lib/api-service";
import { VideoService, type VideoMetadata } from "@/lib/video-service";
import { clearAllVideoBlobs, saveVideoBlob } from "@/lib/blob-store";
import { createVideoTask } from "@/cvat-api/client";
import { useLayoutHost } from "./LayoutHost";
import { eventBus } from "@/lib/golden-layout-lib/eventBus";
import { Library } from "@/lib/local-library";

const QUANT_MATRIX_STORAGE_KEY = "vaa1.quant.matrix.sections";
const QUANT_MATRIX_ANALYSES_STORAGE_KEY = "vaa1.quant.matrix.analyses";
const POS_MATRIX_STORAGE_KEY = "vaa1.pos.matrix.sections";
const POS_MATRIX_ANALYSES_STORAGE_KEY = "vaa1.pos.matrix.analyses";
const SAVED_LAYOUT_STORAGE_KEY = "vaa1.workspace.layout";

export function MenuBar() {
  const { openPanel } = useLayoutHost();

  const [openMenu, setOpenMenu] = useState<number | null>(null);
  const [selectedVideoId, setSelectedVideoId] = useState<string>("");
  const [selectedVideo, setSelectedVideo] = useState<VideoMetadata | null>(null);

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
      } catch {
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

    input.onchange = async (e: Event) => {
      const target = e.target as HTMLInputElement | null;
      const selectedFiles = Array.from(target?.files || []);
      if (!selectedFiles || selectedFiles.length === 0) {
        alert("Select a video first");
        return;
      }

      let cvatID: number | null = null;

      try {
        console.log("Uploading to CVAT");

        // Create CVAT tasks (best-effort: alert on failure but continue upload)
        for (const video of selectedFiles) {
          const taskName = `Task-${Date.now()}`;
          try {
            console.log("🎬 Creating video task...");
            const result = await createVideoTask(taskName, video);
            cvatID = result.taskId;
            console.log(`✅Task ID: ${result.taskId}`);
          } catch (err) {
            console.warn("Create CVAT task failed:", err);
            alert(
              "Could not create CVAT task. Continuing without CVAT linkage.",
            );
            break;
          }
        }
      } catch (err) {
        console.warn("CVAT task creation encountered an error:", err);
        alert("Could not create CVAT task. Continuing without CVAT linkage.");
      }

      try {
        // Upload & save locally (uses cvatID=0 when unavailable)
        for (const f of selectedFiles) {
          const length = await getVideoDuration(f);
          const res = await VideoService.upload(f, cvatID ?? 0, length);
          console.log(res);

          try {
            const videoBlob = new Blob([f], { type: f.type });
            await saveVideoBlob(res.analysis_id, videoBlob);
            console.log(
              `Saved original video blob to IndexedDB for ${res.analysis_id}`,
            );
          } catch (storageErr) {
            console.warn("Failed to save video to IndexedDB:", storageErr);
          }
        }

        await VideoService.list();
        window.dispatchEvent(new CustomEvent("video-uploaded"));

        alert("✅Upload successful!");
      } catch (err) {
        console.error(err);
        alert(
          "Upload failed: " +
            (err instanceof Error ? err.message : String(err)),
        );
      }
    };

    // ⬇️ This MUST be outside input.onchange
    document.body.appendChild(input);
    input.click();
    document.body.removeChild(input);
  };

  const handleImportSavedWork = async () => {
    const input = document.createElement("input");
    input.type = "file";
    input.accept = ".zip,application/zip";
    input.style.display = "none";

    input.onchange = async (e: Event) => {
      const target = e.target as HTMLInputElement | null;
      const selectedFile = target?.files?.[0];
      if (!selectedFile) {
        return;
      }

      try {
        const imported = await VideoService.importSavedWork(selectedFile);
        let importNote =
          imported.bundle_type === "project"
            ? `Saved project opened successfully with ${imported.imported_count || 0} analyses.`
            : "Saved work opened successfully.";
        try {
          let importedBlob: Blob | null = null;
          try {
            importedBlob = await apiService.downloadFile(
              imported.analysis_id,
              "source_video",
            );
          } catch {
            try {
              importedBlob = await apiService.downloadFile(imported.analysis_id, "video");
            } catch {
              importedBlob = null;
            }
          }

          if (importedBlob) {
            await saveVideoBlob(imported.analysis_id, importedBlob);
            eventBus.emit("mediaBlobReady", {
              analysisId: imported.analysis_id,
              blob: importedBlob,
            });
          } else {
            const importedMeta = await VideoService.get(imported.analysis_id);
            if (importedMeta.sourceVideoExists === false) {
              importNote =
                "Saved work opened, but the source video is missing. Use File -> Locate Media... if you want playback.";
            } else {
              importNote =
                "Saved work opened. No playable video was found in the bundle.";
            }
          }
        } catch (blobError) {
          console.warn("Imported saved work has no playable video bundle:", blobError);
          importNote =
            "Saved work opened, but the video could not be loaded. Use File -> Locate Media... if you want playback.";
        }

        window.dispatchEvent(new CustomEvent("video-uploaded"));
        eventBus.emit("videoIdChanged", imported.analysis_id);
        window.setTimeout(() => {
          eventBus.emit("mediaLinked", imported.analysis_id);
        }, 50);
        alert(importNote);
      } catch (error) {
        console.error("Import saved work failed:", error);
        alert(
          "Could not import saved work: " +
            (error instanceof Error ? error.message : String(error)),
        );
      }
    };

    document.body.appendChild(input);
    input.click();
    document.body.removeChild(input);
  };

  const handleRestoreWindows = () => {
    try {
      window.localStorage.removeItem(SAVED_LAYOUT_STORAGE_KEY);
    } catch (error) {
      console.warn("Failed to clear saved workspace layout:", error);
    }
    window.location.reload();
  };

  useEffect(() => {
    const handler = async (id: string) => {
      setSelectedVideoId(id);
      try {
        const metadata = await VideoService.get(id);
        setSelectedVideo(metadata);
      } catch {
        setSelectedVideo(null);
      }
    };

    eventBus.on("videoIdChanged", handler);
    return () => {
      eventBus.off("videoIdChanged", handler);
    };
  }, []);

  const slugifyFilename = (value: string) =>
    value
      .replace(/\.[^.]+$/, "")
      .trim()
      .replace(/[^a-zA-Z0-9-_]+/g, "_")
      .replace(/^_+|_+$/g, "") || "analysis";

  const buildBundleFilename = (baseName?: string) =>
    `${slugifyFilename(baseName || selectedVideo?.name || "analysis")}_analysis_bundle.zip`;

  const buildProjectBundleFilename = (baseName?: string) =>
    `${slugifyFilename(baseName || "vaa1_project")}_project_bundle.zip`;

  const buildProjectPayload = async (projectName?: string) => {
    const analyses = await VideoService.list(200);
    const completedAnalyses = analyses
      .filter((analysis) => analysis.status === "completed")
      .map((analysis) => analysis.id);

    const quantMatrixSections = (() => {
      try {
        const stored = window.localStorage.getItem(QUANT_MATRIX_STORAGE_KEY);
        return stored ? JSON.parse(stored) : [];
      } catch {
        return [];
      }
    })();

    const quantMatrixAnalyses = (() => {
      try {
        const stored = window.localStorage.getItem(QUANT_MATRIX_ANALYSES_STORAGE_KEY);
        return stored ? JSON.parse(stored) : [];
      } catch {
        return [];
      }
    })();

    const posMatrixSections = (() => {
      try {
        const stored = window.localStorage.getItem(POS_MATRIX_STORAGE_KEY);
        return stored ? JSON.parse(stored) : [];
      } catch {
        return [];
      }
    })();

    const posMatrixAnalyses = (() => {
      try {
        const stored = window.localStorage.getItem(POS_MATRIX_ANALYSES_STORAGE_KEY);
        return stored ? JSON.parse(stored) : [];
      } catch {
        return [];
      }
    })();

    return {
      project_name: projectName || "vaa1_project",
      analysis_ids: completedAnalyses,
      matrices: {
        pos: {
          selected_sections: posMatrixSections,
          analysis_ids: posMatrixAnalyses,
        },
        quant: {
          selected_sections: quantMatrixSections,
          analysis_ids: quantMatrixAnalyses,
        },
      },
    };
  };

  const openToolsSection = (section: string) => {
    openPanel("ToolsPanel");
    window.setTimeout(() => {
      eventBus.emit("toolsSectionFocus", section);
    }, 80);
  };

  const handleSave = async () => {
    if (!selectedVideoId || !selectedVideo) {
      alert("Select an analysis first, then use Save Analysis.");
      return;
    }

    try {
      await VideoService.exportBundle(
        selectedVideoId,
        buildBundleFilename(selectedVideo.name),
      );
    } catch (error) {
      console.error("Save failed:", error);
      alert("Could not save the current analysis bundle.");
    }
  };

  const handleSaveAs = async () => {
    if (!selectedVideoId || !selectedVideo) {
      alert("Select an analysis first, then use Save Analysis As.");
      return;
    }

    const suggested = buildBundleFilename(selectedVideo.name);
    const customName = window.prompt("Save analysis bundle as:", suggested);
    if (!customName) {
      return;
    }

    const finalName = customName.endsWith(".zip") ? customName : `${customName}.zip`;

    try {
      await VideoService.exportBundle(selectedVideoId, finalName);
    } catch (error) {
      console.error("Save As failed:", error);
      alert("Could not save the analysis bundle with that name.");
    }
  };

  const handleSaveProject = async () => {
    try {
      const payload = await buildProjectPayload("vaa1_project");
      if (!Array.isArray(payload.analysis_ids) || payload.analysis_ids.length === 0) {
        alert("There are no completed analyses yet to save as a project.");
        return;
      }
      await VideoService.exportProjectBundle(
        payload,
        buildProjectBundleFilename("vaa1_project"),
      );
    } catch (error) {
      console.error("Save Project failed:", error);
      alert("Could not save the current project bundle.");
    }
  };

  const handleSaveProjectAs = async () => {
    try {
      const suggested = buildProjectBundleFilename("vaa1_project");
      const customName = window.prompt("Save project bundle as:", suggested);
      if (!customName) {
        return;
      }

      const finalName = customName.endsWith(".zip")
        ? customName
        : `${customName}.zip`;
      const baseName = finalName.replace(/\.zip$/i, "");
      const payload = await buildProjectPayload(baseName);
      if (!Array.isArray(payload.analysis_ids) || payload.analysis_ids.length === 0) {
        alert("There are no completed analyses yet to save as a project.");
        return;
      }
      await VideoService.exportProjectBundle(payload, finalName);
    } catch (error) {
      console.error("Save Project As failed:", error);
      alert("Could not save the project bundle with that name.");
    }
  };

  const handleRefreshWorkspace = () => {
    window.location.reload();
  };

  const handleLocateMedia = async () => {
    if (!selectedVideoId) {
      alert("Select an analysis first, then use Locate Media...");
      return;
    }

    const input = document.createElement("input");
    input.type = "file";
    input.accept = "video/*";
    input.style.display = "none";

    input.onchange = async (event: Event) => {
      const target = event.target as HTMLInputElement | null;
      const selectedFile = target?.files?.[0];
      if (!selectedFile) {
        return;
      }

      try {
        await saveVideoBlob(selectedVideoId, selectedFile);
        eventBus.emit("mediaBlobReady", {
          analysisId: selectedVideoId,
          blob: selectedFile,
        });
        eventBus.emit("videoIdChanged", selectedVideoId);
        window.setTimeout(() => {
          eventBus.emit("mediaLinked", selectedVideoId);
        }, 50);
        alert(
          "Media located. The selected video is now linked to this analysis in the current browser.",
        );
      } catch (error) {
        console.error("Locate media failed:", error);
        alert("Could not link the selected media file.");
      }
    };

    document.body.appendChild(input);
    input.click();
    document.body.removeChild(input);
  };

  const handleClearProgram = async () => {
    const processingNote =
      selectedVideo?.status === "processing"
        ? " The currently running backend analysis may continue until the server finishes it."
        : "";

    const confirmed = window.confirm(
      `Clear the current VAA1 session and start empty? This clears the browser-side workspace and cached video files.${processingNote}`,
    );
    if (!confirmed) {
      return;
    }

    setSelectedVideoId("");
    setSelectedVideo(null);
    eventBus.emit("videoIdChanged", "");
    eventBus.emit("videoTimeLineChanged", 0);
    let skippedProcessingIds: string[] = [];

    try {
      const result = await VideoService.clearSession();
      skippedProcessingIds = result.skipped_processing_ids || [];
    } catch (error) {
      console.error("Failed to clear backend session:", error);
      alert("Could not clear the backend session. The browser workspace was not reset.");
      return;
    }

    try {
      await clearAllVideoBlobs();
    } catch (error) {
      console.warn("Failed to clear cached video blobs:", error);
    }

    try {
      window.localStorage.removeItem(QUANT_MATRIX_STORAGE_KEY);
      window.localStorage.removeItem(QUANT_MATRIX_ANALYSES_STORAGE_KEY);
      window.localStorage.removeItem(POS_MATRIX_STORAGE_KEY);
      window.localStorage.removeItem(POS_MATRIX_ANALYSES_STORAGE_KEY);
      eventBus.emit("quantMatrixSectionsChanged", []);
      eventBus.emit("quantMatrixAnalysesChanged", []);
      eventBus.emit("posMatrixSectionsChanged", []);
      eventBus.emit("posMatrixAnalysesChanged", []);
    } catch (error) {
      console.warn("Failed to clear Quant Matrix session state:", error);
    }

    Library.clearAll();

    if (skippedProcessingIds.length > 0) {
      alert(
        `Browser workspace cleared. ${skippedProcessingIds.length} backend job(s) are still processing and were not canceled.`,
      );
    }

    window.setTimeout(() => {
      window.location.reload();
    }, 50);
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
        {
          label: "Open Saved Work...",
          onClick: () => {
            handleImportSavedWork();
          },
        },
        {
          label: "Locate Media...",
          onClick: () => {
            void handleLocateMedia();
          },
        },
        {
          label: "Save Analysis",
          onClick: () => {
            handleSave();
          },
        },
        {
          label: "Save Analysis As...",
          onClick: () => {
            handleSaveAs();
          },
        },
        {
          label: "Save Project",
          onClick: () => {
            void handleSaveProject();
          },
        },
        {
          label: "Save Project As...",
          onClick: () => {
            void handleSaveProjectAs();
          },
        },
      ],
    },
    {
      label: "Session",
      submenu: [
        {
          label: "Refresh",
          onClick: () => {
            handleRefreshWorkspace();
          },
        },
        {
          label: "Clear Program",
          onClick: () => {
            void handleClearProgram();
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
          label: "OBJ Detection Lens",
          onClick: () => {
            openPanel("OBJDetection");
          },
        },
        {
          label: "OCR Lens",
          onClick: () => {
            openPanel("OCR");
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
        {
          label: "Expression Lens",
          onClick: () => {
            openPanel("Expressions");
          },
        },
      ],
    },
    {
      label: "Window",
      submenu: [
        {
          label: "Restore Windows",
          onClick: () => {
            handleRestoreWindows();
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
          label: "Source Media",
          onClick: () => {
            openPanel("SourceMediaMetadata");
          },
        },
        {
          label: "Time Bank",
          onClick: () => {
            openPanel("TimeBank", selectedVideoId ? { videoId: selectedVideoId } : {});
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
          label: "Audio",
          onClick: () => {
            if (selectedVideoId) {
              eventBus.emit("videoIdChanged", selectedVideoId);
            }
            openPanel("Audio", selectedVideoId ? { videoId: selectedVideoId } : {});
            if (selectedVideoId) {
              window.setTimeout(() => {
                eventBus.emit("videoIdChanged", selectedVideoId);
              }, 0);
            }
          },
        },
        {
          label: "OBJ Detection Lens",
          onClick: () => {
            openPanel("OBJDetection");
          },
        },
        {
          label: "OCR Lens",
          onClick: () => {
            openPanel("OCR");
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
        {
          label: "Expression Lens",
          onClick: () => {
            openPanel("Expressions");
          },
        },
      ],
    },
    {
      label: "Tools",
      submenu: [
        {
          label: "Analysis Setup",
          onClick: () => {
            openToolsSection("analysis");
          },
        },
        {
          label: "Visual cues",
          onClick: () => {
            openToolsSection("visual");
          },
        },
        {
          label: "Morphology Catalog",
          onClick: () => {
            openToolsSection("morphology");
          },
        },
        {
          label: "Face Records",
          onClick: () => {
            openToolsSection("face");
          },
        },
        {
          label: "Language Records",
          onClick: () => {
            openToolsSection("language");
          },
        },
        {
          label: "Mission Records",
          onClick: () => {
            openToolsSection("mission");
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
