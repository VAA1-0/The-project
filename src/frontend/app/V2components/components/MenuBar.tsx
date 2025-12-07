"use client";
import { useState, useEffect } from "react";

export function MenuBar() {
  const [openMenu, setOpenMenu] = useState<number | null>(null);

  const menuItems = [
    {
      label: "File",
      submenu: ["New File", "Open…", "Save", "Save As…", "Exit"],
    },
    {
      label: "Lenses",
      submenu: ["Lens 1", "Lens 2", "Lens 3"],
    },
    { label: "Analyze" },
    { label: "Annotations" },
    { label: "View" },
    { label: "Window" },
    { label: "Help" },
  ];

  // Click ourside to close menu
  useEffect(() => {
    function handleClickOutside() {
      setOpenMenu(null);
    }
    window.addEventListener("click", handleClickOutside);
    return () => window.removeEventListener("click", handleClickOutside);
  }, []);

  // Click menu item to toggle submenu
  const handleMenuClick = (e: React.MouseEvent, index: number) => {
    e.stopPropagation();
    setOpenMenu(openMenu === index ? null : index);
  };

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
                  className="w-full text-left px-3 py-1 hover:bg-[#3a3a3a] transition-colors"
                >
                  {sub}
                </button>
              ))}
            </div>
          )}
        </div>
      ))}
    </div>
  );
}
