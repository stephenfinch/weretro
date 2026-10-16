"use client";

import { useMeeting } from "../use-meeting";
import { UpdateCard } from "./standup";

export function MyStandupPanel() {
  const { state } = useMeeting();
  const me = state.participants.find((p) => p.isMe);
  if (!me) return null;
  return (
    <div className="space-y-3">
      <p className="text-xs text-muted-foreground">Your standup update. Add or edit it here, even while someone is presenting.</p>
      <UpdateCard participant={me} editable />
    </div>
  );
}
