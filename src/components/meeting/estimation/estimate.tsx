"use client";

import { useMemo, useState } from "react";
import { ArrowLeft, ArrowRight, Coffee, ExternalLink, HelpCircle, Pencil, RotateCcw, Spade, Check } from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { UserAvatar } from "@/components/user-avatar";
import type { EstimationItemDTO } from "@/lib/meeting-types";
import { useMeeting } from "../use-meeting";
import { CommentThread } from "../comments";
import { MeetingActionList } from "../meeting-action-list";

const CARD_COLORS = ["#3B82F6", "#2F6FDF", "#2563EB", "#1D9BC4", "#14A39A", "#22A06B", "#65A30D", "#A3A30D", "#CA8A04", "#D97706", "#EA580C", "#DC2626", "#B91C1C"];

export function useCurrentItem() {
  const { state } = useMeeting();
  const items = useMemo(() => [...state.estimation].sort((a, b) => a.position - b.position), [state.estimation]);
  const target = state.meeting.presenting?.targetId;
  const current = items.find((i) => i.id === target) ?? items.find((i) => i.phase !== "review") ?? items[0] ?? null;
  return { items, current };
}

export function EstimateStep() {
  const { state, op } = useMeeting();
  const { items, current } = useCurrentItem();
  const fac = state.me.isFacilitator;
  if (!current) {
    return (
      <div className="flex h-full flex-col items-center justify-center gap-3 text-center">
        <Spade className="size-10 text-muted-foreground" />
        <p className="text-muted-foreground">Add your estimation items in the prepare step</p>
      </div>
    );
  }
  const idx = items.findIndex((i) => i.id === current.id);
  const goto = (it: EstimationItemDTO) => fac && void op("present.set", { active: true, targetId: it.id });
  const setPhase = (phase: string) => void op("estimation.update", { id: current.id, phase });
  const phases: { key: EstimationItemDTO["phase"]; label: string }[] = [
    { key: "discuss", label: "Discuss" },
    { key: "estimate", label: "Estimate" },
    { key: "review", label: "Review" },
  ];
  const nextPhase = current.phase === "discuss" ? "estimate" : current.phase === "estimate" ? "review" : null;
  const voters = state.participants.filter((p) => ["facilitator", "participant", "guest"].includes(p.role) && !p.absent);
  const instruction =
    current.phase === "discuss"
      ? "Let's discuss before we estimate."
      : current.phase === "estimate"
        ? current.myVote
          ? current.votedParticipantIds.length >= voters.length
            ? fac
              ? "Everyone has voted. Reveal the estimates."
              : "Waiting for the facilitator to reveal estimates."
            : "Waiting for others…"
          : "Select a card below."
        : "Let's review our estimates.";
  return (
    <div className="flex h-full flex-col">
      <div className="min-h-0 flex-1 overflow-y-auto px-4 pb-6 scrollbar-thin">
        <div className="mx-auto max-w-3xl space-y-4 pt-4">
          <div className="flex items-center justify-center gap-3">
            {fac && (
              <Button variant="ghost" size="icon" disabled={idx === 0} onClick={() => goto(items[idx - 1])} aria-label="Previous item">
                <ArrowLeft />
              </Button>
            )}
            <div className="flex overflow-hidden rounded-full border bg-card">
              {phases.map((p) => (
                <button
                  key={p.key}
                  type="button"
                  disabled={!fac}
                  onClick={() => setPhase(p.key)}
                  className={cn("px-4 py-1.5 text-xs font-semibold tracking-wide uppercase", current.phase === p.key ? "bg-primary text-primary-foreground" : "text-muted-foreground", fac && current.phase !== p.key && "hover:bg-muted")}
                >
                  {p.label}
                </button>
              ))}
            </div>
            <span className="text-xs text-muted-foreground">
              {idx + 1} / {items.length}
            </span>
            {fac &&
              (nextPhase ? (
                <Button size="icon" className="rounded-full" onClick={() => setPhase(nextPhase)} aria-label="Next phase">
                  <ArrowRight />
                </Button>
              ) : (
                <Button size="sm" className="rounded-full" disabled={idx === items.length - 1} onClick={() => goto(items[idx + 1])}>
                  Next item <ArrowRight />
                </Button>
              ))}
          </div>
          <ItemCard item={current} />
          <p className="text-center text-sm text-muted-foreground italic">{instruction}</p>
          {current.phase === "review" && <ReviewPanel item={current} />}
          <section className="space-y-2">
            <CommentThread targetType="estimationItem" targetId={current.id} />
          </section>
          {current.phase === "review" && (
            <section className="space-y-2">
              <h3 className="text-sm font-semibold text-muted-foreground">Actions</h3>
              <MeetingActionList kind="action" items={state.actions.filter((a) => a.sourceId === current.id)} source={{ type: "estimationItem", id: current.id }} />
            </section>
          )}
        </div>
      </div>
      <VoterRow item={current} />
      {current.phase !== "review" && <CardDeck item={current} />}
    </div>
  );
}

