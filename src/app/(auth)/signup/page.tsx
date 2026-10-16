import Link from "next/link";
import { SignupForm } from "@/components/auth/forms";
import { OAuthButtons } from "@/components/auth/oauth-buttons";

export const metadata = { title: "Create account" };

export default async function SignupPage({ searchParams }: PageProps<"/signup">) {
  const sp = await searchParams;
  const next = typeof sp.next === "string" ? sp.next : undefined;
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Create your account</h1>
        <p className="text-sm text-muted-foreground">Free forever. Set up your team in under a minute.</p>
      </div>
      <OAuthButtons next={next} />
      <SignupForm next={next} email={typeof sp.email === "string" ? sp.email : undefined} />
      <p className="text-center text-sm text-muted-foreground">
        Already have an account? <Link href={`/login${next ? `?next=${encodeURIComponent(next)}` : ""}`} className="font-medium text-primary hover:underline">Sign in</Link>
      </p>
    </div>
  );
}
