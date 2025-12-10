// src/frontend/app/api/upload/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { v4 as uuidv4 } from 'uuid';
import { cookies } from 'next/headers';

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

    const analysisId = `mock-${uuidv4()}`;

    // ✅ CORRECT usage (no Promise error)
    const cookieStore = await cookies();
    cookieStore.set('analysisId', analysisId);

    return NextResponse.json({
      analysis_id: analysisId,
      filename: file.name,
      status: 'uploaded',
    });

  } catch (error) {
    return NextResponse.json(
      { error: 'Upload failed' },
      { status: 500 }
    );
  }
}
