// src/frontend/app/api/upload/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { v4 as uuidv4 } from 'uuid';

export async function POST(request: NextRequest) {
  try {
    const formData = await request.formData();
    const file = formData.get('file') as File;
    const cvatID = formData.get('cvatID');
    
    if (!file) {
      return NextResponse.json(
        { error: 'No file provided' },
        { status: 400 }
      );
    }

    // Generate a unique ID for this analysis
    const analysisId = `mock-${uuidv4()}`;
    
    console.log('Mock upload received:', {
      filename: file.name,
      size: file.size,
      type: file.type,
      cvatID,
      analysisId
    });
    
    // Return mock response
    return NextResponse.json({
      analysis_id: analysisId,
      filename: file.name,
      message: 'Video uploaded successfully (mock)',
      status: 'uploaded',
      cvatID: cvatID ? parseInt(cvatID.toString()) : 1,
    });
  } catch (error) {
    console.error('Upload error:', error);
    return NextResponse.json(
      { error: 'Upload failed', message: String(error) },
      { status: 500 }
    );
  }
}