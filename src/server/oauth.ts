import "server-only";
import { GitHub, Google, MicrosoftEntraId, decodeIdToken } from "arctic";
import { appUrl } from "./auth";

export type Provider = "google" | "github" | "microsoft";

export function getProvider(name: string) {
  const redirect = appUrl(`/api/auth/${name}/callback`);
  if (name === "google" && process.env.GOOGLE_CLIENT_ID) return { kind: "google" as const, client: new Google(process.env.GOOGLE_CLIENT_ID, process.env.GOOGLE_CLIENT_SECRET!, redirect) };
  if (name === "github" && process.env.GITHUB_CLIENT_ID) return { kind: "github" as const, client: new GitHub(process.env.GITHUB_CLIENT_ID, process.env.GITHUB_CLIENT_SECRET!, redirect) };
  if (name === "microsoft" && process.env.MICROSOFT_CLIENT_ID)
    return { kind: "microsoft" as const, client: new MicrosoftEntraId(process.env.MICROSOFT_TENANT_ID || "common", process.env.MICROSOFT_CLIENT_ID, process.env.MICROSOFT_CLIENT_SECRET ?? null, redirect) };
  return null;
}

export async function fetchProfile(p: NonNullable<ReturnType<typeof getProvider>>, accessToken: string, idToken?: string): Promise<{ id: string; email: string | null; name: string }> {
  if (p.kind === "github") {
    const headers = { authorization: `Bearer ${accessToken}`, "user-agent": "WeRetro" };
    const u = await (await fetch("https://api.github.com/user", { headers })).json();
    let email: string | null = u.email ?? null;
    if (!email) {
      const emails = (await (await fetch("https://api.github.com/user/emails", { headers })).json()) as { email: string; primary: boolean; verified: boolean }[];
      email = emails.find((e) => e.primary && e.verified)?.email ?? null;
    }
    return { id: String(u.id), email, name: u.name || u.login };
  }
  const claims = decodeIdToken(idToken!) as { sub: string; email?: string; name?: string; preferred_username?: string };
  return { id: claims.sub, email: claims.email ?? claims.preferred_username ?? null, name: claims.name ?? claims.email ?? "User" };
}