function ItemCard({ item }: { item: EstimationItemDTO }) {
  const { state, op } = useMeeting();
  const [editing, setEditing] = useState(false);
  const [title, setTitle] = useState(item.title);
  return (
    <div className="relative rounded-3xl border bg-card p-6 shadow-sm">
      <div className="flex items-start gap-3">
        <span className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-primary/10 text-primary">
          <Spade className="size-5" />
        </span>
        <div className="min-w-0 flex-1">
          {editing ? (
            <form onSubmit={(e) => { e.preventDefault(); void op("estimation.update", { id: item.id, title }); setEditing(false); }}>
              <Input autoFocus value={title} onChange={(e) => setTitle(e.target.value)} onBlur={() => setEditing(false)} />
            </form>
          ) : (
            <h2 className="text-xl leading-snug font-semibold">
              {item.externalKey && <span className="mr-2 font-mono text-sm text-muted-foreground">{item.externalKey}</span>}
              {item.title}
              {state.me.isFacilitator && (
                <button type="button" onClick={() => { setTitle(item.title); setEditing(true); }} className="ml-2 text-primary" aria-label="Edit title">
                  <Pencil className="inline size-4" />
                </button>
              )}
            </h2>
          )}
          {item.description && <p className="mt-1 text-sm whitespace-pre-wrap text-muted-foreground">{item.description}</p>}
          {item.url && (
            <a href={item.url} target="_blank" rel="noreferrer" className="mt-1 inline-flex items-center gap-1 text-sm text-primary hover:underline">
              Open in {item.externalSource ?? "source"} <ExternalLink className="size-3" />
            </a>
          )}
        </div>
        {item.phase === "review" && (
          <span className="flex min-w-16 items-center justify-center rounded-2xl bg-primary px-3 py-2 text-2xl font-bold text-primary-foreground">{item.finalEstimate ?? item.average ?? "–"}</span>
        )}
      </div>
    </div>
  );
}

function ReviewPanel({ item }: { item: EstimationItemDTO }) {
  const { state, op } = useMeeting();
  const cards = state.meeting.deck?.cards ?? [];
  const [value, setValue] = useState(item.finalEstimate ?? "");
  const counts = cards.map((c) => ({ card: c, n: item.votes?.filter((v) => v.value === c.label).length ?? 0 }));
  const max = Math.max(1, ...counts.map((c) => c.n));
  return (
    <div className="rounded-3xl border bg-card p-5">
      <div className="flex items-end gap-1.5">
        {counts.map(({ card, n }, i) => (
          <div key={card.label} className="flex flex-1 flex-col items-center gap-1">
            <span className="text-xs font-semibold tabular-nums">{n || ""}</span>
            <div className="w-full rounded-t-md" style={{ height: `${(n / max) * 80 + 2}px`, background: n ? CARD_COLORS[i % CARD_COLORS.length] : "var(--muted)" }} />
            <span className="text-xs text-muted-foreground">{card.label}</span>
          </div>
        ))}
      </div>
      <div className="mt-4 flex flex-wrap items-center gap-3 border-t pt-4 text-sm">
        <span className="text-muted-foreground">Average {item.average ?? "–"}</span>
        {state.me.isFacilitator ? (
          <>
            <span className="ml-auto text-muted-foreground">Final estimate</span>
            <form onSubmit={(e) => { e.preventDefault(); void op("estimation.update", { id: item.id, finalEstimate: value || null }); }} className="flex gap-1">
              <Input value={value} onChange={(e) => setValue(e.target.value)} className="h-8 w-20 text-center font-semibold" />
              <Button size="sm" type="submit"><Check /></Button>
            </form>
            <div className="flex gap-1">
              {cards.filter((c) => !c.special).slice(0, 10).map((c) => (
                <button key={c.label} type="button" onClick={() => { setValue(c.label); void op("estimation.update", { id: item.id, finalEstimate: c.label }); }} className={cn("rounded-md border px-1.5 text-xs", item.finalEstimate === c.label && "border-primary bg-primary/10")}>
                  {c.label}
                </button>
              ))}
            </div>
            <Button size="sm" variant="ghost" onClick={() => void op("estimation.revote", { itemId: item.id })}>
              <RotateCcw /> Re-vote
            </Button>
          </>
        ) : (
          <span className="ml-auto">Final estimate <strong>{item.finalEstimate ?? "–"}</strong></span>
        )}
      </div>
    </div>
  );
}

