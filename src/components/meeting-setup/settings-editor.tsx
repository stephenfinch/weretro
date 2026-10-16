"use client";


import { DynamicIcon, type IconName } from "lucide-react/dynamic";
import { ArrowDown, ArrowUp, GripVertical, Plus, Trash2 } from "lucide-react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Button } from "@/components/ui/button";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { cn } from "@/lib/utils";
import { TOPIC_ICON_NAMES } from "@/lib/topic-icons";
import { BUILTIN_DECKS, CHECK_QUESTIONS, PALETTE, STEP_INSTRUCTIONS, STEP_LABEL } from "@/lib/constants";
import type { Anonymity, DeckCard, MeetingOptions, MeetingStep, MeetingType, SeriesSchedule, Topic } from "@/lib/types";

export type MeetingDraft = {
  type: MeetingType;
  title: string;
  date: string;
  context: string;
  anonymity: Anonymity;
  topics: Topic[];
  steps: MeetingStep[];
  options: MeetingOptions;
  schedule: SeriesSchedule | null;
  deckId?: string | null;
  healthModelId?: string | null;
  closePrevious?: boolean;
  invite?: boolean;
};

export const TOPIC_ICONS = TOPIC_ICON_NAMES as unknown as IconName[];

export function TopicIcon({ name, color, className }: { name?: string; color?: string; className?: string }) {
  return <DynamicIcon name={(name as IconName) || "circle"} className={className} style={{ color }} fallback={() => <span className={className} />} />;
}

type StepOption = { key: string; label: string; options: { value: unknown; label: string }[] };

