"use client";

import { createContext, useContext, useEffect, useRef } from "react";
import { ContentItem, GoldenLayout, JsonValue, LayoutConfig } from "golden-layout";
import { ReactComponentWrapper } from "@/lib/golden-layout-lib/ReactComponentWrapper";
import "golden-layout/dist/css/goldenlayout-base.css";
import "golden-layout/dist/css/themes/goldenlayout-dark-theme.css";

// Import your panel components here
import ProjectPanel from "./panels/ProjectPanel";
import VideoPanel from "./panels/VideoPanel";
import CvatPluginPanel from "./panels/CvatPluginPanel";
import VideoComparePanel from "./panels/VideoComparePanel";
import ToolsPanel from "./panels/ToolsPanel";
import SpeechToTextPanel from "./panels/SpeechToTextPanel";
import OBJDetectionPanel from "./panels/OBJDetectionPanel";
import OCRPanel from "./panels/OCRPanel";
import ExpressionPanel from "./panels/ExpressionPanel";
import DownloadPanel from "./panels/DownloadPanel";
import POSAnalyzePanel from "./panels/POSAnalyzePanel";
import POSMatrixPanel from "./panels/POSMatrixPanel";
import QuantitativeAnalysisPanel from "./panels/QuantitativeAnalysisPanel";
import QuantMatrixPanel from "./panels/QuantMatrixPanel";
import SourceMediaMetadataPanel from "./panels/SourceMediaMetadataPanel";
import TimeBankPanel from "./panels/TimeBankPanel";
import MeaningPlotPanel from "./panels/MeaningPlotPanel";
import SceneCardPanel from "./panels/SceneCardPanel";
import MasterSchemaPanel from "./panels/MasterSchemaPanel";
import TracebackDrawerPanel from "./panels/TracebackDrawerPanel";
import { MenuBar } from "./MenuBar";
import { eventBus } from "@/lib/golden-layout-lib/eventBus";

// --- Context Setup ---
type LayoutHostContextType = {
  openPanel: (panelType: string, panelProps?: JsonValue) => void;
};

const LayoutHostContext = createContext<LayoutHostContextType | undefined>(
  undefined,
);

const SAVED_LAYOUT_STORAGE_KEY = "vaa1.workspace.layout";

const RIGHT_STACK_ANCHOR_TYPES = [
  "TracebackDrawer",
  "MasterSchema",
  "ManualScene",
  "ManualAction",
  "ManualIdentification",
  "ManualAudio",
  "ManualGenre",
  "Expressions",
  "OCR",
  "OBJDetection",
  "Audio",
  "SourceMediaMetadata",
  "TimeBank",
  "MeaningPlot",
  "SceneCards",
  "Transcript",
  "POS",
  "Quant",
];

const MANUAL_LEAF_PANEL_CONFIGS = [
  { componentType: "ManualAction", category: "Action", title: "Action" },
  { componentType: "ManualAudio", category: "Audio", title: "Audio Leaf" },
  {
    componentType: "ManualCinematicCues",
    category: "Cinematic Cues",
    title: "Cinematic Cues",
  },
  {
    componentType: "ManualExpressions",
    category: "Expressions",
    title: "Expressions Leaf",
  },
  { componentType: "ManualGenre", category: "Genre", title: "Genre" },
  {
    componentType: "ManualIdentification",
    category: "Identification",
    title: "Narrative Agent",
  },
  {
    componentType: "ManualInteraction",
    category: "Interaction",
    title: "Interaction",
  },
  { componentType: "ManualMetadata", category: "Metadata", title: "Metadata" },
  { componentType: "ManualMovement", category: "Movement", title: "Movement" },
  { componentType: "ManualNotes", category: "Notes", title: "Notes" },
  { componentType: "ManualOBJ", category: "OBJ", title: "OBJ Leaf" },
  { componentType: "ManualOCR", category: "OCR", title: "OCR Leaf" },
  { componentType: "ManualRole", category: "Role", title: "Role" },
  { componentType: "ManualScene", category: "Scene", title: "Scene" },
  {
    componentType: "ManualTranscription",
    category: "Transcription",
    title: "Transcription Leaf",
  },
];

