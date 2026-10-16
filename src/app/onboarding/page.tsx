import Link from "next/link";
import { Logo } from "@/components/brand";
import { OnboardingForm } from "@/components/shell/onboarding-form";
import { requireUser } from "@/server/auth";

export const metadata = { title: "Get started" };

export default async function OnboardingPage() {
  const user = await requireUser("/onboarding");
  const domain = user.email?.split("@")[1]?.split(".")[0];
  const guess = domain && !["gmail", "outlook", "hotmail", "yahoo", "icloud", "proton"].includes(domain) ? domain[0].toUpperCase() + domain.slice(1) : "";
  return (
    <div className="flex min-h-screen items-center justify-center bg-canvas p-6">
      <div className="w-full max-w-md space-y-6 rounded-2xl border bg-card p-8 shadow-sm">
        <Logo />
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Set up your organization and team</h1>
          <p className="text-sm text-muted-foreground">Hi {user.name.split(" ")[0]}! Organizations hold your teams, users and settings.</p>
        </div>
        <OnboardingForm defaultOrg={guess} />
        <p className="text-center text-sm text-muted-foreground">
          Joining an existing team? <Link href="/join" className="font-medium text-primary hover:underline">Enter an invitation code</Link>
        </p>
      </div>
    </div>
  );
}
