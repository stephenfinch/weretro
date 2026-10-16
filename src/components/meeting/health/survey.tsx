"use client";

import { useEffect, useRef, useState } from "react";
import { Check, Lock, LockOpen } from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import type { HealthDTO, HealthDimensionDTO } from "@/lib/meeting-types";
import { useMeeting } from "../use-meeting";
import { contributors } from "../helpers";
import { HEALTH_COLORS } from "./radar";

export const HAPPY3 = ["😞", "😐", "😄"];
export const HAPPY5 = ["😡", "🙁", "😐", "🙂", "😄"];
export const LIKERT = ["Strongly disagree", "Disagree", "Neutral", "Agree", "Strongly agree"];
export const FAVOR = ["Unfavorable", "Neutral", "Favorable"];

export function scaleColor(i: number, n: number) {
  const t = n <= 1 ? 1 : i / (n - 1);
  return HEALTH_COLORS[Math.round(t * (HEALTH_COLORS.length - 1))];
}

export function ratingLabel(model: HealthDTO["model"], dim: HealthDimensionDTO, value: number) {
  const n = model.maxRating - model.minRating + 1;
  const i = value - model.minRating;
  if (model.style === "matrix") return dim.valueLabels?.[i] ?? String(value);
  if (model.style === "happiness") return (n === 3 ? HAPPY3 : HAPPY5)[i] ?? String(value);
  if (model.style === "likert") return (model.valueLabels ?? LIKERT)[i] ?? String(value);
  if (model.style === "favorability") return (model.valueLabels ?? FAVOR)[i] ?? String(value);
  return String(value);
}

export function RatingControl({ model, dim, value, notApplicable, onRate, disabled, size = "md" }: { model: HealthDTO["model"]; dim: HealthDimensionDTO; value: number | null; notApplicable?: boolean; onRate: (v: number | null, na?: boolean) => void; disabled?: boolean; size?: "sm" | "md" }) {
  const n = model.maxRating - model.minRating + 1;
  let values = Array.from({ length: n }, (_, i) => model.minRating + i);
  if (model.flipOrder) values = [...values].reverse();
  const style = model.style;
  if (style === "matrix") {
    return (
      <div className="grid gap-1.5">
        {values.map((v) => {
          const i = v - model.minRating;
          const on = value === v;
          return (
            <button
              key={v}
              type="button"
              disabled={disabled}
              onClick={() => onRate(on ? null : v)}
              className={cn("flex items-center gap-3 rounded-xl border px-3 py-2 text-left text-sm transition", on ? "border-transparent text-white" : "hover:bg-muted")}
              style={on ? { background: scaleColor(i, n) } : undefined}
            >
              <span className="flex size-6 shrink-0 items-center justify-center rounded-full border text-xs font-semibold" style={!on ? { borderColor: scaleColor(i, n), color: scaleColor(i, n) } : { borderColor: "white" }}>
                {v}
              </span>
              {dim.valueLabels?.[i] ?? ""}
            </button>
          );
        })}
        {model.notApplicableOption && (
          <button type="button" disabled={disabled} onClick={() => onRate(null, !notApplicable)} className={cn("rounded-xl border px-3 py-2 text-left text-sm", notApplicable ? "bg-muted font-medium" : "hover:bg-muted")}>
            Not applicable
          </button>
        )}
      </div>
    );
  }
  return (
    <div className="space-y-1.5">
      <div className="flex flex-wrap items-center gap-2">
        {values.map((v) => {
          const i = v - model.minRating;
          const on = value === v;
          const color = scaleColor(i, n);
          const label = style === "happiness" ? (n === 3 ? HAPPY3 : HAPPY5)[i] : style === "likert" ? (model.valueLabels ?? LIKERT)[i] : style === "favorability" ? (model.valueLabels ?? FAVOR)[i] : String(v);
          const wide = style === "likert" || style === "favorability";
          return (
            <button
              key={v}
              type="button"
              disabled={disabled}
              onClick={() => onRate(on ? null : v)}
              title={label}
              className={cn(
                "flex items-center justify-center rounded-xl border-2 font-semibold transition hover:scale-105 disabled:hover:scale-100",
                wide ? "h-10 flex-1 px-2 text-xs" : size === "sm" ? "size-9 text-sm" : "size-12 text-lg",
                style === "happiness" && (size === "sm" ? "text-xl" : "text-2xl"),
                on ? "text-white shadow-md" : "bg-background",
                !on && value !== null && "opacity-50",
              )}
              style={{ borderColor: color, ...(on ? { background: color } : { color }) }}
            >
              {label}
            </button>
          );
        })}
        {model.notApplicableOption && (
          <button type="button" disabled={disabled} onClick={() => onRate(null, !notApplicable)} className={cn("h-10 rounded-xl border-2 px-3 text-xs font-semibold", notApplicable ? "border-foreground bg-foreground text-background" : "text-muted-foreground")}>
            N/A
          </button>
        )}
      </div>
      {(dim.minLabel || dim.maxLabel) && style !== "likert" && style !== "favorability" && (
        <div className="flex justify-between gap-4 text-[11px] font-semibold tracking-wide text-muted-foreground uppercase">
          <span>{model.flipOrder ? dim.maxLabel : dim.minLabel}</span>
          <span className="text-right">{model.flipOrder ? dim.minLabel : dim.maxLabel}</span>
        </div>
      )}
    </div>
  );
}

