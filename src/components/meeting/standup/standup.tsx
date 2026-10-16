"use client";

import { useState } from "react";
import { AtSign, Check, CheckCircle2, ChevronLeft, ChevronRight, MessageSquare, OctagonAlert, Pencil, RotateCw, Trash2 } from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { UserAvatar, AvatarStack } from "@/components/user-avatar";
import type { ParticipantDTO, StandupUpdateDTO } from "@/lib/meeting-types";
import { useMeeting } from "../use-meeting";
import { MentionInput } from "../mention-input";
import { Reactions } from "../reactions";
import { CommentThread } from "../comments";

const TYPE_COLOR: Record<string, string> = { done: "#3B82F6", doing: "#8B5CF6", blocked: "#EF4444" };

function Highlight({ text }: { text: string }) {
  const parts = text.split(/(@[\w.-]+(?:\s[\w.-]+)?)/g);
  return (
    <>
      {parts.map((p, i) => (p.startsWith("@") ? <span key={i} className="rounded bg-primary/10 px-0.5 font-medium text-primary">{p}</span> : <span key={i}>{p}</span>))}
    </>
  );
}

function Bullet({ u, editable }: { u: StandupUpdateDTO; editable: boolean }) {
  const { state, op } = useMeeting();
  const [editing, setEditing] = useState(false);
  const [text, setText] = useState(u.text);
  const [comments, setComments] = useState(false);
  const canReact = state.meeting.options.reactions !== false && !!state.me.participantId && state.me.role !== "observer";
  return (
    <li className="group/card space-y-1">
      <div className="flex items-start gap-2">
        <span className="mt-2 size-1.5 shrink-0 rounded-full bg-muted-foreground/50" />
        <div className="min-w-0 flex-1">
          {editing ? (
            <MentionInput
              autoFocus
              value={text}
              onChange={setText}
              members={state.members}
              onSubmit={() => {
                if (text.trim()) void op("standup.update", { id: u.id, text });
                setEditing(false);
              }}
              onCancel={() => setEditing(false)}
              className="rounded-md bg-muted px-2 py-1"
            />
          ) : (
            <p className="text-sm break-words whitespace-pre-wrap" onDoubleClick={() => editable && setEditing(true)}>
              <Highlight text={u.text} />
              {u.carryStatus && (
                <span className="ml-2 rounded-full bg-muted px-1.5 py-0.5 text-[10px] font-semibold text-muted-foreground uppercase">
                  {u.carryStatus === "continue" ? `Day ${u.dayCount}` : u.carryStatus === "blocked" ? `Still blocked · day ${u.dayCount}` : "Carried over"}
                </span>
              )}
            </p>
          )}
          <div className="mt-0.5 flex items-center gap-1">
            <Reactions reactions={u.reactions} canReact={canReact} compact onToggle={(emoji) => void op("reaction.toggle", { targetId: u.id, emoji })} />
            {(u.commentCount > 0 || canReact) && (
              <button type="button" onClick={() => setComments(!comments)} className={cn("inline-flex h-6 items-center gap-1 rounded-full px-1.5 text-xs text-muted-foreground hover:bg-muted", !u.commentCount && "opacity-0 group-hover/card:opacity-100")}>
                <MessageSquare className="size-3.5" /> {u.commentCount || ""}
              </button>
            )}
          </div>
        </div>
        {editable && !editing && (
          <span className="flex opacity-0 group-hover/card:opacity-100">
            <Button variant="ghost" size="icon-xs" onClick={() => { setText(u.text); setEditing(true); }} aria-label="Edit update"><Pencil /></Button>
            <Button variant="ghost" size="icon-xs" onClick={() => void op("standup.delete", { id: u.id })} aria-label="Remove update"><Trash2 /></Button>
          </span>
        )}
      </div>
      {comments && (
        <div className="ml-4">
          <CommentThread targetType="update" targetId={u.id} compact />
        </div>
      )}
    </li>
  );
}

