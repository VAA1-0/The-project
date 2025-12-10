export {};

declare global {

  /// <reference types="electron" />

// Type declarations for the project

// UUID module
declare module 'uuid' {
  export function v4(): string;
  export function v1(): string;
  export function v3(): string;
  export function v5(): string;
}

// CSV parse module
declare module 'csv-parse' {
  export function parse(input: string, options?: any): any;
}

// Golden Layout
declare module 'golden-layout' {
  export class GoldenLayout {
    constructor(config: any, container?: HTMLElement);
    registerComponent(name: string, component: any): void;
    loadLayout(layout: any): void;
    destroy(): void;
  }
}

// Add any missing types for your dependencies
declare module 'class-variance-authority' {
  export function cva(base: string, config: any): any;
}

declare module 'tailwind-merge' {
  export function twMerge(...classes: string[]): string;
}

// Extend Window interface
interface Window {
  // Custom events
  addEventListener(type: 'video-uploaded', listener: () => void): void;
  addEventListener(type: 'trigger-upload', listener: () => void): void;
  dispatchEvent(event: CustomEvent): boolean;
  
  // Electron specific (if needed)
  electron?: any;
  require?: NodeRequire;
}

// React types for Next.js
declare namespace React {
  interface ReactElement {
    // Add any React-specific extensions
  }
}

// Node.js types
declare namespace NodeJS {
  interface ProcessEnv {
    NEXT_PUBLIC_API_URL?: string;
    NEXT_PUBLIC_USE_MOCK?: string;
    NEXT_PUBLIC_USE_PROXY?: string;
    BACKEND_URL?: string;
    NODE_ENV: 'development' | 'production' | 'test';
  }
}

// Make sure TypeScript knows about CSS modules
declare module '*.module.css' {
  const classes: { [key: string]: string };
  export default classes;
}

declare module '*.module.scss' {
  const classes: { [key: string]: string };
  export default classes;
}
  interface Window {
    electronAPI: {
      startServices: () => Promise<void>;
      stopServices: () => Promise<void>;
    };
  }
}
