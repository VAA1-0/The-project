import { NextResponse } from "next/server";
import { Library } from "@/lib/local-library";

// GET all videos
export async function GET() {
  return NextResponse.json(Library.getAll().videos);
}

// POST new video
export async function POST(req: Request) {
  const body = await req.json();
  Library.addVideo(body);
  return NextResponse.json({ success: true });
}
