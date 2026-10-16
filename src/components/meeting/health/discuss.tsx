"use client";

import { useMemo, useState } from "react";
import { ArrowDown, ArrowUp, ChevronLeft, ChevronRight, Minus, MessageSquare, X } from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import type { HealthDimensionDTO, HealthDTO } from "@/lib/meeting-types";
import type { HealthDiscussOptions } from "@/lib/types";
import { useMeeting } from "../use-meeting";
import { stepOptions } from "../helpers";
import { HealthRadar, ratingColor } from "./radar";
import { ratingLabel, scaleColor } from "./survey";
import { MeetingActionList } from "../meeting-action-list";
import { CommentThread } from "../comments";

const LAYERS: { key: string; label: string; description: string }[] = [
  { key: "score", label: "Score", description: "Share of responses in the top quarter" },
  { key: "mean", label: "Mean", description: "Average rating for each dimension" },
  { key: "median", label: "Median", description: "Middle rating for each dimension" },
  { key: "mode", label: "Mode", description: "Most common rating" },
  { key: "individual", label: "Individual", description: "Each participant's ratings" },
  { key: "standardDeviation", label: "Standard deviation", description: "±1 standard deviation" },
  { key: "distribution", label: "Distribution", description: "Heat map of all ratings" },
  { key: "range", label: "Range", description: "Highest to lowest rating" },
];

export function sortDimensions(dims: HealthDimensionDTO[], sort: string | undefined) {
  const list = [...dims];
  if (sort === "positive") return list.sort((a, b) => (b.results?.mean ?? -1) - (a.results?.mean ?? -1));
  if (sort === "negative") return list.sort((a, b) => (a.results?.mean ?? 99) - (b.results?.mean ?? 99));
  if (sort === "mixed") return list.sort((a, b) => (b.results?.stdDev ?? -1) - (a.results?.stdDev ?? -1));
  return list;
}

function Trend({ now, prev }: { now: number | null | undefined; prev: number | null | undefined }) {
  if (now === null || now === undefined || prev === null || prev === undefined) return null;
  const d = now - prev;
  if (Math.abs(d) < 0.05) return <span className="inline-flex items-center text-xs text-muted-foreground"><Minus className="size-3" /> 0.0</span>;
  return (
    <span className={cn("inline-flex items-center text-xs font-medium", d > 0 ? "text-emerald-600" : "text-red-500")}>
      {d > 0 ? <ArrowUp className="size-3" /> : <ArrowDown className="size-3" />} {Math.abs(d).toFixed(1)}
    </span>
  );
}

export function DistributionBar({ dim, model }: { dim: HealthDimensionDTO; model: HealthDTO["model"] }) {
  const dist = dim.results?.distribution ?? [];
  const total = dist.reduce((a, b) => a + b, 0);
  if (!total) return <div className="h-2.5 rounded-full bg-muted" />;
  return (
    <div className="flex h-2.5 overflow-hidden rounded-full">
      {dist.map((c, i) =>
        c ? <span key={i} style={{ width: `${(c / total) * 100}%`, background: scaleColor(i, dist.length) }} title={`${ratingLabel(model, dim, model.minRating + i)}: ${c}`} /> : null,
      )}
    </div>
  );
}

