import { createRoot, Root } from "react-dom/client";
import { ComponentContainer } from "golden-layout";
import React from "react";

export class ReactComponentWrapper {
  private root: Root;
  private el: HTMLElement;

  constructor(
    container: ComponentContainer,
    Component: React.FC<any>,
    props?: any
  ) {
    this.el = document.createElement("div");
    this.el.style.height = "100%";
    this.el.style.width = "100%";

    container.element.appendChild(this.el);

    this.root = createRoot(this.el);
    this.root.render(<Component {...props} />);

    // Clean up when the container is destroyed
    container.on("destroy", () => {
      this.root.unmount();
    });
  }
}
