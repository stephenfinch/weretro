"use client";

import { useMeeting } from "../use-meeting";
import { CheckQuestion } from "../check-question";
import { MEETING_TYPE_LABEL } from "@/lib/constants";

export function WelcomeStep() {
  const { state } = useMeeting();
  const label = MEETING_TYPE_LABEL[state.meeting.type].toLowerCase();
  return (
    <div className="h-full overflow-y-auto px-4 pb-24">
      <div className="mx-auto max-w-3xl space-y-8 pt-10 text-center">
        <h1 className="text-3xl font-semibold tracking-tight text-balance">
          Welcome to our <span className="text-primary">{state.meeting.title || state.meeting.templateName || state.meeting.date}</span> {state.meeting.type === "standup" ? "" : label}
        </h1>
        {state.meeting.context && <p className="mx-auto max-w-2xl rounded-2xl border bg-card p-5 text-left whitespace-pre-wrap">{state.meeting.context}</p>}
        {state.meeting.contextImageUrl && (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={state.meeting.contextImageUrl} alt="" className="mx-auto max-h-80 rounded-2xl" />
        )}
        <CheckQuestion kind="in" />
        {state.meeting.type === "retrospective" && (
          <div className="mx-auto grid max-w-3xl gap-3 text-left sm:grid-cols-3">
            {[
              ["Be kind", "Everyone did the best job they could with what they knew at the time."],
              ["Be honest", "Focus on facts and behaviours, not people."],
              ["Be useful", "Leave with a few actions the team will actually do."],
            ].map(([t, d]) => (
              <div key={t} className="rounded-2xl border bg-card p-4">
                <p className="font-semibold">{t}</p>
                <p className="text-sm text-muted-foreground">{d}</p>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
