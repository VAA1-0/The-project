/*import React, { useState } from 'react';

interface Props {
  jobId: number;
  taskId: number;
}

export const CvatCanvas: React.FC<Props> = ({ jobId, taskId }) => {
  const [loaded, setLoaded] = useState(false);
  const src = `http://localhost:8080/tasks/${taskId}/jobs/${jobId}/`;

  

  return (
    <iframe
      src={src}
      onLoad={() => setLoaded(true)}
      style={{ width: "100%", height: "100%", border: "none" }}
    />
  );
};*/


import React, { useRef, useEffect, useState } from 'react';

interface Props {
  jobId: number;
  taskId: number;
}

export const CvatCanvas: React.FC<Props> = ({ jobId, taskId }) => {
  const iframeRef = useRef<HTMLIFrameElement>(null);
  const [loaded, setLoaded] = useState(false);
  const src = `http://localhost:8080/tasks/${taskId}/jobs/${jobId}/`;

  const handleLoad = () => {
    console.log("🎨 CVAT iframe loaded");

    // 🔥 Inject token BEFORE CVAT sends authentication requests
    const token = window.localStorage.getItem("cvat_token");
    if (token && iframeRef.current?.contentWindow) {
      try {
        iframeRef.current.contentWindow.localStorage.setItem("token", token);
        console.log(token);
        console.log("🔑 Token injected into iframe");
      } catch (err) {
        console.error("⚠ Unable to inject token inside iframe", err);
      }
    }

    setLoaded(true);
  };

  useEffect(() => {
    if (!loaded || !iframeRef.current) return;

    const iframe = iframeRef.current;

    // Wait a bit for iframe content to fully render
    const timer = setTimeout(() => {
      try {
        const iframeDoc = iframe.contentDocument || iframe.contentWindow?.document;

        if (!iframeDoc) {
          console.warn("Cannot access iframe document (CORS restriction)");
          return;
        }

        // Inject CSS to hide only the navigation bar
        const style = iframeDoc.createElement('style');
        style.textContent = `
          /* Hide ONLY the top navigation bar (main site header) */
          .cvat-header,
          header.ant-layout-header:not(.cvat-annotation-header) {
            display: none !important;
          }
          
          /* Adjust main layout padding */
          .cvat-layout,
          .ant-layout {
            padding-top: 0 !important;
          }
          
          /* Keep annotation controls visible */
          .cvat-annotation-header {
            display: flex !important;
          }
          
          /* Keep frame slider visible */
          .cvat-player-controls,
          .cvat-player-frame-selector,
          .cvat-player-buttons {
            display: flex !important;
            visibility: visible !important;
          }
          
          /* Keep annotation menu/toolbar visible */
          .cvat-annotation-header-left,
          .cvat-annotation-header-right,
          .cvat-annotation-menu {
            display: flex !important;
            visibility: visible !important;
          }
          
          /* Keep save button and controls visible */
          .cvat-annotation-header-button,
          .cvat-save-job-button {
            display: inline-flex !important;
            visibility: visible !important;
          }
        `;

        iframeDoc.head.appendChild(style);
        console.log("✅ CVAT topbar hidden successfully");

      } catch (error) {
        console.error("Failed to inject CSS into iframe:", error);
      }
    }, 1000); // Wait 1 second for CVAT UI to render

    return () => clearTimeout(timer);
  }, [loaded]);

  return (
    <iframe
      ref={iframeRef}
      src={src}
      onLoad={handleLoad}
      sandbox="allow-same-origin allow-scripts allow-forms allow-modals allow-popups allow-downloads"
      style={{
        width: "100%",
        height: "100%",
        border: "none",
        display: "block",
        overflow: "hidden",
        maxWidth: "100%"
      }}
      title="CVAT Annotation Canvas"
    />
  );
};
