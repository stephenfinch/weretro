import Link from "next/link";
import { notFound } from "next/navigation";
import { and, desc, eq, isNull } from "drizzle-orm";
import { format, parseISO } from "date-fns";
import { CalendarClock, Plus, Sparkles } from "lucide-react";
import { db, schema } from "@/db";
import { requireUser } from "@/server/auth";
import { getTeamAccess } from "@/server/access";
import { startDialogData, startLikePrefill } from "@/server/team-data";
import { teamMeetings } from "@/server/queries";
import { StartMeetingDialog } from "@/components/meeting-setup/start-meeting-dialog";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { AvatarStack } from "@/components/user-avatar";
import { SeriesActions } from "@/components/meetings/series-actions";
import type { SeriesSchedule } from "@/lib/types";

function describe(s: SeriesSchedule | null) {
  const r = s?.recurrence;
  if (!r) return "Does not repeat";
  const days = r.freq === "day" ? "every weekday" : r.freq === "week" ? `${r.interval > 1 ? `every ${r.interval} weeks on` : "every"} ${(r.weekdays ?? []).map((d) => d[0].toUpperCase() + d.slice(1)).join(", ")}` : `monthly on day ${r.dayOfMonth ?? 1}`;
  return `${days} at ${s?.time ?? "09:00"} ${s?.timezone ?? ""}`;
}

export default async function StandupsPage({ params, searchParams }: PageProps<"/t/[team]/standups">) {
  const { team: teamId } = await params;
  const { startLike } = await searchParams;
  const user = await requireUser();
  const access = await getTeamAccess(user, teamId);
  if (!access) notFound();
  const series = await db
    .select()
    .from(schema.meetingSeries)
    .where(and(eq(schema.meetingSeries.teamId, teamId), eq(schema.meetingSeries.type, "standup"), isNull(schema.meetingSeries.deletedAt)))
    .orderBy(desc(schema.meetingSeries.createdAt));
  const history = await teamMeetings(teamId, "standup", { limit: 60 });
  const dialog = await startDialogData(access);
  const canStart = access.can("startStandups") && !access.team.archivedAt;
  const prefill = canStart && typeof startLike === "string" ? await startLikePrefill(teamId, "standup", startLike) : undefined;
  return (
    <div className="mx-auto max-w-7xl space-y-8 px-4 py-8">
      <div className="flex flex-wrap items-center gap-3">
        <h2 className="text-lg font-semibold">Standup series</h2>
        <div className="ml-auto flex gap-2">
          <Button variant="outline" size="sm" asChild>
            <Link href={`/demo/standup?team=${teamId}`}><Sparkles /> Demo standup</Link>
          </Button>
          {canStart && <StartMeetingDialog {...dialog} initialType="standup" trigger={<Button size="sm"><Plus /> Create a standup series</Button>} />}
          {prefill && <StartMeetingDialog key={String(startLike)} {...dialog} initialType="standup" prefill={prefill} defaultOpen trigger={null} />}
        </div>
      </div>
      {!series.length ? (
        <div className="rounded-3xl border bg-card p-10 text-center">
          <p className="text-xl font-semibold">Welcome to standups</p>
          <p className="mx-auto mt-2 max-w-2xl text-muted-foreground">Keep your team connected with regular standups. Create a series, choose your questions, and let people post updates on their own time, then walk through them together.</p>
        </div>
      ) : (
        <div className="grid gap-4 md:grid-cols-2">
          {series.map((s) => {
            const recent = history.filter((m) => m.seriesId === s.id);
            const latest = recent[0];
            return (
              <div key={s.id} className="space-y-3 rounded-2xl border bg-card p-5">
                <div className="flex items-start gap-3">
                  <span className="flex size-10 items-center justify-center rounded-xl bg-primary/10 text-primary"><CalendarClock className="size-5" /></span>
                  <div className="min-w-0 flex-1">
                    <p className="font-semibold">{s.title || "Daily Standup"}</p>
                    <p className="text-xs text-muted-foreground">{describe(s.schedule)}</p>
                  </div>
                  {!s.active && <Badge variant="secondary">Paused</Badge>}
                  <SeriesActions teamId={teamId} seriesId={s.id} active={s.active} canManage={canStart} />
                </div>
                {latest && (
                  <p className="text-sm text-muted-foreground">
                    Latest: {format(parseISO(latest.date), "EEE, MMM d")} · {latest.updateCount} updates{latest.blockerCount ? ` · ${latest.blockerCount} blockers` : ""}
                  </p>
                )}
                <div className="flex gap-2">
                  <Button size="sm" asChild>
                    <Link href={`/t/${teamId}/series/${s.id}`}>Join the current meeting</Link>
                  </Button>
                </div>
              </div>
            );
          })}
        </div>
      )}
      {history.length > 0 && (
        <section className="space-y-2">
          <h2 className="text-lg font-semibold">History</h2>
          <ul className="divide-y rounded-2xl border bg-card">
            {history.map((m) => (
              <li key={m.id}>
                <Link href={`/m/${m.id}`} className="flex items-center gap-3 px-4 py-3 hover:bg-muted/40">
                  <span className="w-28 shrink-0 text-sm text-muted-foreground">{format(parseISO(m.date), "EEE d MMM")}</span>
                  <span className="min-w-0 flex-1 truncate text-sm font-medium">{m.title}</span>
                  <span className="text-xs text-muted-foreground">{m.updateCount} updates{m.blockerCount ? ` · ${m.blockerCount} blockers` : ""}</span>
                  <AvatarStack people={m.participants} size={22} />
                  <Badge variant={m.status === "open" ? "default" : "secondary"}>{m.status === "open" ? "Open" : "Closed"}</Badge>
                </Link>
              </li>
            ))}
          </ul>
        </section>
      )}
    </div>
  );
}
