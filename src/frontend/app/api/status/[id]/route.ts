// src/frontend/app/api/status/[id]/route.ts
import { NextRequest, NextResponse } from 'next/server';

export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  const { id } = await params;
  
  // Return mock status for the given ID
  return NextResponse.json({
    analysis_id: id,
    status: 'completed',
    progress: 100,
    filename: `${id}.mp4`,
    processing_time: Math.random() * 60 + 30,
    summary: {
      yolo_detections: Math.floor(Math.random() * 200) + 50,
      ocr_detections: Math.floor(Math.random() * 50) + 10,
      audio_segments: Math.floor(Math.random() * 20) + 5,
      audio_language: 'en'
    },
    download_links: {
      video: `/api/mock/download/${id}/video`,
      yolo_csv: `/api/mock/download/${id}/yolo_csv`,
      ocr_csv: `/api/mock/download/${id}/ocr_csv`,
      summary_json: `/api/mock/download/${id}/summary_json`,
      audio: `/api/mock/download/${id}/audio`,
      transcript: `/api/mock/download/${id}/transcript`
    },
    pipeline_type: 'full',
    cvatID: Math.floor(Math.random() * 5) + 1
  });
}