import { NextResponse } from "next/server";
import { authServerMetadata } from "@/server/oauth-server";

export function GET() {
  return NextResponse.json(authServerMetadata(), { headers: { "access-control-allow-origin": "*" } });
}
