"use client";
import { useState, useEffect } from "react";
import { VideoService } from "@/lib/video-service";
import { saveVideoBlob } from "@/lib/blob-store";
import { createVideoTask } from "@/cvat-api/client";
import { Loader2 } from "lucide-react";

export function MenuBar() {
  const [openMenu, setOpenMenu] = useState<number | null>(null);
  const [uploading, setUploading] = useState(false);

  // Read duration from video file
  async function getVideoDuration(file: File): Promise<number> {
    return new Promise((resolve) => {
      try {
        const url = URL.createObjectURL(file);
        const v = document.createElement("video");
        v.preload = "metadata";
        v.src = url;
        v.onloadedmetadata = () => {
          URL.revokeObjectURL(url);
          const d = v.duration;
          resolve(Number.isFinite(d) ? Math.round(d) : 0);
        };
        v.onerror = () => {
          URL.revokeObjectURL(url);
          resolve(0);
        };
      } catch (e) {
        resolve(0);
      }
    });
  }

  // Upload handler
  const handleUpload = async () => {
    const input = document.createElement("input");
    input.type = "file";
    input.accept = "video/*";
    input.multiple = true;
    input.style.display = "none";

    input.onchange = async (e: any) => {
      const selectedFiles = Array.from(e.target.files) as File[];
      if (!selectedFiles || selectedFiles.length === 0) {
        return;
      }
      
      setUploading(true);
      let successCount = 0;
      let errorCount = 0;
      
      try {
        for (const f of selectedFiles) {
          try {
            let cvatID = 1; // Default CVAT ID
            
            // Try to create CVAT task
            try {
              console.log("Creating CVAT task...");
              let taskName = `Task-${Date.now()}`;
              let result = await createVideoTask(taskName, f);
              cvatID = result.taskId;
              console.log(`✅ CVAT task created: ${cvatID}`);
            } catch (cvatError) {
              console.warn("CVAT task creation failed, using default ID:", cvatError);
              // Continue with default ID
            }

            // Upload to backend
            const length = await getVideoDuration(f);
            console.log(`Uploading ${f.name} to backend...`);
            
            const res = await VideoService.upload(f, cvatID, length);
            console.log("Backend upload response:", res);

            // Save to IndexedDB for preview
            try {
              const videoBlob = new Blob([f], { type: f.type });
              await saveVideoBlob(res.analysis_id, videoBlob);
              console.log(`Saved to IndexedDB: ${res.analysis_id}`);
            } catch (storageErr) {
              console.warn("Failed to save to IndexedDB:", storageErr);
            }
            
            successCount++;
          } catch (err) {
            console.error(`Failed to upload ${f.name}:`, err);
            errorCount++;
          }
        }
        
        // Refresh video list
        window.dispatchEvent(new CustomEvent("video-uploaded"));
        
        // Show result summary
        if (successCount > 0) {
          if (errorCount > 0) {
            alert(`Uploaded ${successCount} video(s), ${errorCount} failed`);
          } else {
            alert(`Successfully uploaded ${successCount} video(s)!`);
          }
        } else {
          alert("All uploads failed. Please try again.");
        }
        
      } catch (err) {
        console.error("Upload process error:", err);
        alert("Upload process failed: " + ((err as any)?.message ?? String(err)));
      } finally {
        setUploading(false);
      }
    };

    document.body.appendChild(input);
    input.click();
    document.body.removeChild(input);
  };

  // Listen for trigger-upload event
  useEffect(() => {
    const handleTriggerUpload = () => {
      handleUpload();
    };
    
    window.addEventListener('trigger-upload', handleTriggerUpload);
    return () => {
      window.removeEventListener('trigger-upload', handleTriggerUpload);
    };
  }, []);

  const menuItems = [
    {
      label: "File",
      submenu: [
        {
          label: uploading ? "Uploading..." : "Upload New File",
          onClick: uploading ? undefined : handleUpload,
          disabled: uploading,
        },
        { label: "Open…", onClick: () => console.log("Open File Dialog") },
        { label: "Save", onClick: () => console.log("Saving...") },
        { label: "Save As…", onClick: () => console.log("Save As...") },
        { type: "separator" as const },
        { label: "Exit", onClick: () => console.log("Exit App") },
      ],
    },
    {
      label: "Lenses",
      submenu: [
        { label: "Lens 1", onClick: () => alert("Lens 1!") },
        { label: "Lens 2", onClick: () => alert("Lens 2!") },
        { label: "Lens 3", onClick: () => alert("Lens 3!") },
      ],
    },
    { 
      label: "Analyze",
      submenu: [
        { label: "Start Analysis", onClick: () => alert("Starting analysis...") },
        { label: "Batch Process", onClick: () => alert("Batch processing...") },
        { label: "Settings", onClick: () => alert("Analysis settings...") },
      ]
    },
    { 
      label: "Annotations",
      submenu: [
        { label: "Add Annotation", onClick: () => alert("Adding annotation...") },
        { label: "Import Annotations", onClick: () => alert("Importing annotations...") },
        { label: "Export Annotations", onClick: () => alert("Exporting annotations...") },
      ]
    },
    { 
      label: "View",
      submenu: [
        { label: "Toggle Sidebar", onClick: () => alert("Toggling sidebar...") },
        { label: "Full Screen", onClick: () => alert("Full screen...") },
        { label: "Zoom In", onClick: () => alert("Zooming in...") },
        { label: "Zoom Out", onClick: () => alert("Zooming out...") },
      ]
    },
    { 
      label: "Window",
      submenu: [
        { label: "Minimize", onClick: () => alert("Minimizing...") },
        { label: "Maximize", onClick: () => alert("Maximizing...") },
        { label: "Close", onClick: () => alert("Closing...") },
      ]
    },
    { 
      label: "Help",
      submenu: [
        { label: "Documentation", onClick: () => window.open("https://docs.example.com", "_blank") },
        { label: "Keyboard Shortcuts", onClick: () => alert("Keyboard shortcuts...") },
        { label: "About", onClick: () => alert("Video Analysis Tool v1.0") },
      ]
    },
  ];

  // Close menu when clicking outside
  useEffect(() => {
    const close = () => setOpenMenu(null);
    window.addEventListener("click", close);
    return () => window.removeEventListener("click", close);
  }, []);

  // Click menu item to toggle submenu
  const handleMenuClick = (e: React.MouseEvent, index: number) => {
    e.stopPropagation();
    setOpenMenu(openMenu === index ? null : index);
  };

  // Submenu click
  const handleSubClick = (e: React.MouseEvent, fn?: () => void) => {
    e.stopPropagation();
    setOpenMenu(null);
    fn?.();
  };

  return (
    <div className="bg-[#191919] h-8 flex items-center px-2 text-[#b8b8b8] text-[12px] border-b border-[#0a0a0a]">
      {menuItems.map((item, index) => (
        <div key={item.label} className="relative">
          {/* Top Menu Bar */}
          <button
            onClick={(e) => handleMenuClick(e, index)}
            className={`px-3 py-1 transition-colors flex items-center gap-1 ${
              openMenu === index ? "bg-[#2f2f2f]" : "hover:bg-[#2f2f2f]"
            } ${item.label === "File" && uploading ? "text-blue-300" : ""}`}
            disabled={item.label === "File" && uploading}
          >
            {item.label}
            {item.label === "File" && uploading && (
              <Loader2 className="size-3 animate-spin" />
            )}
          </button>

          {/* Sub Menu */}
          {item.submenu && openMenu === index && (
            <div
              className="absolute left-0 top-full bg-[#2a2a2a] 
                          border border-[#0a0a0a] shadow-lg z-50 w-48"
              onClick={(e) => e.stopPropagation()}
            >
              {item.submenu.map((sub, subIndex) => {
                if (sub.type === "separator") {
                  return (
                    <div key={subIndex} className="border-t border-[#1a1a1a] my-1" />
                  );
                }
                
                const subLabel = sub.label || "";
                
                return (
                  <button
                    key={subIndex}
                    onClick={(e) => handleSubClick(e, sub.onClick)}
                    disabled={sub.disabled}
                    className={`w-full text-left px-3 py-1.5 hover:bg-[#3a3a3a] transition-colors text-sm flex items-center justify-between ${
                      sub.disabled ? "opacity-50 cursor-not-allowed" : ""
                    }`}
                  >
                    <span>{subLabel}</span>
                    {subLabel.includes("Upload") && uploading && (
                      <Loader2 className="size-3 animate-spin" />
                    )}
                  </button>
                );
              })}
            </div>
          )}
        </div>
      ))}
      
      {/* Upload progress indicator */}
      {uploading && (
        <div className="ml-auto flex items-center gap-2 text-xs">
          <Loader2 className="size-3 animate-spin text-blue-300" />
          <span className="text-blue-300">Uploading...</span>
        </div>
      )}
    </div>
  );
}