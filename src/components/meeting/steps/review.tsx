"use client";

import { useState } from "react";
import { Switch } from "@/components/ui/switch";
import { useMeeting } from "../use-meeting";
import { MeetingActionList } from "../meeting-action-list";

export function ReviewStep() {
  const { state } = useMeeting();
  const [groupByIdea, setGroupByIdea] = useState(true);
  const mine = state.actions.filter((a) => a.kind === "action" && a.meetingId === state.meeting.id && a.status !== "rejected");
  const other = state.actions.filter((a) => a.kind === "action" && a.meetingId !== state.meeting.id && a.status === "accepted");
  const agreements = state.actions.filter((a) => a.kind === "agreement" && a.status === "accepted");
  const parkedHere = state.actions.filter((a) => a.kind === "parked" && a.meetingId === state.meeting.id && a.status === "accepted");
  const parkedOther = state.actions.filter((a) => a.kind === "parked" && a.meetingId !== state.meeting.id && a.status === "accepted");
  return (
    <div className="h-full overflow-y-auto px-4 pb-24 scrollbar-thin">
      <div className="mx-auto grid max-w-6xl gap-8 pt-6 lg:grid-cols-[1.4fr_1fr]">
        <section className="space-y-3">
          <div className="flex items-center gap-3">
            <h2 className="text-lg font-semibold">Actions from this {state.meeting.type === "healthCheck" ? "health check" : state.meeting.type === "estimation" ? "estimation" : "retrospective"}</h2>
            <label className="ml-auto flex items-center gap-2 text-xs text-muted-foreground">
              <Switch checked={groupByIdea} onCheckedChange={setGroupByIdea} /> Group by idea
            </label>
          </div>
          <MeetingActionList kind="action" items={mine} groupBySource={groupByIdea} />
          {other.length > 0 && (
            <>
              <h3 className="pt-4 text-sm font-semibold text-muted-foreground">Other open actions</h3>
              <MeetingActionList kind="action" items={other} hideAdd />
            </>
          )}
        </section>
        <div className="space-y-8">
          <section className="space-y-3">
            <h2 className="text-lg font-semibold">Team agreements</h2>
            <MeetingActionList kind="agreement" items={agreements} />
          </section>
          <section className="space-y-3">
            <h2 className="text-lg font-semibold">Parking lot</h2>
            <MeetingActionList kind="parked" items={parkedHere} emptyText="Nothing parked in this meeting" />
            {parkedOther.length > 0 && (
              <>
                <p className="text-sm text-muted-foreground">Other parked items</p>
                <MeetingActionList kind="parked" items={parkedOther} hideAdd />
              </>
            )}
          </section>
        </div>
      </div>
    </div>
  );
}
