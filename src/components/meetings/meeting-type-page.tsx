import Link from "next/link";
import { format, parseISO } from "date-fns";
import { Plus, Sparkles } from "lucide-react";
import type { TeamAccess } from "@/server/access";
import { teamMeetings } from "@/server/queries";
import { startDialogData } from "@/server/team-data";
import { StartMeetingDialog } from "@/components/meeting-setup/start-meeting-dialog";
import { MeetingCard } from "@/components/meetings/meeting-card";
import { Button } from "@/components/ui/button";
import { AvatarStack } from "@/components/user-avatar";
import { MEETING_TYPE_LABEL } from "@/lib/constants";
import type { MeetingType } from "@/lib/types";
import { START_PERMISSION } from "@/server/meetings/context";
import { ListSearch } from "./list-search";

const WELCOME: Record<MeetingType, string> = {
  retrospective: "Run focused, engaging retrospectives. Pick a template or create your own topics, decide how anonymous to be, brainstorm on your own, group similar ideas, dot-vote on what matters, then discuss and agree actions.",
  standup: "Keep your team connected with regular standups. Create a series, choose your questions, and let people post updates on their own time or together.",
  healthCheck: "See how your team is really doing with a self-assessed health check. Everyone rates the team on several dimensions, then you discuss the results and agree actions.",
  estimation: "Run planning-poker style estimation. Import items from your task tool or add them by hand, estimate on your own, reveal together, and agree on the number.",
};

export async function MeetingTypePage({ access, type, q, demoHref }: { access: TeamAccess; type: MeetingType; q?: string; demoHref?: string }) {
  const [open, closed, dialog] = await Promise.all([teamMeetings(access.team.id, type, { status: "open" }), teamMeetings(access.team.id, type, { status: "closed", q }), startDialogData(access)]);
  const label = MEETING_TYPE_LABEL[type];
  const canStart = access.can(START_PERMISSION[type]) && !access.team.archivedAt;
  const byMonth = new Map<string, typeof closed>();
  for (const m of closed) {
    const k = format(parseISO(m.date), "MMMM yyyy");
    byMonth.set(k, [...(byMonth.get(k) ?? []), m]);
  }
  const empty = !open.length && !closed.length && !q;
  return (
    <div className="mx-auto max-w-7xl space-y-8 px-4 py-8">
      <div className="flex flex-wrap items-center gap-3">
        <h2 className="text-lg font-semibold">Open {label.toLowerCase()}s</h2>
        <div className="ml-auto flex items-center gap-2">
          {demoHref && (
            <Button variant="outline" size="sm" asChild>
              <Link href={demoHref}><Sparkles /> Demo {label.toLowerCase()}</Link>
            </Button>
          )}
          {canStart && <StartMeetingDialog {...dialog} initialType={type} trigger={<Button size="sm"><Plus /> Start {label.toLowerCase()}</Button>} />}
        </div>
      </div>
      {empty ? (
        <div className="rounded-3xl border bg-card p-10 text-center">
          <p className="text-xl font-semibold">Welcome to {label.toLowerCase()}s</p>
          <p className="mx-auto mt-2 max-w-2xl text-muted-foreground">{WELCOME[type]}</p>
          <div className="mt-5 flex justify-center gap-2">
            {canStart && <StartMeetingDialog {...dialog} initialType={type} trigger={<Button><Plus /> Start {label.toLowerCase()}</Button>} />}
            {demoHref && (
              <Button variant="outline" asChild>
                <Link href={demoHref}><Sparkles /> Try a demo</Link>
              </Button>
            )}
          </div>
        </div>
      ) : (
        <>
          {open.length ? (
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {open.map((m) => (
                <MeetingCard key={m.id} m={m} />
              ))}
            </div>
          ) : (
            <p className="rounded-2xl border border-dashed p-6 text-center text-sm text-muted-foreground">No {label.toLowerCase()}s in progress. Any started by your team admins will appear here.</p>
          )}
          <section className="space-y-3">
            <div className="flex items-center gap-3">
              <h2 className="text-lg font-semibold">Closed {label.toLowerCase()}s</h2>
              <ListSearch placeholder={`Search ${label.toLowerCase()}s…`} />
            </div>
            {!closed.length && <p className="text-sm text-muted-foreground">{q ? <>No {label.toLowerCase()}s matching <strong>{q}</strong></> : "Nothing here yet."}</p>}
            {[...byMonth.entries()].map(([month, list]) => (
              <div key={month} className="space-y-1">
                <p className="pt-2 text-xs font-semibold tracking-wide text-muted-foreground uppercase">{month}</p>
                <ul className="divide-y rounded-2xl border bg-card">
                  {list.map((m) => (
                    <li key={m.id}>
                      <Link href={`/m/${m.id}`} className="flex items-center gap-3 px-4 py-3 hover:bg-muted/40">
                        <span className="w-24 shrink-0 text-sm text-muted-foreground">{format(parseISO(m.date), "EEE d MMM")}</span>
                        <span className="min-w-0 flex-1 truncate text-sm font-medium">{m.title || m.templateName || label}</span>
                        {m.templateName && m.title && <span className="hidden truncate text-xs text-muted-foreground md:block">{m.templateName}</span>}
                        <span className="hidden text-xs text-muted-foreground sm:block">
                          {type === "retrospective" ? `${m.ideaCount} ideas · ` : ""}
                          {m.actionCount} actions
                        </span>
                        <AvatarStack people={m.participants} size={22} max={5} />
                      </Link>
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </section>
        </>
      )}
    </div>
  );
}
