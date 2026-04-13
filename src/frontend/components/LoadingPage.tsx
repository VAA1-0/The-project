"use client";

import { useRouter } from "next/navigation";
import { useEffect } from "react";
import { Button } from "./ui/button";
import { GameRunLogo } from "./ProjectLogo";

const Loader: React.FC<React.SVGProps<SVGSVGElement>> = (props) => (
  <svg viewBox="0 0 50 50" {...props}>
    <circle
      cx="25"
      cy="25"
      r="20"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      opacity="0.2"
    />
    <circle
      cx="25"
      cy="25"
      r="20"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeDasharray="31.4 62.8"
      strokeLinecap="round"
      style={{
        animation: "spin 1s linear infinite",
        transformOrigin: "center",
      }}
    />
    <style>{`
      @keyframes spin {
        from { transform: rotate(0deg); }
        to { transform: rotate(360deg); }
      }
    `}</style>
  </svg>
);

export function LoadingPage() {
  const router = useRouter();
  const continueToWorkspace = () => router.push("/dashboard");

  useEffect(() => {
    const redirectTimer = window.setTimeout(() => {
      router.push("/dashboard");
    }, 400);

    return () => window.clearTimeout(redirectTimer);
  }, [router]);

  return (
    <div className="min-h-screen bg-linear-to-br from-slate-900 via-slate-800 to-slate-900 flex flex-col items-center justify-center p-6">
      {/* Header */}
      <div className="absolute top-6 left-6">
        <GameRunLogo size="lg" />
      </div>

      <div className="flex flex-col items-center justify-center gap-8 max-w-md w-full">
        <Loader className="w-16 h-16 text-blue-400" />
        <div className="text-center space-y-2">
          <h1 className="text-2xl font-bold text-white">Initializing VAA1</h1>
          <p className="text-slate-400">Preparing your analysis workspace...</p>
        </div>

        <Button
          onClick={continueToWorkspace}
          className="w-full bg-blue-600 hover:bg-blue-700 text-white"
        >
          Open VAA1 workspace
        </Button>
      </div>
    </div>
  );
}