function VoterRow({ item }: { item: EstimationItemDTO }) {
  const { state } = useMeeting();
  const voters = state.participants.filter((p) => ["facilitator", "participant", "guest"].includes(p.role) && !p.absent);
  const cards = state.meeting.deck?.cards ?? [];
  return (
    <div className="no-print flex flex-wrap justify-center gap-3 px-4 py-3">
      {voters.map((p) => {
        const voted = item.votedParticipantIds.includes(p.id);
        const v = item.votes?.find((x) => x.participantId === p.id)?.value;
        const anonValue = item.votes && !v && voted ? item.votes[item.votedParticipantIds.indexOf(p.id)]?.value : undefined;
        const val = v ?? anonValue;
        const ci = cards.findIndex((c) => c.label === val);
        return (
          <div key={p.id} className="flex flex-col items-center gap-1">
            <div
              className={cn("relative flex h-16 w-12 items-center justify-center rounded-xl border-2 text-lg font-bold transition-all", voted ? "border-transparent text-white shadow-md" : "border-dashed text-muted-foreground")}
              style={voted ? { background: val ? CARD_COLORS[Math.max(0, ci) % CARD_COLORS.length] : "linear-gradient(135deg, var(--primary), color-mix(in oklab, var(--primary) 60%, black))" } : undefined}
              title={p.name}
            >
              {item.phase === "review" ? (val === "☕" ? <Coffee className="size-5" /> : val === "?" ? <HelpCircle className="size-5" /> : val ?? "") : voted ? <Check className="size-5" /> : ""}
            </div>
            <UserAvatar name={p.name} color={p.color} src={p.avatarUrl} size={22} />
          </div>
        );
      })}
    </div>
  );
}

function CardDeck({ item }: { item: EstimationItemDTO }) {
  const { state, op } = useMeeting();
  const cards = state.meeting.deck?.cards ?? [];
  if (!state.me.canContribute) return null;
  return (
    <div className="no-print flex justify-center overflow-x-auto border-t bg-background/80 px-4 pt-4 pb-3 backdrop-blur">
      <div className="flex gap-1.5">
        {cards.map((c, i) => {
          const mine = item.myVote === c.label;
          return (
            <button
                  key={c.label}
                  type="button"
                  onClick={() => void op("estimation.vote", { itemId: item.id, value: mine ? null : c.label })}
                  onContextMenu={(e) => e.preventDefault()}
                  className={cn("flex h-20 w-14 shrink-0 flex-col items-start justify-between rounded-xl p-2 text-left text-lg font-bold text-white shadow-md transition hover:-translate-y-2", mine && "-translate-y-4 ring-4 ring-primary/50")}
                  style={{ background: c.special ? "#334155" : CARD_COLORS[i % CARD_COLORS.length] }}
                  title={c.special === "coffee" ? "Need a break" : c.special === "unsure" ? "Unsure" : c.description}
                >
                  {c.special === "coffee" ? <Coffee className="size-5" /> : c.special === "unsure" ? <HelpCircle className="size-5" /> : c.label}
                  {c.description && <span className="line-clamp-2 text-[9px] font-normal opacity-80">{c.description}</span>}
                </button>
          );
        })}
      </div>
    </div>
  );
}
