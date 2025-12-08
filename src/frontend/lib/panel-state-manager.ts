import { EventEmitter } from "events";

export type PanelType =
  | "ProjectPanel"
  | "AnalyzeResultsPanel"
  | "VideoPanel"
  | "ToolsPanel"
  | "SpeechToTextPanel";

export interface PanelState {
  videoId: string | null;
}

class PanelStateManager extends EventEmitter {
  private state: PanelState = { videoId: null };

  setVideoId(videoId: string | null) {
    this.state.videoId = videoId;
    this.emit("stateChange", this.state);
  }

  getState(): PanelState {
    return { ...this.state };
  }

  subscribe(callback: (state: PanelState) => void) {
    this.on("stateChange", callback);
    return () => {
      this.off("stateChange", callback);
    };
  }
}

export const panelStateManager = new PanelStateManager();