export function UpdateCard({ participant, editable, highlight }: { participant: ParticipantDTO; editable: boolean; highlight?: boolean }) {
  const { state, op, typing } = useMeeting();
  const ups = state.standup.filter((u) => u.participantId === participant.id);
  const [drafts, setDrafts] = useState<Record<string, string>>({});
  const finished = participant.finishedSteps.includes("standup");
  const closed = state.meeting.status === "closed";
  const canEdit = editable && !closed;
  return (
    <div className={cn("rounded-3xl border bg-card p-5 shadow-sm", highlight && "ring-2 ring-primary")}>
      <div className="mb-4 flex items-center gap-3">
        <UserAvatar name={participant.name} color={participant.color} src={participant.avatarUrl} size={44} />
        <div className="min-w-0 flex-1">
          <p className="text-lg font-semibold">{participant.name}</p>
          {finished && <p className="flex items-center gap-1 text-xs text-emerald-600"><CheckCircle2 className="size-3.5" /> Finished</p>}
        </div>
      </div>
      {canEdit && <Carryovers />}
      <div className="space-y-4">
        {state.meeting.topics.map((t) => {
          const list = ups.filter((u) => u.topicId === t.id).sort((a, b) => a.position - b.position);
          if (!canEdit && !list.length) return null;
          const color = t.type ? TYPE_COLOR[t.type] : t.color;
          return (
            <div key={t.id} className="border-l-[3px] pl-3" style={{ borderColor: color }}>
              <p className="mb-1 text-sm font-semibold" style={{ color: t.type === "blocked" ? color : undefined }}>{t.title}</p>
              <ul className="space-y-1">
                {list.map((u) => (
                  <Bullet key={u.id} u={u} editable={canEdit} />
                ))}
              </ul>
              {canEdit && (
                <div className="mt-1 flex items-center gap-2 rounded-lg px-1 focus-within:bg-muted/60">
                  <span className="text-muted-foreground">›</span>
                  <MentionInput
                    value={drafts[t.id] ?? ""}
                    onChange={(v) => setDrafts((d) => ({ ...d, [t.id]: v }))}
                    onKeyStroke={typing}
                    members={state.members}
                    placeholder={t.description || "Share your update…"}
                    onSubmit={() => {
                      const text = (drafts[t.id] ?? "").trim();
                      if (!text) return;
                      setDrafts((d) => ({ ...d, [t.id]: "" }));
                      const mentions = state.members.filter((m) => text.includes(`@${m.name}`)).map((m) => m.userId);
                      void op("standup.add", { topicId: t.id, text, mentions });
                    }}
                    className="py-1.5"
                  />
                </div>
              )}
            </div>
          );
        })}
      </div>
      {canEdit && state.me.canContribute && (
        <div className="mt-5 flex justify-start">
          <Button variant={finished ? "secondary" : "default"} className="rounded-full" onClick={() => void op("step.finish", { step: "standup", finished: !finished })}>
            <CheckCircle2 /> {finished ? "Update finished" : "Finish update"}
          </Button>
        </div>
      )}
    </div>
  );
}

function Carryovers() {
  const { state, op } = useMeeting();
  const items = state.standupCarryovers;
  if (!items.length) return null;
  const doneTopic = state.meeting.topics.find((t) => t.type === "done") ?? state.meeting.topics[0];
  const doingTopic = state.meeting.topics.find((t) => t.type === "doing") ?? state.meeting.topics[1] ?? doneTopic;
  const blockedTopic = state.meeting.topics.find((t) => t.type === "blocked") ?? doingTopic;
  const carry = (c: (typeof items)[number], status: "done" | "continue" | "blocked") => {
    const topic = status === "done" ? doneTopic : status === "continue" ? doingTopic : blockedTopic;
    void op("standup.add", { topicId: topic.id, text: c.text, carriedFromId: c.id, carryStatus: status, updateType: status === "continue" ? "doing" : status });
  };
  return (
    <div className="mb-4 rounded-2xl border border-dashed bg-muted/30 p-3">
      <p className="mb-2 text-xs font-semibold text-muted-foreground uppercase">
        From {new Date(`${items[0].date}T00:00:00`).toLocaleDateString(undefined, { weekday: "long" })}&apos;s plan · {items.length} to close out
      </p>
      <ul className="space-y-1.5">
        {items.map((c) => (
          <li key={c.id} className="flex flex-wrap items-center gap-2 text-sm">
            <span className="min-w-0 flex-1">
              {c.type === "blocked" && <OctagonAlert className="mr-1 inline size-3.5 text-red-500" />}
              {c.text}
              {c.dayCount > 1 && <span className="ml-1 text-xs text-muted-foreground">Day {c.dayCount}</span>}
            </span>
            <Button size="xs" variant="outline" onClick={() => carry(c, "done")}><Check /> Done</Button>
            <Button size="xs" variant="outline" onClick={() => carry(c, "continue")}><RotateCw /> Continue</Button>
            <Button size="xs" variant="outline" onClick={() => carry(c, "blocked")}><OctagonAlert /> Still blocked</Button>
          </li>
        ))}
      </ul>
    </div>
  );
}

