"use client";

import { useState, useEffect } from 'react';
import { Wifi, WifiOff, RefreshCw } from 'lucide-react';
import { VideoService } from '@/lib/video-service';

export function BackendStatus() {
  const [isConnected, setIsConnected] = useState<boolean | null>(null);
  const [checking, setChecking] = useState(false);

  const checkBackend = async () => {
    setChecking(true);
    try {
      const connected = await VideoService.healthCheck();
      setIsConnected(connected);
    } catch (error) {
      console.warn('Backend check failed:', error);
      setIsConnected(false);
    } finally {
      setChecking(false);
    }
  };

  useEffect(() => {
    checkBackend();
    const interval = setInterval(checkBackend, 30000);
    return () => clearInterval(interval);
  }, []);

  if (isConnected === null) return null;

  return (
    <div className="fixed bottom-4 left-4 z-50">
      <div className={`flex items-center gap-2 px-3 py-2 rounded-lg shadow-lg ${
        isConnected 
          ? 'bg-green-900/80 text-green-300 border border-green-700/50' 
          : 'bg-red-900/80 text-red-300 border border-red-700/50'
      }`}>
        {isConnected ? (
          <Wifi className="size-4" />
        ) : (
          <WifiOff className="size-4" />
        )}
        <span className="text-sm">
          {isConnected ? 'Backend Connected' : 'Backend Disconnected'}
        </span>
        <button
          onClick={checkBackend}
          disabled={checking}
          className="p-1 hover:opacity-80 disabled:opacity-50"
          title="Check connection"
        >
          <RefreshCw className={`size-3 ${checking ? 'animate-spin' : ''}`} />
        </button>
      </div>
    </div>
  );
}