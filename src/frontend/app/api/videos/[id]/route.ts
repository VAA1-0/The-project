import { NextResponse } from "next/server";
import { getById, updateVideoName, updateVideoTag, deleteVideo } from "@/server/video-store";

export async function GET(_: Request, { params }: any) {
  const { id } = params;
  const item = await getById(id);
  return NextResponse.json(item || {});
}

export async function PATCH(req: Request, { params }: any) {
  const { id } = params;
  const updates = await req.json();
  await updateVideoName(id, updates);
  return NextResponse.json({ success: true });
}

export async function PUT(req: Request, { params }: any) {
  const { id } = params;
  const updates = await req.json();
  await updateVideoTag(id, updates);
  return NextResponse.json({ success: true });
}

export async function DELETE(_: Request, { params }: any) {
  const { id } = params;
  await deleteVideo(id);
  return NextResponse.json({ success: true });
}
