"use client";

import type React from "react";
import { useEffect } from "react";

const SEMANTIC_ORDER_COMPONENTS = new Set([
  "AudioPanel",
  "POSAnalyzePanel",
  "POSMatrixPanel",
  "QuantitativeAnalysisPanel",
  "QuantMatrixPanel",
  "SourceMediaMetadataPanel",
  "VideoPanel",
]);

const CONTROL_SELECTOR = ":scope > summary > [data-vaa1-global-disclosure-controls]";

function copyDocumentStyles(target: Window) {
  document.querySelectorAll<HTMLLinkElement | HTMLStyleElement>('link[rel="stylesheet"], style').forEach((node) => {
    target.document.head.appendChild(node.cloneNode(true));
  });
}

function titleOf(details: HTMLDetailsElement) {
  const summary = details.querySelector<HTMLElement>(":scope > summary");
  return (summary?.innerText || summary?.textContent || "Section").replace(/\s+/g, " ").trim();
}

function slug(value: string) {
  return value.toLocaleLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)/g, "").slice(0, 80) || "section";
}

function eligibleDetails(scope: HTMLElement) {
  return [...scope.querySelectorAll<HTMLDetailsElement>("details")].filter((details) => {
    if (details.closest("[data-vaa1-dynamic-panel-section]")) return false;
    const parentDetails = details.parentElement?.closest("details");
    return !parentDetails || !scope.contains(parentDetails);
  });
}

function iconButton(label: string, symbol: string) {
  const wrapper = document.createElement("span");
  wrapper.className = "group relative inline-flex";
  const button = document.createElement("button");
  button.type = "button";
  button.className = "flex h-6 w-6 items-center justify-center rounded border border-slate-800 text-[12px] text-slate-300 hover:border-slate-600 hover:text-white";
  button.setAttribute("aria-label", label);
  button.title = label;
  button.textContent = symbol;
  const tooltip = document.createElement("span");
  tooltip.className = "pointer-events-none absolute right-0 top-full z-[140] mt-1 hidden whitespace-nowrap rounded border border-slate-700 bg-[#090909] px-2 py-1 text-[9px] normal-case tracking-normal text-slate-200 shadow-lg group-hover:block group-focus-within:block";
  tooltip.setAttribute("role", "tooltip");
  tooltip.textContent = label;
  wrapper.append(button, tooltip);
  return { wrapper, button, tooltip };
}

