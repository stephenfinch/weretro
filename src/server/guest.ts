import "server-only";
import { createHmac, timingSafeEqual } from "node:crypto";

const secret = () => process.env.SESSION_SECRET || "weretro-dev-secret";

export function guestSignature(meetingId: string) {
  return createHmac("sha256", secret()).update(`guest:${meetingId}`).digest("base64url").slice(0, 22);
}

export function verifyGuestSignature(meetingId: string, sig: string) {
  const expected = Buffer.from(guestSignature(meetingId));
  const got = Buffer.from(sig);
  return expected.length === got.length && timingSafeEqual(expected, got);
}
