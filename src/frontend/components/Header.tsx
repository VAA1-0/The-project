"use client";

import { useRouter} from "next/navigation";

import { Button } from "./ui/button";
import { GameRunLogo } from "./ProjectLogo";
import Divider from "./ui/Divider";


// Header component with navigation and sign-out functionality
export default function Header() {
    const router = useRouter();

    function handleBack() {
    router.push("/dashboard");
  }

  function handleSignOut() {
    // Hook your sign-out logic here
    router.push("/");
  }

    return (
        <div className="cursor-pointer flex flex-col bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 text-slate-100">
        {/* Header */}
      <header className="w-full border-b border-slate-700 bg-slate-800/50">
        <div className="max-w-7xl  px-6 py-4 flex items-center justify-between">
          <div className="flex items-center gap-4">
            <div className="flex items-center gap-3" onClick={handleBack}>
              <GameRunLogo size="sm" />
            </div>
          
          {/*NOTE: Dividers could be a reusable component */}
            <div className="flex-1 px-3.5 py-0.5 flex justify-start items-center gap-2.5">
            <Button variant="ghost" className="cursor-pointer hover:bg-slate-700/40 transition" onClick={handleBack}>Dashboard</Button>
            <Divider />
            <Button variant="ghost" className="cursor-pointer hover:bg-slate-700/40 transition">Upload Video</Button>
            <Divider />
            <Button variant="ghost" className="cursor-pointer hover:bg-slate-700/40 transition">What's New!</Button>
            <Divider />
            <Button variant="ghost" className="cursor-pointer hover:bg-slate-700/40 transition">Contact Us</Button>
            <Divider />
            <Button variant="ghost" className="cursor-pointer hover:bg-slate-700/40 transition">About Us</Button>
            </div>
          </div>

          <div className="flex gap-3 justify-end">
            <Button
              variant="ghost"
              className="cursor-pointer hidden sm:flex items-center gap-2 bg-neutral-800/30 px-3 py-2 rounded-lg border border-slate-700 hover:bg-slate-700/40 transition"
              >
                <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none">
                  <path d="M12 2L3 14h7l-1 8 10-12h-7l1-8z" fill="currentColor" />
                </svg>
                <span className="text-sm text-slate-200">Light Mode</span>
            </Button>

            <Button
              variant="ghost"
              onClick={handleSignOut}
              className="cursor-pointer hidden sm:flex items-center gap-2 bg-neutral-800/30 px-3 py-2 rounded-lg border border-slate-700 hover:bg-slate-700/40 transition"
            >
              Sign Out
            </Button>

          </div>
        </div>
      </header>
        </div>

    );
}