"use client";

import { useState } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { Bar, BarChart, CartesianGrid, Legend, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { Download, Loader2, Sparkles } from "lucide-react";
import { toast } from "sonner";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import type { InsightsData } from "@/server/insights";
import { CHECK_QUESTIONS } from "@/lib/constants";
import { HealthHistoryChart } from "./health-history-chart";
import { ratingColor } from "@/components/meeting/health/radar";

const TT = { contentStyle: { background: "var(--popover)", border: "1px solid var(--border)", borderRadius: 12, fontSize: 12 } };
const C = { retro: "#6366F1", health: "#22C55E", est: "#F59E0B", standup: "#EC4899" };

function Metric({ label, value, sub }: { label: string; value: React.ReactNode; sub?: string }) {
  return (
    <div className="rounded-2xl border bg-card p-4">
      <p className="text-xs font-medium tracking-wide text-muted-foreground uppercase">{label}</p>
      <p className="mt-1 text-2xl font-semibold tabular-nums">{value}</p>
      {sub && <p className="text-xs text-muted-foreground">{sub}</p>}
    </div>
  );
}

function Card({ title, description, children, actions }: { title: string; description?: string; children: React.ReactNode; actions?: React.ReactNode }) {
  return (
    <section className="space-y-3 rounded-2xl border bg-card p-5">
      <div className="flex items-start gap-3">
        <div className="min-w-0 flex-1">
          <h3 className="font-semibold">{title}</h3>
          {description && <p className="text-sm text-muted-foreground">{description}</p>}
        </div>
        {actions}
      </div>
      {children}
    </section>
  );
}

export type HealthInsights = {
  models: { id: string; name: string; min: number; max: number }[];
  selected: string | null;
  latest: { dimensions: { id: string; name: string }[]; rows: { teamId: string; date: string; values: Record<string, number | null>; overall: number | null }[] } | null;
  history: { dimensions: { id: string; name: string }[]; points: { date: string; values: Record<string, number | null>; overall: number | null }[] } | null;
};

export function InsightsView({ data, health, range, scope, exportBase, aiEnabled }: { data: InsightsData; health: HealthInsights; range: string; scope: "team" | "org"; exportBase: string; aiEnabled: boolean }) {
  const router = useRouter();
  const pathname = usePathname();
  const sp = useSearchParams();
  const setParam = (k: string, v: string) => {
    const p = new URLSearchParams(sp.toString());
    p.set(k, v);
    router.replace(`${pathname}?${p}`);
  };
  const k = data.key;
  const model = health.models.find((m) => m.id === health.selected);
  const teamName = (id: string) => data.teams.find((t) => t.id === id)?.name ?? "";
  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center gap-2">
        <h1 className="text-xl font-semibold">Insights</h1>
        <Select value={range} onValueChange={(v) => setParam("range", v)}>
          <SelectTrigger size="sm" className="ml-auto w-44"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="30">Last 30 days</SelectItem>
            <SelectItem value="90">Last 90 days</SelectItem>
            <SelectItem value="180">Last 6 months</SelectItem>
            <SelectItem value="365">Last 12 months</SelectItem>
            <SelectItem value="all">All time</SelectItem>
          </SelectContent>
        </Select>
      </div>
      <div className="grid grid-cols-2 gap-3 md:grid-cols-4 lg:grid-cols-6">
        {scope === "org" && <Metric label="Teams" value={k.teams} />}
        <Metric label="Active users" value={k.users} />
        <Metric label="Retrospectives" value={k.retrospectives} sub={`${k.ideasPerRetro} ideas per retro`} />
        <Metric label="Health checks" value={k.healthChecks} />
        <Metric label="Estimations" value={k.estimations} sub={`${k.estimatedItems} items estimated`} />
        <Metric label="Standups" value={k.standups} />
        <Metric label="Participation" value={`${k.participationRate}%`} />
        <Metric label="Actions created" value={k.actionsCreated} sub={`${k.actionsPublished} published`} />
        <Metric label="Actions completed" value={k.actionsCompleted} />
        <Metric label="Open actions" value={k.openActions} />
        <Metric label="Time to completion" value={k.timeToCompletion === null ? "–" : `${k.timeToCompletion}d`} />
        <Metric label="Team agreements" value={k.agreements} />
      </div>
      <Tabs defaultValue="activity">
        <TabsList className="w-full justify-start overflow-x-auto">
          {["activity", "retrospectives", "health", "estimations", "actions", "agreements", "usage", "reports"].map((t) => (
            <TabsTrigger key={t} value={t} className="capitalize">{t === "usage" ? "Usage" : t}</TabsTrigger>
          ))}
        </TabsList>
        <TabsContent value="activity" className="space-y-4 pt-4">
          <Card title="Activity overview" description="Meetings per month by type">
            <div className="h-72">
              <ResponsiveContainer>
                <BarChart data={data.activity}>
                  <CartesianGrid strokeDasharray="3 3" strokeOpacity={0.2} />
                  <XAxis dataKey="month" fontSize={11} />
                  <YAxis allowDecimals={false} fontSize={11} />
                  <Tooltip {...TT} />
                  <Legend wrapperStyle={{ fontSize: 12 }} />
                  <Bar dataKey="retrospective" name="Retros" stackId="a" fill={C.retro} />
                  <Bar dataKey="healthCheck" name="Health checks" stackId="a" fill={C.health} />
                  <Bar dataKey="estimation" name="Estimations" stackId="a" fill={C.est} />
                  <Bar dataKey="standup" name="Standups" stackId="a" fill={C.standup} radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </Card>
          {scope === "org" && (
            <Card title="Activity by team">
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead className="text-left text-xs text-muted-foreground uppercase">
                    <tr><th className="py-2">Team</th><th>Retros</th><th>Health</th><th>Estimations</th><th>Standups</th><th>Open actions</th><th>Agreements</th><th>Last meeting</th></tr>
                  </thead>
                  <tbody>
                    {data.activityByTeam.map((t) => (
                      <tr key={t.team} className="border-t">
                        <td className="py-2 font-medium"><span className="mr-2 inline-block size-2.5 rounded-full" style={{ background: t.color }} />{t.team}</td>
                        <td>{t.retros}</td><td>{t.health}</td><td>{t.estimations}</td><td>{t.standups}</td><td>{t.openActions}</td><td>{t.agreements}</td><td className="text-muted-foreground">{t.last ?? "–"}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </Card>
          )}
        </TabsContent>
        <TabsContent value="retrospectives" className="space-y-4 pt-4">
          <div className="grid gap-4 lg:grid-cols-2">
            <Card title="Frequency" description="How often teams run retrospectives (median gap between retros)">
              <ul className="divide-y text-sm">
                {data.retroFreq.map((r) => (
                  <li key={r.team} className="flex justify-between py-2"><span>{r.team}</span><span className="text-muted-foreground">{r.label} · {r.count}</span></li>
                ))}
              </ul>
            </Card>
            <Card title="Most-used templates">
              <div className="h-60">
                <ResponsiveContainer>
                  <BarChart data={data.templateUse} layout="vertical" margin={{ left: 60 }}>
                    <XAxis type="number" allowDecimals={false} fontSize={11} />
                    <YAxis type="category" dataKey="name" fontSize={11} width={120} />
                    <Tooltip {...TT} />
                    <Bar dataKey="count" fill={C.retro} radius={[0, 4, 4, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </Card>
          </div>
          <ThemesCard data={data} aiEnabled={aiEnabled} exportBase={exportBase} />
          <Card title="Sentiment trends" description="Positive vs negative ideas per retrospective">
            <div className="h-64">
              <ResponsiveContainer>
                <BarChart data={data.sentimentTrend}>
                  <CartesianGrid strokeDasharray="3 3" strokeOpacity={0.2} />
                  <XAxis dataKey="date" fontSize={11} />
                  <YAxis fontSize={11} allowDecimals={false} />
                  <Tooltip {...TT} />
                  <Bar dataKey="positive" stackId="s" fill="#22C55E" />
                  <Bar dataKey="neutral" stackId="s" fill="#94A3B8" />
                  <Bar dataKey="negative" stackId="s" fill="#EF4444" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </Card>
          <Card title="Check in / check out" description="How teams answered the optional questions">
            {!data.checkStats.length && <p className="text-sm text-muted-foreground">No check-in or check-out questions answered yet.</p>}
            <div className="grid gap-3 sm:grid-cols-2">
              {data.checkStats.map((c) => {
                const q = CHECK_QUESTIONS.find((x) => x.key === c.question);
                const total = c.dist.reduce((a, b) => a + b, 0) || 1;
                return (
                  <div key={`${c.kind}${c.question}`} className="space-y-2 rounded-xl border p-3">
                    <p className="text-sm font-medium">Check-{c.kind}: {q?.title ?? c.question}</p>
                    <div className="flex h-6 overflow-hidden rounded-md">
                      {c.dist.map((n, i) => n ? <span key={i} title={`${q?.options[i]?.label}: ${n}`} style={{ width: `${(n / total) * 100}%`, background: ratingColor(i + 1, 1, 5) }} /> : null)}
                    </div>
                    <p className="text-xs text-muted-foreground">{q?.options.map((o, i) => `${o.emoji} ${c.dist[i]}`).join("  ")}</p>
                  </div>
                );
              })}
            </div>
          </Card>
        </TabsContent>
        <TabsContent value="health" className="space-y-4 pt-4">
          {!health.models.length ? (
            <p className="rounded-2xl border border-dashed p-8 text-center text-muted-foreground">No health checks in this period.</p>
          ) : (
            <>
              <Select value={health.selected ?? ""} onValueChange={(v) => setParam("model", v)}>
                <SelectTrigger className="w-64"><SelectValue placeholder="Health model" /></SelectTrigger>
                <SelectContent>{health.models.map((m) => <SelectItem key={m.id} value={m.id}>{m.name}</SelectItem>)}</SelectContent>
              </Select>
              {health.latest && model && (
                <Card title="Latest ratings" description="Most recent mean rating by team">
                  <div className="overflow-x-auto">
                    <table className="w-full text-center text-sm">
                      <thead className="text-xs text-muted-foreground">
                        <tr>
                          <th className="p-2 text-left">Team</th>
                          {health.latest.dimensions.map((d) => <th key={d.id} className="p-2 font-medium">{d.name}</th>)}
                          <th className="p-2">Overall</th>
                        </tr>
                      </thead>
                      <tbody>
                        {health.latest.rows.map((r) => (
                          <tr key={r.teamId}>
                            <td className="p-2 text-left font-medium">{teamName(r.teamId)} <span className="text-xs text-muted-foreground">{r.date}</span></td>
                            {health.latest!.dimensions.map((d) => {
                              const v = r.values[d.id];
                              return <td key={d.id} className="p-1"><span className="block rounded-md py-1.5 font-semibold text-white" style={{ background: ratingColor(v, model.min, model.max) }}>{v?.toFixed(1) ?? "–"}</span></td>;
                            })}
                            <td className="p-1"><span className="block rounded-md py-1.5 font-bold text-white" style={{ background: ratingColor(r.overall, model.min, model.max) }}>{r.overall?.toFixed(1) ?? "–"}</span></td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </Card>
              )}
              {health.history && model && (
                <Card title="Historical ratings">
                  <HealthHistoryChart dimensions={health.history.dimensions} points={health.history.points} min={model.min} max={model.max} />
                </Card>
              )}
            </>
          )}
        </TabsContent>
        <TabsContent value="estimations" className="pt-4">
          <Card title="Estimation meetings">
            <table className="w-full text-sm">
              <thead className="text-left text-xs text-muted-foreground uppercase"><tr><th className="py-2">Date</th><th>Team</th><th>Meeting</th><th>Items</th><th>Estimated</th></tr></thead>
              <tbody>
                {data.estimations.map((e, i) => (
                  <tr key={i} className="border-t"><td className="py-2">{e.date}</td><td>{e.team}</td><td>{e.title}</td><td>{e.items}</td><td>{e.estimated}</td></tr>
                ))}
              </tbody>
            </table>
            {!data.estimations.length && <p className="text-sm text-muted-foreground">No estimation meetings in this period.</p>}
          </Card>
        </TabsContent>
        <TabsContent value="actions" className="space-y-4 pt-4">
          <Card title="Actions created vs completed">
            <div className="h-64">
              <ResponsiveContainer>
                <LineChart data={data.actionTrend}>
                  <CartesianGrid strokeDasharray="3 3" strokeOpacity={0.2} />
                  <XAxis dataKey="month" fontSize={11} />
                  <YAxis allowDecimals={false} fontSize={11} />
                  <Tooltip {...TT} />
                  <Legend wrapperStyle={{ fontSize: 12 }} />
                  <Line dataKey="created" stroke={C.retro} strokeWidth={2} />
                  <Line dataKey="completed" stroke={C.health} strokeWidth={2} />
                </LineChart>
              </ResponsiveContainer>
            </div>
          </Card>
          <Card title="Open actions">
            <ul className="divide-y text-sm">
              {data.openActionsList.map((a) => (
                <li key={a.id} className="flex gap-3 py-2"><span className="flex-1">{a.title}</span><span className="text-muted-foreground">{a.team}</span><span className="w-24 text-right text-muted-foreground">{a.dueDate ?? ""}</span></li>
              ))}
            </ul>
          </Card>
        </TabsContent>
        <TabsContent value="agreements" className="pt-4">
          <Card title="Team agreements">
            <ul className="divide-y text-sm">
              {data.agreementsList.map((a) => (
                <li key={a.id} className="flex gap-3 py-2"><span className="flex-1">{a.title}</span><span className="text-muted-foreground">{a.team}</span><span className="text-muted-foreground">{a.createdAt}</span></li>
              ))}
            </ul>
            {!data.agreementsList.length && <p className="text-sm text-muted-foreground">No agreements yet.</p>}
          </Card>
        </TabsContent>
        <TabsContent value="usage" className="pt-4">
          <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
            <Metric label="Comments" value={data.usage.comments} />
            <Metric label="Reactions" value={data.usage.reactions} />
            <Metric label="Polls" value={data.usage.polls} />
            <Metric label="Whiteboards" value={data.usage.whiteboards} />
            <Metric label="Kudos" value={data.usage.kudos} />
            <Metric label="Standup updates" value={data.usage.standupUpdates} />
            <Metric label="Blockers raised" value={data.usage.blockers} />
            <Metric label="Ideas" value={data.key.ideas} />
          </div>
        </TabsContent>
        <TabsContent value="reports" className="pt-4">
          <Card title="Downloads" description="Export data for further analysis">
            <div className="grid gap-2 sm:grid-cols-2">
              {data.teams.map((t) => (
                <div key={t.id} className="flex items-center gap-2 rounded-xl border p-3 text-sm">
                  <span className="flex-1 font-medium">{t.name}</span>
                  <a className="text-primary hover:underline" href={`/api/teams/${t.id}/export?kind=all&format=xlsx`}><Download className="inline size-3.5" /> All meetings (Excel)</a>
                  <a className="text-primary hover:underline" href={`/api/teams/${t.id}/export?kind=summary&format=md`}>Summary</a>
                </div>
              ))}
            </div>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}

function ThemesCard({ data, aiEnabled, exportBase }: { data: InsightsData; aiEnabled: boolean; exportBase: string }) {
  const [filter, setFilter] = useState<"all" | "pos" | "neg">("all");
  const [themes, setThemes] = useState<{ theme: string; count: number }[] | null>(null);
  const [busy, setBusy] = useState(false);
  const words = data.words.filter((w) => (filter === "all" ? true : filter === "pos" ? w.sentiment > 0 : w.sentiment < 0));
  const max = Math.max(1, ...words.map((w) => w.value));
  return (
    <Card
      title="Common themes"
      description="Words used most often in retrospective ideas. Color reflects sentiment."
      actions={
        <div className="flex gap-1">
          {(["all", "pos", "neg"] as const).map((f) => (
            <Button key={f} size="xs" variant={filter === f ? "default" : "outline"} onClick={() => setFilter(f)}>{f === "all" ? "All" : f === "pos" ? "Positive" : "Negative"}</Button>
          ))}
          {aiEnabled && (
            <Button
              size="xs"
              variant="outline"
              disabled={busy}
              onClick={async () => {
                setBusy(true);
                const res = await fetch(`${exportBase}/themes`, { method: "POST" });
                const json = await res.json();
                setBusy(false);
                if (!res.ok) return void toast.error(json.error);
                setThemes(json.themes);
              }}
            >
              {busy ? <Loader2 className="animate-spin" /> : <Sparkles />} Identify themes
            </Button>
          )}
        </div>
      }
    >
      <div className="flex flex-wrap items-baseline justify-center gap-x-3 gap-y-1 py-4">
        {words.map((w) => (
          <span key={w.text} style={{ fontSize: 12 + (w.value / max) * 26, color: w.sentiment > 0.2 ? "#22C55E" : w.sentiment < -0.2 ? "#EF4444" : undefined }} className="font-semibold">
            {w.text}
          </span>
        ))}
        {!words.length && <p className="text-sm text-muted-foreground">Not enough ideas yet.</p>}
      </div>
      {themes && (
        <div className="flex flex-wrap gap-2 border-t pt-3">
          {themes.map((t) => <span key={t.theme} className="rounded-full bg-primary/10 px-3 py-1 text-sm text-primary">{t.theme} · {t.count}</span>)}
        </div>
      )}
    </Card>
  );
}
