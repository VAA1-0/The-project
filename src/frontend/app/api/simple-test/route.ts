import { NextRequest, NextResponse } from 'next/server';

export async function GET(request: NextRequest) {
  try {
    console.log('[Simple Test] Endpoint called');
    
    // Just return success without external fetch
    return NextResponse.json({
      success: true,
      message: 'Simple test endpoint works',
      timestamp: new Date().toISOString(),
      env: {
        dockerUrl: process.env.DOCKER_API_URL || 'not set',
        nodeEnv: process.env.NODE_ENV,
      }
    });
    
  } catch (error) {
    console.error('[Simple Test Error]:', error);
    
    return NextResponse.json({
      success: false,
      message: 'Simple test failed',
      error: error instanceof Error ? error.message : 'Unknown error',
      timestamp: new Date().toISOString(),
    }, { status: 500 });
  }
}
