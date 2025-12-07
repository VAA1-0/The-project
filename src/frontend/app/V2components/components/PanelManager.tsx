"use client";

import { useEffect, useRef, useState } from "react";
import { GoldenLayout } from "golden-layout";
import "golden-layout/dist/css/goldenlayout-base.css";
import "golden-layout/dist/css/themes/goldenlayout-dark-theme.css";

import ProjectPanel from "./panels/ProjectPanel";
import AnalyzeResultsPanel from "./panels/AnalyzeResultsPanel";
import VideoPanel from "./panels/VideoPanel";
import PanelB from "./panels/PanelB";
import { createRoot } from "react-dom/client";

export default function PanelManager() {
  const containerRef = useRef<HTMLDivElement>(null);
  const [videoId, setVideoId] = useState<string | null>(null);
  const videoRootRef = useRef<any>(null);

  // Initialize GoldenLayout once
  useEffect(() => {
    if (!containerRef.current) return;

    const layout = new GoldenLayout(containerRef.current);

    // Mount React components into the GoldenLayout containers
    layout.registerComponent("ProjectPanel", (container: any) => {
      const mountEl = document.createElement("div");
      container.getElement().append(mountEl);
      const root = createRoot(mountEl);
      root.render(
        <ProjectPanel
          onVideoSelect={(id: string) => {
            setVideoId(id);
          }}
        />
      );
      container.on("destroy", () => {
        // Defer unmount to avoid synchronous unmount during React rendering
        setTimeout(() => root.unmount(), 0);
      });
    });

    layout.registerComponent("AnalyzeResultsPanel", (container: any) => {
      const mountEl = document.createElement("div");
      container.getElement().append(mountEl);
      const root = createRoot(mountEl);
      root.render(<AnalyzeResultsPanel />);
      container.on("destroy", () => {
        // Defer unmount to avoid synchronous unmount during React rendering
        setTimeout(() => root.unmount(), 0);
      });
    });

    layout.registerComponent("VideoPanel", (container: any) => {
      const mountEl = document.createElement("div");
      container.getElement().append(mountEl);
      const videoRoot = createRoot(mountEl);
      videoRootRef.current = videoRoot;
      videoRootRef.current.render(<VideoPanel videoId={null} />);

      container.on("destroy", () => {
        // Defer unmount to avoid synchronous unmount during React rendering
        setTimeout(() => videoRootRef.current?.unmount(), 0);
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
    layout.loadLayout({
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
                title: "Project Panel",
                height: 50,
              },
              {
                type: "component",
                componentType: "AnalyzeResultsPanel",
                title: "Analyze Results",
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
                title: "Video Panel",
                height: 70,
              },
              { type: "component", componentType: "PanelB", title: "Panel B" },
            ],
          },
        ],
      },
    });

    return () => layout.destroy();
  }, []); // ← Empty dependency array ensures this runs only once

  // Update VideoPanel when videoId changes
  useEffect(() => {
    if (videoRootRef.current) {
      videoRootRef.current.render(<VideoPanel videoId={videoId} />);
    }
  }, [videoId]);

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