export function HealthDiscussStep() {
  const { state, op } = useMeeting();
  const health = state.health;
  const opts = stepOptions<HealthDiscussOptions>(state, "healthDiscuss");
  const [sort, setSort] = useState(opts.sort ?? "negative");
  const [layers, setLayers] = useState<string[]>(opts.layers ?? ["mean", "distribution"]);
  const [focus, setFocus] = useState<string | null>(null);
  const dims = useMemo(() => (health ? sortDimensions(health.dimensions, sort) : []), [health, sort]);
  if (!health) return null;
  const presenting = state.meeting.presenting?.active;
  const focusId = presenting ? state.meeting.presenting?.targetId ?? dims[0]?.id : focus;
  if (focusId) {
    const idx = Math.max(0, dims.findIndex((d) => d.id === focusId));
    const nav = (id: string) => (presenting && state.me.isFacilitator ? void op("present.set", { active: true, targetId: id }) : setFocus(id));
    const canNav = !presenting || state.me.isFacilitator;
    return (
      <div className="h-full overflow-y-auto px-4 pb-32 scrollbar-thin">
        <div className="mx-auto max-w-3xl space-y-5 pt-4">
          <div className="flex items-center gap-2">
            <Button variant="ghost" size="icon" disabled={!canNav || idx === 0} onClick={() => nav(dims[idx - 1].id)} aria-label="Previous"><ChevronLeft /></Button>
            <div className="flex flex-1 justify-center gap-1.5">
              {dims.map((d, i) => (
                <button key={d.id} type="button" disabled={!canNav} onClick={() => nav(d.id)} className={cn("h-2 rounded-full transition-all", i === idx ? "w-6 bg-primary" : "w-2 bg-muted-foreground/30")} aria-label={d.name} />
              ))}
            </div>
            <Button variant="ghost" size="icon" disabled={!canNav || idx === dims.length - 1} onClick={() => nav(dims[idx + 1].id)} aria-label="Next"><ChevronRight /></Button>
            {canNav && (
              <Button variant="ghost" size="icon" onClick={() => (presenting ? void op("present.set", { active: false }) : setFocus(null))} aria-label="Back"><X /></Button>
            )}
          </div>
          <DimensionDetail dim={dims[idx]} health={health} />
        </div>
      </div>
    );
  }
  return (
    <div className="h-full overflow-y-auto px-4 pb-24 scrollbar-thin">
      <div className="mx-auto grid max-w-7xl gap-6 pt-6 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.1fr)]">
        <section className="space-y-3">
          <div className="flex items-center gap-2">
            <h2 className="text-lg font-semibold">{health.model.name}</h2>
            <Popover>
              <PopoverTrigger className="ml-auto rounded-full border px-3 py-1 text-xs font-medium uppercase">Show: {layers.length} layers</PopoverTrigger>
              <PopoverContent align="end" className="w-72 space-y-1">
                {LAYERS.map((l) => (
                  <label key={l.key} className="flex items-start gap-2 rounded-md p-1.5 text-sm hover:bg-muted">
                    <input type="checkbox" className="mt-1" checked={layers.includes(l.key)} onChange={(e) => setLayers((x) => (e.target.checked ? [...x, l.key] : x.filter((k) => k !== l.key)))} />
                    <span>
                      <span className="font-medium">{l.label}</span>
                      <span className="block text-xs text-muted-foreground">{l.description}</span>
                    </span>
                  </label>
                ))}
              </PopoverContent>
            </Popover>
          </div>
          <div className="rounded-2xl border bg-card p-4 text-foreground">
            <HealthRadar health={health} layers={layers} showPrevious />
            {Object.values(health.previous).some((v) => v !== null) && <p className="text-center text-xs text-muted-foreground">Dashed line: previous health check</p>}
          </div>
        </section>
        <section className="space-y-3">
          <div className="flex items-center gap-2">
            <h2 className="text-lg font-semibold">Health dimensions</h2>
            <Select value={sort} onValueChange={(v) => setSort(v as typeof sort)}>
              <SelectTrigger size="sm" className="ml-auto w-48"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="negative">Most negative first</SelectItem>
                <SelectItem value="positive">Most positive first</SelectItem>
                <SelectItem value="mixed">Most mixed first</SelectItem>
                <SelectItem value="original">Original order</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <ul className="space-y-2">
            {dims.map((d) => {
              const actions = state.actions.filter((a) => a.sourceId === d.id && a.kind === "action").length;
              const comments = (d.results?.comments.length ?? 0) + state.comments.filter((c) => c.targetId === d.id).length;
              return (
                <li key={d.id}>
                  <button
                    type="button"
                    onClick={() => (state.me.isFacilitator ? void op("present.set", { active: true, targetId: d.id }) : setFocus(d.id))}
                    className="w-full space-y-2 rounded-2xl border bg-card p-4 text-left transition hover:border-primary/50 hover:shadow-sm"
                  >
                    <div className="flex items-center gap-3">
                      <span className="flex size-11 shrink-0 items-center justify-center rounded-xl text-base font-bold text-white" style={{ background: ratingColor(d.results?.mean, health.model.minRating, health.model.maxRating) }}>
                        {d.results?.mean?.toFixed(1) ?? "–"}
                      </span>
                      <div className="min-w-0 flex-1">
                        <p className="font-medium">{d.name}</p>
                        <p className="truncate text-xs text-muted-foreground">{d.description}</p>
                      </div>
                      <div className="flex flex-col items-end gap-0.5 text-xs text-muted-foreground">
                        <Trend now={d.results?.mean} prev={health.previous[d.id]} />
                        <span>{d.results?.count ?? 0} responses</span>
                      </div>
                    </div>
                    <DistributionBar dim={d} model={health.model} />
                    {(actions > 0 || comments > 0) && (
                      <div className="flex gap-3 text-xs text-muted-foreground">
                        {comments > 0 && <span className="inline-flex items-center gap-1"><MessageSquare className="size-3" /> {comments}</span>}
                        {actions > 0 && <span>{actions} {actions === 1 ? "action" : "actions"}</span>}
                      </div>
                    )}
                  </button>
                </li>
              );
            })}
          </ul>
        </section>
      </div>
    </div>
  );
}

