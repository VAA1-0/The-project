"use client";
import { useState, useEffect } from "react";
<<<<<<< HEAD

export function MenuBar() {
  const [openMenu, setOpenMenu] = useState<number | null>(null);
=======
import { VideoService } from "@/lib/video-service";
import { saveVideoBlob, deleteVideoBlob } from "@/lib/blob-store";

export function MenuBar() {
  const [openMenu, setOpenMenu] = useState<number | null>(null);
  const [file, setFile] = useState<File | null>(null);
  const [files, setFiles] = useState<File[] | null>(null);
  const [uploading, setUploading] = useState(false);
  const [libraryVideos, setLibraryVideos] = useState<any[]>([]);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);

  // Read duration (in seconds) from a video File using a temporary HTMLVideoElement
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

  // Upload handler (frontend-only): persist blob to IndexedDB and metadata to local Library
  const handleUpload = async () => {
    console.log("Uploading video...");

    document.getElementById("videoUpload")?.click();

    const selected = files || (file ? ([file] as any) : null);
    if (!selected || selected.length === 0)
      return alert("Select a video first");
    setUploading(true);
    let cvatID = null;
    try {
      //=========Upload to CVAT==================

      /*
        for (const video of selected) {
          let taskName = `Task-${Date.now()}`;
          console.log("🎬 Creating video task...");
          let result = await createVideoTask(taskName, video);
          cvatID = result.taskId;
          alert(cvatID);
          alert(`✅ Task created successfully!\nTask ID: ${result.taskId}`);
        }
        */

      //<=============================================>
      try {
        const arr = Array.from(selected as any) as File[];
        for (const f of arr) {
          // compute actual duration (in seconds) from the file
          const length = await getVideoDuration(f);
          // use VideoService to upload (saves blob + metadata)
          const res = await VideoService.upload(f, 1, length);
          console.log(res);

          // Store the original video blob in IndexedDB for instant preview on analyze page
          try {
            const videoBlob = new Blob([f], { type: f.type });
            await saveVideoBlob(res.analysis_id, videoBlob);
            console.log(
              `Saved original video blob to IndexedDB for ${res.analysis_id}`
            );
          } catch (storageErr) {
            console.warn(
              "Failed to save video to IndexedDB (preview may be unavailable):",
              storageErr
            );
          }
        }

        // refresh local view
        const list = await VideoService.list();
        setLibraryVideos(list);
        setFiles(null);
        setFile(null);
        setPreviewUrl(null);
        alert("Upload successful (saved in browser storage)");
      } catch (err) {
        console.error(err);
        alert("Upload failed: " + ((err as any)?.message ?? String(err)));
      }
    } catch (err) {
      console.log("Video uploading to CVAT failed. Try again!");
      alert("Upload failed: " + ((err as any)?.message ?? String(err)));
    } finally {
      setUploading(false);
    }
  };
>>>>>>> 2e2d0f4e0810f1746ac9f8098bfb210d2aef5040

  const menuItems = [
    {
      label: "File",
<<<<<<< HEAD
      submenu: ["New File", "Open…", "Save", "Save As…", "Exit"],
    },
    {
      label: "Lenses",
      submenu: ["Lens 1", "Lens 2", "Lens 3"],
=======
      submenu: [
        {
          label: "New File",
          onClick: () => {
            handleUpload();
            console.log("Open File Dialog");
          },
        },
        { label: "Open…", onClick: () => console.log("Open File Dialog") },
        { label: "Save", onClick: () => console.log("Saving...") },
        { label: "Save As…", onClick: () => console.log("Save As...") },
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
>>>>>>> 2e2d0f4e0810f1746ac9f8098bfb210d2aef5040
    },
    { label: "Analyze" },
    { label: "Annotations" },
    { label: "View" },
    { label: "Window" },
    { label: "Help" },
  ];

  // Click ourside to close menu
  useEffect(() => {
<<<<<<< HEAD
    function handleClickOutside() {
      setOpenMenu(null);
    }
    window.addEventListener("click", handleClickOutside);
    return () => window.removeEventListener("click", handleClickOutside);
=======
    const close = () => setOpenMenu(null);
    window.addEventListener("click", close);
    return () => window.removeEventListener("click", close);
>>>>>>> 2e2d0f4e0810f1746ac9f8098bfb210d2aef5040
  }, []);

  // Click menu item to toggle submenu
  const handleMenuClick = (e: React.MouseEvent, index: number) => {
    e.stopPropagation();
    setOpenMenu(openMenu === index ? null : index);
  };

<<<<<<< HEAD
=======
  // 子菜单点击
  const handleSubClick = (e: React.MouseEvent, fn?: () => void) => {
    e.stopPropagation();
    setOpenMenu(null);
    fn?.();
  };

>>>>>>> 2e2d0f4e0810f1746ac9f8098bfb210d2aef5040
  return (
    <div className="bg-[#191919] h-8 flex items-center px-2 text-[#b8b8b8] text-[12px] border-b border-[#0a0a0a]">
      {menuItems.map((item, index) => (
        <div key={item.label} className="relative">
          {/* Top Menu Bar */}
          <button
            onClick={(e) => handleMenuClick(e, index)}
            className={`px-3 py-1 transition-colors ${
              openMenu === index ? "bg-[#2f2f2f]" : "hover:bg-[#2f2f2f]"
            }`}
          >
            {item.label}
          </button>

          {/* Sub Menu */}
          {item.submenu && openMenu === index && (
            <div
              className="absolute left-0 top-full bg-[#2a2a2a] 
                          border border-[#0a0a0a] shadow-lg z-50 w-40"
              onClick={(e) => e.stopPropagation()} // Prevent closing when clicking the submenu
            >
              {item.submenu.map((sub, subIndex) => (
                <button
                  key={subIndex}
<<<<<<< HEAD
                  className="w-full text-left px-3 py-1 hover:bg-[#3a3a3a] transition-colors"
                >
                  {sub}
=======
                  onClick={(e) => handleSubClick(e, sub.onClick)}
                  className="w-full text-left px-3 py-1 hover:bg-[#3a3a3a] transition-colors"
                >
                  {sub.label}
>>>>>>> 2e2d0f4e0810f1746ac9f8098bfb210d2aef5040
                </button>
              ))}
            </div>
          )}
        </div>
      ))}
    </div>
  );
}
