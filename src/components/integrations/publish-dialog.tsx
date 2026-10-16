"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { integrationDef } from "@/lib/integrations";
import { publishActionsAction, publishAgreementsAction, publishSummaryAction } from "@/app/actions/integrations";
import { cn } from "@/lib/utils";

export type IntegrationLite = { id: string; type: string; name: string };

export function PublishDialog({
  teamId,
  kind,
  actionIds = [],
  meetingId,
  open,
  onOpenChange,
  integrations,
}: {
  teamId: string;
  kind: "actions" | "agreements" | "summary";
  actionIds?: string[];
  meetingId?: string;
  open: boolean;
  onOpenChange: (o: boolean) => void;
  integrations: IntegrationLite[];
}) {
  const usable = integrations.filter((i) => integrationDef(i.type)?.publishes.includes(kind));
  const [selected, setSelected] = useState<string | null>(null);
  const [pending, start] = useTransition();
  const title = kind === "actions" ? `Publish ${actionIds.length === 1 ? "action" : `${actionIds.length} actions`}` : kind === "agreements" ? "Publish agreements" : "Publish meeting summary";
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
          <DialogDescription>Send to one of your team&apos;s connected tools.</DialogDescription>
        </DialogHeader>
        {usable.length ? (
          <div className="grid gap-2">
            {usable.map((i) => (
              <button key={i.id} type="button" onClick={() => setSelected(i.id)} className={cn("flex items-center justify-between rounded-xl border px-4 py-3 text-left text-sm", selected === i.id && "border-primary bg-primary/5")}>
                <span className="font-medium">{integrationDef(i.type)?.name}</span>
                <span className="text-xs text-muted-foreground">{i.name}</span>
              </button>
            ))}
          </div>
        ) : (
          <div className="rounded-xl border border-dashed p-5 text-center text-sm">
            <p className="font-medium">Configure your integrations</p>
            <p className="text-muted-foreground">Connect Jira, GitHub, Linear, Slack, Teams, Notion, Confluence and more.</p>
            <Button asChild size="sm" className="mt-3">
              <Link href={`/t/${teamId}/settings/integrations`}>Set up now</Link>
            </Button>
          </div>
        )}
        {!!usable.length && (
          <DialogFooter>
            <Button
              disabled={!selected || pending}
              onClick={() =>
                start(async () => {
                  const r =
                    kind === "actions"
                      ? await publishActionsAction(teamId, selected!, actionIds)
                      : kind === "agreements"
                        ? await publishAgreementsAction(teamId, selected!)
                        : await publishSummaryAction(teamId, selected!, meetingId!);
                  if (!r.ok) return void toast.error(r.error);
                  toast.success("Published");
                  onOpenChange(false);
                })
              }
            >
              {pending ? "Publishing…" : "Publish"}
            </Button>
          </DialogFooter>
        )}
      </DialogContent>
    </Dialog>
  );
}