const STEP_OPTIONS: Partial<Record<string, StepOption[]>> = {
  icebreaker: [{ key: "mode", label: "Mode", options: [{ value: "game", label: "Icebreaker games" }, { value: "questions", label: "Icebreaker question" }] }],
  welcome: [
    {
      key: "checkInQuestion",
      label: "Check-in question",
      options: [{ value: null, label: "No check-in question" }, ...CHECK_QUESTIONS.filter((q) => q.kind !== "out").map((q) => ({ value: q.key, label: `Check-in: ${q.title}` }))],
    },
  ],
  brainstorm: [
    { key: "showAvatar", label: "Who added", options: [{ value: "hidden", label: "Don't show who added" }, { value: "shown", label: "Show who added" }] },
    { key: "colorIdea", label: "Color", options: [{ value: "topic", label: "Color by topic" }, { value: "participant", label: "Color by who added" }, { value: "manual", label: "Color manually" }] },
    { key: "showIdea", label: "Show ideas", options: [{ value: "nextStep", label: "Show ideas in next step" }, { value: "immediately", label: "Show ideas immediately" }] },
  ],
  group: [
    { key: "permission", label: "Group", options: [{ value: "participant", label: "Everyone can group" }, { value: "facilitator", label: "Only facilitator can group" }] },
    {
      key: "sort",
      label: "Sort",
      options: [
        { value: "original", label: "Original order" },
        { value: "whoAdded", label: "Sort by who added" },
        { value: "whoAddedRandom", label: "Sort by who added (randomized)" },
        { value: "random", label: "Randomize order" },
      ],
    },
    { key: "autoSuggest", label: "AI suggestions", options: [{ value: false, label: "Suggest groups: off" }, { value: true, label: "Suggest groups: on" }] },
  ],
  vote: [
    { key: "maxVotes", label: "Votes", options: [...[1, 2, 3, 4, 5, 6, 7, 8, 10, 12, 15, 20].map((n) => ({ value: n, label: `${n} ${n === 1 ? "vote" : "votes"}` })), { value: null, label: "Unlimited votes" }] },
    { key: "itemLimit", label: "Per item", options: [{ value: null, label: "No limit per item" }, ...[1, 2, 3, 5].map((n) => ({ value: n, label: `Max ${n} per item` }))] },
    { key: "topicLimit", label: "Per topic", options: [{ value: null, label: "No limit per topic" }, ...[1, 2, 3, 5].map((n) => ({ value: n, label: `Max ${n} per topic` }))] },
    { key: "anonymous", label: "Anonymity", options: [{ value: true, label: "Votes are anonymous" }, { value: false, label: "Votes are not anonymous" }] },
    { key: "reveal", label: "Reveal", options: [{ value: "nextStep", label: "Reveal votes in next step" }, { value: "immediately", label: "Reveal votes immediately" }] },
    { key: "voteOn", label: "Vote on", options: [{ value: "groups", label: "Vote on groups" }, { value: "ideas", label: "Vote on ideas" }] },
    { key: "facilitatorUnlimited", label: "Facilitator", options: [{ value: false, label: "Facilitator votes are limited" }, { value: true, label: "Unlimited facilitator votes" }] },
  ],
  discuss: [
    { key: "which", label: "Discuss", options: [{ value: "all", label: "Discuss all" }, { value: "allVoted", label: "Discuss all with votes" }, { value: "topN", label: "Discuss top-N voted" }] },
    { key: "topN", label: "Top", options: [3, 5, 7, 10].map((n) => ({ value: n, label: `Top ${n}` })) },
    {
      key: "sort",
      label: "Sort",
      options: [
        { value: "votes", label: "Sort by votes" },
        { value: "topicThenVotes", label: "Sort by topic, then votes" },
        { value: "topicThenWhoAdded", label: "Sort by topic, then who added" },
        { value: "original", label: "Original order" },
      ],
    },
    {
      key: "actionPermission",
      label: "Actions",
      options: [
        { value: "participantNoPropose", label: "Everyone can add actions" },
        { value: "participantCanPropose", label: "Everyone can propose or add actions" },
        { value: "facilitatorCanPropose", label: "Everyone can propose actions" },
        { value: "facilitatorNoPropose", label: "Facilitators can add actions" },
      ],
    },
    { key: "autoSuggestActions", label: "AI suggestions", options: [{ value: false, label: "Suggest actions: off" }, { value: true, label: "Suggest actions: on" }] },
  ],
  healthDiscuss: [
    { key: "sort", label: "Sort", options: [{ value: "negative", label: "Most negative first" }, { value: "positive", label: "Most positive first" }, { value: "mixed", label: "Most mixed first" }, { value: "original", label: "Original order" }] },
    {
      key: "actionPermission",
      label: "Actions",
      options: [
        { value: "participantNoPropose", label: "Everyone can add actions" },
        { value: "participantCanPropose", label: "Everyone can propose or add actions" },
        { value: "facilitatorCanPropose", label: "Everyone can propose actions" },
        { value: "facilitatorNoPropose", label: "Facilitators can add actions" },
      ],
    },
  ],
  share: [
    {
      key: "checkOutQuestion",
      label: "Check-out question",
      options: [{ value: null, label: "No check-out question" }, ...CHECK_QUESTIONS.filter((q) => q.kind !== "in").map((q) => ({ value: q.key, label: `Check-out: ${q.title}` }))],
    },
  ],
};

