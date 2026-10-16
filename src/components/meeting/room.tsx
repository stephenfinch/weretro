"use client";

import { useEffect, useState } from "react";
import type { MeetingStateDTO } from "@/lib/meeting-types";
import type { SeriesSchedule } from "@/lib/types";
import { MeetingContext, useMeetingSync } from "./use-meeting";
import { MeetingTopBar } from "./top-bar";
import { StepToolbar } from "./toolbar";
import { SidePanel, type PanelKey } from "./side-panel";
import { currentStepKey } from "./helpers";
import { BrainstormStep } from "./steps/brainstorm";
import { GroupStep } from "./steps/group";
import { VoteStep } from "./steps/vote";
import { DiscussStep } from "./steps/discuss";
import { ReviewStep } from "./steps/review";
import { ShareStep } from "./steps/share";
import { WelcomeStep } from "./steps/welcome";
import { OpenActionsStep } from "./steps/open-actions";
import { HealthSurveyStep } from "./health/survey";
import { HealthDiscussStep } from "./health/discuss";
import { PrepareStep } from "./estimation/prepare";
import { EstimateStep } from "./estimation/estimate";
import { EstimationReviewStep } from "./estimation/review";
import { StandupStep } from "./standup/standup";
import { IcebreakerStep } from "./icebreaker/icebreaker";
import { CustomizeDialog } from "./customize-dialog";
import { FloatingReactions, LiveFeedbackBar } from "./live-feedback";
import { WhiteboardDialog } from "./whiteboard-dialog";

export function MeetingRoom({ initial, integrations, schedule, screen }: { initial: MeetingStateDTO; integrations: { id: string; type: string; name: string }[]; schedule: SeriesSchedule | null; screen?: boolean }) {
  const ctx = useMeetingSync(initial);
  const { state } = ctx;
  const [panel, setPanel] = useState<PanelKey | null>(null);
  const [customize, setCustomize] = useState(false);
  const [whiteboard, setWhiteboard] = useState<string | null>(null);
  const key = currentStepKey(state);
  useEffect(() => {
    document.title = `${state.meeting.title || state.meeting.templateName || "Meeting"} · WeRetro`;
  }, [state.meeting.title, state.meeting.templateName]);
  const presenting = !!state.meeting.presenting?.active;
  const bg = state.meeting.options.background;
  let content: React.ReactNode;
  switch (key) {
    case "icebreaker":
      content = <IcebreakerStep />;
      break;
    case "welcome":
      content = <WelcomeStep />;
      break;
    case "openActions":
      content = <OpenActionsStep />;
      break;
    case "brainstorm":
      content = <BrainstormStep onWhiteboard={setWhiteboard} />;
      break;
    case "group":
      content = <GroupStep />;
      break;
    case "vote":
      content = <VoteStep />;
      break;
    case "discuss":
      content = <DiscussStep />;
      break;
    case "review":
      content = state.meeting.type === "estimation" ? <EstimationReviewStep /> : <ReviewStep />;
      break;
    case "share":
      content = <ShareStep integrations={integrations} />;
      break;
    case "healthSurvey":
      content = <HealthSurveyStep />;
      break;
    case "healthDiscuss":
      content = <HealthDiscussStep />;
      break;
    case "prepare":
      content = <PrepareStep />;
      break;
    case "estimate":
      content = <EstimateStep />;
      break;
    case "standup":
      content = state.meeting.status === "closed" ? <ShareStep integrations={integrations} /> : <StandupStep />;
      break;
    default:
      content = null;
  }
  return (
    <MeetingContext value={ctx}>
      <div className="flex h-dvh flex-col overflow-hidden bg-canvas">
        {!screen && <MeetingTopBar onCustomize={() => setCustomize(true)} />}
        {!screen && <StepToolbar onCustomize={() => setCustomize(true)} />}
        <div className="flex min-h-0 flex-1">
          <main className="relative min-w-0 flex-1">
            {bg?.url && (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={bg.url} alt="" className="pointer-events-none absolute inset-0 size-full object-cover" style={{ opacity: bg.opacity ?? 0.25 }} />
            )}
            <div className="relative h-full">{content}</div>
            <FloatingReactions />
            {presenting && <LiveFeedbackBar />}
          </main>
          {!screen && <SidePanel panel={panel} setPanel={setPanel} onOpenWhiteboard={setWhiteboard} />}
        </div>
      </div>
      <CustomizeDialog open={customize} onOpenChange={setCustomize} schedule={schedule} />
      <WhiteboardDialog id={whiteboard} onClose={() => setWhiteboard(null)} />
    </MeetingContext>
  );
}
