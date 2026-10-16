"use client";

import { useMeeting } from "../use-meeting";
import { MeetingActionList } from "../meeting-action-list";

export function OpenActionsStep() {
  const { state } = useMeeting();
  const open = state.actions.filter((a) => a.kind === "action" && a.meetingId !== state.meeting.id && (a.status === "accepted" || (a.status === "completed" && a.completedAt && a.completedAt >= state.meeting.createdAt)));
  const lastMeetingId = open.filter((a) => a.meetingId).sort((a, b) => b.createdAt.localeCompare(a.createdAt))[0]?.meetingId;
  const fromLast = open.filter((a) => a.meetingId === lastMeetingId);
  const others = open.filter((a) => a.meetingId !== lastMeetingId);
  const agreements = state.actions.filter((a) => a.kind === "agreement" && a.status === "accepted");
  const parked = state.actions.filter((a) => a.kind === "parked" && a.status === "accepted");
  return (
    <div className="h-full overflow-y-auto px-4 pb-24 scrollbar-thin">
      <div className="mx-auto grid max-w-6xl gap-8 pt-6 lg:grid-cols-2">
        <section className="space-y-4">
          <h2 className="text-lg font-semibold">Team actions</h2>
          {lastMeetingId && (
            <div className="space-y-2">
              <p className="text-sm font-medium text-muted-foreground">From the last {state.meeting.type === "healthCheck" ? "health check" : "meeting"}</p>
              <MeetingActionList kind="action" items={fromLast} hideAdd />
            </div>
          )}
          <div className="space-y-2">
            <p className="text-sm font-medium text-muted-foreground">{lastMeetingId ? "Other open actions" : "Open actions"}</p>
            <MeetingActionList kind="action" items={others} hideAdd emptyText="No other open actions" />
          </div>
        </section>
        <div className="space-y-8">
          <section className="space-y-3">
            <h2 className="text-lg font-semibold">Team agreements</h2>
            <MeetingActionList kind="agreement" items={agreements} />
          </section>
          <section className="space-y-3">
            <h2 className="text-lg font-semibold">Parking lot</h2>
            <MeetingActionList kind="parked" items={parked} />
          </section>
        </div>
      </div>
    </div>
  );
}
