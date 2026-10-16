import { Logo } from "@/components/brand";
import { JoinCodeForm } from "@/components/shell/onboarding-form";
import { requireUser } from "@/server/auth";

export const metadata = { title: "Join a team" };

export default async function JoinPage() {
  await requireUser("/join");
  return (
    <div className="flex min-h-screen items-center justify-center bg-canvas p-6">
      <div className="w-full max-w-sm space-y-6 rounded-2xl border bg-card p-8 shadow-sm">
        <Logo />
        <div>
          <h1 className="text-xl font-semibold">Join a meeting or team</h1>
          <p className="text-sm text-muted-foreground">Enter your 9-character invitation code</p>
        </div>
        <JoinCodeForm />
      </div>
    </div>
  );
}