export function StandupStep() {
  const { state, op } = useMeeting();
  const me = state.participants.find((p) => p.isMe);
  const presenting = state.meeting.presenting?.active;
  const posters = state.participants.filter((p) => state.standup.some((u) => u.participantId === p.id) || p.isMe);
  const contributors = state.participants.filter((p) => ["facilitator", "participant", "guest"].includes(p.role) && !p.absent);
  const pending = contributors.filter((p) => !p.finishedSteps.includes("standup"));
  const blockers = state.standup.filter((u) => u.type === "blocked");
  const mentions = state.standup.filter((u) => u.mentions.includes(state.me.userId) || u.text.includes(`@${state.me.name}`));

  if (presenting) {
    const order = contributors.filter((p) => state.standup.some((u) => u.participantId === p.id) || p.finishedSteps.includes("standup"));
    const list = order.length ? order : contributors;
    const cur = list.find((p) => p.id === state.meeting.presenting?.targetId) ?? list[0];
    const idx = list.findIndex((p) => p.id === cur?.id);
    const nav = (p: ParticipantDTO) => state.me.isFacilitator && void op("present.set", { active: true, targetId: p.id });
    return (
      <div className="h-full overflow-y-auto px-4 pb-32 scrollbar-thin">
        <div className="mx-auto max-w-3xl space-y-5 pt-4">
          <div className="flex items-center justify-center gap-2">
            <Button variant="ghost" size="icon" disabled={!state.me.isFacilitator || idx <= 0} onClick={() => nav(list[idx - 1])} aria-label="Previous"><ChevronLeft /></Button>
            <div className="flex flex-wrap justify-center gap-1.5" aria-label="Participant navigation">
              {list.map((p) => (
                <button key={p.id} type="button" disabled={!state.me.isFacilitator} onClick={() => nav(p)} className={cn("rounded-full p-0.5 transition", p.id === cur?.id ? "ring-2 ring-primary" : "opacity-60 hover:opacity-100")}>
                  <UserAvatar name={p.name} color={p.color} src={p.avatarUrl} size={32} />
                </button>
              ))}
            </div>
            <Button variant="ghost" size="icon" disabled={!state.me.isFacilitator || idx >= list.length - 1} onClick={() => nav(list[idx + 1])} aria-label="Next"><ChevronRight /></Button>
          </div>
          {cur && <UpdateCard participant={cur} editable={cur.isMe} highlight />}
        </div>
      </div>
    );
  }

  return (
    <div className="h-full overflow-y-auto px-4 pb-24 scrollbar-thin">
      <div className="mx-auto grid max-w-6xl gap-6 pt-6 lg:grid-cols-[minmax(0,1fr)_300px]">
        <div className="space-y-5">
          {me && state.me.canContribute && <UpdateCard participant={me} editable />}
          {state.standupHiddenCount > 0 ? (
            <div className="flex flex-col items-center gap-2 rounded-3xl border border-dashed bg-card/50 p-8 text-center">
              <AvatarStack people={posters.filter((p) => !p.isMe).map((p) => ({ name: p.name, color: p.color, avatarUrl: p.avatarUrl }))} />
              <p className="text-sm text-muted-foreground">Your team members&apos; standups will appear here once you finish your update.</p>
            </div>
          ) : (
            posters
              .filter((p) => !p.isMe || !state.me.canContribute)
              .map((p) => <UpdateCard key={p.id} participant={p} editable={false} />)
          )}
          {state.standupHiddenCount === 0 && posters.filter((p) => !p.isMe).length === 0 && (
            <p className="rounded-3xl border border-dashed p-8 text-center text-sm text-muted-foreground">Your team members&apos; standups will appear here</p>
          )}
        </div>
        <aside className="space-y-4">
          <div className="rounded-2xl border bg-card p-4">
            <p className="mb-2 text-xs font-semibold text-muted-foreground uppercase">{pending.length ? `Waiting on ${pending.length}` : "Everyone has posted"}</p>
            <div className="flex flex-wrap gap-1.5">
              {contributors.map((p) => (
                <span key={p.id} className={cn("rounded-full", !p.finishedSteps.includes("standup") && "opacity-40 grayscale")} title={p.name}>
                  <UserAvatar name={p.name} color={p.color} src={p.avatarUrl} size={28} />
                </span>
              ))}
            </div>
          </div>
          {blockers.length > 0 && (
            <div className="rounded-2xl border border-red-500/30 bg-red-500/5 p-4">
              <p className="mb-2 flex items-center gap-1.5 text-xs font-semibold text-red-600 uppercase"><OctagonAlert className="size-3.5" /> Blockers</p>
              <ul className="space-y-1.5 text-sm">
                {blockers.map((b) => (
                  <li key={b.id}>
                    <span className="font-medium">{state.participants.find((p) => p.id === b.participantId)?.name}: </span>
                    {b.text}
                  </li>
                ))}
              </ul>
            </div>
          )}
          {mentions.length > 0 && (
            <div className="rounded-2xl border bg-card p-4">
              <p className="mb-2 flex items-center gap-1.5 text-xs font-semibold text-primary uppercase"><AtSign className="size-3.5" /> Mentions</p>
              <ul className="space-y-1.5 text-sm">
                {mentions.map((m) => (
                  <li key={m.id}>
                    <span className="font-medium">{state.participants.find((p) => p.id === m.participantId)?.name}</span> <span className="text-xs text-muted-foreground">in update</span>
                    <p><Highlight text={m.text} /></p>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </aside>
      </div>
    </div>
  );
}
