export {};

declare global {
  interface Window {
    electronAPI: {
      startServices: () => Promise<void>;
      stopServices: () => Promise<void>;
    };
  }
}
