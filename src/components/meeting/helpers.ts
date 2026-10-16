import type { GroupDTO, IdeaDTO, MeetingStateDTO } from "@/lib/meeting-types";
import type { DiscussOptions, GroupOptions, SortMode, StepKey, VoteOptions } from "@/lib/types";

export function stepOptions<T = Record<string, unknown>>(s: MeetingStateDTO, key: StepKey): T {
  return (s.meeting.steps.find((x) => x.key === key)?.options ?? {}) as T;
}

export function currentStepKey(s: MeetingStateDTO): StepKey {
  return s.meeting.steps[s.meeting.stepIndex]?.key ?? "brainstorm";
}

export function enabledSteps(s: MeetingStateDTO) {
  return s.meeting.steps.map((st, index) => ({ ...st, index })).filter((st) => st.enabled);
}

export function isPast(s: MeetingStateDTO, key: StepKey) {
  const idx = s.meeting.steps.findIndex((x) => x.key === key);
  return idx >= 0 && s.meeting.stepIndex > idx;
}

export type DiscussionItem = {
  id: string; // group id or idea id (the vote target)
  kind: "group" | "idea";
  topicId: string;
  title: string;
  ideas: IdeaDTO[];
  group: GroupDTO | null;
  votes: number;
  myVotes: number;
  position: number;
  authorId: string | null;
};

export function voteOnGroups(s: MeetingStateDTO) {
  return (stepOptions<VoteOptions>(s, "vote").voteOn ?? "groups") === "groups";
}

/** Build the list of vote/discussion targets: groups (with their ideas) and loose ideas. */
export function discussionItems(s: MeetingStateDTO): DiscussionItem[] {
  const items: DiscussionItem[] = [];
  const byGroup = voteOnGroups(s);
  for (const g of s.groups) {
    const ideas = s.ideas.filter((i) => i.groupId === g.id).sort((a, b) => a.position - b.position);
    if (!ideas.length) continue;
    if (byGroup) {
      items.push({ id: g.id, kind: "group", topicId: g.topicId, title: g.title || ideas[0].text, ideas, group: g, votes: g.votes ?? 0, myVotes: g.myVotes, position: g.position, authorId: null });
    }
  }
  for (const i of s.ideas) {
    if (i.groupId && byGroup) continue;
    items.push({ id: i.id, kind: "idea", topicId: i.topicId, title: i.text, ideas: [i], group: null, votes: i.votes ?? 0, myVotes: i.myVotes, position: i.position, authorId: i.authorId });
  }
  return items;
}

function hash(s: string) {
  let h = 0;
  for (const c of s) h = (h * 31 + c.charCodeAt(0)) | 0;
  return h;
}

export function sortItems<T extends { topicId: string; position: number; votes?: number; authorId?: string | null; id: string }>(items: T[], s: MeetingStateDTO, mode: SortMode | undefined): T[] {
  const topicOrder = (t: string) => s.meeting.topics.findIndex((x) => x.id === t);
  const seed = s.meeting.id;
  const list = [...items];
  switch (mode) {
    case "votes":
      return list.sort((a, b) => (b.votes ?? 0) - (a.votes ?? 0) || topicOrder(a.topicId) - topicOrder(b.topicId) || a.position - b.position);
    case "topicThenVotes":
      return list.sort((a, b) => topicOrder(a.topicId) - topicOrder(b.topicId) || (b.votes ?? 0) - (a.votes ?? 0));
    case "whoAdded":
    case "topicThenWhoAdded":
      return list.sort((a, b) => (mode === "topicThenWhoAdded" ? topicOrder(a.topicId) - topicOrder(b.topicId) : 0) || String(a.authorId ?? "").localeCompare(String(b.authorId ?? "")) || a.position - b.position);
    case "whoAddedRandom":
    case "topicThenWhoAddedRandom":
      return list.sort((a, b) => (mode === "topicThenWhoAddedRandom" ? topicOrder(a.topicId) - topicOrder(b.topicId) : 0) || hash(seed + (a.authorId ?? "")) - hash(seed + (b.authorId ?? "")) || a.position - b.position);
    case "random":
      return list.sort((a, b) => hash(seed + a.id) - hash(seed + b.id));
    default:
      return list.sort((a, b) => topicOrder(a.topicId) - topicOrder(b.topicId) || a.position - b.position);
  }
}

export function discussList(s: MeetingStateDTO) {
  const opts = stepOptions<DiscussOptions>(s, "discuss");
  let items = discussionItems(s);
  const which = opts.which ?? "allVoted";
  const anyVotes = items.some((i) => i.votes > 0);
  if (which === "allVoted" && anyVotes) items = items.filter((i) => i.votes > 0);
  items = sortItems(items, s, opts.sort ?? "votes");
  if (which === "topN") items = items.slice(0, opts.topN ?? 5);
  return items;
}

export function groupSort(s: MeetingStateDTO) {
  return stepOptions<GroupOptions>(s, "group").sort ?? "original";
}

export function participantName(s: MeetingStateDTO, id: string | null | undefined) {
  if (!id) return "Anonymous";
  return s.participants.find((p) => p.id === id)?.name ?? "Someone";
}

export function participantColor(s: MeetingStateDTO, id: string | null | undefined) {
  return s.participants.find((p) => p.id === id)?.color ?? "#94A3B8";
}

export function contributors(s: MeetingStateDTO) {
  return s.participants.filter((p) => ["facilitator", "participant", "guest"].includes(p.role) && !p.absent);
}

export function topicColor(s: MeetingStateDTO, topicId: string) {
  return s.meeting.topics.find((t) => t.id === topicId)?.color ?? "#94A3B8";
}

export function ideaBg(color: string, alpha = 0.14) {
  return `color-mix(in oklab, ${color} ${Math.round(alpha * 100)}%, var(--card))`;
}
