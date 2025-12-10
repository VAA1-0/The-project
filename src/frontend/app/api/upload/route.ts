// src/frontend/app/api/upload/route.ts
import { NextRequest, NextResponse } from 'next/server';

const DOCKER_API_URL = process.env.DOCKER_API_URL || 'http://localhost:8000';

export async function POST(request: NextRequest) {
  try {
    console.log('[Upload Proxy] Receiving file upload');
    
    // Get FormData from request
    const formData = await request.formData();
    
    // Debug: log form data contents
    const entries: string[] = [];
    for (const [key, value] of formData.entries()) {
      if (value instanceof File) {
        entries.push(`${key}: File (${value.name}, ${value.size} bytes)`);
      } else {
        entries.push(`${key}: ${value}`);
      }
    }
    console.log('[Upload Proxy] FormData:', entries);
    
    // Forward to Docker backend
    const response = await fetch(`${DOCKER_API_URL}/api/upload`, {
      method: 'POST',
      body: formData,
      // Don't set Content-Type header - browser sets it with boundary
    });
    
    const data = await response.json();
    console.log('[Upload Proxy] Docker response:', data);
    
    return NextResponse.json(data, { status: response.status });
    
  } catch (error) {
    console.error('[Upload Proxy Error]:', error);
    
    return NextResponse.json(
      {
        error: 'Upload failed',
        message: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    );
  }
}