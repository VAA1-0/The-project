"use client";

import { useEffect, useRef, useState } from "react";
import { GoldenLayout } from "golden-layout";
import "golden-layout/dist/css/goldenlayout-base.css";
import "golden-layout/dist/css/themes/goldenlayout-dark-theme.css";
import { createRoot } from "react-dom/client";

// Import your panel components here
import ProjectPanel from "./panels/ProjectPanel";
import VideoPanel from "./panels/VideoPanel";
import ToolsPanel from "./panels/ToolsPanel";
import SpeechToTextPanel from "./panels/SpeechToTextPanel";
import DownloadPanel from "./panels/DownloadPanel";

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
    componentName: "VideoPanel",
    Component: VideoPanel,
    getProps: (state) => ({ videoId: state.videoId }),
  },
  {
    componentName: "DownloadPanel",
    Component: DownloadPanel,
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
            componentType: "DownloadPanel",
            title: "DownloadPanel",
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

  useEffect(() => {
    if (!containerRef.current) return;

    const layout = new GoldenLayout(containerRef.current);

    const factory = new GoldenLayoutFactory(layout);
    panelConfigs.forEach((config) => factory.registerFactory(config));
    factoryRef.current = factory;

    layout.loadLayout({
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
                title: "Project Library",
                height: 50,
              },
              {
                type: "component",
                componentType: "DownloadPanel",
                title: "Download Results",
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
                title: "Video Player",
                height: 70,
              },
              {
                type: "component",
                componentType: "ToolsPanel",
                title: "Analysis Tools",
              },
            ],
          },
          {
            type: "component",
            componentType: "SpeechToTextPanel",
            title: "Analysis Results",
            width: 20,
          },
        ],
      },
    });

    return () => {
      factory.destroy();
      layout.destroy();
    };
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
