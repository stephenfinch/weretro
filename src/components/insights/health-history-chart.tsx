"use client";

import { useState } from "react";
import { CartesianGrid, Legend, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";

const COLORS = ["#6366F1", "#22C55E", "#F97316", "#EC4899", "#06B6D4", "#EAB308", "#8B5CF6", "#EF4444", "#14B8A6", "#64748B", "#A855F7", "#84CC16"];

export function HealthHistoryChart({ dimensions, points, min = 1, max = 5 }: { dimensions: { id: string; name: string }[]; points: { date: string; values: Record<string, number | null>; overall: number | null }[]; min?: number; max?: number }) {
  const [mode, setMode] = useState<"overall" | "dimensions">("overall");
  const data = points.map((p) => ({ date: p.date, overall: p.overall, ...Object.fromEntries(dimensions.map((d) => [d.name, p.values[d.id]])) }));
  if (!data.length) return <p className="py-10 text-center text-sm text-muted-foreground">No completed health checks yet.</p>;
  return (
    <div className="space-y-2">
      <div className="flex justify-end gap-1 text-xs">
        {(["overall", "dimensions"] as const).map((m) => (
          <button key={m} type="button" onClick={() => setMode(m)} className={`rounded-full px-2.5 py-1 capitalize ${mode === m ? "bg-primary text-primary-foreground" : "bg-muted"}`}>
            {m}
          </button>
        ))}
      </div>
      <div className="h-72">
        <ResponsiveContainer width="100%" height="100%">
          <LineChart data={data} margin={{ left: -20, right: 10, top: 10 }}>
            <CartesianGrid strokeDasharray="3 3" strokeOpacity={0.2} />
            <XAxis dataKey="date" fontSize={11} tickMargin={6} />
            <YAxis domain={[min, max]} fontSize={11} allowDecimals={false} />
            <Tooltip contentStyle={{ background: "var(--popover)", border: "1px solid var(--border)", borderRadius: 12, fontSize: 12 }} />
            {mode === "overall" ? (
              <Line type="monotone" dataKey="overall" name="Overall" stroke="var(--primary)" strokeWidth={3} dot={{ r: 4 }} />
            ) : (
              dimensions.map((d, i) => <Line key={d.id} type="monotone" dataKey={d.name} stroke={COLORS[i % COLORS.length]} strokeWidth={2} dot={{ r: 3 }} connectNulls />)
            )}
            {mode === "dimensions" && <Legend wrapperStyle={{ fontSize: 11 }} />}
          </LineChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}
