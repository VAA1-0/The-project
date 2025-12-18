"use client";

import { createContext, useContext, useEffect, useRef } from "react";
import { GoldenLayout, JsonValue } from "golden-layout";
import { ReactComponentWrapper } from "@/lib/golden-layout-lib/ReactComponentWrapper";
import "golden-layout/dist/css/goldenlayout-base.css";
import "golden-layout/dist/css/themes/goldenlayout-dark-theme.css";

// Import your panel components here
import ProjectPanel from "./panels/ProjectPanel";
import VideoPanel from "./panels/VideoPanel";
import ToolsPanel from "./panels/ToolsPanel";
import SpeechToTextPanel from "./panels/SpeechToTextPanel";
import DownloadPanel from "./panels/DownloadPanel";
import POSAnalyzePanel from "./panels/POSAnalyzePanel";
import QuantitativeAnalysisPanel from "./panels/QuantitativeAnalysisPanel";
import { MenuBar } from "./MenuBar";

// --- Context Setup ---
type LayoutHostContextType = {
  openPanel: (panelType: string, panelProps?: JsonValue) => void;
};

const LayoutHostContext = createContext<LayoutHostContextType | undefined>(
  undefined
);

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

  const layoutConfig: import("golden-layout").LayoutConfig = {
    root: {
      type: "row",
      content: [
        {
          type: "column",
          width: 40,
          content: [
            {
              type: "component",
              componentType: "ProjectPanel",
              title: "ProjectPanel",
              height: 40,
            },
            {
              type: "component",
              componentType: "DownloadPanel",
              title: "DownloadPanel",
              height: 60,
            },
          ],
        },
        {
          type: "column",
          content: [
            {
              type: "component",
              componentType: "VideoPanel",
              title: "VideoPanel",
              height: 70,
            },
            {
              type: "component",
              componentType: "ToolsPanel",
              title: "ToolsPanel",
            },
          ],
        },
        {
          type: "stack",
          id: "rightStack",
          width: 30,
          content: [
            {
              type: "component",
              componentType: "Transcript",
              title: "Transcript",
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
    layoutRef.current.addComponent(panelType, panelProps || {});
  };
  // --- End openPanel function ---

  useEffect(() => {
    if (!hostRef.current) return;

    const layout = new GoldenLayout(hostRef.current);

    // Register the component factories
    layout.registerComponentFactoryFunction(
      "ProjectPanel",
      (container, state: JsonValue | undefined) => {
        new ReactComponentWrapper(container, ProjectPanel);
      }
    );

    layout.registerComponentFactoryFunction(
      "VideoPanel",
      (container, state: JsonValue | undefined) => {
        new ReactComponentWrapper(container, VideoPanel);
      }
    );

    layout.registerComponentFactoryFunction(
      "DownloadPanel",
      (container, state: JsonValue | undefined) => {
        new ReactComponentWrapper(container, DownloadPanel);
      }
    );

    layout.registerComponentFactoryFunction(
      "ToolsPanel",
      (container, state: JsonValue | undefined) => {
        new ReactComponentWrapper(container, ToolsPanel);
      }
    );

    layout.registerComponentFactoryFunction(
      "Transcript",
      (container, state: JsonValue | undefined) => {
        new ReactComponentWrapper(container, SpeechToTextPanel);
      }
    );

    layout.registerComponentFactoryFunction(
      "POS",
      (container, state: JsonValue | undefined) => {
        new ReactComponentWrapper(container, POSAnalyzePanel);
      }
    );

    layout.registerComponentFactoryFunction(
      "Quant",
      (container, state: JsonValue | undefined) => {
        new ReactComponentWrapper(container, QuantitativeAnalysisPanel);
      }
    );

    // Define the initial layout configuration
    layout.loadLayout(layoutConfig);

    layoutRef.current = layout;

    return () => layout.destroy();
  }, []);

  return (
    <LayoutHostContext.Provider value={{ openPanel }}>
      <MenuBar />
      <div ref={hostRef} style={{ width: "100%", height: "100%" }} />
      {children}
    </LayoutHostContext.Provider>
  );
}
