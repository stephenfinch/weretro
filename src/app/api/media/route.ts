import { NextResponse, type NextRequest } from "next/server";
import { db, schema } from "@/db";
import { getCurrentUser } from "@/server/auth";
import { unauthorized } from "@/server/http";

const MAX = 5 * 1024 * 1024;
const TYPES = ["image/png", "image/jpeg", "image/gif", "image/webp", "image/svg+xml"];

export async function POST(req: NextRequest) {
  const user = await getCurrentUser();
  if (!user) return unauthorized();
  const form = await req.formData();
  const file = form.get("file");
  if (!(file instanceof File)) return NextResponse.json({ error: "No file" }, { status: 400 });
  if (file.size > MAX) return NextResponse.json({ error: "Images must be under 5 MB" }, { status: 400 });
  if (!TYPES.includes(file.type)) return NextResponse.json({ error: "Unsupported file type" }, { status: 400 });
  const bytes = Buffer.from(await file.arrayBuffer());
  const [row] = await db
    .insert(schema.media)
    .values({ uploadedById: user.id, contentType: file.type, bytes, size: file.size, kind: String(form.get("kind") ?? "image") })
    .returning({ id: schema.media.id });
  return NextResponse.json({ id: row.id, url: `/api/media/${row.id}` });
}
