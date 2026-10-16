import "server-only";
import type { TeamAccess } from "./access";
import { listHealthModels } from "./health-models";
import { teamDecks, teamTemplates } from "./queries";
import type { MeetingType } from "@/lib/types";
import { START_PERMISSION } from "./meetings/context";

export async function startDialogData(access: TeamAccess) {
  const { team } = access;
  const [retro, standup, models, decks] = await Promise.all([
    teamTemplates(team.orgId, team.id, "retrospective"),
    teamTemplates(team.orgId, team.id, "standup"),
    listHealthModels(team.orgId, team.id),
    teamDecks(team.orgId, team.id),
  ]);
  const allowed = (["retrospective", "standup", "healthCheck", "estimation"] as MeetingType[]).filter((t) => access.can(START_PERMISSION[t]));
  return {
    teamId: team.id,
    allowed,
    customTemplates: [...retro, ...standup].map((t) => ({ id: t.id, name: t.name, meetingType: t.meetingType, descriptionShort: t.descriptionShort, body: t.body, teamId: t.teamId })),
    healthModels: models.map((m) => ({ id: m.id, name: m.name, description: m.description, style: m.style, category: m.category, dimensionNames: m.dimensionNames, teamId: m.teamId, orgId: m.orgId })),
    decks: decks.map((d) => ({ id: d.id, name: d.name, cards: d.cards })),
    defaultDeckId: team.defaultDeckId,
    defaultHealthModelId: team.defaultHealthModelId,
  };
}
export type StartDialogData = Awaited<ReturnType<typeof startDialogData>>;
