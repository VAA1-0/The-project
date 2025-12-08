"use client";

<<<<<<< HEAD
import { useEffect, useRef } from "react";
import { GoldenLayout } from "golden-layout";
import "golden-layout/dist/css/goldenlayout-base.css";
import "golden-layout/dist/css/themes/goldenlayout-dark-theme.css";

import ProjectPanel from "./panels/ProjectPanel";
import PanelB from "./panels/PanelB";
import { createRoot } from "react-dom/client";

export default function PanelManager() {
  const containerRef = useRef<HTMLDivElement>(null);
=======
import { useEffect, useRef, useState } from "react";
import { GoldenLayout } from "golden-layout";
import "golden-layout/dist/css/goldenlayout-base.css";
import "golden-layout/dist/css/themes/goldenlayout-dark-theme.css";
import { createRoot } from "react-dom/client";

// Import your panel components here
import ProjectPanel from "./panels/ProjectPanel";
import AnalyzeResultsPanel from "./panels/AnalyzeResultsPanel";
import VideoPanel from "./panels/VideoPanel";
import ToolsPanel from "./panels/ToolsPanel";
import SpeechToTextPanel from "./panels/SpeechToTextPanel";

// Import State manager and laytout factory if needed
import { panelStateManager } from "@/lib/panel-state-manager";
import { GoldenLayoutFactory } from "@/lib/golden-layout-factory";

interface PanelConfig {
  componentName: string;
  Component: React.ComponentType<any>;
  getProps?: (state?: any) => Record<string, any>;
}

const panelConfigs: PanelConfig[] = [
  {
    componentName: "ProjectPanel",
    Component: ProjectPanel,
    getProps: () => ({
      onVideoSelect: (id: string) => panelStateManager.setVideoId(id),
    }),
  },
  {
    componentName: "AnalyzeResultsPanel",
    Component: AnalyzeResultsPanel,
  },
  {
    componentName: "VideoPanel",
    Component: VideoPanel,
    getProps: (state) => ({ videoId: state.videoId }),
  },
  {
    componentName: "ToolsPanel",
    Component: ToolsPanel,
    getProps: (state) => ({ videoId: state.videoId }),
  },
  {
    componentName: "SpeechToTextPanel",
    Component: SpeechToTextPanel,
    getProps: (state) => ({ videoId: state.videoId }),
  },
];

const layoutConfig = {
  root: {
    type: "row",
    content: [
      {
        type: "column",
        width: 15,
        content: [
          {
            type: "component",
            componentType: "ProjectPanel",
            title: "ProjectPanel",
            height: 50,
          },
          {
            type: "component",
            componentType: "AnalyzeResultsPanel",
            title: "AnalyzeResultsPanel",
            height: 50,
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
        type: "component",
        componentType: "SpeechToTextPanel",
        title: "SpeechToTextPanel",
        width: 20,
      },
    ],
  },
};

export default function PanelManager() {
  const containerRef = useRef<HTMLDivElement>(null);
  const factoryRef = useRef<GoldenLayoutFactory | null>(null);
>>>>>>> 2e2d0f4e0810f1746ac9f8098bfb210d2aef5040

  useEffect(() => {
    if (!containerRef.current) return;

    const layout = new GoldenLayout(containerRef.current);

<<<<<<< HEAD
    // Mount React components into the GoldenLayout containers
    layout.registerComponent("ProjectPanel", (container: any) => {
      const mountEl = document.createElement("div");
      container.getElement().append(mountEl);
      const root = createRoot(mountEl);
      root.render(<ProjectPanel />);
      container.on("destroy", () => {
        // Defer unmount to avoid synchronous unmount during React rendering
        setTimeout(() => root.unmount(), 0);
      });
    });

    layout.registerComponent("PanelB", (container: any) => {
      const mountEl = document.createElement("div");
      container.getElement().append(mountEl);
      const root = createRoot(mountEl);
      root.render(<PanelB />);
      container.on("destroy", () => {
        // Defer unmount to avoid synchronous unmount during React rendering
        setTimeout(() => root.unmount(), 0);
      });
    });

    // Initialize the layout with two panels
=======
    const factory = new GoldenLayoutFactory(layout);
    panelConfigs.forEach((config) => factory.registerFactory(config));
    factoryRef.current = factory;

>>>>>>> 2e2d0f4e0810f1746ac9f8098bfb210d2aef5040
    layout.loadLayout({
      root: {
        type: "row",
        content: [
          {
<<<<<<< HEAD
            type: "component",
            componentType: "ProjectPanel",
            title: "ProjectPanel",
          },
          { type: "component", componentType: "PanelB", title: "Panel B" },
=======
            type: "column",
            width: 20,
            content: [
              {
                type: "component",
                componentType: "ProjectPanel",
                title: "ProjectPanel",
                height: 50,
              },
              {
                type: "component",
                componentType: "AnalyzeResultsPanel",
                title: "AnalyzeResultsPanel",
                height: 50,
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
            type: "component",
            componentType: "SpeechToTextPanel",
            title: "SpeechToTextPanel",
            width: 20,
          },
>>>>>>> 2e2d0f4e0810f1746ac9f8098bfb210d2aef5040
        ],
      },
    });

<<<<<<< HEAD
    return () => layout.destroy();
=======
    return () => {
      factory.destroy();
      layout.destroy();
    };
>>>>>>> 2e2d0f4e0810f1746ac9f8098bfb210d2aef5040
  }, []);

  return (
    <div
      ref={containerRef}
      style={{
        width: "100%",
        height: "100%",
      }}
    />
  );
}
