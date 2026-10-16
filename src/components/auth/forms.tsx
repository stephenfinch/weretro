"use client";

import Link from "next/link";
import { useActionState, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { forgotAction, loginAction, magicLinkAction, resetAction, signupAction, type FormState } from "@/app/(auth)/actions";

function Message({ state }: { state: FormState }) {
  if (!state) return null;
  if (state.error) return <p className="rounded-lg bg-destructive/10 px-3 py-2 text-sm text-destructive">{state.error}</p>;
  if (state.ok) return <p className="rounded-lg bg-emerald-500/10 px-3 py-2 text-sm text-emerald-700 dark:text-emerald-400">{state.ok}</p>;
  return null;
}

export function LoginForm({ next }: { next?: string }) {
  const [mode, setMode] = useState<"password" | "magic">("password");
  const [state, action, pending] = useActionState(loginAction, undefined);
  const [mState, mAction, mPending] = useActionState(magicLinkAction, undefined);
  if (mode === "magic") {
    return (
      <form action={mAction} className="space-y-4">
        <input type="hidden" name="next" value={next ?? ""} />
        <div className="space-y-1.5">
          <Label htmlFor="email">Email</Label>
          <Input id="email" name="email" type="email" required autoFocus placeholder="you@company.com" className="h-10" />
        </div>
        <Message state={mState} />
        <Button className="w-full h-10" disabled={mPending}>{mPending ? "Sending…" : "Email me a sign-in link"}</Button>
        <button type="button" onClick={() => setMode("password")} className="w-full text-center text-sm text-muted-foreground hover:text-foreground">
          Use a password instead
        </button>
      </form>
    );
  }
  return (
    <form action={action} className="space-y-4">
      <input type="hidden" name="next" value={next ?? ""} />
      <div className="space-y-1.5">
        <Label htmlFor="email">Email</Label>
        <Input id="email" name="email" type="email" required autoFocus placeholder="you@company.com" className="h-10" />
      </div>
      <div className="space-y-1.5">
        <div className="flex items-center justify-between">
          <Label htmlFor="password">Password</Label>
          <Link href="/forgot" className="text-xs text-muted-foreground hover:text-foreground">Forgot password?</Link>
        </div>
        <Input id="password" name="password" type="password" required className="h-10" />
      </div>
      <Message state={state} />
      <Button className="w-full h-10" disabled={pending}>{pending ? "Signing in…" : "Sign in"}</Button>
      <button type="button" onClick={() => setMode("magic")} className="w-full text-center text-sm text-muted-foreground hover:text-foreground">
        Email me a sign-in link instead
      </button>
    </form>
  );
}

export function SignupForm({ next, email }: { next?: string; email?: string }) {
  const [state, action, pending] = useActionState(signupAction, undefined);
  return (
    <form action={action} className="space-y-4">
      <input type="hidden" name="next" value={next ?? ""} />
      <div className="space-y-1.5">
        <Label htmlFor="name">Your name</Label>
        <Input id="name" name="name" required autoFocus placeholder="Alex Doe" className="h-10" />
      </div>
      <div className="space-y-1.5">
        <Label htmlFor="email">Work email</Label>
        <Input id="email" name="email" type="email" required defaultValue={email} placeholder="you@company.com" className="h-10" />
      </div>
      <div className="space-y-1.5">
        <Label htmlFor="password">Password</Label>
        <Input id="password" name="password" type="password" required minLength={8} placeholder="At least 8 characters" className="h-10" />
      </div>
      <Message state={state} />
      <Button className="w-full h-10" disabled={pending}>{pending ? "Creating account…" : "Create account"}</Button>
    </form>
  );
}

export function ForgotForm() {
  const [state, action, pending] = useActionState(forgotAction, undefined);
  return (
    <form action={action} className="space-y-4">
      <div className="space-y-1.5">
        <Label htmlFor="email">Email</Label>
        <Input id="email" name="email" type="email" required autoFocus className="h-10" />
      </div>
      <Message state={state} />
      <Button className="w-full h-10" disabled={pending}>Send reset link</Button>
    </form>
  );
}

export function ResetForm({ token }: { token: string }) {
  const [state, action, pending] = useActionState(resetAction, undefined);
  return (
    <form action={action} className="space-y-4">
      <input type="hidden" name="token" value={token} />
      <div className="space-y-1.5">
        <Label htmlFor="password">New password</Label>
        <Input id="password" name="password" type="password" minLength={8} required autoFocus className="h-10" />
      </div>
      <Message state={state} />
      <Button className="w-full h-10" disabled={pending}>Save password</Button>
    </form>
  );
}
