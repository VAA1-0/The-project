import { GoldenLayout, ComponentContainer } from "golden-layout";
import { createRoot } from "react-dom/client";

type PanelName =
  | "ProjectPanel"
  | "VideoPanel"
  | "DownloadPanel"
  | "ToolsPanel"
  | "SpeechToTextPanel"
  | "POSAnalyzePanel";

interface PanelMap {
  [key: string]: ComponentContainer | null;
}

export class PanelManager {
  private static instance: PanelManager;
  private panels: PanelMap = {};

  public constructor(private layout: GoldenLayout) {}

  static getInstance(layout: GoldenLayout): PanelManager {
    if (!PanelManager.instance) {
      PanelManager.instance = new PanelManager(layout);
    }
    return PanelManager.instance;
  }

  // Register a panel
  register(panel: PanelName, container: ComponentContainer) {
    this.panels[panel] = container;
    container.on("destroy", () => {
      this.panels[panel] = null;
    });
  }

  // Open or show a panel
  open(panel: PanelName) {
    const container = this.panels[panel];

    if (container) {
      // Focus and show the panel
      container.focus();
      return;
    }

    // If panel is not found, create it
    try {
      this.layout.addComponent(panel, {});
    } catch (error) {
      console.error(`Failed to create panel: ${panel}`, error);
    }
  }

  close(panel: PanelName) {
    const container = this.panels[panel];
    if (container) container.close();
  }
}
