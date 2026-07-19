import { createRoot, Root } from "react-dom/client";
import { ComponentContainer } from "golden-layout";
import React from "react";

export class ReactComponentWrapper {
  private root: Root;
  private el: HTMLElement;
  private destroyed = false;

  constructor(
    container: ComponentContainer,
    Component: React.FC<any>,
    props?: any,
    WrapperComponent?: React.FC<{ children: React.ReactNode }>,
  ) {
    this.el = document.createElement("div");
    this.el.className = "vaa1-panel-leaf";
    this.el.dataset.vaa1PanelLeaf = "true";
    this.el.style.height = "100%";
    this.el.style.width = "100%";

    container.element.appendChild(this.el);

    this.root = createRoot(this.el);

    let mounted = false;
    const mount = () => {
      if (mounted || this.destroyed) return;
      mounted = true;
      const element = WrapperComponent ? (
        <WrapperComponent>
          <Component {...props} />
        </WrapperComponent>
      ) : (
        <Component {...props} />
      );
      this.root.render(element);
    };
    // GoldenLayout creates every tab in a restored stack. Defer React panel
    // initialization until the tab is first shown, then keep it mounted so its
    // analytical working state is preserved while switching tabs.
    container.on("show", mount);
    if (container.visible && !container.isHidden) mount();
    else window.setTimeout(() => {
      if (container.visible && !container.isHidden) mount();
    }, 0);

    // Clean up when the container is destroyed
    container.on("destroy", () => {
      if (this.destroyed) {
        return;
      }
      this.destroyed = true;
      container.off("show", mount);
      window.setTimeout(() => {
        this.root.unmount();
      }, 0);
    });
  }
}