function manualCategoryDisplayLabel(category: string): string {
  return category === "Identification" ? "Narrative Agent" : category;
}

function normalizeLegacyPanelTitle(title: unknown): unknown {
  if (title === "Identification" || title === "Identification Leaf") {
    return "Narrative Agent";
  }
  if (title === "Manual Identification") {
    return "Manual Narrative Agent";
  }
  return title;
}

function normalizeLegacyLayoutLabels(value: unknown): unknown {
  if (Array.isArray(value)) {
    return value.map((item) => normalizeLegacyLayoutLabels(item));
  }
  if (!value || typeof value !== "object") {
    return value;
  }

  const record = value as Record<string, unknown>;
  const next: Record<string, unknown> = {};
  for (const [key, childValue] of Object.entries(record)) {
    next[key] = normalizeLegacyLayoutLabels(childValue);
  }

  if (next.componentType === "ManualIdentification") {
    next.title = "Narrative Agent";
    const componentState = next.componentState;
    if (componentState && typeof componentState === "object") {
      next.componentState = {
        ...(componentState as Record<string, unknown>),
        panelTitle: "Narrative Agent",
        panelDescription:
          "Manual Narrative Agent annotations live here as a dedicated leaf, while also remaining visible in the Master Schema.",
      };
    }
  } else if ("title" in next) {
    next.title = normalizeLegacyPanelTitle(next.title);
  }

  if ("panelTitle" in next) {
    next.panelTitle = normalizeLegacyPanelTitle(next.panelTitle);
  }
  if (
    typeof next.panelDescription === "string" &&
    next.panelDescription.includes("Manual Identification annotations")
  ) {
    next.panelDescription =
      "Manual Narrative Agent annotations live here as a dedicated leaf, while also remaining visible in the Master Schema.";
  }

  return next;
}

function layoutContainsComponent(value: unknown, componentType: string): boolean {
  if (Array.isArray(value)) {
    return value.some((item) => layoutContainsComponent(item, componentType));
  }
  if (!value || typeof value !== "object") {
    return false;
  }

  const record = value as Record<string, unknown>;
  if (record.componentType === componentType) {
    return true;
  }

  return Object.values(record).some((childValue) =>
    layoutContainsComponent(childValue, componentType),
  );
}

const buildDefaultLayoutConfig = (): import("golden-layout").LayoutConfig => ({
  settings: {
    showMaximiseIcon: false,
    showPopoutIcon: false,
  },
  root: {
    type: "row",
    content: [
      {
        type: "column",
        width: 16,
        content: [
          {
            type: "component",
            componentType: "ProjectPanel",
            title: "Project",
            height: 28,
          },
          {
            type: "component",
            componentType: "DownloadPanel",
            title: "Downloads",
            height: 72,
          },
        ],
      },
      {
        type: "column",
        width: 56,
        content: [
          {
            type: "component",
            componentType: "VideoPanel",
            title: "Video",
            height: 64,
          },
          {
            type: "row",
            content: [
              {
                type: "component",
                width: 32,
                componentType: "ToolsPanel",
                title: "Tools",
              },
              {
                type: "component",
                componentType: "Transcript",
                title: "Transcript",
              },
            ],
          },
        ],
      },
      {
        type: "stack",
        id: "rightStack",
        width: 28,
        content: [
          {
            type: "component",
            componentType: "OBJDetection",
            title: "Objects",
          },
          {
            type: "component",
            componentType: "OCR",
            title: "OCR",
          },
          {
            type: "component",
            componentType: "Expressions",
            title: "Expressions",
          },
          {
            type: "component",
            componentType: "MasterSchema",
            title: "Master Schema",
          },
          {
            type: "component",
            componentType: "SceneCards",
            title: "Scene Cards",
          },
          {
            type: "component",
            componentType: "POS",
            title: "POS",
          },
          {
            type: "component",
            componentType: "Quant",
            title: "Quant",
          },
        ],
      },
    ],
  },
});

