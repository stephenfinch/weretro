"use client";

import { EyeOff } from "lucide-react";
import { useMeeting } from "../use-meeting";
import { Board, Column } from "../board-column";
import { IdeaInput } from "../idea-input";
import { IdeaCard } from "../idea-card";
import { ideaBg } from "../helpers";

export function BrainstormStep({ onWhiteboard }: { onWhiteboard?: (id: string) => void }) {
  const { state } = useMeeting();
  const topics = state.meeting.topics;
  return (
    <Board count={topics.length}>
      {topics.map((t) => {
        const mine = state.ideas.filter((i) => i.topicId === t.id).sort((a, b) => a.position - b.position);
        const hidden = state.hiddenIdeaCounts[t.id] ?? 0;
        return (
          <Column key={t.id} topic={t} count={mine.length + hidden}>
            <IdeaInput topicId={t.id} color={t.color} onWhiteboard={onWhiteboard} />
            {mine.map((i) => (
              <IdeaCard key={i.id} idea={i} />
            ))}
            {Array.from({ length: hidden }).map((_, k) => (
              <div key={k} className="flex h-12 items-center justify-center rounded-xl" style={{ background: ideaBg(t.color, 0.1) }}>
                <EyeOff className="size-5 opacity-30" style={{ color: t.color }} />
              </div>
            ))}
          </Column>
        );
      })}
    </Board>
  );
}
