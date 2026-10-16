"use client";

import { useActionState, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { onboardAction, joinCodeAction } from "@/app/actions/onboarding";
import { PALETTE } from "@/lib/constants";
import { cn } from "@/lib/utils";

export function OnboardingForm({ defaultOrg }: { defaultOrg?: string }) {
  const [state, action, pending] = useActionState(onboardAction, undefined);
  const [color, setColor] = useState(PALETTE[11]);
  return (
    <form action={action} className="space-y-5">
      <div className="space-y-1.5">
        <Label htmlFor="orgName">Organization name</Label>
        <Input id="orgName" name="orgName" defaultValue={defaultOrg} placeholder="Acme Inc." required className="h-10" />
      </div>
      <div className="space-y-1.5">
        <Label htmlFor="teamName">First team <span className="font-normal text-muted-foreground">— you can add more later</span></Label>
        <Input id="teamName" name="teamName" placeholder="Platform team" required className="h-10" />
      </div>
      <div className="space-y-1.5">
        <Label>Team color</Label>
        <input type="hidden" name="color" value={color} />
        <div className="flex flex-wrap gap-2">
          {PALETTE.slice(0, 16).map((c) => (
            <button key={c} type="button" onClick={() => setColor(c)} className={cn("size-7 rounded-full ring-offset-2 ring-offset-background transition", color === c && "ring-2 ring-foreground")} style={{ background: c }} aria-label={c} />
          ))}
        </div>
      </div>
      {state?.error && <p className="text-sm text-destructive">{state.error}</p>}
      <Button className="h-10 w-full" disabled={pending}>{pending ? "Setting up…" : "Create organization"}</Button>
    </form>
  );
}

export function JoinCodeForm({ code }: { code?: string }) {
  const [state, action, pending] = useActionState(joinCodeAction, undefined);
  return (
    <form action={action} className="space-y-3">
      <Input name="code" defaultValue={code} placeholder="ABC-DEF-GHJ" className="h-11 text-center font-mono text-lg tracking-widest uppercase" required />
      {state?.error && <p className="text-sm text-destructive">{state.error}</p>}
      <Button className="h-10 w-full" disabled={pending}>Join team</Button>
    </form>
  );
}