const buildAnnotationWorkspaceLayout = (): import("golden-layout").LayoutConfig => ({
  settings: {
    showMaximiseIcon: false,
    showPopoutIcon: false,
  },
  root: {
    type: "row",
    content: [
      {
        type: "stack",
        width: 10,
        content: [
          {
            type: "component",
            componentType: "ProjectPanel",
            title: "Project",
          },
          {
            type: "component",
            componentType: "DownloadPanel",
            title: "Downloads",
          },
        ],
      },
      {
        type: "column",
        width: 62,
        content: [
          {
            type: "row",
            content: [
              {
                type: "component",
                componentType: "VideoPanel",
                title: "Video",
                width: 50,
              },
              {
                type: "component",
                componentType: "ToolsPanel",
                title: "Tools",
                width: 50,
              },
            ],
          },
        ],
      },
      {
        type: "stack",
        id: "annotationRightStack",
        width: 28,
        content: [
          {
            type: "component",
            componentType: "OBJDetection",
            title: "Objects",
          },
          {
            type: "component",
            componentType: "OCR",
            title: "OCR",
          },
          {
            type: "component",
            componentType: "Expressions",
            title: "Expressions",
          },
          {
            type: "component",
            componentType: "MasterSchema",
            title: "Master Schema",
          },
          {
            type: "component",
            componentType: "SourceMediaMetadata",
            title: "Source Media",
          },
          {
            type: "component",
            componentType: "TimeBank",
            title: "Time Bank",
          },
          {
            type: "component",
            componentType: "SceneCards",
            title: "Scene Cards",
          },
          {
            type: "component",
            componentType: "Transcript",
            title: "Transcript",
          },
          {
            type: "component",
            componentType: "Audio",
            title: "Audio",
          },
        ],
      },
    ],
  },
});

export function useLayoutHost() {
  const ctx = useContext(LayoutHostContext);
  if (!ctx)
    throw new Error("useLayoutHost must be used within LayoutHostProvider");
  return ctx;
}
// --- End Context Setup ---

