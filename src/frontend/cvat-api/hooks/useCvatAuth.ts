// src/renderer/hooks/useCvatAuth.ts
import { useState } from 'react';
import { loginToCvat, loginForIframe } from "@/cvat-api/client";


export function useCvatAuth() {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [loggedIn, setLoggedIn] = useState(false);

  async function login(username: string, password: string) {
    setLoading(true);
    setError(null);
    try {
      // 1️⃣ Login for iframe (cookie-based)
      const iframeLogin = await loginForIframe(username, password);
      if (!iframeLogin.ok || !iframeLogin.cookie) {
        throw new Error(iframeLogin.error || "Iframe login failed");
      }
      // In Electron, set via main; in browser, fall back to document.cookie
      if (typeof window !== "undefined" && (window as any).electronAPI?.setCvatCookie) {
        await (window as any).electronAPI.setCvatCookie(iframeLogin.cookie);
      } else if (typeof document !== "undefined") {
        document.cookie = iframeLogin.cookie;
      }

      // 2️⃣ Login for backend task API (token-based)
      const res = await loginToCvat(username, password);
      if (!res.ok) {
        throw new Error(res.error || "Token login failed");
      }

      console.log("CVAT authenticated (cookie + token)");
      setLoggedIn(true);
    } catch (e: any) {
      setError(e.message);
      setLoggedIn(false);
    } finally {
      setLoading(false);
    }
  }


  return { loading, error, loggedIn, login };
}
