"use client";

import type { HealthDTO } from "@/lib/meeting-types";

export const HEALTH_COLORS = ["#E5484D", "#F76B15", "#F5B800", "#99C21F", "#30A46C"];

export function ratingColor(value: number | null | undefined, min: number, max: number) {
  if (value === null || value === undefined) return "#94A3B8";
  const t = max === min ? 1 : (value - min) / (max - min);
  const idx = Math.min(HEALTH_COLORS.length - 1, Math.max(0, Math.round(t * (HEALTH_COLORS.length - 1))));
  return HEALTH_COLORS[idx];
}

type Axis = { id: string; name: string; values: number[]; mean: number | null; median: number | null; mode: number | null; stdDev: number | null; min: number | null; max: number | null; score: number | null; distribution: number[]; previous?: number | null };

export function HealthRadar({ health, layers = ["mean", "distribution"], size = 440, showPrevious }: { health: HealthDTO; layers?: string[]; size?: number; showPrevious?: boolean }) {
  const { minRating: lo, maxRating: hi } = health.model;
  const axes: Axis[] = health.dimensions.map((d) => ({
    id: d.id,
    name: d.name,
    values: (d.results?.individual ?? []).map((r) => r.value).filter((v): v is number => v !== null),
    mean: d.results?.mean ?? null,
    median: d.results?.median ?? null,
    mode: d.results?.mode ?? null,
    stdDev: d.results?.stdDev ?? null,
    min: d.results?.min ?? null,
    max: d.results?.max ?? null,
    score: d.results?.score ?? null,
    distribution: d.results?.distribution ?? [],
    previous: health.previous[d.id] ?? null,
  }));
  if (axes.length < 3) return <p className="py-8 text-center text-sm text-muted-foreground">At least 3 dimensions are needed to draw the radar.</p>;
  const pad = 90;
  const W = size + pad * 2;
  const c = W / 2;
  const R = size / 2 - 10;
  const n = axes.length;
  const angle = (i: number) => (Math.PI * 2 * i) / n - Math.PI / 2;
  const r = (v: number) => ((v - lo + 1) / (hi - lo + 1)) * R;
  const pt = (i: number, v: number) => [c + Math.cos(angle(i)) * r(v), c + Math.sin(angle(i)) * r(v)] as const;
  const poly = (vals: (number | null)[]) =>
    vals
      .map((v, i) => (v === null ? null : pt(i, v)))
      .filter(Boolean)
      .map((p) => p!.join(","))
      .join(" ");
  const levels = Array.from({ length: hi - lo + 1 }, (_, i) => lo + i);
  return (
    <svg viewBox={`0 0 ${W} ${W}`} className="mx-auto w-full max-w-[560px]" role="img" aria-label="Health radar">
      {levels.map((lv) => (
        <polygon key={lv} points={axes.map((_, i) => pt(i, lv).join(",")).join(" ")} fill="none" stroke="currentColor" strokeOpacity={0.12} />
      ))}
      {axes.map((a, i) => {
        const [x, y] = pt(i, hi);
        const [lx, ly] = [c + Math.cos(angle(i)) * (R + 18), c + Math.sin(angle(i)) * (R + 18)];
        const anchor = Math.abs(Math.cos(angle(i))) < 0.2 ? "middle" : Math.cos(angle(i)) > 0 ? "start" : "end";
        return (
          <g key={a.id}>
            <line x1={c} y1={c} x2={x} y2={y} stroke="currentColor" strokeOpacity={0.12} />
            <text x={lx} y={ly} textAnchor={anchor} dominantBaseline="middle" fontSize={12} fill="currentColor" fillOpacity={0.75}>
              {a.name.length > 22 ? `${a.name.slice(0, 21)}…` : a.name}
            </text>
          </g>
        );
      })}
      {layers.includes("distribution") &&
        axes.map((a, i) =>
          a.distribution.map((count, k) => {
            if (!count) return null;
            const v = lo + k;
            const [x, y] = pt(i, v);
            const total = a.distribution.reduce((s, x2) => s + x2, 0) || 1;
            return <circle key={`${a.id}-${k}`} cx={x} cy={y} r={4 + (count / total) * 14} fill={ratingColor(v, lo, hi)} fillOpacity={0.35} />;
          }),
        )}
      {layers.includes("range") && <polygon points={poly(axes.map((a) => a.max))} fill="var(--primary)" fillOpacity={0.08} stroke="var(--primary)" strokeOpacity={0.3} strokeDasharray="4 3" />}
      {layers.includes("range") && <polygon points={poly(axes.map((a) => a.min))} fill="var(--background)" fillOpacity={0.6} stroke="var(--primary)" strokeOpacity={0.3} strokeDasharray="4 3" />}
      {layers.includes("standardDeviation") && (
        <>
          <polygon points={poly(axes.map((a) => (a.mean !== null && a.stdDev !== null ? Math.min(hi, a.mean + a.stdDev) : null)))} fill="var(--primary)" fillOpacity={0.1} stroke="none" />
          <polygon points={poly(axes.map((a) => (a.mean !== null && a.stdDev !== null ? Math.max(lo, a.mean - a.stdDev) : null)))} fill="var(--background)" fillOpacity={0.5} stroke="none" />
        </>
      )}
      {layers.includes("individual") &&
        axes.map((a, i) =>
          a.values.map((v, k) => {
            const [x, y] = pt(i, v);
            return <circle key={`${a.id}-i${k}`} cx={x + ((k % 5) - 2) * 2} cy={y + ((k % 3) - 1) * 2} r={3} fill={ratingColor(v, lo, hi)} />;
          }),
        )}
      {showPrevious && axes.some((a) => a.previous !== null) && <polygon points={poly(axes.map((a) => a.previous ?? null))} fill="none" stroke="currentColor" strokeOpacity={0.4} strokeDasharray="5 4" strokeWidth={1.5} />}
      {layers.includes("median") && <polygon points={poly(axes.map((a) => a.median))} fill="none" stroke="#14B8A6" strokeWidth={2} />}
      {layers.includes("mode") && <polygon points={poly(axes.map((a) => a.mode))} fill="none" stroke="#F59E0B" strokeWidth={2} strokeDasharray="2 3" />}
      {layers.includes("score") && <polygon points={poly(axes.map((a) => (a.score === null ? null : lo + ((hi - lo) * a.score) / 100)))} fill="#30A46C" fillOpacity={0.12} stroke="#30A46C" strokeWidth={2} />}
      {layers.includes("mean") && (
        <>
          <polygon points={poly(axes.map((a) => a.mean))} fill="var(--primary)" fillOpacity={0.18} stroke="var(--primary)" strokeWidth={2.5} strokeLinejoin="round" />
          {axes.map((a, i) => {
            if (a.mean === null) return null;
            const [x, y] = pt(i, a.mean);
            return (
              <g key={`m-${a.id}`}>
                <circle cx={x} cy={y} r={5} fill={ratingColor(a.mean, lo, hi)} stroke="var(--background)" strokeWidth={2} />
              </g>
            );
          })}
        </>
      )}
    </svg>
  );
}
