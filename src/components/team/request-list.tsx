"use client";

import { useTransition } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { resolveRequest } from "@/app/actions/teams";

type Req = { id: string; kind: string; teamName: string | null; userName: string; userEmail: string | null; createdAt: string };

export function RequestList({ requests }: { requests: Req[] }) {
  const [pending, start] = useTransition();
  const act = (id: string, accept: boolean) =>
    start(async () => {
      const r = await resolveRequest(id, accept);
      if (!r.ok) toast.error(r.error);
      else toast.success(accept ? "Request accepted" : "Request declined");
    });
  return (
    <ul className="divide-y rounded-2xl border bg-card">
      {requests.map((r) => (
        <li key={r.id} className="flex flex-wrap items-center gap-3 px-4 py-3 text-sm">
          <span className="min-w-0 flex-1">
            <strong>{r.userName}</strong>{" "}
            {r.kind === "createTeam" ? (
              <>has requested team <strong>{r.teamName}</strong> be created</>
            ) : r.kind === "teamAdmin" ? (
              <>has requested to be <strong>an admin</strong> of {r.teamName}</>
            ) : (
              <>has requested to be a member of {r.teamName}</>
            )}
          </span>
          <div className="flex gap-2">
            <Button size="sm" disabled={pending} onClick={() => act(r.id, true)}>Accept</Button>
            <Button size="sm" variant="ghost" disabled={pending} onClick={() => act(r.id, false)}>Decline</Button>
          </div>
        </li>
      ))}
    </ul>
  );
}