function DimensionDetail({ dim, health }: { dim: HealthDimensionDTO; health: HealthDTO }) {
  const { state } = useMeeting();
  const r = dim.results;
  const n = health.model.maxRating - health.model.minRating + 1;
  const total = r?.count ?? 0;
  return (
    <div className="space-y-5">
      <div className="rounded-3xl border bg-card p-6 shadow-sm">
        <div className="flex items-start gap-4">
          <span className="flex size-16 shrink-0 items-center justify-center rounded-2xl text-2xl font-bold text-white" style={{ background: ratingColor(r?.mean, health.model.minRating, health.model.maxRating) }}>
            {r?.mean?.toFixed(1) ?? "–"}
          </span>
          <div className="min-w-0 flex-1">
            <h2 className="text-2xl font-semibold">{dim.name}</h2>
            <p className="text-muted-foreground">{dim.description}</p>
            <div className="mt-1 flex gap-3 text-sm text-muted-foreground">
              <Trend now={r?.mean} prev={health.previous[dim.id]} />
              <span>Score {r?.score ?? "–"}%</span>
              <span>Median {r?.median ?? "–"}</span>
              <span>σ {r?.stdDev?.toFixed(2) ?? "–"}</span>
              {!!r?.notApplicable && <span>{r.notApplicable} N/A</span>}
            </div>
          </div>
        </div>
        <div className="mt-5 space-y-1.5">
          {Array.from({ length: n }, (_, i) => {
            const v = health.model.minRating + i;
            const c = r?.distribution[i] ?? 0;
            return (
              <div key={v} className="flex items-center gap-3 text-sm">
                <span className="w-40 shrink-0 truncate text-right text-muted-foreground">{ratingLabel(health.model, dim, v)}</span>
                <span className="h-5 flex-1 overflow-hidden rounded-md bg-muted">
                  <span className="block h-full rounded-md" style={{ width: `${total ? (c / total) * 100 : 0}%`, background: scaleColor(i, n) }} />
                </span>
                <span className="w-6 text-right font-medium tabular-nums">{c}</span>
              </div>
            );
          })}
        </div>
      </div>
      {!!r?.comments.length && (
        <section className="space-y-2">
          <h3 className="text-sm font-semibold text-muted-foreground">Survey responses</h3>
          {r.comments.map((c, i) => (
            <p key={i} className="rounded-xl bg-muted/70 px-3 py-2 text-sm">
              {c.name && <span className="font-medium">{c.name}: </span>}
              {c.text}
            </p>
          ))}
        </section>
      )}
      <section className="space-y-2">
        <h3 className="text-sm font-semibold text-muted-foreground">Actions</h3>
        <MeetingActionList kind="action" items={state.actions.filter((a) => a.kind === "action" && a.sourceId === dim.id)} source={{ type: "dimension", id: dim.id }} />
      </section>
      {state.meeting.options.comments !== false && (
        <section className="space-y-2">
          <h3 className="text-sm font-semibold text-muted-foreground">Comments</h3>
          <CommentThread targetType="dimension" targetId={dim.id} />
        </section>
      )}
    </div>
  );
}
