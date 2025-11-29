import { NextResponse } from "next/server";
import { getAll, addVideo } from "@/server/video-store";

// GET all videos
export async function GET() {
  const all = await getAll();
  return NextResponse.json(all);
}

// POST new video
export async function POST(req: Request) {
  const body = await req.json();
  await addVideo(body);
  return NextResponse.json({ success: true });
}
