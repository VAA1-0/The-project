"use client";

import React, {
  Children,
  isValidElement,
  type ReactElement,
  type ReactNode,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { createPortal } from "react-dom";

type DynamicPanelSectionProps = {
  sectionId: string;
  title: string;
  summary?: ReactNode;
  children: ReactNode;
  defaultOpen?: boolean;
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
  orderPriority?: number;
  orderReason?: string;
};

type DynamicPanelSectionElement = ReactElement<DynamicPanelSectionProps>;

const DRAG_TYPE = "application/x-datascene-panel-section";

function copyDocumentStyles(target: Window) {
  document.querySelectorAll<HTMLLinkElement | HTMLStyleElement>('link[rel="stylesheet"], style').forEach((node) => {
    target.document.head.appendChild(node.cloneNode(true));
  });
}

export function DynamicPanelSection({
  sectionId,
  title,
  summary,
  children,
  defaultOpen = false,
  open: controlledOpen,
  onOpenChange,
  orderPriority,
  orderReason,
}: DynamicPanelSectionProps) {
  const [open, setOpen] = useState(defaultOpen);
  const visibleOpen = controlledOpen ?? open;
  const toggleOpen = () => {
    const next = !visibleOpen;
    if (controlledOpen === undefined) setOpen(next);
    onOpenChange?.(next);
  };
  const [focused, setFocused] = useState(false);
  const [portalTarget, setPortalTarget] = useState<HTMLElement | null>(null);
  const [fillPortalTarget, setFillPortalTarget] = useState<HTMLElement | null>(null);
  const sectionElement = useRef<HTMLElement | null>(null);
  const fillOverlay = useRef<HTMLElement | null>(null);
  const detachedWindow = useRef<Window | null>(null);

  const returnFromFill = () => {
    setFocused(false);
    setFillPortalTarget(null);
    fillOverlay.current?.remove();
    fillOverlay.current = null;
  };

  const fillPanel = () => {
    if (focused) {
      returnFromFill();
      return;
    }
    const host = sectionElement.current?.closest<HTMLElement>("[data-vaa1-panel-leaf]");
    if (!host) return;
    if (window.getComputedStyle(host).position === "static") host.style.position = "relative";
    const overlay = document.createElement("div");
    overlay.dataset.vaa1FilledSectionHost = sectionId;
    overlay.className = "absolute inset-0 z-[110] min-h-0 overflow-hidden bg-[#151515] p-2";
    host.appendChild(overlay);
    fillOverlay.current = overlay;
    setFillPortalTarget(overlay);
    setFocused(true);
    if (controlledOpen === undefined) setOpen(true);
    onOpenChange?.(true);
  };

  useEffect(() => () => {
    detachedWindow.current?.close();
    fillOverlay.current?.remove();
  }, []);
  useEffect(() => {
    if (!portalTarget) return;
    const watcher = window.setInterval(() => {
      if (!detachedWindow.current || detachedWindow.current.closed) {
        detachedWindow.current = null;
        setPortalTarget(null);
        setFocused(false);
      }
    }, 200);
    return () => window.clearInterval(watcher);
  }, [portalTarget]);

  const detach = () => {
    if (detachedWindow.current && !detachedWindow.current.closed) {
      detachedWindow.current.focus();
      return;
    }
    const popup = window.open("", `datascene-section-${sectionId}`, "popup=yes,width=1180,height=820,resizable=yes,scrollbars=yes");
    if (!popup) return;
    returnFromFill();
    popup.document.title = `${title} — Datascene`;
    copyDocumentStyles(popup);
    popup.document.body.className = "m-0 min-h-screen bg-[#151515] text-slate-200";
    const root = popup.document.createElement("div");
    root.dataset.vaa1DetachedSectionHost = sectionId;
    popup.document.body.appendChild(root);
    detachedWindow.current = popup;
    setPortalTarget(root);
    if (controlledOpen === undefined) setOpen(true);
    onOpenChange?.(true);
    const returnToHost = () => {
      detachedWindow.current = null;
      setPortalTarget(null);
      setFocused(false);
    };
    popup.addEventListener("beforeunload", returnToHost, { once: true });
  };

  const card = (
    <section
      ref={sectionElement}
      className={focused && !portalTarget
        ? "flex h-full min-h-0 w-full flex-col overflow-hidden rounded border border-cyan-700 bg-[#101010] shadow-2xl"
        : "rounded border border-slate-800 bg-[#101010]"}
      data-vaa1-dynamic-panel-section={sectionId}
      data-vaa1-section-order-priority={orderPriority ?? "alphabetical"}
      data-vaa1-section-order-reason={orderReason || "alphabetical default"}
      data-vaa1-section-detached={portalTarget ? "true" : "false"}
    >
      <header className="flex items-center gap-1 px-3 py-2">
        <button
          type="button"
          onClick={toggleOpen}
          className="flex min-w-0 flex-1 items-center gap-2 text-left"
          aria-expanded={visibleOpen}
        >
          <span className="min-w-0">
            <span className="font-semibold text-slate-200">{title}</span>
            {summary ? <span className="ml-2 text-[9px] text-slate-500">{summary}</span> : null}
          </span>
          <span aria-hidden="true" className="ml-auto w-4 shrink-0 text-center text-[10px] text-cyan-300">
            {visibleOpen ? "▾" : "▸"}
          </span>
        </button>
        <nav className="flex shrink-0 items-center gap-1" aria-label={`${title} section controls`}>
          <span className="group relative">
            <span
              draggable={!portalTarget}
              onDragStart={(event) => {
                event.dataTransfer.effectAllowed = "move";
                event.dataTransfer.setData(DRAG_TYPE, sectionId);
              }}
              className="flex h-6 w-6 cursor-grab select-none items-center justify-center rounded border border-slate-800 text-[12px] text-slate-400 hover:border-slate-600 hover:text-slate-200 active:cursor-grabbing"
              title="Drag to reorder"
              role="button"
              aria-label="Drag to reorder"
              tabIndex={0}
              data-vaa1-panel-section-drag-handle={sectionId}
            >
              ↕
            </span>
            <span role="tooltip" className="pointer-events-none absolute right-0 top-full z-[120] mt-1 hidden whitespace-nowrap rounded border border-slate-700 bg-[#090909] px-2 py-1 text-[9px] text-slate-200 shadow-lg group-hover:block group-focus-within:block">
              Drag to reorder
            </span>
          </span>
          <span className="group relative">
            <button
              type="button"
              onClick={fillPanel}
              className="flex h-6 w-6 items-center justify-center rounded border border-slate-800 text-[12px] text-slate-300 hover:border-slate-600 hover:text-white"
              title={focused ? "Return to panel" : "Fill panel"}
              aria-label={focused ? "Return" : "Fill"}
            >
              <span aria-hidden="true">{focused ? "↙" : "⛶"}</span>
            </button>
            <span role="tooltip" className="pointer-events-none absolute right-0 top-full z-[120] mt-1 hidden whitespace-nowrap rounded border border-slate-700 bg-[#090909] px-2 py-1 text-[9px] text-slate-200 shadow-lg group-hover:block group-focus-within:block">
              {focused ? "Return to panel" : "Fill panel"}
            </span>
          </span>
          <span className="group relative">
            <button
              type="button"
              onClick={detach}
              className="flex h-6 w-6 items-center justify-center rounded border border-slate-800 text-[13px] text-slate-300 hover:border-cyan-800 hover:text-cyan-100"
              title="Detach to another screen"
              aria-label="Detach"
            >
              <span aria-hidden="true">↗</span>
            </button>
            <span role="tooltip" className="pointer-events-none absolute right-0 top-full z-[120] mt-1 hidden whitespace-nowrap rounded border border-slate-700 bg-[#090909] px-2 py-1 text-[9px] text-slate-200 shadow-lg group-hover:block group-focus-within:block">
              Detach to another screen
            </span>
          </span>
        </nav>
      </header>
      {visibleOpen ? <div className={focused
        ? "min-h-0 flex-1 overflow-auto border-t border-slate-800 [&>details>summary]:hidden"
        : "border-t border-slate-800 [&>details>summary]:hidden"}>{children}</div> : null}
    </section>
  );

  if (fillPortalTarget && !portalTarget) return createPortal(card, fillPortalTarget);

  return portalTarget ? (
    <>
      <div className="rounded border border-dashed border-cyan-900/70 bg-cyan-950/10 px-3 py-2 text-[10px] text-cyan-200" data-vaa1-detached-section-placeholder={sectionId}>
        {title} is open in a separate window. Closing that window returns it here.
      </div>
      {createPortal(card, portalTarget)}
    </>
  ) : card;
}

function sectionChildren(children: ReactNode): DynamicPanelSectionElement[] {
  return Children.toArray(children).filter(
    (child): child is DynamicPanelSectionElement =>
      isValidElement<DynamicPanelSectionProps>(child) && child.type === DynamicPanelSection,
  );
}

export function DynamicPanelSectionGroup({
  panelId,
  children,
  className = "space-y-2",
}: {
  panelId: string;
  children: ReactNode;
  className?: string;
}) {
  const sections = useMemo(() => sectionChildren(children), [children]);
  const storageKey = `vaa1.panel-section-order.${panelId}`;
  const canonicalIds = useMemo(
    () => [...sections]
      .sort((left, right) => {
        const leftPriority = left.props.orderPriority;
        const rightPriority = right.props.orderPriority;
        if (leftPriority !== undefined || rightPriority !== undefined) {
          return (leftPriority ?? Number.MAX_SAFE_INTEGER) - (rightPriority ?? Number.MAX_SAFE_INTEGER)
            || left.props.title.localeCompare(right.props.title, undefined, { sensitivity: "base" });
        }
        return left.props.title.localeCompare(right.props.title, undefined, { sensitivity: "base" });
      })
      .map((section) => section.props.sectionId),
    [sections],
  );
  const canonicalSignature = canonicalIds.join("\u001f");
  const [order, setOrder] = useState<string[]>(canonicalIds);

  useEffect(() => {
    for (const section of sections) {
      if (section.props.orderPriority !== undefined && !section.props.orderReason?.trim()) {
        console.error(
          `Datascene section ${section.props.sectionId} overrides alphabetical order without an orderReason.`,
        );
      }
    }
  }, [sections]);

  useEffect(() => {
    const saved = window.localStorage.getItem(storageKey);
    if (!saved) {
      setOrder((current) => current.join("\u001f") === canonicalSignature ? current : canonicalIds);
      return;
    }
    try {
      const parsed = JSON.parse(saved) as string[];
      // A changed section set is a new canonical layout. Reset it alphabetically
      // instead of preserving a partial legacy order and appending new sections.
      const hasSameSectionSet = parsed.length === canonicalIds.length
        && parsed.every((id) => canonicalIds.includes(id));
      const next = hasSameSectionSet ? parsed : canonicalIds;
      if (!hasSameSectionSet) window.localStorage.removeItem(storageKey);
      setOrder((current) => current.join("\u001f") === next.join("\u001f") ? current : next);
    } catch {
      setOrder((current) => current.join("\u001f") === canonicalSignature ? current : canonicalIds);
    }
  }, [storageKey, canonicalSignature]);

  const ordered = [...sections].sort(
    (left, right) => order.indexOf(left.props.sectionId) - order.indexOf(right.props.sectionId),
  );

  return (
    <div
      className={`relative ${className}`}
      data-vaa1-dynamic-panel-section-group={panelId}
      onDragOver={(event) => {
        if (event.dataTransfer.types.includes(DRAG_TYPE)) event.preventDefault();
      }}
      onDrop={(event) => {
        const sourceId = event.dataTransfer.getData(DRAG_TYPE);
        const target = (event.target as HTMLElement).closest<HTMLElement>("[data-vaa1-dynamic-panel-section]");
        const targetId = target?.dataset.vaa1DynamicPanelSection;
        if (!sourceId || !targetId || sourceId === targetId) return;
        event.preventDefault();
        setOrder((current) => {
          const next = current.filter((id) => id !== sourceId);
          next.splice(Math.max(0, next.indexOf(targetId)), 0, sourceId);
          window.localStorage.setItem(storageKey, JSON.stringify(next));
          return next;
        });
      }}
    >
      {ordered}
    </div>
  );
}
