"use client";
import { useState, useEffect } from "react";
import {
  apiService,
  type SharedTaxonomyLabel,
} from "@/lib/api-service";
import { VideoService, type VideoMetadata } from "@/lib/video-service";
import { clearAllVideoBlobs, saveVideoBlob } from "@/lib/blob-store";
import { useLayoutHost } from "./LayoutHost";
import { eventBus } from "@/lib/golden-layout-lib/eventBus";
import { Library } from "@/lib/local-library";
import CustomizableSelectField from "@/components/metadata/CustomizableSelectField";
import {
  getLearnedTaxonomyLabels,
  getExpertiseAxisOptions,
  getMediaGenreOptions,
  getMediaSubgenreOptions,
  getPrivacyAxisOptions,
  type SharedTaxonomyOption,
  removeCustomTaxonomyLabel,
  registerCustomTaxonomyLabel,
  getSituationalGenreOptions,
  getSituationalSubgenreOptions,
  type CustomTaxonomyScope,
} from "@/lib/metadata-taxonomy";

const QUANT_MATRIX_STORAGE_KEY = "vaa1.quant.matrix.sections";
const QUANT_MATRIX_ANALYSES_STORAGE_KEY = "vaa1.quant.matrix.analyses";
const POS_MATRIX_STORAGE_KEY = "vaa1.pos.matrix.sections";
const POS_MATRIX_ANALYSES_STORAGE_KEY = "vaa1.pos.matrix.analyses";
const SAVED_LAYOUT_STORAGE_KEY = "vaa1.workspace.layout";

type UploadMetadataDraft = {
  title: string;
  scope: string;
  description: string;
  persons: string;
  relations: string;
  location_country: string;
  location_city: string;
  location_place: string;
  location_room: string;
  time_era: string;
  time_year: string;
  time_moment: string;
  situation_event: string;
  keywords: string;
  interaction_dynamics: string;
  narrative_development: string;
  performance_expression: string;
  genre: string;
  genre_subtype: string;
  custom_genre: string;
  custom_genre_subtype: string;
  situational_genre: string;
  situational_subtype: string;
  custom_situational_genre: string;
  custom_situational_subtype: string;
  privacy_axis: string;
  custom_privacy_axis: string;
  expertise_axis: string;
  custom_expertise_axis: string;
  references: string;
  reference_files: File[];
  reference_relation: string;
  reference_source: string;
  confidence: string;
  notes: string;
};

function MetaHint({ children }: { children: React.ReactNode }) {
  return <div className="mt-1 text-[10px] text-slate-500">{children}</div>;
}

