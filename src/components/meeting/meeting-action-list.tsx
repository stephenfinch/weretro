"use client";

import type { ActionDTO } from "@/lib/meeting-types";
import type { DiscussOptions, StepKey } from "@/lib/types";
import { ActionList, type Kind } from "@/components/actions/action-list";
import { useMeeting } from "./use-meeting";
import { stepOptions } from "./helpers";

export function usePermission(kind: Kind) {
  const { state } = useMeeting();
  const stepKey: StepKey = state.meeting.type === "healthCheck" ? "healthDiscuss" : state.meeting.type === "estimation" ? "estimate" : "discuss";
  const perm =
    kind === "action"
      ? stepOptions<DiscussOptions>(state, stepKey).actionPermission ?? "participantNoPropose"
      : kind === "agreement"
        ? state.meeting.options.agreements ?? "participantNoPropose"
        : state.meeting.options.parkingLot ?? "participantNoPropose";
  const member = !!state.me.participantId && state.me.role !== "observer";
  const fac = state.me.isFacilitator;
  return {
    canAdd: fac || (member && perm.startsWith("participant")),
    canPropose: !fac && member && (perm === "participantCanPropose" || perm === "facilitatorCanPropose"),
  };
}

export function MeetingActionList({
  kind,
  items,
  source,
  emptyText,
  hideAdd,
  groupBySource,
  compact,
}: {
  kind: Kind;
  items: ActionDTO[];
  source?: { type: string; id: string };
  emptyText?: string;
  hideAdd?: boolean;
  groupBySource?: boolean;
  compact?: boolean;
}) {
  const { state, op } = useMeeting();
  const { canAdd, canPropose } = usePermission(kind);
  const member = !!state.me.participantId && state.me.role !== "observer";
  return (
    <ActionList
      items={items}
      kind={kind}
      members={state.members}
      canAdd={canAdd}
      canPropose={canPropose}
      canEdit={member}
      canComplete={member}
      isFacilitator={state.me.isFacilitator}
      emptyText={emptyText}
      hideAdd={hideAdd}
      groupBySource={groupBySource}
      compact={compact}
      handlers={{
        onAdd: async (title, { propose }) => void (await op("action.add", { kind, title, propose, sourceType: source?.type, sourceId: source?.id })),
        onUpdate: async (id, patch) => void (await op("action.update", { id, ...patch })),
        onDelete: async (id) => void (await op("action.delete", { id })),
        onVote: async (id, value) => void (await op("action.vote", { id, value })),
      }}
    />
  );
}
