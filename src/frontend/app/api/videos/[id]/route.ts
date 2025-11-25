import { NextResponse } from "next/server";
import { Library } from "@/lib/local-library";

export async function GET(_: Request, { params }: any) {
  const { id } = params;
  const item = Library.getAll().videos.find(v => v.id === id);
  return NextResponse.json(item || {});
}

export async function PATCH(req: Request, { params }: any) {
  const { id } = params;
  const updates = await req.json();
  Library.updateVideoName(id, updates);
  return NextResponse.json({ success: true });
}

export async function PUT(req: Request, { params }: any) {
  const { id } = params;
  const updates = await req.json();
  Library.updateVideoTag(id, updates);
  return NextResponse.json({ success: true });
}

export async function DELETE(_: Request, { params }: any) {
  const { id } = params;
  Library.deleteVideo(id);
  return NextResponse.json({ success: true });
}