export function MenuBar() {
  const { openPanel } = useLayoutHost();

  const [openMenu, setOpenMenu] = useState<number | null>(null);
  const [selectedVideoId, setSelectedVideoId] = useState<string>("");
  const [selectedVideo, setSelectedVideo] = useState<VideoMetadata | null>(null);
  const [pendingUploadFiles, setPendingUploadFiles] = useState<File[]>([]);
  const [uploadMetadataDrafts, setUploadMetadataDrafts] = useState<
    UploadMetadataDraft[]
  >([]);
  const [showUploadMetadataDialog, setShowUploadMetadataDialog] =
    useState(false);
  const [isSubmittingUpload, setIsSubmittingUpload] = useState(false);
  const [showAdvancedUploadFields, setShowAdvancedUploadFields] =
    useState(false);
  const [, setTaxonomyRefreshNonce] = useState(0);
  const [sharedTaxonomyLabels, setSharedTaxonomyLabels] = useState<
    SharedTaxonomyLabel[]
  >([]);

  const buildUploadDraft = (file: File): UploadMetadataDraft => ({
    title: file.name.replace(/\.[^.]+$/, ""),
    scope: "short clip",
    description: "",
    persons: "",
    relations: "",
    location_country: "",
    location_city: "",
    location_place: "",
    location_room: "",
    time_era: "",
    time_year: "",
    time_moment: "",
    situation_event: "",
    keywords: "",
    interaction_dynamics: "",
    narrative_development: "",
    performance_expression: "",
    genre: "",
    genre_subtype: "",
    custom_genre: "",
    custom_genre_subtype: "",
    situational_genre: "",
    situational_subtype: "",
    custom_situational_genre: "",
    custom_situational_subtype: "",
    privacy_axis: "",
    custom_privacy_axis: "",
    expertise_axis: "",
    custom_expertise_axis: "",
    references: "",
    reference_files: [],
    reference_relation: "",
    reference_source: "",
    confidence: "",
    notes: "",
  });

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

  const updateUploadDraft = (
    index: number,
    patch: Partial<UploadMetadataDraft>,
  ) => {
    setUploadMetadataDrafts((previous) =>
      previous.map((item, itemIndex) =>
        itemIndex === index ? { ...item, ...patch } : item,
      ),
    );
  };

  const applyCustomUploadTaxonomy = (
    index: number,
    field:
      | "genre"
      | "genre_subtype"
      | "situational_genre"
      | "situational_subtype"
      | "privacy_axis"
      | "expertise_axis",
    customField:
      | "custom_genre"
      | "custom_genre_subtype"
      | "custom_situational_genre"
      | "custom_situational_subtype"
      | "custom_privacy_axis"
      | "custom_expertise_axis",
    scope:
      | "media_genre"
      | "media_subgenre"
      | "situational_genre"
      | "situational_subgenre"
      | "privacy_axis"
      | "expertise_axis",
    parentValue?: string,
  ) => {
    const draft = uploadMetadataDrafts[index];
    const customValue = draft?.[customField]?.trim();
    if (!customValue) {
      return;
    }

    registerCustomTaxonomyLabel(scope, customValue, parentValue);
    updateUploadDraft(index, {
      [field]: customValue,
      [customField]: "",
    } as Partial<UploadMetadataDraft>);
    setTaxonomyRefreshNonce((value) => value + 1);
  };

  useEffect(() => {
    async function loadSharedTaxonomy() {
      try {
        const labels = await apiService.listSharedTaxonomyLabels();
        setSharedTaxonomyLabels(labels);
      } catch (error) {
        console.warn("Failed to load shared taxonomy labels:", error);
      }
    }
    void loadSharedTaxonomy();
  }, []);

  const shareCustomUploadTaxonomy = async (
    index: number,
    field:
      | "genre"
      | "genre_subtype"
      | "situational_genre"
      | "situational_subtype"
      | "privacy_axis"
      | "expertise_axis",
    customField:
      | "custom_genre"
      | "custom_genre_subtype"
      | "custom_situational_genre"
      | "custom_situational_subtype"
      | "custom_privacy_axis"
      | "custom_expertise_axis",
    scope: CustomTaxonomyScope,
    parentValue?: string,
  ) => {
    const draft = uploadMetadataDrafts[index];
    const customValue = draft?.[customField]?.trim();
    if (!customValue) {
      return;
    }

    try {
      const saved = await apiService.saveSharedTaxonomyLabel({
        scope,
        label: customValue,
        parent_value: parentValue,
        created_by: "analyst",
        source: "manual_share",
      });
      registerCustomTaxonomyLabel(scope, customValue, parentValue);
      updateUploadDraft(index, {
        [field]: customValue,
        [customField]: "",
      } as Partial<UploadMetadataDraft>);
      setSharedTaxonomyLabels((current) => {
        const next = current.filter(
          (entry) =>
            !(
              entry.scope === saved.scope &&
              (entry.parent_value || "") === (saved.parent_value || "") &&
              entry.label.trim().toLowerCase() === saved.label.trim().toLowerCase()
            ),
        );
        next.push(saved);
        return next.sort((left, right) =>
          left.label.localeCompare(right.label, undefined, {
            sensitivity: "base",
          }),
        );
      });
    } catch (error) {
      console.error("Failed to save shared taxonomy label:", error);
      alert("Could not save shared taxonomy label.");
    }
  };

  const sharedTaxonomyOptions: SharedTaxonomyOption[] = sharedTaxonomyLabels.map(
    (entry) => ({
      scope: entry.scope,
      label: entry.label,
      parent_value: entry.parent_value,
    }),
  );

  const removeLearnedUploadTaxonomy = (
    index: number,
    scope: CustomTaxonomyScope,
    label: string,
    parentValue?: string,
  ) => {
    removeCustomTaxonomyLabel(scope, label, parentValue);
    setTaxonomyRefreshNonce((value) => value + 1);
    const draft = uploadMetadataDrafts[index];
    if (!draft) {
      return;
    }
    if (scope === "media_genre" && draft.genre === label) {
      updateUploadDraft(index, { genre: "", genre_subtype: "" });
    } else if (scope === "media_subgenre" && draft.genre_subtype === label) {
      updateUploadDraft(index, { genre_subtype: "" });
    } else if (
      scope === "situational_genre" &&
      draft.situational_genre === label
    ) {
      updateUploadDraft(index, {
        situational_genre: "",
        situational_subtype: "",
      });
    } else if (
      scope === "situational_subgenre" &&
      draft.situational_subtype === label
    ) {
      updateUploadDraft(index, { situational_subtype: "" });
    } else if (scope === "privacy_axis" && draft.privacy_axis === label) {
      updateUploadDraft(index, { privacy_axis: "" });
    } else if (scope === "expertise_axis" && draft.expertise_axis === label) {
      updateUploadDraft(index, { expertise_axis: "" });
    }
  };

  // Upload handler: show file selector and upload video
  const runUploadWithMetadata = async (
    files: File[],
    drafts: UploadMetadataDraft[],
  ) => {
    try {
      for (let index = 0; index < files.length; index += 1) {
        const f = files[index];
        const draft = drafts[index] || buildUploadDraft(f);
        const length = await getVideoDuration(f);
        const res = await VideoService.upload(f, 0, length);

        try {
          const videoBlob = new Blob([f], { type: f.type });
          await saveVideoBlob(res.analysis_id, videoBlob);
        } catch (storageErr) {
          console.warn("Failed to save video to IndexedDB:", storageErr);
        }

        await apiService.updateSourceMediaMetadata(res.analysis_id, {
          title: draft.title.trim(),
          scope: draft.scope.trim(),
          description: draft.description.trim(),
          persons: draft.persons
            .split(",")
            .map((value) => value.trim())
            .filter(Boolean),
          relations: draft.relations.trim(),
          location_country: draft.location_country.trim(),
          location_city: draft.location_city.trim(),
          location_place: draft.location_place.trim(),
          location_room: draft.location_room.trim(),
          time_era: draft.time_era.trim(),
          time_year: draft.time_year.trim(),
          time_moment: draft.time_moment.trim(),
          situation_event: draft.situation_event.trim(),
          keywords: draft.keywords
            .split(",")
            .map((value) => value.trim())
            .filter(Boolean),
          interaction_dynamics: draft.interaction_dynamics.trim(),
          narrative_development: draft.narrative_development.trim(),
          performance_expression: draft.performance_expression.trim(),
          genre: draft.genre.trim(),
          genre_subtype: draft.genre_subtype.trim(),
          situational_genre: draft.situational_genre.trim(),
          situational_subtype: draft.situational_subtype.trim(),
          privacy_axis: draft.privacy_axis.trim(),
          expertise_axis: draft.expertise_axis.trim(),
          references: draft.references
            .split("\n")
            .map((value) => value.trim())
            .filter(Boolean),
          reference_relation: draft.reference_relation.trim(),
          reference_source: draft.reference_source.trim(),
          confidence: draft.confidence.trim(),
          notes: draft.notes.trim(),
        });

        if (draft.reference_files.length > 0) {
          await apiService.uploadSourceMediaReferences(
            res.analysis_id,
            draft.reference_files,
          );
        }
      }

      await VideoService.list();
      window.dispatchEvent(new CustomEvent("video-uploaded"));
      alert("✅Upload successful!");
    } catch (err) {
      console.error(err);
      alert(
        "Upload failed: " + (err instanceof Error ? err.message : String(err)),
      );
    }
  };

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
      setPendingUploadFiles(selectedFiles);
      setUploadMetadataDrafts(selectedFiles.map((file) => buildUploadDraft(file)));
      setShowUploadMetadataDialog(true);
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

  const openSchemaPanel = (panelType: string) => {
    if (selectedVideoId) {
      eventBus.emit("videoIdChanged", selectedVideoId);
    }
    openPanel(panelType, selectedVideoId ? { videoId: selectedVideoId } : {});
    if (selectedVideoId) {
      window.setTimeout(() => {
        eventBus.emit("videoIdChanged", selectedVideoId);
      }, 0);
    }
  };

  const openAnnotationWorkspace = () => {
    eventBus.emit("workspacePresetRequest", "annotation");

    if (selectedVideoId) {
      window.setTimeout(() => {
        eventBus.emit("videoIdChanged", selectedVideoId);
      }, 120);
    }

    window.setTimeout(() => {
      eventBus.emit("toolsSectionFocus", "annotation");
    }, 180);
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
        {
          label: "Master Schema",
          onClick: () => {
            openSchemaPanel("MasterSchema");
          },
        },
        {
          label: "Scene Leaf",
          onClick: () => {
            openSchemaPanel("ManualScene");
          },
        },
        {
          label: "Action Leaf",
          onClick: () => {
            openSchemaPanel("ManualAction");
          },
        },
        {
          label: "Identification Leaf",
          onClick: () => {
            openSchemaPanel("ManualIdentification");
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
        {
          label: "Master Schema",
          onClick: () => {
            openSchemaPanel("MasterSchema");
          },
        },
        {
          label: "Scene",
          onClick: () => {
            openSchemaPanel("ManualScene");
          },
        },
        {
          label: "Action",
          onClick: () => {
            openSchemaPanel("ManualAction");
          },
        },
        {
          label: "Identification",
          onClick: () => {
            openSchemaPanel("ManualIdentification");
          },
        },
        {
          label: "Cinematic Cues",
          onClick: () => {
            openSchemaPanel("ManualCinematicCues");
          },
        },
      ],
    },
    {
      label: "Tools",
      submenu: [
        {
          label: "Annotation workspace",
          onClick: () => {
            openAnnotationWorkspace();
          },
        },
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
          label: "Master Schema",
          onClick: () => {
            openSchemaPanel("MasterSchema");
          },
        },
        {
          label: "Scene Leaf",
          onClick: () => {
            openSchemaPanel("ManualScene");
          },
        },
        {
          label: "Action Leaf",
          onClick: () => {
            openSchemaPanel("ManualAction");
          },
        },
        {
          label: "Identification Leaf",
          onClick: () => {
            openSchemaPanel("ManualIdentification");
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
    <>
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
                onClick={(e) => e.stopPropagation()}
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
      {showUploadMetadataDialog ? (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/60 px-4">
          <div className="max-h-[88vh] w-full max-w-3xl overflow-y-auto rounded-lg border border-white/10 bg-[#171717] p-4 text-slate-200 shadow-2xl">
            <div className="flex items-start justify-between gap-4">
              <div>
                <div className="text-sm font-medium text-slate-100">
                  Upload metadata
                </div>
                <div className="mt-1 text-xs text-slate-400">
                  Add light metadata now. The rest can be enriched later in Source Media.
                </div>
              </div>
              <button
                type="button"
                className="rounded border border-white/8 px-2 py-1 text-xs text-slate-400 transition hover:text-slate-200"
                onClick={() => {
                  if (isSubmittingUpload) return;
                  setShowUploadMetadataDialog(false);
                  setPendingUploadFiles([]);
                  setUploadMetadataDrafts([]);
                  setShowAdvancedUploadFields(false);
                }}
              >
                Close
              </button>
            </div>
            <div className="mt-3 flex items-center justify-between gap-3 rounded-md border border-white/8 bg-[#111111] px-3 py-2 text-xs text-slate-400">
              <span>Use light upload mode by default. Open advanced fields only when needed.</span>
              <button
                type="button"
                className="rounded border border-white/8 px-2 py-1 text-[11px] text-slate-300 transition hover:text-slate-100"
                onClick={() => setShowAdvancedUploadFields((previous) => !previous)}
              >
                {showAdvancedUploadFields ? "Hide advanced fields" : "Advanced fields"}
              </button>
            </div>
            <div className="mt-4 space-y-4">
              {pendingUploadFiles.map((file, index) => {
                const draft = uploadMetadataDrafts[index] || buildUploadDraft(file);
                return (
                  <div
                    key={`${file.name}-${index}`}
                    className="rounded-md border border-white/8 bg-[#111111] p-3"
                  >
                    <div className="mb-3 text-xs text-slate-400">{file.name}</div>
                    <div className="grid gap-3 md:grid-cols-2">
                      <label className="block">
                        <div className="mb-1 text-[10px] uppercase tracking-[0.12em] text-slate-500">
                          Title
                        </div>
                        <input
                          value={draft.title}
                          onChange={(e) =>
                            setUploadMetadataDrafts((previous) =>
                              previous.map((item, itemIndex) =>
                                itemIndex === index
                                  ? { ...item, title: e.target.value }
                                  : item,
                              ),
                            )
                          }
                          className="w-full rounded-md border border-slate-700 bg-[#171717] px-3 py-2 text-sm text-slate-200 outline-none focus:border-slate-500"
                        />
                        <MetaHint>Short name for this media.</MetaHint>
                      </label>
                      <label className="block">
                        <div className="mb-1 text-[10px] uppercase tracking-[0.12em] text-slate-500">
                          Scope
                        </div>
                        <select
                          value={draft.scope}
                          onChange={(e) =>
                            setUploadMetadataDrafts((previous) =>
                              previous.map((item, itemIndex) =>
                                itemIndex === index
                                  ? { ...item, scope: e.target.value }
                                  : item,
                              ),
                            )
                          }
                          className="w-full rounded-md border border-slate-700 bg-[#171717] px-3 py-2 text-sm text-slate-200 outline-none focus:border-slate-500"
                        >
                          <option value="short clip">Short clip</option>
                          <option value="scene / segment">Scene / segment</option>
                          <option value="full recording">Full recording</option>
                          <option value="full episode / film">Full episode / film</option>
                        </select>
                        <MetaHint>How much material is included.</MetaHint>
                      </label>
                    </div>
                    <label className="mt-3 block">
                      <div className="mb-1 text-[10px] uppercase tracking-[0.12em] text-slate-500">
                        Description
                      </div>
                      <textarea
                        value={draft.description}
                        onChange={(e) =>
                          setUploadMetadataDrafts((previous) =>
                            previous.map((item, itemIndex) =>
                              itemIndex === index
                                ? { ...item, description: e.target.value }
                                : item,
                            ),
                          )
                        }
                        rows={2}
                        className="w-full rounded-md border border-slate-700 bg-[#171717] px-3 py-2 text-sm text-slate-200 outline-none focus:border-slate-500"
                      />
                      <MetaHint>What is happening in one to two sentences.</MetaHint>
                    </label>
                    <div className="mt-3 grid gap-3 md:grid-cols-2">
                      <label className="block">
                        <div className="mb-1 text-[10px] uppercase tracking-[0.12em] text-slate-500">
                          Persons
                        </div>
                        <input
                          value={draft.persons}
                          onChange={(e) =>
                            setUploadMetadataDrafts((previous) =>
                              previous.map((item, itemIndex) =>
                                itemIndex === index
                                  ? { ...item, persons: e.target.value }
                                  : item,
                              ),
                            )
                          }
                          placeholder="Optional, comma separated"
                          className="w-full rounded-md border border-slate-700 bg-[#171717] px-3 py-2 text-sm text-slate-200 outline-none focus:border-slate-500"
                        />
                        <MetaHint>Who appears. Use names or roles.</MetaHint>
                      </label>
                      <label className="block">
                        <div className="mb-1 text-[10px] uppercase tracking-[0.12em] text-slate-500">
                          Keywords
                        </div>
                        <input
                          value={draft.keywords}
                          onChange={(e) =>
                            setUploadMetadataDrafts((previous) =>
                              previous.map((item, itemIndex) =>
                                itemIndex === index
                                  ? { ...item, keywords: e.target.value }
                                  : item,
                              ),
                            )
                          }
                          placeholder="Optional, comma separated"
                          className="w-full rounded-md border border-slate-700 bg-[#171717] px-3 py-2 text-sm text-slate-200 outline-none focus:border-slate-500"
                        />
                        <MetaHint>Three to seven important themes.</MetaHint>
                      </label>
                    </div>
                    <div className="mt-3">
                      <CustomizableSelectField
                        label="Media genre"
                        value={draft.genre}
                        onChange={(nextValue) =>
                          updateUploadDraft(index, {
                            genre: nextValue,
                            genre_subtype: "",
                          })
                        }
                        options={getMediaGenreOptions(
                          draft.genre,
                          sharedTaxonomyOptions,
                        )}
                        customValue={draft.custom_genre}
                        onCustomValueChange={(value) =>
                          updateUploadDraft(index, { custom_genre: value })
                        }
                        onAddCustom={() =>
                          applyCustomUploadTaxonomy(
                            index,
                            "genre",
                            "custom_genre",
                            "media_genre",
                          )
                        }
                        onShareCustom={() =>
                          shareCustomUploadTaxonomy(
                            index,
                            "genre",
                            "custom_genre",
                            "media_genre",
                          )
                        }
                        learnedLabels={getLearnedTaxonomyLabels("media_genre")}
                        onRemoveLearnedLabel={(label) =>
                          removeLearnedUploadTaxonomy(
                            index,
                            "media_genre",
                            label,
                          )
                        }
                      />
                      <MetaHint>
                        Choose the main media class, including broadcast,
                        webvideo, and webcall formats.
                      </MetaHint>
                    </div>
                    <label className="mt-3 block">
                      <div className="mb-1 text-[10px] uppercase tracking-[0.12em] text-slate-500">
                        References
                      </div>
                      <textarea
                        value={draft.references}
                        onChange={(e) =>
                          setUploadMetadataDrafts((previous) =>
                            previous.map((item, itemIndex) =>
                              itemIndex === index
                                ? { ...item, references: e.target.value }
                                : item,
                            ),
                          )
                        }
                        rows={2}
                        placeholder="Optional, one per line"
                        className="w-full rounded-md border border-slate-700 bg-[#171717] px-3 py-2 text-sm text-slate-200 outline-none focus:border-slate-500"
                      />
                      <MetaHint>Related materials you may want to connect later.</MetaHint>
                    </label>
                    <div className="mt-3 grid gap-3 md:grid-cols-2">
                      <label className="block">
                        <div className="mb-1 text-[10px] uppercase tracking-[0.12em] text-slate-500">
                          Reference relation
                        </div>
                        <input
                          value={draft.reference_relation}
                          onChange={(e) =>
                            setUploadMetadataDrafts((previous) =>
                              previous.map((item, itemIndex) =>
                                itemIndex === index
                                  ? { ...item, reference_relation: e.target.value }
                                  : item,
                              ),
                            )
                          }
                          placeholder="Optional"
                          className="w-full rounded-md border border-slate-700 bg-[#171717] px-3 py-2 text-sm text-slate-200 outline-none focus:border-slate-500"
                        />
                        <MetaHint>How the reference connects to this media.</MetaHint>
                      </label>
                      <label className="block">
                        <div className="mb-1 text-[10px] uppercase tracking-[0.12em] text-slate-500">
                          Reference source
                        </div>
                        <input
                          value={draft.reference_source}
                          onChange={(e) =>
                            setUploadMetadataDrafts((previous) =>
                              previous.map((item, itemIndex) =>
                                itemIndex === index
                                  ? { ...item, reference_source: e.target.value }
                                  : item,
                              ),
                            )
                          }
                          placeholder="Optional"
                          className="w-full rounded-md border border-slate-700 bg-[#171717] px-3 py-2 text-sm text-slate-200 outline-none focus:border-slate-500"
                        />
                        <MetaHint>Where the reference comes from.</MetaHint>
                      </label>
                    </div>
                    <label className="mt-3 block">
                      <div className="mb-1 text-[10px] uppercase tracking-[0.12em] text-slate-500">
                        Upload reference data
                      </div>
                      <input
                        type="file"
                        multiple
                        accept=".pdf,.doc,.txt,.jpeg,.jpg,.png,.PNG,.webp"
                        onChange={(e) => {
                          const selected = Array.from(e.target.files || []);
                          setUploadMetadataDrafts((previous) =>
                            previous.map((item, itemIndex) =>
                              itemIndex === index
                                ? { ...item, reference_files: selected }
                                : item,
                            ),
                          );
                        }}
                        className="w-full rounded-md border border-dashed border-slate-700 bg-[#171717] px-3 py-2 text-sm text-slate-300 file:mr-3 file:rounded file:border-0 file:bg-slate-800 file:px-2 file:py-1 file:text-xs file:text-slate-200"
                      />
                      <MetaHint>
                        Attach supporting reference files such as PDF, DOC, TXT,
                        JPEG, PNG, or WEBP.
                      </MetaHint>
                      {draft.reference_files.length > 0 ? (
                        <div className="mt-2 flex flex-wrap gap-2">
                          {draft.reference_files.map((refFile) => (
                            <span
                              key={`${refFile.name}-${refFile.size}`}
                              className="rounded-md bg-slate-800/50 px-2 py-1 text-[11px] text-slate-300"
                            >
                              {refFile.name}
                            </span>
                          ))}
                        </div>
                      ) : null}
                    </label>
                    {showAdvancedUploadFields ? (
                      <div className="mt-4 space-y-3 rounded-md border border-white/8 bg-[#151515] p-3">
                        <div className="text-[10px] uppercase tracking-[0.12em] text-slate-500">
                          Advanced fields
                        </div>
                        <label className="block">
                          <div className="mb-1 text-[10px] uppercase tracking-[0.12em] text-slate-500">
                            Relations
                          </div>
                          <textarea
                            value={draft.relations}
                            onChange={(e) =>
                              setUploadMetadataDrafts((previous) =>
                                previous.map((item, itemIndex) =>
                                  itemIndex === index
                                    ? { ...item, relations: e.target.value }
                                    : item,
                                ),
                              )
                            }
                            rows={2}
                            className="w-full rounded-md border border-slate-700 bg-[#171717] px-3 py-2 text-sm text-slate-200 outline-none focus:border-slate-500"
                          />
                        </label>
                        <div className="grid gap-3 md:grid-cols-2">
                          {[
                            ["location_country", "Location: country"],
                            ["location_city", "Location: city"],
                            ["location_place", "Location: place"],
                            ["location_room", "Location: room"],
                            ["time_era", "Time: era"],
                            ["time_year", "Time: year"],
                            ["time_moment", "Time: moment"],
                            ["situation_event", "Scene / event"],
                          ].map(([key, label]) => (
                            <label key={key} className="block">
                              <div className="mb-1 text-[10px] uppercase tracking-[0.12em] text-slate-500">
                                {label}
                              </div>
                              <input
                                value={draft[key as keyof UploadMetadataDraft] as string}
                                onChange={(e) =>
                                  setUploadMetadataDrafts((previous) =>
                                    previous.map((item, itemIndex) =>
                                      itemIndex === index
                                        ? { ...item, [key]: e.target.value }
                                        : item,
                                    ),
                                  )
                                }
                                className="w-full rounded-md border border-slate-700 bg-[#171717] px-3 py-2 text-sm text-slate-200 outline-none focus:border-slate-500"
                              />
                            </label>
                          ))}
                        </div>
                        <div className="grid gap-3 md:grid-cols-2">
                          <CustomizableSelectField
                            label="Genre subtype"
                            value={draft.genre_subtype}
                            onChange={(nextValue) =>
                              updateUploadDraft(index, {
                                genre_subtype: nextValue,
                              })
                            }
                            options={getMediaSubgenreOptions(
                              draft.genre,
                              draft.genre_subtype,
                              sharedTaxonomyOptions,
                            )}
                            customValue={draft.custom_genre_subtype}
                            onCustomValueChange={(value) =>
                              updateUploadDraft(index, {
                                custom_genre_subtype: value,
                              })
                            }
                            onAddCustom={() =>
                              applyCustomUploadTaxonomy(
                                index,
                                "genre_subtype",
                                "custom_genre_subtype",
                                "media_subgenre",
                                draft.genre,
                              )
                            }
                            onShareCustom={() =>
                              shareCustomUploadTaxonomy(
                                index,
                                "genre_subtype",
                                "custom_genre_subtype",
                                "media_subgenre",
                                draft.genre,
                              )
                            }
                            disabled={!draft.genre}
                            emptyLabel={
                              draft.genre
                                ? "Select subtype"
                                : "Choose media genre first"
                            }
                            customPlaceholder={
                              draft.genre
                                ? "Add custom subtype if needed"
                                : "Choose media genre first"
                            }
                            learnedLabels={getLearnedTaxonomyLabels(
                              "media_subgenre",
                              draft.genre,
                            )}
                            onRemoveLearnedLabel={(label) =>
                              removeLearnedUploadTaxonomy(
                                index,
                                "media_subgenre",
                                label,
                                draft.genre,
                              )
                            }
                          />
                          <CustomizableSelectField
                            label="Situation type"
                            value={draft.situational_genre}
                            onChange={(nextValue) =>
                              updateUploadDraft(index, {
                                situational_genre: nextValue,
                                situational_subtype: "",
                              })
                            }
                            options={getSituationalGenreOptions(
                              draft.situational_genre,
                              sharedTaxonomyOptions,
                            )}
                            customValue={draft.custom_situational_genre}
                            onCustomValueChange={(value) =>
                              updateUploadDraft(index, {
                                custom_situational_genre: value,
                              })
                            }
                            onAddCustom={() =>
                              applyCustomUploadTaxonomy(
                                index,
                                "situational_genre",
                                "custom_situational_genre",
                                "situational_genre",
                              )
                            }
                            onShareCustom={() =>
                              shareCustomUploadTaxonomy(
                                index,
                                "situational_genre",
                                "custom_situational_genre",
                                "situational_genre",
                              )
                            }
                            learnedLabels={getLearnedTaxonomyLabels(
                              "situational_genre",
                            )}
                            onRemoveLearnedLabel={(label) =>
                              removeLearnedUploadTaxonomy(
                                index,
                                "situational_genre",
                                label,
                              )
                            }
                          />
                          <CustomizableSelectField
                            label="Situation detail"
                            value={draft.situational_subtype}
                            onChange={(nextValue) =>
                              updateUploadDraft(index, {
                                situational_subtype: nextValue,
                              })
                            }
                            options={getSituationalSubgenreOptions(
                              draft.situational_genre,
                              draft.situational_subtype,
                              sharedTaxonomyOptions,
                            )}
                            customValue={draft.custom_situational_subtype}
                            onCustomValueChange={(value) =>
                              updateUploadDraft(index, {
                                custom_situational_subtype: value,
                              })
                            }
                            onAddCustom={() =>
                              applyCustomUploadTaxonomy(
                                index,
                                "situational_subtype",
                                "custom_situational_subtype",
                                "situational_subgenre",
                                draft.situational_genre,
                              )
                            }
                            onShareCustom={() =>
                              shareCustomUploadTaxonomy(
                                index,
                                "situational_subtype",
                                "custom_situational_subtype",
                                "situational_subgenre",
                                draft.situational_genre,
                              )
                            }
                            disabled={!draft.situational_genre}
                            emptyLabel={
                              draft.situational_genre
                                ? "Select subtype"
                                : "Choose situational genre first"
                            }
                            customPlaceholder={
                              draft.situational_genre
                                ? "Add custom subtype if needed"
                                : "Choose situational genre first"
                            }
                            learnedLabels={getLearnedTaxonomyLabels(
                              "situational_subgenre",
                              draft.situational_genre,
                            )}
                            onRemoveLearnedLabel={(label) =>
                              removeLearnedUploadTaxonomy(
                                index,
                                "situational_subgenre",
                                label,
                                draft.situational_genre,
                              )
                            }
                          />
                          <CustomizableSelectField
                            label="Privacy"
                            value={draft.privacy_axis}
                            onChange={(nextValue) =>
                              updateUploadDraft(index, {
                                privacy_axis: nextValue,
                              })
                            }
                            options={getPrivacyAxisOptions(
                              draft.privacy_axis,
                              sharedTaxonomyOptions,
                            )}
                            customValue={draft.custom_privacy_axis}
                            onCustomValueChange={(value) =>
                              updateUploadDraft(index, {
                                custom_privacy_axis: value,
                              })
                            }
                            onAddCustom={() =>
                              applyCustomUploadTaxonomy(
                                index,
                                "privacy_axis",
                                "custom_privacy_axis",
                                "privacy_axis",
                              )
                            }
                            onShareCustom={() =>
                              shareCustomUploadTaxonomy(
                                index,
                                "privacy_axis",
                                "custom_privacy_axis",
                                "privacy_axis",
                              )
                            }
                            learnedLabels={getLearnedTaxonomyLabels(
                              "privacy_axis",
                            )}
                            onRemoveLearnedLabel={(label) =>
                              removeLearnedUploadTaxonomy(
                                index,
                                "privacy_axis",
                                label,
                              )
                            }
                          />
                          <CustomizableSelectField
                            label="Expertise"
                            value={draft.expertise_axis}
                            onChange={(nextValue) =>
                              updateUploadDraft(index, {
                                expertise_axis: nextValue,
                              })
                            }
                            options={getExpertiseAxisOptions(
                              draft.expertise_axis,
                              sharedTaxonomyOptions,
                            )}
                            customValue={draft.custom_expertise_axis}
                            onCustomValueChange={(value) =>
                              updateUploadDraft(index, {
                                custom_expertise_axis: value,
                              })
                            }
                            onAddCustom={() =>
                              applyCustomUploadTaxonomy(
                                index,
                                "expertise_axis",
                                "custom_expertise_axis",
                                "expertise_axis",
                              )
                            }
                            onShareCustom={() =>
                              shareCustomUploadTaxonomy(
                                index,
                                "expertise_axis",
                                "custom_expertise_axis",
                                "expertise_axis",
                              )
                            }
                            learnedLabels={getLearnedTaxonomyLabels(
                              "expertise_axis",
                            )}
                            onRemoveLearnedLabel={(label) =>
                              removeLearnedUploadTaxonomy(
                                index,
                                "expertise_axis",
                                label,
                              )
                            }
                          />
                        </div>
                        <label className="block">
                          <div className="mb-1 text-[10px] uppercase tracking-[0.12em] text-slate-500">
                            Interaction
                          </div>
                          <textarea
                            value={draft.interaction_dynamics}
                            onChange={(e) =>
                              setUploadMetadataDrafts((previous) =>
                                previous.map((item, itemIndex) =>
                                  itemIndex === index
                                    ? { ...item, interaction_dynamics: e.target.value }
                                    : item,
                                ),
                              )
                            }
                            rows={2}
                            className="w-full rounded-md border border-slate-700 bg-[#171717] px-3 py-2 text-sm text-slate-200 outline-none focus:border-slate-500"
                          />
                        </label>
                        <label className="block">
                          <div className="mb-1 text-[10px] uppercase tracking-[0.12em] text-slate-500">
                            Development
                          </div>
                          <textarea
                            value={draft.narrative_development}
                            onChange={(e) =>
                              setUploadMetadataDrafts((previous) =>
                                previous.map((item, itemIndex) =>
                                  itemIndex === index
                                    ? { ...item, narrative_development: e.target.value }
                                    : item,
                                ),
                              )
                            }
                            rows={2}
                            className="w-full rounded-md border border-slate-700 bg-[#171717] px-3 py-2 text-sm text-slate-200 outline-none focus:border-slate-500"
                          />
                        </label>
                        <label className="block">
                          <div className="mb-1 text-[10px] uppercase tracking-[0.12em] text-slate-500">
                            Expression / delivery
                          </div>
                          <textarea
                            value={draft.performance_expression}
                            onChange={(e) =>
                              setUploadMetadataDrafts((previous) =>
                                previous.map((item, itemIndex) =>
                                  itemIndex === index
                                    ? { ...item, performance_expression: e.target.value }
                                    : item,
                                ),
                              )
                            }
                            rows={2}
                            className="w-full rounded-md border border-slate-700 bg-[#171717] px-3 py-2 text-sm text-slate-200 outline-none focus:border-slate-500"
                          />
                        </label>
                        <div className="grid gap-3 md:grid-cols-2">
                          <label className="block">
                            <div className="mb-1 text-[10px] uppercase tracking-[0.12em] text-slate-500">
                              Confidence
                            </div>
                            <select
                              value={draft.confidence}
                              onChange={(e) =>
                                setUploadMetadataDrafts((previous) =>
                                  previous.map((item, itemIndex) =>
                                    itemIndex === index
                                      ? { ...item, confidence: e.target.value }
                                      : item,
                                  ),
                                )
                              }
                              className="w-full rounded-md border border-slate-700 bg-[#171717] px-3 py-2 text-sm text-slate-200 outline-none focus:border-slate-500"
                            >
                              <option value="">Not set</option>
                              <option value="high">High</option>
                              <option value="medium">Medium</option>
                              <option value="low">Low</option>
                            </select>
                          </label>
                        </div>
                        <label className="block">
                          <div className="mb-1 text-[10px] uppercase tracking-[0.12em] text-slate-500">
                            Notes
                          </div>
                          <textarea
                            value={draft.notes}
                            onChange={(e) =>
                              setUploadMetadataDrafts((previous) =>
                                previous.map((item, itemIndex) =>
                                  itemIndex === index
                                    ? { ...item, notes: e.target.value }
                                    : item,
                                ),
                              )
                            }
                            rows={3}
                            className="w-full rounded-md border border-slate-700 bg-[#171717] px-3 py-2 text-sm text-slate-200 outline-none focus:border-slate-500"
                          />
                        </label>
                      </div>
                    ) : null}
                  </div>
                );
              })}
            </div>
            <div className="mt-4 flex items-center justify-end gap-2">
              <button
                type="button"
                className="rounded border border-white/8 px-3 py-1.5 text-xs text-slate-400 transition hover:text-slate-200"
                onClick={() => {
                  if (isSubmittingUpload) return;
                  setShowUploadMetadataDialog(false);
                  setPendingUploadFiles([]);
                  setUploadMetadataDrafts([]);
                  setShowAdvancedUploadFields(false);
                }}
              >
                Cancel
              </button>
              <button
                type="button"
                className="rounded border border-slate-600 bg-slate-800/70 px-3 py-1.5 text-xs text-slate-200 transition hover:bg-slate-700/70 disabled:opacity-50"
                disabled={isSubmittingUpload || pendingUploadFiles.length === 0}
                onClick={() => {
                  setIsSubmittingUpload(true);
                  void runUploadWithMetadata(
                    pendingUploadFiles,
                    uploadMetadataDrafts,
                  ).finally(() => {
                    setIsSubmittingUpload(false);
                    setShowUploadMetadataDialog(false);
                    setPendingUploadFiles([]);
                    setUploadMetadataDrafts([]);
                    setShowAdvancedUploadFields(false);
                  });
                }}
              >
                {isSubmittingUpload ? "Uploading..." : "Upload"}
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </>
  );
}
