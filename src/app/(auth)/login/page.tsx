import Link from "next/link";
import { redirect } from "next/navigation";
import { LoginForm } from "@/components/auth/forms";
import { OAuthButtons } from "@/components/auth/oauth-buttons";
import { getCurrentUser } from "@/server/auth";

export const metadata = { title: "Sign in" };

export default async function LoginPage({ searchParams }: PageProps<"/login">) {
  const sp = await searchParams;
  const next = typeof sp.next === "string" ? sp.next : undefined;
  const user = await getCurrentUser();
  if (user && !user.isGuest) redirect(next ?? "/home");
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Welcome back</h1>
        <p className="text-sm text-muted-foreground">Sign in to your WeRetro account</p>
      </div>
      {typeof sp.error === "string" && <p className="rounded-lg bg-destructive/10 px-3 py-2 text-sm text-destructive">{sp.error}</p>}
      <OAuthButtons next={next} />
      <LoginForm next={next} />
      <p className="text-center text-sm text-muted-foreground">
        New here? <Link href={`/signup${next ? `?next=${encodeURIComponent(next)}` : ""}`} className="font-medium text-primary hover:underline">Create an account</Link>
      </p>
      <p className="text-center text-sm text-muted-foreground">
        Company account? <Link href={`/sso${next ? `?next=${encodeURIComponent(next)}` : ""}`} className="font-medium text-primary hover:underline">Sign in with SSO</Link>
      </p>
      <p className="text-center text-sm text-muted-foreground">
        Have an invitation code? <Link href="/join" className="font-medium text-primary hover:underline">Join a team</Link>
      </p>
    </div>
  );
}
