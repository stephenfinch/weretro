"use client";

import { useMemo, useRef, useState } from "react";
import { Eraser, Trophy } from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { UserAvatar } from "@/components/user-avatar";
import type { IcebreakerEntryDTO, ParticipantDTO } from "@/lib/meeting-types";
import type { IcebreakerState } from "@/lib/types";
import { useMeeting } from "../use-meeting";

export type Game = {
  ib: IcebreakerState;
  data: Record<string, unknown>;
  phase: string;
  round: number;
  entries: IcebreakerEntryDTO[];
  players: ParticipantDTO[];
  me: ParticipantDTO | undefined;
  isFac: boolean;
  set: (patch: Partial<IcebreakerState> & { clearEntries?: boolean; clearRound?: number }) => Promise<unknown>;
  setData: (patch: Record<string, unknown>, extra?: Partial<IcebreakerState> & { clearEntries?: boolean }) => Promise<unknown>;
  submit: (kind: string, payload: Record<string, unknown>, opts?: { replace?: boolean; round?: number }) => Promise<unknown>;
  name: (pid: string | null | undefined) => string;
  color: (pid: string | null | undefined) => string;
  mine: (kind: string, round?: number) => IcebreakerEntryDTO[];
  of: (kind: string, round?: number) => IcebreakerEntryDTO[];
};

export function useGame(): Game {
  const { state, op } = useMeeting();
  const ib = state.meeting.icebreaker ?? { mode: "game" };
  const data = (ib.data ?? {}) as Record<string, unknown>;
  const round = ib.round ?? 0;
  const players = state.participants.filter((p) => ["facilitator", "participant", "guest", "facilitatorOnly"].includes(p.role) && !p.absent && !p.invited);
  const me = state.participants.find((p) => p.isMe);
  const nicks = useMemo(() => {
    const m = new Map<string, string>();
    for (const e of state.icebreakerEntries) if (e.kind === "nick") m.set(e.participantId, String(e.payload.name ?? ""));
    return m;
  }, [state.icebreakerEntries]);
  const name = (pid: string | null | undefined) => (pid ? nicks.get(pid) || state.participants.find((p) => p.id === pid)?.name || "Someone" : "Someone");
  const color = (pid: string | null | undefined) => state.participants.find((p) => p.id === pid)?.color ?? "#94A3B8";
  return {
    ib,
    data,
    phase: ib.phase ?? "lobby",
    round,
    entries: state.icebreakerEntries,
    players,
    me,
    isFac: state.me.isFacilitator,
    set: (patch) => op("icebreaker.set", patch as Record<string, unknown>),
    setData: (patch, extra = {}) => op("icebreaker.set", { data: { ...data, ...patch }, ...extra }),
    submit: (kind, payload, opts = {}) => op("icebreaker.entry", { kind, payload, round: opts.round ?? round, replace: opts.replace ?? false }),
    name,
    color,
    mine: (kind, r = round) => state.icebreakerEntries.filter((e) => e.mine && e.kind === kind && e.round === r),
    of: (kind, r = round) => state.icebreakerEntries.filter((e) => e.kind === kind && e.round === r),
  };
}

