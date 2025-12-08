

import React, { useRef, useState } from 'react';

interface Props {
  jobId: number;
  taskId: number;
}

export const CvatCanvas: React.FC<Props> = ({ jobId, taskId }) => {
  const iframeRef = useRef<HTMLIFrameElement>(null);
  const [loaded, setLoaded] = useState(false);
  const cvatBase = (/*process.env.NEXT_PUBLIC_CVAT_BASE_URL || */"http://localhost:8080").replace(/\/$/, "");
  const src = `${cvatBase}/tasks/${taskId}/jobs/${jobId}/`;

  const handleLoad = () => {
    console.log("🎨 CVAT iframe loaded");
    setLoaded(true);
  };

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