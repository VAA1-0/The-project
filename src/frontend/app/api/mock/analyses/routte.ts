// src/frontend/app/api/mock/analyses/routte.ts
import { NextResponse } from 'next/server';

export async function GET() {
  // Return mock data for development
  const mockAnalyses = {
    analyses: {
      'test-1': {
        filename: 'sample-video-1.mp4',
        status: 'completed',
        progress: 100,
        start_time: Date.now() / 1000 - 3600, // 1 hour ago
        pipeline_type: 'full'
      },
      'test-2': {
        filename: 'sample-video-2.mp4',
        status: 'processing',
        progress: 75,
        start_time: Date.now() / 1000 - 1800, // 30 minutes ago
        pipeline_type: 'visual_only'
      }
    }
  };
  
  return NextResponse.json(mockAnalyses);
}