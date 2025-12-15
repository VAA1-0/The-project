// src/frontend/app/api/test-proxy/route.ts
import { NextRequest, NextResponse } from 'next/server';

const DOCKER_API_URL = process.env.DOCKER_API_URL || 'http://host.docker.internal:8000';

export async function GET(request: NextRequest) {
  try {
    console.log(`[Test Proxy] Testing connection to: ${DOCKER_API_URL}`);
    
    // Test 1: Try to connect to Docker backend
    let backendResponse;
    try {
      backendResponse = await fetch(`${DOCKER_API_URL}/api/health`, {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
        },
      });
    } catch (fetchError) {
      return NextResponse.json({
        success: false,
        message: 'Fetch failed',
        error: fetchError instanceof Error ? fetchError.message : 'Unknown fetch error',
        dockerUrl: DOCKER_API_URL,
        timestamp: new Date().toISOString(),
      }, { status: 500 });
    }
    
    if (backendResponse.ok) {
      const data = await backendResponse.json();
      return NextResponse.json({
        success: true,
        message: 'Proxy connection successful',
        backend: data,
        dockerUrl: DOCKER_API_URL,
        status: backendResponse.status,
        timestamp: new Date().toISOString(),
      });
    } else {
      const errorText = await backendResponse.text();
      return NextResponse.json({
        success: false,
        message: 'Backend returned error',
        status: backendResponse.status,
        errorText: errorText,
        dockerUrl: DOCKER_API_URL,
        timestamp: new Date().toISOString(),
      }, { status: 500 });
    }
    
  } catch (error) {
    console.error('[Test Proxy Error]:', error);
    
    return NextResponse.json({
      success: false,
      message: 'Unexpected error',
      error: error instanceof Error ? error.message : 'Unknown error',
      dockerUrl: DOCKER_API_URL,
      timestamp: new Date().toISOString(),
    }, { status: 500 });
  }
}