function OptionChip({ opt, value, onChange, disabled }: { opt: StepOption; value: unknown; onChange: (v: unknown) => void; disabled?: boolean }) {
  const current = opt.options.find((o) => o.value === value) ?? opt.options.find((o) => o.value === undefined);
  return (
    <Select disabled={disabled} value={JSON.stringify(value ?? null)} onValueChange={(v) => onChange(JSON.parse(v))}>
      <SelectTrigger size="sm" className="h-7 rounded-full border-dashed px-2.5 text-xs font-medium uppercase tracking-wide">
        <SelectValue>{current?.label ?? opt.label}</SelectValue>
      </SelectTrigger>
      <SelectContent>
        {opt.options.map((o) => (
          <SelectItem key={JSON.stringify(o.value)} value={JSON.stringify(o.value ?? null)}>
            {o.label}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}

export function StepOptionChips({ step, onChange, disabled }: { step: MeetingStep; onChange: (options: Record<string, unknown>) => void; disabled?: boolean }) {
  const opts = STEP_OPTIONS[step.key] ?? [];
  const values = step.options ?? {};
  return (
    <div className="flex flex-wrap gap-1.5">
      {opts
        .filter((o) => !(step.key === "discuss" && o.key === "topN" && values.which !== "topN"))
        .map((o) => (
          <OptionChip key={o.key} opt={o} value={values[o.key] ?? null} disabled={disabled} onChange={(v) => onChange({ ...values, [o.key]: v })} />
        ))}
    </div>
  );
}

export function SettingsEditor({
  draft,
  setDraft,
  mode,
  currentStepKey,
  decks,
}: {
  draft: MeetingDraft;
  setDraft: (d: MeetingDraft) => void;
  mode: "create" | "edit";
  currentStepKey?: string;
  decks?: { id: string; name: string; cards: DeckCard[] }[];
}) {
  const set = <K extends keyof MeetingDraft>(k: K, v: MeetingDraft[K]) => setDraft({ ...draft, [k]: v });
  const setOpt = (patch: Partial<MeetingOptions>) => set("options", { ...draft.options, ...patch });
  const hasTopics = draft.type === "retrospective" || draft.type === "standup";
  const tabs = [
    { key: "general", label: "General" },
    ...(hasTopics ? [{ key: "topics", label: draft.type === "standup" ? "Questions" : "Topics" }] : []),
    ...(draft.type !== "standup" ? [{ key: "process", label: "Process" }] : []),
    { key: "recurrence", label: "Recurrence" },
    { key: "options", label: "Options" },
  ];
  return (
    <Tabs defaultValue="general" className="gap-4">
      <TabsList className="w-full justify-start overflow-x-auto">
        {tabs.map((t) => (
          <TabsTrigger key={t.key} value={t.key}>{t.label}</TabsTrigger>
        ))}
      </TabsList>

      <TabsContent value="general" className="space-y-5">
        <div className="grid gap-4 sm:grid-cols-[1fr_180px]">
          <div className="space-y-1.5">
            <Label>Name</Label>
            <Input value={draft.title} maxLength={64} onChange={(e) => set("title", e.target.value)} placeholder={draft.type === "standup" ? "eg. Daily Standup" : "eg. Sprint 12"} />
          </div>
          <div className="space-y-1.5">
            <Label>Date</Label>
            <Input type="date" value={draft.date} onChange={(e) => set("date", e.target.value)} />
          </div>
        </div>
        <div className="space-y-1.5">
          <div className="flex items-center justify-between">
            <Label>Context</Label>
            <ContextPresets onPick={(t) => set("context", draft.context ? `${draft.context}\n${t}` : t)} />
          </div>
          <Textarea value={draft.context} onChange={(e) => set("context", e.target.value)} rows={3} placeholder="Set the stage: goals, scope, or anything people should keep in mind" />
        </div>
        {draft.type === "healthCheck" ? (
          <div className="flex items-center justify-between rounded-xl border p-3">
            <div>
              <p className="text-sm font-medium">Survey responses are anonymous</p>
              <p className="text-xs text-muted-foreground">Hide who gave which rating or comment. Can&apos;t be turned off once responses come in.</p>
            </div>
            <Switch checked={draft.options.healthAnonymous !== false} onCheckedChange={(v) => setOpt({ healthAnonymous: v })} />
          </div>
        ) : (
          <div className="space-y-1.5">
            <Label>Anonymity</Label>
            <div className="grid grid-cols-3 gap-1 rounded-xl bg-muted p-1">
              {(["anonymous", "aliases", "names"] as Anonymity[]).map((a) => {
                const order = ["names", "aliases", "anonymous"];
                const locked = mode === "edit" && order.indexOf(a) < order.indexOf(draft.anonymity);
                return (
                  <button
                    key={a}
                    type="button"
                    disabled={locked}
                    onClick={() => set("anonymity", a)}
                    className={cn("rounded-lg py-1.5 text-sm font-medium capitalize transition disabled:opacity-40", draft.anonymity === a ? "bg-background shadow-sm" : "text-muted-foreground hover:text-foreground")}
                  >
                    {a}
                  </button>
                );
              })}
            </div>
            <p className="text-xs text-muted-foreground">
              {draft.anonymity === "anonymous" ? "Nobody's name is shown anywhere." : draft.anonymity === "aliases" ? "Everyone gets a random alias like “Brave Otter”." : "Names are visible where relevant."} Once enabled, anonymity can&apos;t be reduced.
            </p>
          </div>
        )}
        {draft.type === "retrospective" && (
          <ToggleRow label="Optional anonymity" description="Let participants submit specific ideas or comments anonymously" checked={!!draft.options.allowAnonymousContributions} onChange={(v) => setOpt({ allowAnonymousContributions: v })} />
        )}
        {draft.type === "estimation" && decks && (
          <div className="space-y-1.5">
            <Label>Deck</Label>
            <Select value={draft.deckId ?? "scrum"} onValueChange={(v) => set("deckId", v)}>
              <SelectTrigger className="w-full"><SelectValue /></SelectTrigger>
              <SelectContent>
                {decks.map((d) => (
                  <SelectItem key={d.id} value={d.id}>{d.name} — {d.cards.map((c) => c.label).join(" ")}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        )}
        {mode === "create" && draft.type !== "standup" && (
          <ToggleRow label="Close previous meetings" description="Close any other open meetings of this type for the team" checked={!!draft.closePrevious} onChange={(v) => set("closePrevious", v)} />
        )}
      </TabsContent>

      {hasTopics && (
        <TabsContent value="topics" className="space-y-3">
          <TopicsEditor type={draft.type} topics={draft.topics} onChange={(t) => set("topics", t)} />
          {draft.type === "retrospective" && (
            <div className="space-y-2 rounded-xl border p-3">
              <Label>Background image URL</Label>
              <Input value={draft.options.background?.url ?? ""} placeholder="https://…" onChange={(e) => setOpt({ background: e.target.value ? { ...(draft.options.background ?? {}), url: e.target.value, opacity: draft.options.background?.opacity ?? 0.25 } : null })} />
              {draft.options.background?.url && (
                <div className="flex items-center gap-3 text-sm">
                  Opacity
                  <input type="range" min={0.05} max={1} step={0.05} value={draft.options.background.opacity ?? 0.25} onChange={(e) => setOpt({ background: { ...draft.options.background, opacity: Number(e.target.value) } })} />
                </div>
              )}
            </div>
          )}
        </TabsContent>
      )}

      {draft.type !== "standup" && (
        <TabsContent value="process" className="space-y-2">
          {draft.steps.map((s, i) => {
            const isCurrent = currentStepKey === s.key;
            const required = ["brainstorm", "healthSurvey", "estimate", "standup"].includes(s.key);
            return (
              <div key={s.key} className={cn("rounded-xl border p-3", !s.enabled && "opacity-60")}>
                <div className="flex items-center gap-3">
                  <Switch
                    checked={s.enabled}
                    disabled={isCurrent || required}
                    onCheckedChange={(v) => {
                      const steps = [...draft.steps];
                      steps[i] = { ...s, enabled: v };
                      set("steps", steps);
                    }}
                  />
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-medium">{STEP_LABEL[s.key]}</p>
                    <p className="text-xs text-muted-foreground">{STEP_INSTRUCTIONS[s.key]}</p>
                  </div>
                </div>
                {s.enabled && STEP_OPTIONS[s.key] && (
                  <div className="mt-2 pl-12">
                    <StepOptionChips
                      step={s}
                      onChange={(options) => {
                        const steps = [...draft.steps];
                        steps[i] = { ...s, options };
                        set("steps", steps);
                      }}
                    />
                  </div>
                )}
              </div>
            );
          })}
          <ToggleRow label="Any team member can facilitate this meeting" checked={!!draft.options.anyMemberCanFacilitate} onChange={(v) => setOpt({ anyMemberCanFacilitate: v })} />
        </TabsContent>
      )}

      <TabsContent value="recurrence" className="space-y-4">
        <RecurrenceEditor value={draft.schedule} onChange={(s) => set("schedule", s)} type={draft.type} />
      </TabsContent>

      <TabsContent value="options" className="space-y-2">
        <ToggleRow
          label="Live feedback and reactions"
          description="Let participants react while you present"
          checked={draft.options.liveFeedback?.enabled !== false}
          onChange={(v) => setOpt({ liveFeedback: { ...(draft.options.liveFeedback ?? {}), enabled: v } })}
        >
          {draft.options.liveFeedback?.enabled !== false && (
            <div className="mt-2 flex flex-wrap gap-2">
              {(
                [
                  ["reactions", "Live reactions"],
                  ["slowerFaster", "Go slower / go faster"],
                  ["agreeDisagree", "Agree / disagree"],
                  ["raisedHand", "Raise hand"],
                ] as const
              ).map(([k, label]) => {
                const on = draft.options.liveFeedback?.[k] !== false;
                return (
                  <button
                    key={k}
                    type="button"
                    onClick={() => setOpt({ liveFeedback: { ...(draft.options.liveFeedback ?? {}), [k]: !on } })}
                    className={cn("rounded-full border px-3 py-1 text-xs font-medium", on ? "border-primary bg-primary/10 text-primary" : "text-muted-foreground")}
                  >
                    {label}
                  </button>
                );
              })}
            </div>
          )}
        </ToggleRow>
        {draft.type !== "healthCheck" && <ToggleRow label="Reactions" description="Let participants react to ideas and updates" checked={draft.options.reactions !== false} onChange={(v) => setOpt({ reactions: v })} />}
        <ToggleRow label="Comments" description={draft.type === "healthCheck" ? "Let participants comment on dimensions during discussion" : "Let participants comment on any idea"} checked={draft.options.comments !== false} onChange={(v) => setOpt({ comments: v })} />
        {draft.type === "healthCheck" && <ToggleRow label="Comments during survey" description="Let participants add comments while rating" checked={draft.options.surveyComments !== false} onChange={(v) => setOpt({ surveyComments: v })} />}
        <ToggleRow label="Comment reactions" description="Let participants react to comments" checked={draft.options.commentReactions !== false} onChange={(v) => setOpt({ commentReactions: v })} />
        <ToggleRow label="Kudos" description="Show appreciation for someone's work" checked={draft.options.kudos !== false} onChange={(v) => setOpt({ kudos: v })} />
        {draft.type === "estimation" && <ToggleRow label="Auto-sync estimates" description="Push final estimates to the tool items were imported from" checked={!!draft.options.autoSyncEstimates} onChange={(v) => setOpt({ autoSyncEstimates: v })} />}
        {draft.type === "standup" && <ToggleRow label="Show the feed before posting" description="Let people read others' updates before they finish their own" checked={!!draft.options.standupShowFeedBeforeFinish} onChange={(v) => setOpt({ standupShowFeedBeforeFinish: v })} />}
        <div className="grid gap-3 rounded-xl border p-3 sm:grid-cols-2">
          <SelectRow label="Chat" value={draft.options.chat ?? "everyone"} onChange={(v) => setOpt({ chat: v as MeetingOptions["chat"] })} options={[["everyone", "Everyone can post messages"], ["facilitators", "Facilitators can post messages"], ["disabled", "Disabled"]]} />
          <SelectRow label="Whiteboards" value={draft.options.whiteboards ?? "everyone"} onChange={(v) => setOpt({ whiteboards: v as MeetingOptions["whiteboards"] })} options={[["everyone", "Everyone can create whiteboards"], ["facilitators", "Facilitators can create whiteboards"]]} />
          <SelectRow
            label="Agreements"
            value={draft.options.agreements ?? "participantNoPropose"}
            onChange={(v) => setOpt({ agreements: v as MeetingOptions["agreements"] })}
            options={[["participantNoPropose", "Everyone can add agreements"], ["participantCanPropose", "Everyone can propose or add"], ["facilitatorCanPropose", "Everyone can propose agreements"], ["facilitatorNoPropose", "Facilitators can add agreements"]]}
          />
          <SelectRow
            label="Parking lot"
            value={draft.options.parkingLot ?? "participantNoPropose"}
            onChange={(v) => setOpt({ parkingLot: v as MeetingOptions["parkingLot"] })}
            options={[["participantNoPropose", "Everyone can park items"], ["participantCanPropose", "Everyone can propose or park"], ["facilitatorCanPropose", "Everyone can propose items"], ["facilitatorNoPropose", "Facilitators can park items"]]}
          />
        </div>
      </TabsContent>
    </Tabs>
  );
}

function SelectRow({ label, value, onChange, options }: { label: string; value: string; onChange: (v: string) => void; options: [string, string][] }) {
  return (
    <div className="space-y-1.5">
      <Label className="text-xs text-muted-foreground">{label}</Label>
      <Select value={value} onValueChange={onChange}>
        <SelectTrigger className="w-full"><SelectValue /></SelectTrigger>
        <SelectContent>
          {options.map(([v, l]) => (
            <SelectItem key={v} value={v}>{l}</SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  );
}

export function ToggleRow({ label, description, checked, onChange, children }: { label: string; description?: string; checked: boolean; onChange: (v: boolean) => void; children?: React.ReactNode }) {
  return (
    <div className="rounded-xl border p-3">
      <div className="flex items-center justify-between gap-4">
        <div>
          <p className="text-sm font-medium">{label}</p>
          {description && <p className="text-xs text-muted-foreground">{description}</p>}
        </div>
        <Switch checked={checked} onCheckedChange={onChange} />
      </div>
      {children}
    </div>
  );
}

const CONTEXT_PRESETS = [
  "We are here to improve, not to blame.",
  "Everyone did the best job they could, given what they knew at the time.",
  "Focus on what we can control.",
  "Sprint goal: ",
  "What we shipped this sprint: ",
];

function ContextPresets({ onPick }: { onPick: (t: string) => void }) {
  return (
    <Popover>
      <PopoverTrigger className="text-xs font-medium text-primary hover:underline">Presets</PopoverTrigger>
      <PopoverContent align="end" className="w-80 p-1">
        {CONTEXT_PRESETS.map((p) => (
          <button key={p} type="button" onClick={() => onPick(p)} className="w-full rounded-md px-2 py-1.5 text-left text-sm hover:bg-muted">
            {p}
          </button>
        ))}
      </PopoverContent>
    </Popover>
  );
}

export function TopicsEditor({ type, topics, onChange }: { type: MeetingType; topics: Topic[]; onChange: (t: Topic[]) => void }) {
  const update = (i: number, patch: Partial<Topic>) => onChange(topics.map((t, j) => (j === i ? { ...t, ...patch } : t)));
  const move = (i: number, d: number) => {
    const j = i + d;
    if (j < 0 || j >= topics.length) return;
    const next = [...topics];
    [next[i], next[j]] = [next[j], next[i]];
    onChange(next);
  };
  return (
    <div className="space-y-2">
      {topics.map((t, i) => (
        <div key={t.id} className="flex items-start gap-2 rounded-xl border p-2">
          <GripVertical className="mt-2 size-4 shrink-0 text-muted-foreground" />
          <Popover>
            <PopoverTrigger className="mt-0.5 flex size-8 shrink-0 items-center justify-center rounded-lg border" style={{ background: `${t.color}22` }}>
              <TopicIcon name={t.icon} color={t.color} className="size-4" />
            </PopoverTrigger>
            <PopoverContent className="w-72 space-y-3">
              <div className="flex flex-wrap gap-1.5">
                {PALETTE.map((c) => (
                  <button key={c} type="button" onClick={() => update(i, { color: c })} className={cn("size-6 rounded-full", t.color === c && "ring-2 ring-foreground ring-offset-2 ring-offset-background")} style={{ background: c }} />
                ))}
              </div>
              <div className="grid grid-cols-9 gap-1">
                {TOPIC_ICONS.map((ic) => (
                  <button key={ic} type="button" onClick={() => update(i, { icon: ic })} className={cn("flex size-7 items-center justify-center rounded-md hover:bg-muted", t.icon === ic && "bg-muted")}>
                    <TopicIcon name={ic} color={t.color} className="size-4" />
                  </button>
                ))}
              </div>
            </PopoverContent>
          </Popover>
          <div className="min-w-0 flex-1 space-y-1">
            <Input value={t.title} onChange={(e) => update(i, { title: e.target.value })} placeholder={type === "standup" ? "Question…" : "Topic…"} className="h-8" />
            <Input value={t.description ?? ""} onChange={(e) => update(i, { description: e.target.value })} placeholder={type === "standup" ? "Hint, eg. Share your update…" : "Description…"} className="h-8 text-xs" />
            {type === "standup" && (
              <Select value={t.type ?? "none"} onValueChange={(v) => update(i, { type: v === "none" ? undefined : (v as Topic["type"]) })}>
                <SelectTrigger size="sm" className="h-7 text-xs"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">No status type</SelectItem>
                  <SelectItem value="done">Done</SelectItem>
                  <SelectItem value="doing">Doing</SelectItem>
                  <SelectItem value="blocked">Blocked</SelectItem>
                </SelectContent>
              </Select>
            )}
          </div>
          <div className="flex flex-col">
            <Button type="button" variant="ghost" size="icon-xs" onClick={() => move(i, -1)} aria-label="Move up"><ArrowUp /></Button>
            <Button type="button" variant="ghost" size="icon-xs" onClick={() => move(i, 1)} aria-label="Move down"><ArrowDown /></Button>
          </div>
          <Button type="button" variant="ghost" size="icon-sm" onClick={() => onChange(topics.filter((_, j) => j !== i))} aria-label="Remove">
            <Trash2 />
          </Button>
        </div>
      ))}
      <Button
        type="button"
        variant="outline"
        size="sm"
        onClick={() => onChange([...topics, { id: `t${Date.now()}`, title: type === "standup" ? "New question" : "New topic", color: PALETTE[(topics.length * 3) % PALETTE.length], icon: "star", description: "" }])}
      >
        <Plus /> Add {type === "standup" ? "question" : "topic"}
      </Button>
    </div>
  );
}

const WEEKDAYS = ["mon", "tue", "wed", "thu", "fri", "sat", "sun"];

export function RecurrenceEditor({ value, onChange, type }: { value: SeriesSchedule | null; onChange: (s: SeriesSchedule | null) => void; type: MeetingType }) {
  const rec = value?.recurrence ?? null;
  const freq = rec?.freq ?? "none";
  const tz = value?.timezone ?? (typeof Intl !== "undefined" ? Intl.DateTimeFormat().resolvedOptions().timeZone : "UTC");
  const setRec = (patch: Partial<NonNullable<SeriesSchedule["recurrence"]>>) =>
    onChange({ ...(value ?? {}), timezone: tz, recurrence: { freq: "week", interval: 1, ...(rec ?? {}), ...patch } as NonNullable<SeriesSchedule["recurrence"]> });
  return (
    <div className="space-y-4">
      <div className="grid gap-3 sm:grid-cols-2">
        <div className="space-y-1.5">
          <Label>Repeats</Label>
          <Select
            value={freq}
            onValueChange={(v) => {
              if (v === "none") onChange(value ? { ...value, recurrence: null } : null);
              else setRec({ freq: v as "day" | "week" | "month", weekdays: v === "week" ? rec?.weekdays ?? ["mon"] : v === "day" ? ["mon", "tue", "wed", "thu", "fri"] : undefined });
            }}
          >
            <SelectTrigger className="w-full"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="none">Does not repeat</SelectItem>
              <SelectItem value="day">Every weekday</SelectItem>
              <SelectItem value="week">Weekly</SelectItem>
              <SelectItem value="month">Monthly</SelectItem>
            </SelectContent>
          </Select>
        </div>
        {freq !== "none" && (
          <div className="space-y-1.5">
            <Label>{freq === "month" ? "Every N months" : freq === "week" ? "Every N weeks" : "Interval"}</Label>
            <Input type="number" min={1} max={12} value={rec?.interval ?? 1} onChange={(e) => setRec({ interval: Math.max(1, Number(e.target.value)) })} disabled={freq === "day"} />
          </div>
        )}
      </div>
      {freq === "week" && (
        <div className="space-y-1.5">
          <Label>On</Label>
          <div className="flex flex-wrap gap-1">
            {WEEKDAYS.map((d) => {
              const on = rec?.weekdays?.includes(d);
              return (
                <button
                  key={d}
                  type="button"
                  onClick={() => setRec({ weekdays: on ? (rec?.weekdays ?? []).filter((x) => x !== d) : [...(rec?.weekdays ?? []), d] })}
                  className={cn("h-8 w-11 rounded-lg border text-xs font-semibold uppercase", on ? "border-primary bg-primary text-primary-foreground" : "text-muted-foreground")}
                >
                  {d}
                </button>
              );
            })}
          </div>
        </div>
      )}
      {freq === "month" && (
        <div className="space-y-1.5">
          <Label>Day of month</Label>
          <Input type="number" min={1} max={28} value={rec?.dayOfMonth ?? 1} onChange={(e) => setRec({ dayOfMonth: Number(e.target.value) })} />
        </div>
      )}
      {freq !== "none" && (
        <>
          <div className="grid gap-3 sm:grid-cols-2">
            <div className="space-y-1.5">
              <Label>Send invites at</Label>
              <Input type="time" value={value?.time ?? "09:00"} onChange={(e) => onChange({ ...(value ?? {}), time: e.target.value })} />
            </div>
            <div className="space-y-1.5">
              <Label>Timezone</Label>
              <Input value={tz} onChange={(e) => onChange({ ...(value ?? {}), timezone: e.target.value })} />
            </div>
          </div>
          <div className="space-y-1.5">
            <Label>Opens</Label>
            <Select value={value?.opens ?? "anytime"} onValueChange={(v) => onChange({ ...(value ?? {}), opens: v as SeriesSchedule["opens"] })}>
              <SelectTrigger className="w-full"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="anytime">On each scheduled day</SelectItem>
                <SelectItem value="afterPrevious">After the previous one closes</SelectItem>
                <SelectItem value="onStart">When the meeting starts</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <ToggleRow
            label="Reminders"
            description="Nudge anyone the meeting is still waiting on"
            checked={!!value?.reminders?.enabled}
            onChange={(v) => onChange({ ...(value ?? {}), reminders: { ...(value?.reminders ?? {}), enabled: v, time: value?.reminders?.time ?? "11:00" } })}
          >
            {value?.reminders?.enabled && (
              <div className="mt-2 flex items-center gap-2 text-sm">
                Remind at <Input type="time" className="w-32" value={value.reminders.time ?? "11:00"} onChange={(e) => onChange({ ...value, reminders: { ...value.reminders!, time: e.target.value } })} />
              </div>
            )}
          </ToggleRow>
          <ToggleRow
            label="Close automatically"
            description="Close the meeting at a set time and email a summary to the team"
            checked={!!value?.close?.enabled}
            onChange={(v) => onChange({ ...(value ?? {}), close: { ...(value?.close ?? {}), enabled: v, time: value?.close?.time ?? "17:00", summary: true } })}
          >
            {value?.close?.enabled && (
              <div className="mt-2 flex items-center gap-2 text-sm">
                Close at <Input type="time" className="w-32" value={value.close.time ?? "17:00"} onChange={(e) => onChange({ ...value, close: { ...value.close!, time: e.target.value } })} />
              </div>
            )}
          </ToggleRow>
        </>
      )}
      {freq === "none" && type === "standup" && <p className="text-sm text-muted-foreground">Standups usually repeat every weekday. Pick a schedule above.</p>}
    </div>
  );
}

export { BUILTIN_DECKS };