function SurveyComment({ dim, disabled }: { dim: HealthDimensionDTO; disabled?: boolean }) {
  const { op } = useMeeting();
  const [text, setText] = useState(dim.myRating?.comment ?? "");
  const [saved, setSaved] = useState(false);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  useEffect(() => () => void (timer.current && clearTimeout(timer.current)), []);
  return (
    <div className="relative">
      <textarea
        value={text}
        disabled={disabled}
        rows={1}
        onChange={(e) => {
          setText(e.target.value);
          setSaved(false);
          if (timer.current) clearTimeout(timer.current);
          const v = e.target.value;
          timer.current = setTimeout(async () => {
            const r = await op("health.rate", { dimensionId: dim.id, comment: v });
            if (r.ok) setSaved(true);
          }, 800);
        }}
        placeholder="Additional comments…"
        className="w-full resize-none rounded-xl border bg-background/60 px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-ring/30"
      />
      {saved && <span className="absolute top-2 right-3 text-[10px] font-semibold text-emerald-600 uppercase">Saved</span>}
    </div>
  );
}

export function HealthSurveyStep() {
  const { state, op } = useMeeting();
  const health = state.health;
  if (!health) return <p className="p-10 text-center text-muted-foreground">This health check has no model.</p>;
  const anon = state.meeting.options.healthAnonymous !== false;
  const me = state.participants.find((p) => p.isMe);
  const finished = !!me?.finishedSteps.includes("healthSurvey");
  const rated = health.dimensions.filter((d) => d.myRating && (d.myRating.value !== null || d.myRating.notApplicable)).length;
  const people = contributors(state);
  const remaining = people.filter((p) => !p.finishedSteps.includes("healthSurvey")).length;
  const groups = health.model.groups.length > 1 ? health.model.groups : [{ id: null as string | null, name: "", description: "" }];
  const canRate = state.me.canContribute;
  return (
    <div className="h-full overflow-y-auto px-4 pb-24 scrollbar-thin">
      <div className="mx-auto max-w-3xl space-y-6 pt-6">
        <div className="flex items-center gap-3 rounded-2xl border bg-card p-4">
          {anon ? <Lock className="size-5 text-emerald-500" /> : <LockOpen className="size-5 text-amber-500" />}
          <div className="text-sm">
            <p className="font-medium">{anon ? "Your ratings are anonymous" : "Your responses are not anonymous"}</p>
            <p className="text-muted-foreground">{anon ? "Nobody can see who gave which rating or comment." : "Ratings and comments will be shown with names during the discussion."}</p>
          </div>
          <span className="ml-auto text-sm font-medium tabular-nums">
            {rated}/{health.dimensions.length}
          </span>
        </div>
        {groups.map((g) => {
          const dims = g.id ? health.dimensions.filter((d) => d.groupId === g.id) : health.dimensions;
          return (
            <section key={g.id ?? "all"} className="space-y-3">
              {g.name && (
                <div>
                  <h2 className="text-lg font-semibold">{g.name}</h2>
                  {g.description && <p className="text-sm text-muted-foreground">{g.description}</p>}
                </div>
              )}
              {dims.map((d) => (
                <div key={d.id} className={cn("space-y-3 rounded-2xl border bg-card p-5 transition", d.myRating && (d.myRating.value !== null || d.myRating.notApplicable) && "border-emerald-500/40")}>
                  <div className="flex items-start gap-2">
                    <div className="min-w-0 flex-1">
                      <h3 className="font-semibold">{d.name}</h3>
                      {d.description && <p className="text-sm text-muted-foreground">{d.description}</p>}
                    </div>
                    {d.myRating && (d.myRating.value !== null || d.myRating.notApplicable) && <Check className="size-5 text-emerald-500" />}
                  </div>
                  <RatingControl
                    model={health.model}
                    dim={d}
                    value={d.myRating?.value ?? null}
                    notApplicable={d.myRating?.notApplicable}
                    disabled={!canRate}
                    onRate={(v, na) => void op("health.rate", { dimensionId: d.id, value: v, notApplicable: !!na })}
                  />
                  {state.meeting.options.surveyComments !== false && canRate && <SurveyComment dim={d} disabled={!canRate} />}
                </div>
              ))}
            </section>
          );
        })}
        <div className="flex flex-col items-center gap-3 py-6 text-center">
          {canRate && (
            <Button size="lg" variant={finished ? "secondary" : "default"} onClick={() => void op("step.finish", { step: "healthSurvey", finished: !finished })}>
              <Check /> {finished ? "Finished — click to keep editing" : "I'm finished"}
            </Button>
          )}
          <p className="text-sm text-muted-foreground">
            {!canRate
              ? remaining
                ? `Waiting for ${remaining} ${remaining === 1 ? "participant" : "participants"} to finish`
                : "Everyone has finished. Waiting for the facilitator to move on."
              : !finished
                ? `Waiting for ${remaining} ${remaining === 1 ? "participant" : "participants"} to finish, including you.`
                : remaining
                  ? `Nice job! Waiting for ${remaining} ${remaining === 1 ? "participant" : "participants"} to finish`
                  : "Nice job! Waiting for the facilitator to move to the next step."}
          </p>
          {state.me.isFacilitator && (
            <Button
              variant="outline"
              onClick={() => {
                const idx = state.meeting.steps.findIndex((s, i) => i > state.meeting.stepIndex && s.enabled);
                if (idx >= 0) void op("step.goto", { index: idx });
              }}
            >
              Move to discussion
            </Button>
          )}
        </div>
      </div>
    </div>
  );
}
