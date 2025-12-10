import { createRoot, Root } from "react-dom/client";
import { panelStateManager, PanelState } from "./panel-state-manager";

export interface ComponentFactory {
  componentName: string;
  Component: React.ComponentType<any>;
  getProps?: (state: PanelState) => Record<string, any>;
}

export class GoldenLayoutFactory {
  private roots = new Map<string, Root>();
  private componentFactories: ComponentFactory[] = [];

  constructor(private layout: any) {}

  registerFactory(factory: ComponentFactory) {
    this.componentFactories.push(factory);

    this.layout.registerComponent(factory.componentName, (container: any) => {
      const mountEl = document.createElement("div");
      mountEl.className = "w-full h-full";
      container.getElement().append(mountEl);

      const root = createRoot(mountEl);
      this.roots.set(factory.componentName, root);

      this.renderComponent(factory, root);

      const unsubscribe = panelStateManager.subscribe((state) => {
        this.renderComponent(factory, root, state);
      });

      container.on("destroy", () => {
        unsubscribe();
        setTimeout(() => {
          root.unmount();
          this.roots.delete(factory.componentName);
        }, 0);
      });
    });
  }

  private renderComponent(
    factory: ComponentFactory,
    root: Root,
    state?: PanelState
  ) {
    const props = factory.getProps
      ? factory.getProps(state || panelStateManager.getState())
      : {};
    root.render(<factory.Component {...props} />);
  }

  destroy() {
    this.roots.forEach((root) => root.unmount());
    this.roots.clear();
  }
}