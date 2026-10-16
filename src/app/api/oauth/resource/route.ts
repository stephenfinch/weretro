import { NextResponse } from "next/server";
import { resourceMetadata } from "@/server/oauth-server";

export function GET() {
  return NextResponse.json(resourceMetadata(), { headers: { "access-control-allow-origin": "*" } });
}
