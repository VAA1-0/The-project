"use client";

import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { Button } from "./ui/button";
import { GameRunLogo } from "./ProjectLogo";
import { loginToCvat } from "@/cvat-api/client";

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

type LoadingState = "loading" | "success" | "error";

export function LoadingPage() {
  const router = useRouter();
  const [state, setState] = useState<LoadingState>("loading");
  const [errorMessage, setErrorMessage] = useState("");

  const attemptLogin = async () => {
    setState("loading");
    setErrorMessage("");

    try {
      const auth = await loginToCvat("admin", "admin123");
      if (auth.ok) {
        console.log("✅ Logged In");
        setState("success");
        // Navigate to dashboard after a short delay
        setTimeout(() => {
          router.push("/dashboard");
        }, 400);
      } else {
        setState("error");
        setErrorMessage("Login failed. Please try again.");
      }
    } catch (err) {
      console.error("Login error:", err);
      setState("error");
      setErrorMessage(
        err instanceof Error ? err.message : "An unexpected error occurred"
      );
    }
  };

  useEffect(() => {
    attemptLogin();
  }, []);

  return (
    <div className="min-h-screen bg-linear-to-br from-slate-900 via-slate-800 to-slate-900 flex flex-col items-center justify-center p-6">
      {/* Header */}
      <div className="absolute top-6 left-6">
        <GameRunLogo size="lg" />
      </div>

      <div className="flex flex-col items-center justify-center gap-8 max-w-md w-full">
        {state === "loading" && (
          <>
            <Loader className="w-16 h-16 text-blue-400" />
            <div className="text-center space-y-2">
              <h1 className="text-2xl font-bold text-white">Initializing</h1>
              <p className="text-slate-400">Connecting to CVAT...</p>
            </div>
          </>
        )}

        {state === "success" && (
          <>
            <div className="w-16 h-16 bg-green-500/20 rounded-full flex items-center justify-center">
              <svg
                className="w-8 h-8 text-green-400"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M5 13l4 4L19 7"
                />
              </svg>
            </div>
            <div className="text-center space-y-2">
              <h1 className="text-2xl font-bold text-white">Connected!</h1>
              <p className="text-slate-400">Redirecting to dashboard...</p>
            </div>
          </>
        )}

        {state === "error" && (
          <>
            <div className="w-16 h-16 bg-red-500/20 rounded-full flex items-center justify-center">
              <svg
                className="w-8 h-8 text-red-400"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M6 18L18 6M6 6l12 12"
                />
              </svg>
            </div>
            <div className="text-center space-y-4">
              <div className="space-y-2">
                <h1 className="text-2xl font-bold text-white">
                  Connection Failed
                </h1>
                <p className="text-slate-400">{errorMessage}</p>
              </div>
              <Button
                onClick={attemptLogin}
                className="w-full bg-blue-600 hover:bg-blue-700 text-white"
              >
                Retry
              </Button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
