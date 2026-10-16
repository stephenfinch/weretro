"use client";

import { useState } from "react";
import { toast } from "sonner";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Label } from "@/components/ui/label";
import { MEETING_TYPE_LABEL, BUILTIN_DECKS } from "@/lib/constants";
import { SettingsEditor, type MeetingDraft } from "@/components/meeting-setup/settings-editor";
import { customizeMeetingAction } from "@/app/actions/meetings";
import { useMeeting } from "./use-meeting";
import type { SeriesSchedule } from "@/lib/types";

export function CustomizeDialog({ open, onOpenChange, schedule }: { open: boolean; onOpenChange: (o: boolean) => void; schedule: SeriesSchedule | null }) {
  const { state, refresh } = useMeeting();
  const m = state.meeting;
  const build = (): MeetingDraft => ({
    type: m.type,
    title: m.title,
    date: m.date,
    context: m.context,
    anonymity: m.anonymity,
    topics: m.topics,
    steps: m.steps,
    options: m.options,
    schedule,
    deckId: m.deck?.id ?? BUILTIN_DECKS.find((d) => d.name === m.deck?.name)?.id ?? null,
    healthModelId: m.healthModelId,
  });
  const [draft, setDraft] = useState<MeetingDraft>(build);
  const [scope, setScope] = useState<"meeting" | "series">("meeting");
  const [busy, setBusy] = useState(false);
  // Reset the draft each time the dialog opens.
  const [wasOpen, setWasOpen] = useState(open);
  if (open !== wasOpen) {
    setWasOpen(open);
    if (open) setDraft(build());
  }
  const label = MEETING_TYPE_LABEL[m.type];
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="flex max-h-[90vh] flex-col gap-0 overflow-hidden p-0 sm:max-w-3xl">
        <DialogHeader className="border-b px-6 py-4">
          <DialogTitle>Customize {label}</DialogTitle>
        </DialogHeader>
        <div className="min-h-0 flex-1 overflow-y-auto px-6 py-5">
          <SettingsEditor draft={draft} setDraft={setDraft} mode="edit" currentStepKey={m.steps[m.stepIndex]?.key} decks={BUILTIN_DECKS} />
        </div>
        <DialogFooter className="items-center border-t px-6 py-4 sm:justify-between">
          {m.seriesId ? (
            <RadioGroup value={scope} onValueChange={(v) => setScope(v as "meeting" | "series")} className="flex gap-4">
              <Label className="flex items-center gap-2 font-normal">
                <RadioGroupItem value="meeting" /> This {label.toLowerCase()} only
              </Label>
              <Label className="flex items-center gap-2 font-normal">
                <RadioGroupItem value="series" /> This and future {label.toLowerCase()}s
              </Label>
            </RadioGroup>
          ) : (
            <span className="text-xs text-muted-foreground">Changes apply to this {label.toLowerCase()} only</span>
          )}
          <Button
            disabled={busy}
            onClick={async () => {
              setBusy(true);
              const r = await customizeMeetingAction(
                m.id,
                { title: draft.title, date: draft.date, context: draft.context, anonymity: draft.anonymity, topics: draft.topics, steps: draft.steps, options: draft.options, schedule: draft.schedule, deckId: draft.deckId },
                scope,
              );
              setBusy(false);
              if (!r.ok) return void toast.error(r.error);
              toast.success("Saved");
              refresh();
              onOpenChange(false);
            }}
          >
            Save changes
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
