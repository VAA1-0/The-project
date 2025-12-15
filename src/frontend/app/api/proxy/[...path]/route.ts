// src/frontend/app/api/proxy/[...path]/route.ts
import { NextRequest, NextResponse } from 'next/server';

// Docker backend URL - from environment variable
const DOCKER_API_URL = process.env.DOCKER_API_URL || 'http://host.docker.internal:8000';
console.log(`[Proxy] DOCKER_API_URL: ${DOCKER_API_URL}`);

// Handle all HTTP methods
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ path: string[] }> }
) {
  return handleProxyRequest(request, 'GET', params);
}

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ path: string[] }> }
) {
  return handleProxyRequest(request, 'POST', params);
}

export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ path: string[] }> }
) {
  return handleProxyRequest(request, 'PUT', params);
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ path: string[] }> }
) {
  return handleProxyRequest(request, 'DELETE', params);
}

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ path: string[] }> }
) {
  return handleProxyRequest(request, 'PATCH', params);
}

async function handleProxyRequest(
  request: NextRequest,
  method: string,
  paramsPromise: Promise<{ path: string[] }>
) {
  try {
    // Await the params - THIS IS IMPORTANT!
    const params = await paramsPromise;
    const { path } = params;
    
    // Check if path is defined
    if (!path || !Array.isArray(path)) {
      console.error('Invalid path parameter:', path);
      return NextResponse.json(
        {
          error: 'Invalid request path',
          message: 'Path parameter is missing or invalid',
        },
        { status: 400 }
      );
    }
    
    // Construct target URL
    const pathSegment = path.join('/');
    const searchParams = request.nextUrl.searchParams.toString();
    const targetUrl = `${DOCKER_API_URL}/${pathSegment}${searchParams ? `?${searchParams}` : ''}`;
    
    console.log(`[Proxy] ${method} ${pathSegment} -> ${targetUrl}`);
    
    // Prepare headers
    const headers: Record<string, string> = {};
    
    // Copy relevant headers
    const forwardHeaders = [
      'authorization',
      'content-type',
      'accept',
      'user-agent',
    ];
    
    forwardHeaders.forEach(header => {
      const value = request.headers.get(header);
      if (value) {
        headers[header] = value;
      }
    });
    
    // Get request body for non-GET requests
    let body: BodyInit | undefined;
    const contentType = request.headers.get('content-type');
    
    if (method !== 'GET' && method !== 'HEAD') {
      if (contentType?.includes('multipart/form-data')) {
        // For file uploads - should go through /api/upload endpoint
        console.warn('FormData should use /api/upload endpoint');
        body = await request.formData();
        delete headers['content-type'];
      } else if (contentType?.includes('application/json')) {
        // For JSON
        body = await request.text();
      } else {
        // For other types
        body = await request.text();
      }
    }
    
    // Make request to Docker backend
    const response = await fetch(targetUrl, {
      method,
      headers,
      body,
    });
    
    // Get response content type
    const responseContentType = response.headers.get('content-type') || '';
    
    // Handle JSON responses
    if (responseContentType.includes('application/json')) {
      const data = await response.json();
      return NextResponse.json(data, { status: response.status });
    }
    
    // Handle text responses
    if (responseContentType.includes('text/')) {
      const text = await response.text();
      return new NextResponse(text, { status: response.status });
    }
    
    // Handle binary responses (files)
    const buffer = await response.arrayBuffer();
    return new NextResponse(buffer, { 
      status: response.status,
      headers: {
        'content-type': responseContentType,
        'content-disposition': response.headers.get('content-disposition') || 'attachment',
      }
    });
    
  } catch (error) {
    console.error('[Proxy Error]:', error);
    
    return NextResponse.json(
      {
        error: 'Proxy request failed',
        message: error instanceof Error ? error.message : 'Unknown error',
        timestamp: new Date().toISOString(),
      },
      { status: 500 }
    );
  }
}

// Add HEAD method for completeness
export async function HEAD(
  request: NextRequest,
  { params }: { params: Promise<{ path: string[] }> }
) {
  const response = await handleProxyRequest(request, 'HEAD', params);
  return new NextResponse(null, {
    status: response.status,
    headers: response.headers,
  });
}