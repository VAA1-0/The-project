import { NextResponse } from "next/server";
import { Library } from "@/lib/local-library";

export async function GET() {
  return NextResponse.json(Library.getAll().folders);
}

export async function POST(req: Request) {
  const body = await req.json();
  Library.addFolder(body);
  return NextResponse.json({ success: true });
}
