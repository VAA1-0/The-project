"use client";

import { createContext, useContext, useEffect, useRef } from "react";
import { GoldenLayout, JsonValue, LayoutConfig } from "golden-layout";
import { ReactComponentWrapper } from "@/lib/golden-layout-lib/ReactComponentWrapper";
import "golden-layout/dist/css/goldenlayout-base.css";
import "golden-layout/dist/css/themes/goldenlayout-dark-theme.css";

// Import your panel components here
import ProjectPanel from "./panels/ProjectPanel";
import VideoPanel from "./panels/VideoPanel";
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
    VideoCompare: "Video compare",
    POSMatrix: "POS matrix",
    QuantMatrix: "Quant matrix",
    SourceMediaMetadata: "Source Media",
    TimeBank: "Time Bank",
  };

  const activateExistingPanel = (panelType: string): boolean => {
    const layout = layoutRef.current;
    if (!layout) {
      return false;
    }

    const items = layout.getAllContentItems();
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
      };

      if (!candidate.isComponent || candidate.componentType !== panelType) {
        continue;
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

  const layoutConfig: import("golden-layout").LayoutConfig = {
    settings: {
        showMaximiseIcon: false, 
        showPopoutIcon: false,
      },
    root: {
      type: "row",
      content: [
        {
          type: "column",
          width: 20,
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
          width: 54,
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
          width: 26,
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
  };

  // --- openPanel function ---
  const openPanel = (panelType: string, panelProps?: JsonValue) => {
    if (!layoutRef.current) return;
    if (activateExistingPanel(panelType)) {
      return;
    }
    layoutRef.current.addComponent(
      panelType,
      panelProps || {},
      PANEL_TITLES[panelType],
    );
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
    try {
      const stored = window.localStorage.getItem(SAVED_LAYOUT_STORAGE_KEY);
      if (stored) {
        initialLayout = JSON.parse(stored) as import("golden-layout").LayoutConfig;
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

    // Define the initial layout configuration
    layout.loadLayout(initialLayout);

    layoutRef.current = layout;

    return () => {
      if (saveTimeout) {
        clearTimeout(saveTimeout);
      }
      layout.off("stateChanged", persistLayout);
      layout.off("itemDestroyed", persistLayout);
      layout.off("itemCreated", persistLayout);
      eventBus.off("openPanelRequest", openPanelRequestHandler);
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