export function shuffle<T>(list: T[]): T[] {
  const a = [...list];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

export function pickIndexes(n: number, total: number) {
  return shuffle(Array.from({ length: total }, (_, i) => i)).slice(0, n);
}

export function Stage({ title, subtitle, children, controls }: { title: string; subtitle?: React.ReactNode; children: React.ReactNode; controls?: React.ReactNode }) {
  return (
    <div className="mx-auto w-full max-w-3xl space-y-5">
      <div className="text-center">
        <h2 className="text-2xl font-semibold text-balance">{title}</h2>
        {subtitle && <p className="mt-1 text-muted-foreground">{subtitle}</p>}
      </div>
      {children}
      {controls && <div className="flex flex-wrap justify-center gap-2 pt-2">{controls}</div>}
    </div>
  );
}

export function Waiting({ done, total, label = "submitted" }: { done: number; total: number; label?: string }) {
  return (
    <p className="text-center text-sm text-muted-foreground">
      {done}/{total} {label}
    </p>
  );
}

export function PlayerChip({ pid, g, highlight, children }: { pid: string; g: Game; highlight?: boolean; children?: React.ReactNode }) {
  return (
    <span className={cn("inline-flex items-center gap-1.5 rounded-full border bg-card py-1 pr-3 pl-1 text-sm", highlight && "border-primary bg-primary/10")}>
      <UserAvatar name={g.name(pid)} color={g.color(pid)} size={22} />
      {g.name(pid)}
      {children}
    </span>
  );
}

export function Scoreboard({ scores, g }: { scores: Record<string, number>; g: Game }) {
  const list = Object.entries(scores).sort((a, b) => b[1] - a[1]);
  if (!list.length) return null;
  return (
    <div className="mx-auto max-w-sm rounded-2xl border bg-card p-4">
      <p className="mb-2 flex items-center gap-2 text-sm font-semibold"><Trophy className="size-4 text-amber-500" /> Leaderboard</p>
      <ol className="space-y-1">
        {list.map(([pid, s], i) => (
          <li key={pid} className="flex items-center gap-2 text-sm">
            <span className="w-5 text-muted-foreground">{i + 1}.</span>
            <UserAvatar name={g.name(pid)} color={g.color(pid)} size={20} />
            <span className="flex-1 truncate">{g.name(pid)}</span>
            <span className="font-semibold tabular-nums">{s}</span>
          </li>
        ))}
      </ol>
    </div>
  );
}

export function TextSubmit({ placeholder, onSubmit, disabled, button = "Submit", multiline }: { placeholder: string; onSubmit: (t: string) => void; disabled?: boolean; button?: string; multiline?: boolean }) {
  const [t, setT] = useState("");
  return (
    <form
      className="mx-auto flex max-w-xl gap-2"
      onSubmit={(e) => {
        e.preventDefault();
        if (!t.trim()) return;
        onSubmit(t.trim());
        setT("");
      }}
    >
      {multiline ? (
        <textarea value={t} onChange={(e) => setT(e.target.value)} placeholder={placeholder} disabled={disabled} rows={3} className="flex-1 rounded-xl border bg-background px-3 py-2 text-sm" />
      ) : (
        <Input value={t} onChange={(e) => setT(e.target.value)} placeholder={placeholder} disabled={disabled} className="h-10" />
      )}
      <Button type="submit" disabled={disabled || !t.trim()}>{button}</Button>
    </form>
  );
}

export type Stroke = { points: [number, number][]; color: string; width: number };
const PEN_COLORS = ["#111827", "#EF4444", "#F59E0B", "#22C55E", "#3B82F6", "#8B5CF6", "#EC4899", "#ffffff"];

/** A shared drawing surface. Strokes are stored as icebreaker entries. */
export function DrawPad({ strokes, onStroke, readOnly, className, onClear }: { strokes: Stroke[]; onStroke?: (s: Stroke) => void; readOnly?: boolean; className?: string; onClear?: () => void }) {
  const ref = useRef<SVGSVGElement>(null);
  const [current, setCurrent] = useState<Stroke | null>(null);
  const [color, setColor] = useState(PEN_COLORS[0]);
  const [width, setWidth] = useState(3);
  const point = (e: React.PointerEvent): [number, number] => {
    const r = ref.current!.getBoundingClientRect();
    return [Math.round(((e.clientX - r.left) / r.width) * 1000) / 1000, Math.round(((e.clientY - r.top) / r.height) * 1000) / 1000];
  };
  const path = (s: Stroke) => s.points.map((p, i) => `${i ? "L" : "M"}${p[0] * 800} ${p[1] * 500}`).join(" ");
  return (
    <div className={cn("space-y-2", className)}>
      <svg
        ref={ref}
        viewBox="0 0 800 500"
        className={cn("aspect-[8/5] w-full touch-none rounded-2xl border bg-white", !readOnly && "cursor-crosshair")}
        onPointerDown={(e) => {
          if (readOnly) return;
          (e.target as Element).setPointerCapture?.(e.pointerId);
          setCurrent({ points: [point(e)], color, width });
        }}
        onPointerMove={(e) => current && setCurrent({ ...current, points: [...current.points, point(e)] })}
        onPointerUp={() => {
          if (current && current.points.length > 1) onStroke?.(current);
          setCurrent(null);
        }}
      >
        {[...strokes, ...(current ? [current] : [])].map((s, i) => (
          <path key={i} d={path(s)} stroke={s.color} strokeWidth={s.width} fill="none" strokeLinecap="round" strokeLinejoin="round" />
        ))}
      </svg>
      {!readOnly && (
        <div className="flex flex-wrap items-center justify-center gap-1.5">
          {PEN_COLORS.map((c) => (
            <button key={c} type="button" onClick={() => setColor(c)} className={cn("size-6 rounded-full border", color === c && "ring-2 ring-primary ring-offset-2 ring-offset-background")} style={{ background: c }} aria-label={c} />
          ))}
          {[2, 4, 8].map((w) => (
            <button key={w} type="button" onClick={() => setWidth(w)} className={cn("flex size-7 items-center justify-center rounded-md border", width === w && "border-primary")}>
              <span className="rounded-full bg-foreground" style={{ width: w + 2, height: w + 2 }} />
            </button>
          ))}
          {onClear && (
            <Button size="xs" variant="ghost" onClick={onClear}><Eraser /> Clear mine</Button>
          )}
        </div>
      )}
    </div>
  );
}

export function strokesFrom(entries: IcebreakerEntryDTO[], filter: (e: IcebreakerEntryDTO) => boolean = () => true): Stroke[] {
  return entries.filter((e) => e.kind === "stroke" && filter(e)).map((e) => e.payload as unknown as Stroke);
}

export const norm = (s: string) => s.toLowerCase().replace(/[^a-z0-9]+/g, " ").trim();
