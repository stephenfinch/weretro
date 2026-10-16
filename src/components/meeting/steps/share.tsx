"use client";

import { useState } from "react";
import Link from "next/link";
import { BarChart3, ClipboardList, Download, Home, Lightbulb, Send, Share2, Sparkles, Users, Vote, AlertOctagon, CheckCheck, Spade, HeartPulse, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuLabel, DropdownMenuSeparator, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { UserAvatar } from "@/components/user-avatar";
import { MEETING_TYPE_LABEL, KUDOS_TYPES } from "@/lib/constants";
import { useMeeting } from "../use-meeting";
import { CheckQuestion } from "../check-question";
import { MeetingActionList } from "../meeting-action-list";
import { IdeaCard } from "../idea-card";
import { GroupStackReadonly } from "./group";
import { VoteBadge } from "./vote";
import { discussionItems, sortItems } from "../helpers";
import { HealthRadar } from "../health/radar";
import { PublishDialog } from "@/components/integrations/publish-dialog";
import { shareActionsByEmail } from "@/app/actions/teams";
import { TopicIcon } from "@/components/meeting-setup/settings-editor";

function Stat({ icon: Icon, title, sub }: { icon: typeof Lightbulb; title: string; sub?: string }) {
  return (
    <div className="flex flex-col items-center gap-1 text-center">
      <Icon className="size-8 opacity-80" />
      <p className="text-lg font-semibold">{title}</p>
      {sub && <p className="text-xs opacity-80">{sub}</p>}
    </div>
  );
}

export function ShareStep({ integrations }: { integrations?: { id: string; type: string; name: string }[] }) {
  const { state } = useMeeting();
  const s = state.stats;
  const t = state.meeting.type;
  const label = MEETING_TYPE_LABEL[t].toLowerCase();
  const newActions = state.actions.filter((a) => a.kind === "action" && a.meetingId === state.meeting.id && a.status !== "rejected").length;
  const openActions = state.actions.filter((a) => a.kind === "action" && a.meetingId !== state.meeting.id && a.status === "accepted").length;
  const [publish, setPublish] = useState<null | "summary" | "actions">(null);
  const [share, setShare] = useState(false);
  return (
    <div className="h-full overflow-y-auto pb-24 scrollbar-thin">
      <div className="bg-brand-gradient px-4 py-10 text-white">
        <div className="mx-auto max-w-4xl space-y-8">
          <h1 className="text-center text-2xl font-semibold">{state.meeting.status === "closed" ? `This ${label} has ended` : `Wrapping up this ${label}`}</h1>
          <div className="grid grid-cols-2 gap-6 sm:grid-cols-4">
            {t === "retrospective" && (
              <>
                <Stat icon={Lightbulb} title={s.ideas ? `${s.ideas} ideas added` : "No ideas added"} sub={`by ${s.ideaContributors} contributors`} />
                <Stat icon={Vote} title={s.votesCast ? `${s.votesCast} votes cast` : "No votes cast"} sub={`for ${s.votedTargets} items by ${s.voters} participants`} />
              </>
            )}
            {t === "healthCheck" && state.health && (
              <Stat
                icon={HeartPulse}
                title={`Overall health ${(() => {
                  const vals = state.health.dimensions.map((d) => d.results?.mean).filter((x): x is number => typeof x === "number");
                  return vals.length ? (vals.reduce((a, b) => a + b, 0) / vals.length).toFixed(1) : "–";
                })()}`}
                sub={`by ${s.contributors} contributors`}
              />
            )}
            {t === "estimation" && (
              <Stat icon={Spade} title={`${state.estimation.length} estimation items`} sub={`${state.estimation.filter((e) => e.finalEstimate).length} estimated`} />
            )}
            {t === "standup" && (
              <>
                <Stat icon={CheckCheck} title={`${state.standup.filter((u) => u.type === "done").length} tasks completed`} />
                <Stat icon={AlertOctagon} title={`${state.standup.filter((u) => u.type === "blocked").length} blockers`} sub={`${new Set(state.standup.filter((u) => u.type === "blocked").map((u) => u.participantId)).size} people need help`} />
              </>
            )}
            <Stat icon={ClipboardList} title={newActions ? `${newActions} new actions` : "No new actions"} sub={openActions ? `${openActions} existing open actions` : "No existing open actions"} />
            <Stat icon={Users} title={`${s.participationRate}% participation`} sub={`${Math.min(s.contributors, s.expected)}/${s.expected} participants contributed`} />
          </div>
          <div className="flex flex-wrap justify-center gap-3">
            <Button variant="secondary" size="lg" onClick={() => setPublish("summary")}>
              <Send /> Publish
            </Button>
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="secondary" size="lg">
                  <Download /> Download
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="center" className="w-56">
                <DropdownMenuLabel className="text-xs text-muted-foreground">Summary</DropdownMenuLabel>
                <DropdownMenuItem asChild><a href={`/m/${state.meeting.id}/report?print=1`} target="_blank" rel="noreferrer">PDF</a></DropdownMenuItem>
                <DropdownMenuItem asChild><a href={`/api/meetings/${state.meeting.id}/export?kind=summary&format=md`}>Markdown</a></DropdownMenuItem>
                <DropdownMenuItem asChild><a href={`/api/meetings/${state.meeting.id}/export?kind=summaryWithComment&format=md`}>Summary with comments</a></DropdownMenuItem>
                <DropdownMenuSeparator />
                {t === "retrospective" && (
                  <>
                    <DropdownMenuItem asChild><a href={`/api/meetings/${state.meeting.id}/export?kind=ideas&format=xlsx`}>Ideas (Excel)</a></DropdownMenuItem>
                    <DropdownMenuItem asChild><a href={`/api/meetings/${state.meeting.id}/export?kind=ideas&format=csv`}>Ideas (CSV)</a></DropdownMenuItem>
                    <DropdownMenuItem asChild><a href={`/api/meetings/${state.meeting.id}/export?kind=ungroupIdeas&format=csv`}>Ideas, ungrouped (CSV)</a></DropdownMenuItem>
                  </>
                )}
                {t === "healthCheck" && (
                  <>
                    <DropdownMenuItem asChild><a href={`/api/meetings/${state.meeting.id}/export?kind=healthSummary&format=xlsx`}>Results (Excel)</a></DropdownMenuItem>
                    <DropdownMenuItem asChild><a href={`/api/meetings/${state.meeting.id}/export?kind=healthRating&format=csv`}>Individual responses (CSV)</a></DropdownMenuItem>
                    <DropdownMenuItem asChild><a href={`/api/meetings/${state.meeting.id}/export?kind=healthHistory&format=xlsx`}>Health history (Excel)</a></DropdownMenuItem>
                  </>
                )}
                {t === "estimation" && <DropdownMenuItem asChild><a href={`/api/meetings/${state.meeting.id}/export?kind=estimations&format=csv`}>Estimates (CSV)</a></DropdownMenuItem>}
                {t === "standup" && <DropdownMenuItem asChild><a href={`/api/meetings/${state.meeting.id}/export?kind=updates&format=csv`}>Updates (CSV)</a></DropdownMenuItem>}
                <DropdownMenuItem asChild><a href={`/api/meetings/${state.meeting.id}/export?kind=actions&format=csv`}>Actions (CSV)</a></DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
            <Button variant="secondary" size="lg" onClick={() => setShare(true)} disabled={state.me.isGuest}>
              <Share2 /> Share
            </Button>
            <Button variant="secondary" size="lg" asChild>
              <Link href={state.me.isGuest ? "/" : `/t/${state.team.id}`}>
                <Home /> Exit {label}
              </Link>
            </Button>
          </div>
        </div>
      </div>
      <div className="mx-auto max-w-4xl px-4">
        <MeetingReport />
      </div>
      {integrations && (
        <PublishDialog
          teamId={state.team.id}
          kind={publish === "actions" ? "actions" : "summary"}
          meetingId={state.meeting.id}
          actionIds={state.actions.filter((a) => a.meetingId === state.meeting.id && a.kind === "action" && a.status === "accepted").map((a) => a.id)}
          open={!!publish}
          onOpenChange={(o) => !o && setPublish(null)}
          integrations={integrations}
        />
      )}
      <ShareDialog open={share} onOpenChange={setShare} />
    </div>
  );
}

function ShareDialog({ open, onOpenChange }: { open: boolean; onOpenChange: (o: boolean) => void }) {
  const { state } = useMeeting();
  const [to, setTo] = useState(state.members.map(() => "").join(""));
  const [busy, setBusy] = useState(false);
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Email actions and {MEETING_TYPE_LABEL[state.meeting.type].toLowerCase()} summary</DialogTitle>
          <DialogDescription>Participants receive summaries automatically if they have them turned on. Add anyone else here.</DialogDescription>
        </DialogHeader>
        <Textarea value={to} onChange={(e) => setTo(e.target.value)} placeholder="ana@company.com, ben@company.com" rows={3} />
        <DialogFooter>
          <Button
            disabled={busy || !to.trim()}
            onClick={async () => {
              setBusy(true);
              const r = await shareActionsByEmail(state.team.id, { recipients: to.split(/[\s,;]+/).filter(Boolean), scope: "all", meetingId: state.meeting.id });
              setBusy(false);
              if (!r.ok) return void toast.error(r.error);
              toast.success("Summary emailed");
              onOpenChange(false);
            }}
          >
            Send
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

export function MeetingReport({ printable }: { printable?: boolean }) {
  const { state, op } = useMeeting();
  const [notes, setNotes] = useState(state.meeting.notes);
  const [editingNotes, setEditingNotes] = useState(false);
  const [generating, setGenerating] = useState(false);
  const facilitators = state.participants.filter((p) => p.role === "facilitator" || p.role === "facilitatorOnly");
  const participants = state.participants.filter((p) => !p.invited && p.role !== "facilitatorOnly" && p.role !== "observer");
  const items = sortItems(discussionItems(state), state, "votes");
  const newActions = state.actions.filter((a) => a.kind === "action" && a.meetingId === state.meeting.id && a.status !== "rejected");
  const other = state.actions.filter((a) => a.kind === "action" && a.meetingId !== state.meeting.id && a.status === "accepted");
  const generate = async () => {
    setGenerating(true);
    const res = await fetch(`/api/ai/meetings/${state.meeting.id}/summary`, { method: "POST" });
    const json = await res.json().catch(() => ({}));
    setGenerating(false);
    if (!res.ok) toast.error(json.error ?? "Couldn't generate a summary");
  };
  return (
    <div className="space-y-10 py-8">
      <div className="space-y-2">
        <h2 className="text-2xl font-semibold">
          {state.meeting.title || state.meeting.date} {MEETING_TYPE_LABEL[state.meeting.type]}
        </h2>
        <p className="text-sm text-muted-foreground">
          {state.team.name} · {state.meeting.date}
          {state.meeting.templateName ? ` · ${state.meeting.templateName}` : ""}
        </p>
        {state.meeting.anonymity !== "names" && <p className="text-xs text-muted-foreground">This {MEETING_TYPE_LABEL[state.meeting.type].toLowerCase()} {state.meeting.anonymity === "anonymous" ? "was anonymous" : "used aliases"}</p>}
      </div>

      <section className="space-y-2">
        {editingNotes ? (
          <div className="space-y-2">
            <Textarea value={notes} onChange={(e) => setNotes(e.target.value)} rows={5} placeholder="Meeting notes…" autoFocus />
            <div className="flex gap-2">
              <Button size="sm" onClick={() => { void op("notes.update", { notes }); setEditingNotes(false); }}>Save notes</Button>
              <Button size="sm" variant="ghost" onClick={() => setEditingNotes(false)}>Cancel</Button>
            </div>
          </div>
        ) : state.meeting.notes ? (
          <div className="rounded-2xl border bg-card p-4">
            <div className="mb-1 flex items-center justify-between">
              <h3 className="text-sm font-semibold">Notes</h3>
              {state.me.canFacilitate && !printable && <button type="button" className="text-xs text-primary" onClick={() => setEditingNotes(true)}>Edit</button>}
            </div>
            <p className="text-sm whitespace-pre-wrap">{state.meeting.notes}</p>
          </div>
        ) : (
          state.me.canFacilitate && !printable && (
            <Button variant="link" className="px-0" onClick={() => setEditingNotes(true)}>
              Add notes
            </Button>
          )
        )}
        {state.meeting.aiSummary ? (
          <div className="rounded-2xl border border-violet-500/30 bg-violet-500/5 p-4">
            <div className="mb-1 flex items-center gap-2">
              <Sparkles className="size-4 text-violet-500" />
              <h3 className="text-sm font-semibold">AI summary</h3>
              {state.team.ai.summaries && state.me.canFacilitate && !printable && (
                <button type="button" onClick={generate} className="ml-auto text-xs text-primary">{generating ? "Refreshing…" : "Refresh summary"}</button>
              )}
            </div>
            <div className="text-sm whitespace-pre-wrap">{state.meeting.aiSummary}</div>
          </div>
        ) : (
          state.team.ai.summaries && state.me.canFacilitate && !printable && (
            <Button variant="outline" size="sm" onClick={generate} disabled={generating}>
              {generating ? <Loader2 className="animate-spin" /> : <Sparkles />} Generate summary
            </Button>
          )
        )}
      </section>

      <section className="grid gap-4 sm:grid-cols-[200px_1fr]">
        <div className="rounded-2xl border bg-card p-4">
          <h3 className="mb-2 text-sm font-semibold text-muted-foreground">Facilitator</h3>
          {facilitators.map((p) => (
            <div key={p.id} className="flex items-center gap-2 py-1 text-sm">
              <UserAvatar name={p.name} color={p.color} src={p.avatarUrl} size={22} /> {p.name}
            </div>
          ))}
        </div>
        <div className="rounded-2xl border bg-card p-4">
          <h3 className="mb-2 text-sm font-semibold text-muted-foreground">Participants</h3>
          <div className="grid grid-cols-2 gap-1 sm:grid-cols-3">
            {participants.map((p) => (
              <div key={p.id} className="flex items-center gap-2 py-1 text-sm">
                <UserAvatar name={p.name} color={p.color} src={p.avatarUrl} size={22} /> <span className="truncate">{p.name}</span>
              </div>
            ))}
          </div>
        </div>
      </section>

      <CheckQuestion kind="in" />
      {state.checks.some((c) => c.kind === "out") && <CheckQuestion kind="out" />}

      <section className="space-y-3">
        <h3 className="text-lg font-semibold">Team actions</h3>
        <p className="text-sm font-medium text-muted-foreground">Actions from this {MEETING_TYPE_LABEL[state.meeting.type].toLowerCase()}</p>
        <MeetingActionList kind="action" items={newActions} hideAdd={printable} emptyText="No actions were added" />
        {other.length > 0 && (
          <>
            <p className="pt-2 text-sm font-medium text-muted-foreground">Other open actions</p>
            <MeetingActionList kind="action" items={other} hideAdd />
          </>
        )}
      </section>

      {state.meeting.type === "retrospective" && (
        <section className="space-y-4">
          {state.meeting.topics.map((t) => {
            const list = items.filter((i) => i.topicId === t.id);
            if (!list.length) return null;
            return (
              <div key={t.id} className="space-y-2">
                <h3 className="flex items-center gap-2 font-semibold">
                  <TopicIcon name={t.icon} color={t.color} className="size-5" /> {t.title}
                </h3>
                <div className="grid gap-2 sm:grid-cols-2">
                  {list.map((item) =>
                    item.kind === "group" && item.group ? (
                      <GroupStackReadonly key={item.id} group={item.group} ideas={item.ideas} footer={<div className="flex justify-end"><VoteBadge votes={item.votes} /></div>} />
                    ) : (
                      <IdeaCard key={item.id} idea={item.ideas[0]} footer={<VoteBadge votes={item.votes} />} />
                    ),
                  )}
                </div>
              </div>
            );
          })}
        </section>
      )}

      {state.health && (
        <section className="space-y-3">
          <h3 className="text-lg font-semibold">Health radar</h3>
          <div className="rounded-2xl border bg-card p-4">
            <HealthRadar health={state.health} layers={["mean", "distribution"]} />
          </div>
          <table className="w-full text-sm">
            <thead className="text-left text-muted-foreground">
              <tr>
                <th className="py-1">Dimension</th>
                <th>Mean</th>
                <th>Score</th>
                <th>Responses</th>
              </tr>
            </thead>
            <tbody>
              {state.health.dimensions.map((d) => (
                <tr key={d.id} className="border-t">
                  <td className="py-1.5">{d.name}</td>
                  <td>{d.results?.mean?.toFixed(1) ?? "–"}</td>
                  <td>{d.results?.score ?? "–"}%</td>
                  <td>{d.results?.count ?? 0}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </section>
      )}

      {state.estimation.length > 0 && (
        <section className="space-y-2">
          <h3 className="text-lg font-semibold">Estimation items</h3>
          <ul className="divide-y rounded-2xl border bg-card">
            {state.estimation.map((it) => (
              <li key={it.id} className="flex items-center gap-3 px-4 py-2 text-sm">
                <span className="min-w-0 flex-1">{it.title}</span>
                <span className="rounded-lg bg-primary/10 px-2 py-0.5 font-semibold text-primary">{it.finalEstimate ?? "–"}</span>
              </li>
            ))}
          </ul>
        </section>
      )}

      {state.standup.length > 0 && (
        <section className="space-y-3">
          <h3 className="text-lg font-semibold">Updates</h3>
          {Array.from(new Set(state.standup.map((u) => u.participantId))).map((pid) => {
            const p = state.participants.find((x) => x.id === pid);
            return (
              <div key={pid} className="rounded-2xl border bg-card p-4">
                <div className="mb-2 flex items-center gap-2 font-medium">
                  <UserAvatar name={p?.name} color={p?.color} src={p?.avatarUrl} size={24} /> {p?.name}
                </div>
                {state.meeting.topics.map((t) => {
                  const ups = state.standup.filter((u) => u.participantId === pid && u.topicId === t.id);
                  if (!ups.length) return null;
                  return (
                    <div key={t.id} className="mb-2 border-l-2 pl-3" style={{ borderColor: t.color }}>
                      <p className="text-xs font-semibold text-muted-foreground">{t.title}</p>
                      <ul className="list-disc pl-4 text-sm">
                        {ups.map((u) => (
                          <li key={u.id}>{u.text}</li>
                        ))}
                      </ul>
                    </div>
                  );
                })}
              </div>
            );
          })}
        </section>
      )}

      <section className="grid gap-6 sm:grid-cols-2">
        <div className="space-y-2">
          <h3 className="text-lg font-semibold">Team agreements</h3>
          <MeetingActionList kind="agreement" items={state.actions.filter((a) => a.kind === "agreement" && a.status === "accepted")} hideAdd={printable} />
        </div>
        <div className="space-y-2">
          <h3 className="text-lg font-semibold">Parking lot</h3>
          <MeetingActionList kind="parked" items={state.actions.filter((a) => a.kind === "parked" && a.status === "accepted")} hideAdd={printable} />
        </div>
      </section>

      {state.kudos.length > 0 && (
        <section className="space-y-2">
          <h3 className="text-lg font-semibold">Meeting kudos</h3>
          <div className="grid gap-2 sm:grid-cols-2">
            {state.kudos.map((k) => {
              const kt = KUDOS_TYPES.find((x) => x.key === k.type);
              return (
                <div key={k.id} className="flex items-start gap-3 rounded-2xl border bg-card p-3">
                  <span className="text-2xl">{kt?.emoji}</span>
                  <div className="text-sm">
                    <p>
                      <strong>{k.fromName}</strong> → <strong>{k.toName}</strong>: {kt?.label}
                    </p>
                    {k.message && <p className="text-muted-foreground">{k.message}</p>}
                  </div>
                </div>
              );
            })}
          </div>
        </section>
      )}
      {state.whiteboards.length > 0 && (
        <section className="space-y-2">
          <h3 className="text-lg font-semibold">Meeting whiteboards</h3>
          <ul className="space-y-1 text-sm">
            {state.whiteboards.map((w) => (
              <li key={w.id}>
                <a className="text-primary hover:underline" href={`/m/${state.meeting.id}/whiteboards/${w.id}`} target="_blank" rel="noreferrer">
                  {w.title}
                </a>
              </li>
            ))}
          </ul>
        </section>
      )}
      <p className="flex items-center justify-center gap-1 pt-4 text-xs text-muted-foreground">
        <BarChart3 className="size-3" /> {state.stats.participationRate}% participation
      </p>
    </div>
  );
}
