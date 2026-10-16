"use client";

import { useActionState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { joinAsGuest } from "./actions";

export function GuestJoinForm({ meetingId, sig }: { meetingId: string; sig: string }) {
  const [state, action, pending] = useActionState(joinAsGuest.bind(null, meetingId, sig), undefined);
  return (
    <form action={action} className="space-y-3">
      <Input name="name" placeholder="Your name" required autoFocus className="h-10" />
      {state?.error && <p className="text-sm text-destructive">{state.error}</p>}
      <Button className="h-10 w-full" disabled={pending}>Join as guest</Button>
    </form>
  );
}
