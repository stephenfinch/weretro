import "server-only";
import { NextResponse } from "next/server";
import { HttpError } from "./access";

export function jsonError(e: unknown) {
  if (e instanceof HttpError) return NextResponse.json({ error: e.message }, { status: e.status });
  if (e && typeof e === "object" && "digest" in e && String((e as { digest: unknown }).digest).startsWith("NEXT_")) throw e;
  console.error(e);
  return NextResponse.json({ error: "Something went wrong" }, { status: 500 });
}

export function unauthorized() {
  return NextResponse.json({ error: "Not signed in" }, { status: 401 });
}
