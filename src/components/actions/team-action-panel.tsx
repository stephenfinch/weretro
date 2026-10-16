"use client";

import { toast } from "sonner";
import { ActionList, type Kind, type MemberLite } from "./action-list";
import type { ActionDTO } from "@/lib/meeting-types";
import { addTeamItem, deleteTeamItem, updateTeamItem } from "@/app/actions/teams";

export function TeamActionPanel({
  teamId,
  kind,
  items,
  members,
  canManage,
  canComplete,
  onPublish,
  hideAdd,
}: {
  teamId: string | ((a: ActionDTO) => string);
  kind: Kind;
  items: ActionDTO[];
  members: MemberLite[];
  canManage: boolean;
  canComplete: boolean;
  onPublish?: (id: string) => void;
  hideAdd?: boolean;
}) {
  const tid = (id?: string) => (typeof teamId === "string" ? teamId : teamId(items.find((i) => i.id === id)!));
  const check = (r: { ok: boolean; error?: string }) => {
    if (!r.ok) toast.error(r.error ?? "Something went wrong");
  };
  return (
    <ActionList
      items={items}
      kind={kind}
      members={members}
      canAdd={canManage}
      canEdit={canManage}
      canComplete={canComplete}
      hideAdd={hideAdd}
      handlers={{
        onAdd: async (title) => check(await addTeamItem(tid(), kind, { title })),
        onUpdate: async (id, patch) => check(await updateTeamItem(tid(id), id, patch)),
        onDelete: async (id) => check(await deleteTeamItem(tid(id), id)),
        onPublish,
      }}
    />
  );
}
