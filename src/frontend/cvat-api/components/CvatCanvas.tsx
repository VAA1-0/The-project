

import React, { useRef, useState } from 'react';

interface Props {
  jobId: number;
  taskId: number;
}

export const CvatCanvas: React.FC<Props> = ({ jobId, taskId }) => {
  const iframeRef = useRef<HTMLIFrameElement>(null);
  const [loaded, setLoaded] = useState(false);
  const cvatBase = (process.env.NEXT_PUBLIC_CVAT_BASE_URL || "http://localhost:8080").replace(/\/$/, "");
  const src = `${cvatBase}/tasks/${taskId}/jobs/${jobId}/`;

  // Determine once whether the iframe is same-origin (so DOM access is allowed)
  useEffect(() => {
    /*try {
      const frameUrl = new URL(src, window.location.href);
      setIsSameOrigin(frameUrl.origin === window.location.origin);
    } catch (err) {
      console.warn('Could not evaluate iframe origin:', err);
      setIsSameOrigin(false);
    }*/
  }, [src]);

  const handleLoad = () => {
    console.log("🎨 CVAT iframe loaded");

    /*
    // If cross-origin, skip DOM/localStorage access to avoid security errors
    if (isSameOrigin && iframeRef.current?.contentWindow) {
      // 🔥 Inject token BEFORE CVAT sends authentication requests
      const token = window.localStorage.getItem("cvat_token");
      if (token) {
        try {
          iframeRef.current.contentWindow.localStorage.setItem("token", token);
          console.log("🔑 Token injected into iframe");
        } catch (err) {
          console.error("⚠ Unable to inject token inside iframe", err);
        }
      }
    }*/

    setLoaded(true);
  };

  useEffect(() => {
    if (!loaded || !iframeRef.current) return;

    const iframe = iframeRef.current;
    console.log("Loaded!");

    // Wait a bit for iframe content to fully render
    const timer = setTimeout(() => {
      try {
        const iframeDoc = iframe.contentDocument || iframe.contentWindow?.document;

        if (!iframeDoc) {
          console.warn("Cannot access iframe document (CORS restriction)");
          return;
        }

        // Inject CSS to style CVAT with blue theme and hide top nav
        const css = `
          /* Global dark navy background + light text */
          html, body, .cvat-layout, .ant-layout, .cvat-canvas, .cvat-canvas-container, #cvat_canvas_wrapper {
            background-color: #d4e2f6ff !important;
            font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif !important;
            color: #FFFFFF !important;
          }

          /* Keep video layers transparent */
          #cvat_canvas_background,
          #cvat_canvas_content,
          #cvat_canvas_bitmap,
          #cvat_canvas_attachment_board,
          #cvat_canvas_grid,
          #cvat_canvas_text_content,
          #cvat_canvas_content svg,
          #cvat_canvas_content img {
            background: transparent !important;
            background-color: transparent !important;
          }

          /* Blue-themed toolbars and side menus */
          .cvat-annotation-header,
          .cvat-annotation-menu,
          .cvat-annotation-header-left,
          .cvat-annotation-header-right,
          .cvat-player-controls,
          .cvat-player-frame-selector,
          .cvat-player-buttons,
          .ant-layout-sider,
          .ant-menu,
          .ant-menu-item {
            background: linear-gradient(
              90deg,
              #6a84aeff 100%
            ) !important;
            background-color: #c8d6f0ff !important;
            border-color: #ccdbedff !important;
          }

          /* Stronger tint for annotation header */
          .cvat-annotation-header {
            background: linear-gradient(
              90deg,
              #1B263B 0%,
              #2C3E58 100%
            ) !important;
            background-color: #bbc5d8ff !important;
            color: #FFFFFF !important;
          }

          /* Primary buttons — lighter blue */
          .ant-btn-primary,
          .ant-btn-primary:hover,
          .ant-btn-primary:active {
            background-color: #415A77 !important;
            border-color: #778DA9 !important;
            color: #FFFFFF !important;
          }

          /* Secondary buttons / ghost buttons */
          .ant-btn,
          .ant-btn:hover,
          .ant-btn:active {
            background-color: #26354D !important;
            border-color: #5e7ea2ff !important;
            color: #FFFFFF !important;
          }

          /* Hide top navigation bar */
          .cvat-header,
          header.ant-layout-header:not(.cvat-annotation-header) {
            display: none !important;
          }

          /* Remove default padding */
          .cvat-layout,
          .ant-layout {
            padding-top: 0 !important;
            background-color: transparent !important;
          }

          /* Ensure annotation controls remain visible */
          .cvat-annotation-header,
          .cvat-player-controls,
          .cvat-player-buttons,
          .cvat-annotation-menu {
            display: flex !important;
            visibility: visible !important;
          }
        `;

        const style = iframeDoc.createElement('style');
        style.setAttribute('data-injected-by', 'cvat-canvas');
        style.textContent = css;

        iframeDoc.head.appendChild(style);
        console.log('✅ CVAT topbar hidden and canvas + toolbar styling injected successfully');

      } catch (error) {
        console.error("Failed to inject CSS into iframe:", error);
      }
    }, 1000); // Wait 1 second for CVAT UI to render

    return () => clearTimeout(timer);
  }, [loaded]);

  return (
    <div
      style={{
        width: "100%",
        height: "100%",
        backgroundColor: "#d4e2f6",
        overflow: "hidden",
        position: "relative"
      }}
    >
      <iframe
        ref={iframeRef}
        src={src}
        onLoad={handleLoad}
        sandbox="allow-same-origin allow-scripts allow-forms allow-modals allow-popups allow-downloads"
        style={{
          width: "100%",
          height: "100%",
          border: "none",
          display: "block"
        }}
        title="CVAT Annotation Canvas"
      />
      {!loaded && (
        <div
          style={{
            position: "absolute",
            top: "50%",
            left: "50%",
            transform: "translate(-50%, -50%)",
            color: "#415A77",
            fontSize: "16px",
            fontFamily: "-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif"
          }}
        >
          Loading CVAT...
        </div>
      )}
    </div>
  );
};