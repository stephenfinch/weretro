import "server-only";
import { headers } from "next/headers";
import { ipAllowed } from "@/lib/ip";
import type { OrgSettings } from "@/lib/types";
import { HttpError } from "./access";

export function ipFromHeaders(h: Headers) {
  const fwd = h.get("x-forwarded-for");
  return (fwd ? fwd.split(",")[0] : h.get("x-real-ip"))?.trim() || null;
}

export async function currentIp() {
  try {
    return ipFromHeaders(await headers());
  } catch {
    return null; // outside a request (scripts, background jobs)
  }
}

/** Throw if the organization limits access by IP and this request comes from elsewhere. */
export async function assertIpAllowed(org: { settings: OrgSettings | null }, ip?: string | null) {
  const ranges = org.settings?.allowedIpRanges;
  if (!ranges?.length) return;
  const addr = ip === undefined ? await currentIp() : ip;
  if (!ipAllowed(addr, ranges)) throw new HttpError(403, "Your network address isn't allowed to access this organization");
}
