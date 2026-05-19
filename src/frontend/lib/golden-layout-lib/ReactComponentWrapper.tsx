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
    this.el.style.height = "100%";
    this.el.style.width = "100%";

    container.element.appendChild(this.el);

    this.root = createRoot(this.el);

    const element = WrapperComponent ? (
      <WrapperComponent>
        <Component {...props} />
      </WrapperComponent>
    ) : (
      <Component {...props} />
    );

    this.root.render(element);

    // Clean up when the container is destroyed
    container.on("destroy", () => {
      if (this.destroyed) {
        return;
      }
      this.destroyed = true;
      window.setTimeout(() => {
        this.root.unmount();
      }, 0);
    });
  }
}
