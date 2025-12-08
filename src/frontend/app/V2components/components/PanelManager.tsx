"use client";

import { useEffect, useRef } from "react";
import { GoldenLayout } from "golden-layout";
import "golden-layout/dist/css/goldenlayout-base.css";
import "golden-layout/dist/css/themes/goldenlayout-dark-theme.css";

import ProjectPanel from "./panels/ProjectPanel";
import PanelB from "./panels/PanelB";
import { createRoot } from "react-dom/client";

export default function PanelManager() {
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!containerRef.current) return;

    const layout = new GoldenLayout(containerRef.current);

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
    layout.loadLayout({
      root: {
        type: "row",
        content: [
          {
            type: "component",
            componentType: "ProjectPanel",
            title: "ProjectPanel",
          },
          { type: "component", componentType: "PanelB", title: "Panel B" },
        ],
      },
    });

    return () => layout.destroy();
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