export default function LayoutHost({
  children,
}: {
  children?: React.ReactNode;
}) {
  const hostRef = useRef<HTMLDivElement>(null);
  const layoutRef = useRef<GoldenLayout | null>(null);
  const PANEL_TITLES: Record<string, string> = {
    Audio: "Audio",
    CvatPluginPanel: "CVAT plugin",
    Transcript: "Transcript",
    ToolsPanel: "Tools",
    OBJDetection: "Objects",
    OCR: "OCR",
    Expressions: "Expressions",
    POS: "POS",
    Quant: "Quant",
    VideoCompare: "Video compare",
    POSMatrix: "POS matrix",
    QuantMatrix: "Quant matrix",
    SourceMediaMetadata: "Source Media",
    TimeBank: "Time Bank",
    MeaningPlot: "Meaning / Plot",
    SceneCards: "Scene Cards",
    MasterSchema: "Master Schema",
    TracebackDrawer: "Traceback",
    ...Object.fromEntries(
      MANUAL_LEAF_PANEL_CONFIGS.map((item) => [item.componentType, item.title]),
    ),
  };

  const getLayoutItems = (item: ContentItem | undefined): ContentItem[] => {
    if (!item) {
      return [];
    }

    return [item, ...item.contentItems.flatMap((child) => getLayoutItems(child))];
  };

  const activateExistingPanel = (panelType: string): boolean => {
    const layout = layoutRef.current;
    if (!layout) {
      return false;
    }

    const items = getLayoutItems(layout.rootItem);
    for (const item of items) {
      const candidate = item as {
        isComponent?: boolean;
        componentType?: unknown;
        parent?: {
          type?: string;
          setActiveComponentItem?: (
            item: unknown,
            focus: boolean,
            suppressFocusEvent?: boolean,
          ) => void;
        };
        focus?: (suppressEvent?: boolean) => void;
        setTitle?: (title: string) => void;
      };

      if (!candidate.isComponent || candidate.componentType !== panelType) {
        continue;
      }

      const title = PANEL_TITLES[panelType];
      if (title && candidate.setTitle) {
        candidate.setTitle(title);
      }

      if (
        candidate.parent?.type === "stack" &&
        candidate.parent.setActiveComponentItem
      ) {
        candidate.parent.setActiveComponentItem(candidate, true, false);
      }

      candidate.focus?.(false);
      return true;
    }

    return false;
  };

  const findPreferredRightStack = () => {
    const layout = layoutRef.current;
    if (!layout) {
      return null;
    }

    const items = getLayoutItems(layout.rootItem);
    for (const anchorType of RIGHT_STACK_ANCHOR_TYPES) {
      const anchor = items.find((item) => {
        const candidate = item as {
          isComponent?: boolean;
          componentType?: unknown;
        };
        return candidate.isComponent && candidate.componentType === anchorType;
      }) as
        | {
            parent?: {
              addComponent: (
                componentType: JsonValue,
                componentState?: JsonValue,
                title?: string,
              ) => number;
            };
          }
        | undefined;

      if (anchor?.parent?.addComponent) {
        return anchor.parent;
      }
    }

    return null;
  };

  const layoutConfig = buildDefaultLayoutConfig();

  // --- openPanel function ---
  const openPanel = (panelType: string, panelProps?: JsonValue) => {
    if (!layoutRef.current) return;
    if (activateExistingPanel(panelType)) {
      return;
    }
    const rightStack = findPreferredRightStack();
    if (rightStack) {
      rightStack.addComponent(panelType, panelProps || {}, PANEL_TITLES[panelType]);
      return;
    }
    layoutRef.current.addComponent(panelType, panelProps || {}, PANEL_TITLES[panelType]);
  };
  // --- End openPanel function ---

  useEffect(() => {
    if (!hostRef.current) return;

    const layout = new GoldenLayout(hostRef.current);
    let saveTimeout: ReturnType<typeof setTimeout> | undefined;

    // Create a wrapper component that provides the context
    const ContextWrapper: React.FC<{ children: React.ReactNode }> = ({
      children,
    }) => (
      <LayoutHostContext.Provider value={{ openPanel }}>
        {children}
      </LayoutHostContext.Provider>
    );

    // Register the component factories
    layout.registerComponentFactoryFunction(
      "ProjectPanel",
      (container, state: JsonValue | undefined) => {
        new ReactComponentWrapper(container, ProjectPanel, {}, ContextWrapper);
      },
    );

    layout.registerComponentFactoryFunction(
      "VideoPanel",
      (container, state: JsonValue | undefined) => {
        new ReactComponentWrapper(container, VideoPanel, {}, ContextWrapper);
      },
    );

    layout.registerComponentFactoryFunction(
      "CvatPluginPanel",
      (container, state: JsonValue | undefined) => {
        new ReactComponentWrapper(
          container,
          CvatPluginPanel,
          {},
          ContextWrapper,
        );
      },
    );

    layout.registerComponentFactoryFunction(
      "VideoCompare",
      (container, state: JsonValue | undefined) => {
        new ReactComponentWrapper(
          container,
          VideoComparePanel,
          (state as Record<string, unknown>) || {},
          ContextWrapper,
        );
      },
    );

    layout.registerComponentFactoryFunction(
      "DownloadPanel",
      (container, state: JsonValue | undefined) => {
        new ReactComponentWrapper(container, DownloadPanel, {}, ContextWrapper);
      },
    );

    layout.registerComponentFactoryFunction(
      "ToolsPanel",
      (container, state: JsonValue | undefined) => {
        new ReactComponentWrapper(container, ToolsPanel, {}, ContextWrapper);
      },
    );

    layout.registerComponentFactoryFunction(
      "Transcript",
      (container, state: JsonValue | undefined) => {
        new ReactComponentWrapper(
          container,
          SpeechToTextPanel,
          {},
          ContextWrapper,
        );
      },
    );

    layout.registerComponentFactoryFunction(
      "Audio",
      (container, state: JsonValue | undefined) => {
        new ReactComponentWrapper(
          container,
          SpeechToTextPanel,
          { ...(state as Record<string, unknown> || {}), panelMode: "audio" },
          ContextWrapper,
        );
      },
    );

    layout.registerComponentFactoryFunction(
      "OBJDetection",
      (container, state: JsonValue | undefined) => {
        new ReactComponentWrapper(
          container,
          OBJDetectionPanel,
          {},
          ContextWrapper,
        );
      },
    );

    layout.registerComponentFactoryFunction(
      "OCR",
      (container, state: JsonValue | undefined) => {
        new ReactComponentWrapper(
          container,
          OCRPanel,
          {},
          ContextWrapper,
        );
      },
    );

    layout.registerComponentFactoryFunction(
      "POS",
      (container, state: JsonValue | undefined) => {
        new ReactComponentWrapper(
          container,
          POSAnalyzePanel,
          {},
          ContextWrapper,
        );
      },
    );

    layout.registerComponentFactoryFunction(
      "POSMatrix",
      (container, state: JsonValue | undefined) => {
        new ReactComponentWrapper(
          container,
          POSMatrixPanel,
          (state as Record<string, unknown>) || {},
          ContextWrapper,
        );
      },
    );

    layout.registerComponentFactoryFunction(
      "Quant",
      (container, state: JsonValue | undefined) => {
        new ReactComponentWrapper(
          container,
          QuantitativeAnalysisPanel,
          {},
          ContextWrapper,
        );
      },
    );

    layout.registerComponentFactoryFunction(
      "QuantMatrix",
      (container, state: JsonValue | undefined) => {
        new ReactComponentWrapper(
          container,
          QuantMatrixPanel,
          (state as Record<string, unknown>) || {},
          ContextWrapper,
        );
      },
    );

    layout.registerComponentFactoryFunction(
      "Expressions",
      (container, state: JsonValue | undefined) => {
        new ReactComponentWrapper(
          container,
          ExpressionPanel,
          {},
          ContextWrapper,
        );
      },
    );

    layout.registerComponentFactoryFunction(
      "SourceMediaMetadata",
      (container, state: JsonValue | undefined) => {
        new ReactComponentWrapper(
          container,
          SourceMediaMetadataPanel,
          (state as Record<string, unknown>) || {},
          ContextWrapper,
        );
      },
    );

    layout.registerComponentFactoryFunction(
      "TimeBank",
      (container, state: JsonValue | undefined) => {
        new ReactComponentWrapper(
          container,
          TimeBankPanel,
          (state as Record<string, unknown>) || {},
          ContextWrapper,
        );
      },
    );

    layout.registerComponentFactoryFunction(
      "MeaningPlot",
      (container, state: JsonValue | undefined) => {
        new ReactComponentWrapper(
          container,
          MeaningPlotPanel,
          (state as Record<string, unknown>) || {},
          ContextWrapper,
        );
      },
    );

    layout.registerComponentFactoryFunction(
      "SceneCards",
      (container, state: JsonValue | undefined) => {
        new ReactComponentWrapper(
          container,
          SceneCardPanel,
          (state as Record<string, unknown>) || {},
          ContextWrapper,
        );
      },
    );

    layout.registerComponentFactoryFunction(
      "MasterSchema",
      (container, state: JsonValue | undefined) => {
        new ReactComponentWrapper(
          container,
          MasterSchemaPanel,
          {},
          ContextWrapper,
        );
      },
    );

    layout.registerComponentFactoryFunction(
      "TracebackDrawer",
      (container, state: JsonValue | undefined) => {
        new ReactComponentWrapper(
          container,
          TracebackDrawerPanel,
          (state as Record<string, unknown>) || {},
          ContextWrapper,
        );
      },
    );

    for (const leaf of MANUAL_LEAF_PANEL_CONFIGS) {
      layout.registerComponentFactoryFunction(
        leaf.componentType,
        (container, state: JsonValue | undefined) => {
          new ReactComponentWrapper(
            container,
            MasterSchemaPanel,
            {
              ...(state as Record<string, unknown> || {}),
              category: leaf.category,
              panelTitle: leaf.title,
              panelDescription:
                `Manual ${manualCategoryDisplayLabel(leaf.category)} annotations live here as a dedicated leaf, while also remaining visible in the Master Schema.`,
            },
            ContextWrapper,
          );
        },
      );
    }

    const persistLayout = () => {
      if (saveTimeout) {
        clearTimeout(saveTimeout);
      }
      saveTimeout = setTimeout(() => {
        try {
          const resolvedConfig = layout.saveLayout();
          const restorableConfig = LayoutConfig.fromResolved(resolvedConfig);
          window.localStorage.setItem(
            SAVED_LAYOUT_STORAGE_KEY,
            JSON.stringify(restorableConfig),
          );
        } catch (error) {
          console.warn("Failed to persist workspace layout:", error);
        }
      }, 150);
    };

    let initialLayout = layoutConfig;
    let requestedAnalysisId = "";
    let requestedWorkspace = "";
    try {
      const stored = window.localStorage.getItem(SAVED_LAYOUT_STORAGE_KEY);
      if (stored) {
        const restoredLayout = normalizeLegacyLayoutLabels(
          JSON.parse(stored),
        ) as import("golden-layout").LayoutConfig;
        initialLayout = layoutContainsComponent(restoredLayout, "VideoPanel")
          ? restoredLayout
          : buildDefaultLayoutConfig();
      }
      const params = new URLSearchParams(window.location.search);
      requestedAnalysisId = params.get("analysis_id") || "";
      requestedWorkspace = params.get("workspace") || "";
      if (requestedWorkspace === "annotation") {
        initialLayout = buildAnnotationWorkspaceLayout();
      } else if (requestedWorkspace === "default") {
        initialLayout = buildDefaultLayoutConfig();
      }
    } catch (error) {
      console.warn("Failed to restore saved workspace layout:", error);
    }

    layout.on("stateChanged", persistLayout);
    layout.on("itemDestroyed", persistLayout);
    layout.on("itemCreated", persistLayout);

    const openPanelRequestHandler = (payload: {
      panelType: string;
      panelProps?: JsonValue;
    }) => {
      if (!payload?.panelType) {
        return;
      }
      openPanel(payload.panelType, payload.panelProps);
    };
    eventBus.on("openPanelRequest", openPanelRequestHandler);

    const workspacePresetHandler = (preset: string) => {
      if (!layoutRef.current) {
        return;
      }

      if (preset === "annotation") {
        layoutRef.current.loadLayout(buildAnnotationWorkspaceLayout());
      } else if (preset === "default") {
        layoutRef.current.loadLayout(buildDefaultLayoutConfig());
      }
      eventBus.emit("workspacePresetChanged", preset);
      persistLayout();
    };
    eventBus.on<string>("workspacePresetRequest", workspacePresetHandler);

    // Define the initial layout configuration
    layout.loadLayout(initialLayout);

    layoutRef.current = layout;

    if (requestedWorkspace) {
      window.setTimeout(() => {
        eventBus.emit("workspacePresetChanged", requestedWorkspace);
        if (requestedWorkspace === "annotation") {
          eventBus.emit("toolsSectionFocus", "annotation");
        }
      }, 60);
    }

    if (requestedAnalysisId) {
      window.setTimeout(() => {
        eventBus.emit("videoIdChanged", requestedAnalysisId);
      }, 120);
    }

    return () => {
      if (saveTimeout) {
        clearTimeout(saveTimeout);
      }
      layout.off("stateChanged", persistLayout);
      layout.off("itemDestroyed", persistLayout);
      layout.off("itemCreated", persistLayout);
      eventBus.off("openPanelRequest", openPanelRequestHandler);
      eventBus.off<string>("workspacePresetRequest", workspacePresetHandler);
      layout.destroy();
    };
  }, []);

  return (
    <LayoutHostContext.Provider value={{ openPanel }}>
      <MenuBar />
      <div ref={hostRef} style={{ width: "100%", height: "100%" }} />
      {children}
    </LayoutHostContext.Provider>
  );
}