export function useUniversalPanelDisclosures(
  scopeRef: React.RefObject<HTMLElement | null>,
  componentName: string,
) {
  useEffect(() => {
    const scope = scopeRef.current;
    if (!scope) return;
    const cleanupTasks: Array<() => void> = [];
    const storageKey = `vaa1.panel-section-order.global.${componentName}`;

    const enhance = () => {
      const sections = eligibleDetails(scope);
      const idCounts = new Map<string, number>();
      for (const details of sections) {
        if (details.querySelector(CONTROL_SELECTOR)) continue;
        const summary = details.querySelector<HTMLElement>(":scope > summary");
        if (!summary) continue;
        const title = titleOf(details);
        const baseId = details.dataset.vaa1GlobalDisclosureId || slug(title);
        const occurrence = idCounts.get(baseId) || 0;
        idCounts.set(baseId, occurrence + 1);
        const sectionId = occurrence ? `${baseId}-${occurrence + 1}` : baseId;
        details.dataset.vaa1GlobalDisclosureId = sectionId;
        details.open = false;

        summary.classList.add("flex", "items-center", "gap-1");
        const controls = document.createElement("span");
        controls.dataset.vaa1GlobalDisclosureControls = "true";
        controls.className = "flex shrink-0 items-center gap-1 pl-2";
        controls.style.marginLeft = "auto";

        const drag = iconButton("Drag to reorder", "↕");
        drag.button.draggable = true;
        drag.button.dataset.vaa1GlobalDragHandle = sectionId;
        drag.button.addEventListener("click", (event) => event.preventDefault());
        drag.button.addEventListener("dragstart", (event) => {
          event.stopPropagation();
          event.dataTransfer?.setData("application/x-datascene-global-section", sectionId);
          if (event.dataTransfer) event.dataTransfer.effectAllowed = "move";
        });

        const fill = iconButton("Fill panel", "⛶");
        let fillStyle = "";
        fill.button.addEventListener("click", (event) => {
          event.preventDefault();
          event.stopPropagation();
          const leaf = details.closest<HTMLElement>("[data-vaa1-panel-leaf]");
          if (!leaf) return;
          if (details.dataset.vaa1GlobalFilled === "true") {
            details.style.cssText = fillStyle;
            delete details.dataset.vaa1GlobalFilled;
            fill.button.textContent = "⛶";
            fill.button.setAttribute("aria-label", "Fill panel");
            fill.tooltip.textContent = "Fill panel";
            return;
          }
          details.open = true;
          const rect = leaf.getBoundingClientRect();
          fillStyle = details.style.cssText;
          details.dataset.vaa1GlobalFilled = "true";
          Object.assign(details.style, {
            position: "fixed",
            left: `${rect.left}px`,
            top: `${rect.top}px`,
            width: `${rect.width}px`,
            height: `${rect.height}px`,
            maxHeight: "none",
            overflow: "auto",
            zIndex: "110",
            margin: "0",
            background: "#151515",
          });
          fill.button.textContent = "↙";
          fill.button.setAttribute("aria-label", "Return");
          fill.tooltip.textContent = "Return to panel";
        });

        const detach = iconButton("Detach to another screen", "↗");
        detach.button.addEventListener("click", (event) => {
          event.preventDefault();
          event.stopPropagation();
          const leaf = details.closest<HTMLElement>("[data-vaa1-panel-leaf]");
          if (!leaf) return;
          const popup = window.open("", `datascene-global-section-${componentName}-${sectionId}`, "popup=yes,width=1180,height=820,resizable=yes,scrollbars=yes");
          if (!popup) return;
          const parent = leaf.parentNode;
          const nextSibling = leaf.nextSibling;
          if (!parent) return;
          popup.document.title = `${title} — Datascene`;
          copyDocumentStyles(popup);
          popup.document.body.className = "m-0 min-h-screen bg-[#151515] text-slate-200";
          const hidden: Array<{ element: HTMLElement; display: string }> = [];
          let branch: HTMLElement = details;
          while (branch !== leaf) {
            const branchParent = branch.parentElement;
            if (!branchParent) break;
            for (const sibling of [...branchParent.children]) {
              if (sibling !== branch && sibling instanceof HTMLElement) {
                hidden.push({ element: sibling, display: sibling.style.display });
                sibling.style.display = "none";
              }
            }
            branch = branchParent;
          }
          const placeholder = document.createElement("div");
          placeholder.className = "h-full rounded border border-dashed border-cyan-900/70 p-3 text-[10px] text-cyan-200";
          placeholder.textContent = `${title} is open in a separate window. Closing that window returns it here.`;
          parent.insertBefore(placeholder, nextSibling);
          popup.document.body.appendChild(leaf);
          leaf.style.height = "100vh";
          details.open = true;
          const restore = () => {
            if (!placeholder.isConnected) return;
            leaf.style.height = "100%";
            if (nextSibling && nextSibling.parentNode === parent) parent.insertBefore(leaf, nextSibling);
            else parent.appendChild(leaf);
            for (const item of hidden) item.element.style.display = item.display;
            placeholder.remove();
          };
          popup.addEventListener("beforeunload", restore, { once: true });
          const watcher = window.setInterval(() => {
            if (popup.closed) {
              window.clearInterval(watcher);
              restore();
            }
          }, 200);
          cleanupTasks.push(() => {
            window.clearInterval(watcher);
            if (!popup.closed) popup.close();
            restore();
          });
        });

        controls.append(drag.wrapper, fill.wrapper, detach.wrapper);
        summary.appendChild(controls);
      }

      const byParent = new Map<HTMLElement, HTMLDetailsElement[]>();
      for (const details of eligibleDetails(scope)) {
        const parent = details.parentElement;
        if (!parent) continue;
        const siblings = byParent.get(parent) || [];
        siblings.push(details);
        byParent.set(parent, siblings);
      }
      for (const [parent, siblings] of byParent) {
        if (siblings.length < 2) continue;
        let computed = window.getComputedStyle(parent);
        if (computed.display !== "flex" && computed.display !== "grid") {
          parent.style.setProperty("display", "flex", "important");
          parent.style.setProperty("flex-direction", "column", "important");
          computed = window.getComputedStyle(parent);
        }
        if (computed.display !== "flex" && computed.display !== "grid") continue;
        let order = siblings.map((details) => details.dataset.vaa1GlobalDisclosureId || "");
        if (!SEMANTIC_ORDER_COMPONENTS.has(componentName)) {
          order = [...siblings]
            .sort((left, right) => titleOf(left).localeCompare(titleOf(right), undefined, { sensitivity: "base" }))
            .map((details) => details.dataset.vaa1GlobalDisclosureId || "");
        }
        try {
          const saved = JSON.parse(window.localStorage.getItem(storageKey) || "null") as string[] | null;
          if (saved && saved.length === order.length && saved.every((id) => order.includes(id))) order = saved;
        } catch {
          window.localStorage.removeItem(storageKey);
        }
        const applyOrder = () => siblings.forEach((details) => {
          details.style.setProperty("order", String(order.indexOf(details.dataset.vaa1GlobalDisclosureId || "")), "important");
        });
        applyOrder();
        parent.addEventListener("dragover", (event) => {
          if (event.dataTransfer?.types.includes("application/x-datascene-global-section")) event.preventDefault();
        });
        parent.addEventListener("drop", (event) => {
          const sourceId = event.dataTransfer?.getData("application/x-datascene-global-section");
          const target = (event.target as HTMLElement).closest<HTMLDetailsElement>("details[data-vaa1-global-disclosure-id]");
          const targetId = target?.dataset.vaa1GlobalDisclosureId;
          if (!sourceId || !targetId || sourceId === targetId || !order.includes(sourceId) || !order.includes(targetId)) return;
          event.preventDefault();
          order = order.filter((id) => id !== sourceId);
          order.splice(order.indexOf(targetId), 0, sourceId);
          window.localStorage.setItem(storageKey, JSON.stringify(order));
          applyOrder();
        });
      }
    };

    enhance();
    const observer = new MutationObserver(() => enhance());
    observer.observe(scope, { childList: true, subtree: true });
    return () => {
      observer.disconnect();
      cleanupTasks.forEach((cleanup) => cleanup());
    };
  }, [componentName, scopeRef]);
}
