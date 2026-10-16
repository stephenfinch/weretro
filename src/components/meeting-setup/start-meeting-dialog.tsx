"use client";

import { useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { ArrowLeft, ClipboardCheck, HeartPulse, LayoutGrid, MessagesSquare, Plus, Search, Spade } from "lucide-react";
import { toast } from "sonner";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import { BUILTIN_DECKS, DEFAULT_OPTIONS, DEFAULT_STEPS, MEETING_TYPE_BLURB, MEETING_TYPE_LABEL } from "@/lib/constants";
import { RETRO_TEMPLATES, STANDUP_TEMPLATES, type BuiltinTemplate } from "@/lib/templates";
import type { DeckCard, MeetingType, TemplateBody } from "@/lib/types";
import { createMeetingAction } from "@/app/actions/meetings";
import { SettingsEditor, TopicIcon, type MeetingDraft } from "./settings-editor";

export type CustomTemplate = { id: string; name: string; meetingType: string; descriptionShort: string; body: TemplateBody; teamId: string | null };
export type HealthModelSummary = { id: string; name: string; description: string; style: string; category: string; dimensionNames: string[]; teamId: string | null; orgId: string | null };

const TYPE_ICON: Record<MeetingType, typeof LayoutGrid> = {
  retrospective: LayoutGrid,
  standup: MessagesSquare,
  healthCheck: HeartPulse,
  estimation: Spade,
};

function today() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

function draftFor(type: MeetingType): MeetingDraft {
  return {
    type,
    title: type === "standup" ? "Daily Standup" : "",
    date: today(),
    context: "",
    anonymity: "names",
    topics: [],
    steps: structuredClone(DEFAULT_STEPS[type]),
    options: { ...DEFAULT_OPTIONS },
    schedule: null,
    invite: false,
  };
}

export function StartMeetingDialog({
  teamId,
  allowed,
  customTemplates,
  healthModels,
  decks,
  defaultDeckId,
  defaultHealthModelId,
  initialType,
  trigger,
}: {
  teamId: string;
  allowed: MeetingType[];
  customTemplates: CustomTemplate[];
  healthModels: HealthModelSummary[];
  decks: { id: string; name: string; cards: DeckCard[] }[];
  defaultDeckId?: string | null;
  defaultHealthModelId?: string | null;
  initialType?: MeetingType;
  trigger?: React.ReactNode;
}) {
  const [open, setOpen] = useState(false);
  const [type, setType] = useState<MeetingType | null>(initialType ?? null);
  const [stage, setStage] = useState<"type" | "pick" | "options">(initialType ? "pick" : "type");
  const [draft, setDraft] = useState<MeetingDraft>(draftFor(initialType ?? "retrospective"));
  const [templateId, setTemplateId] = useState<string | null>(null);
  const [pending, start] = useTransition();
  const router = useRouter();
  const allDecks = useMemo(() => [...BUILTIN_DECKS, ...decks], [decks]);

  const reset = () => {
    setType(initialType ?? null);
    setStage(initialType ? "pick" : "type");
    setDraft(draftFor(initialType ?? "retrospective"));
    setTemplateId(null);
  };

  const chooseType = (t: MeetingType) => {
    setType(t);
    const d = draftFor(t);
    if (t === "estimation") {
      d.deckId = defaultDeckId ?? "scrum";
      setDraft(d);
      setStage("options");
      return;
    }
    if (t === "healthCheck" && defaultHealthModelId) d.healthModelId = defaultHealthModelId;
    setDraft(d);
    setStage("pick");
  };

  const pickTemplate = (id: string, name: string, body: TemplateBody) => {
    setTemplateId(id);
    setDraft({
      ...draft,
      title: draft.type === "standup" ? name : draft.title,
      topics: structuredClone(body.topics),
      schedule: body.schedule ?? (draft.type === "standup" ? { recurrence: { freq: "week", interval: 1, weekdays: ["mon", "tue", "wed", "thu", "fri"] }, time: "09:00", opens: "anytime" } : null),
      options: { ...draft.options, ...(body.options ?? {}) },
    });
    setStage("options");
  };

  const submit = () =>
    start(async () => {
      if (!type) return;
      const r = await createMeetingAction(teamId, {
        type,
        title: draft.title,
        date: draft.date,
        templateId,
        topics: draft.topics,
        steps: draft.steps,
        options: draft.options,
        anonymity: draft.anonymity,
        context: draft.context,
        healthModelId: draft.healthModelId,
        deckId: draft.deckId,
        invite: draft.invite,
        closePrevious: draft.closePrevious,
        schedule: draft.schedule,
      });
      if (!r.ok) return void toast.error(r.error);
      setOpen(false);
      router.push(`/m/${r.data!.id}`);
    });

  return (
    <Dialog
      open={open}
      onOpenChange={(o) => {
        setOpen(o);
        if (!o) setTimeout(reset, 200);
      }}
    >
      <DialogTrigger asChild>
        {trigger ?? (
          <Button>
            <Plus /> Start a meeting
          </Button>
        )}
      </DialogTrigger>
      <DialogContent className="flex max-h-[90vh] flex-col gap-0 overflow-hidden p-0 sm:max-w-4xl">
        <DialogHeader className="border-b px-6 py-4">
          <div className="flex items-center gap-3">
            {stage !== "type" && !(initialType && stage === "pick") && (
              <Button variant="ghost" size="icon-sm" onClick={() => setStage(stage === "options" && type !== "estimation" ? "pick" : "type")} aria-label="Back">
                <ArrowLeft />
              </Button>
            )}
            <DialogTitle>
              {stage === "type" ? "Start a meeting" : stage === "pick" ? (type === "healthCheck" ? "Choose a health model" : "Select a template") : `${MEETING_TYPE_LABEL[type!]} options`}
            </DialogTitle>
            {stage !== "type" && (
              <div className="ml-auto hidden items-center gap-2 text-xs text-muted-foreground sm:flex">
                <span className={cn("rounded-full px-2 py-0.5", stage === "pick" ? "bg-primary text-primary-foreground" : "bg-muted")}>1. {type === "healthCheck" ? "Health model" : "Template"}</span>
                <span className={cn("rounded-full px-2 py-0.5", stage === "options" ? "bg-primary text-primary-foreground" : "bg-muted")}>2. Options</span>
              </div>
            )}
          </div>
        </DialogHeader>
        <div className="min-h-0 flex-1 overflow-y-auto px-6 py-5">
          {stage === "type" && (
            <div className="grid gap-3 sm:grid-cols-2">
              {(["retrospective", "standup", "healthCheck", "estimation"] as MeetingType[]).map((t) => {
                const Icon = TYPE_ICON[t];
                const enabled = allowed.includes(t);
                return (
                  <button
                    key={t}
                    type="button"
                    disabled={!enabled}
                    onClick={() => chooseType(t)}
                    className="group flex items-start gap-4 rounded-2xl border bg-card p-5 text-left transition hover:border-primary hover:shadow-md disabled:pointer-events-none disabled:opacity-40"
                  >
                    <span className="flex size-12 shrink-0 items-center justify-center rounded-xl bg-primary/10 text-primary group-hover:bg-primary group-hover:text-primary-foreground">
                      <Icon className="size-6" />
                    </span>
                    <span>
                      <span className="block font-semibold">{MEETING_TYPE_LABEL[t]}</span>
                      <span className="text-sm text-muted-foreground">{MEETING_TYPE_BLURB[t]}</span>
                    </span>
                  </button>
                );
              })}
            </div>
          )}
          {stage === "pick" && type === "retrospective" && (
            <TemplatePicker builtins={RETRO_TEMPLATES} custom={customTemplates.filter((t) => t.meetingType === "retrospective")} onPick={pickTemplate} />
          )}
          {stage === "pick" && type === "standup" && (
            <TemplatePicker builtins={STANDUP_TEMPLATES} custom={customTemplates.filter((t) => t.meetingType === "standup")} onPick={pickTemplate} />
          )}
          {stage === "pick" && type === "healthCheck" && (
            <HealthModelPicker
              models={healthModels}
              selected={draft.healthModelId ?? null}
              onPick={(id) => {
                const m = healthModels.find((x) => x.id === id);
                setDraft({ ...draft, healthModelId: id, title: draft.title || (m?.name ?? "") });
                setStage("options");
              }}
            />
          )}
          {stage === "options" && <SettingsEditor draft={draft} setDraft={setDraft} mode="create" decks={allDecks} />}
        </div>
        {stage === "options" && (
          <div className="flex items-center justify-between gap-4 border-t px-6 py-4">
            <label className="flex items-center gap-2 text-sm">
              <Switch checked={!!draft.invite} onCheckedChange={(v) => setDraft({ ...draft, invite: v })} /> Invite team immediately
            </label>
            <Button onClick={submit} disabled={pending || (type === "healthCheck" && !draft.healthModelId)}>
              {pending ? "Starting…" : type === "standup" ? "Create standup" : `Start ${MEETING_TYPE_LABEL[type!].toLowerCase()}`}
            </Button>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}

const CATEGORIES = [
  { key: "custom", label: "Custom" },
  { key: "standard", label: "Standard" },
  { key: "milestone", label: "Milestone" },
  { key: "specialized", label: "Specialized" },
  { key: "community", label: "Community" },
];

function TemplatePicker({ builtins, custom, onPick }: { builtins: BuiltinTemplate[]; custom: CustomTemplate[]; onPick: (id: string, name: string, body: TemplateBody) => void }) {
  const cats = CATEGORIES.filter((c) => (c.key === "custom" ? custom.length : builtins.some((b) => b.category === c.key)));
  const [cat, setCat] = useState(cats.find((c) => c.key === "standard")?.key ?? cats[0]?.key ?? "standard");
  const [q, setQ] = useState("");
  const [sort, setSort] = useState<"popularity" | "alphabetical">("popularity");
  const list = useMemo(() => {
    const items =
      cat === "custom"
        ? custom.map((c) => ({ id: c.id, name: c.name, descriptionShort: c.descriptionShort, body: c.body, popularity: 0, tags: [] as string[] }))
        : builtins.filter((b) => b.category === cat);
    const filtered = q
      ? [...builtins, ...custom.map((c) => ({ id: c.id, name: c.name, descriptionShort: c.descriptionShort, body: c.body, popularity: 0, tags: [] as string[] }))].filter(
          (t) => t.name.toLowerCase().includes(q.toLowerCase()) || t.body.topics.some((tp) => tp.title.toLowerCase().includes(q.toLowerCase())),
        )
      : items;
    return [...filtered].sort((a, b) => (sort === "alphabetical" ? a.name.localeCompare(b.name) : b.popularity - a.popularity || a.name.localeCompare(b.name)));
  }, [cat, q, sort, builtins, custom]);
  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-2">
        <div className="flex flex-wrap gap-1 rounded-xl bg-muted p-1">
          {cats.map((c) => (
            <button key={c.key} type="button" onClick={() => { setCat(c.key); setQ(""); }} className={cn("rounded-lg px-3 py-1 text-sm font-medium", cat === c.key && !q ? "bg-background shadow-sm" : "text-muted-foreground")}>
              {c.label}
            </button>
          ))}
        </div>
        <div className="relative ml-auto">
          <Search className="absolute top-1/2 left-2.5 size-4 -translate-y-1/2 text-muted-foreground" />
          <Input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search templates…" className="h-9 w-56 pl-8" />
        </div>
        <button type="button" onClick={() => setSort(sort === "popularity" ? "alphabetical" : "popularity")} className="text-xs font-medium text-muted-foreground uppercase hover:text-foreground">
          {sort === "popularity" ? "By popularity" : "A–Z"}
        </button>
      </div>
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {list.map((t) => (
          <button key={t.id} type="button" onClick={() => onPick(t.id, t.name, t.body)} className="flex flex-col gap-2 rounded-2xl border bg-card p-4 text-left transition hover:border-primary hover:shadow-md">
            <span className="font-medium">{t.name}</span>
            <span className="line-clamp-2 text-xs text-muted-foreground">{t.body.topics.map((tp) => tp.title).join(" · ")}</span>
            <span className="mt-auto flex gap-1.5 pt-1">
              {t.body.topics.slice(0, 6).map((tp) => (
                <span key={tp.id} className="flex size-7 items-center justify-center rounded-lg" style={{ background: `${tp.color}1f` }}>
                  <TopicIcon name={tp.icon} color={tp.color} className="size-4" />
                </span>
              ))}
            </span>
          </button>
        ))}
        {!list.length && <p className="col-span-full py-8 text-center text-sm text-muted-foreground">No templates match.</p>}
      </div>
    </div>
  );
}

function HealthModelPicker({ models, selected, onPick }: { models: HealthModelSummary[]; selected: string | null; onPick: (id: string) => void }) {
  const [q, setQ] = useState("");
  const [cat, setCat] = useState<string>("all");
  const cats = ["all", ...Array.from(new Set(models.map((m) => (m.teamId || m.orgId ? "custom" : m.category))))];
  const list = models.filter((m) => (cat === "all" || (cat === "custom" ? m.teamId || m.orgId : m.category === cat && !m.teamId && !m.orgId)) && (!q || m.name.toLowerCase().includes(q.toLowerCase()) || m.dimensionNames.join(" ").toLowerCase().includes(q.toLowerCase())));
  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-2">
        <div className="flex flex-wrap gap-1 rounded-xl bg-muted p-1">
          {cats.map((c) => (
            <button key={c} type="button" onClick={() => setCat(c)} className={cn("rounded-lg px-3 py-1 text-sm font-medium capitalize", cat === c ? "bg-background shadow-sm" : "text-muted-foreground")}>
              {c === "maturityModel" ? "Maturity models" : c}
            </button>
          ))}
        </div>
        <Input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search health models…" className="ml-auto h-9 w-56" />
      </div>
      <div className="grid gap-3 sm:grid-cols-2">
        {list.map((m) => (
          <button key={m.id} type="button" onClick={() => onPick(m.id)} className={cn("flex flex-col gap-2 rounded-2xl border bg-card p-4 text-left transition hover:border-primary hover:shadow-md", selected === m.id && "border-primary ring-2 ring-primary/30")}>
            <span className="flex items-center gap-2 font-medium">
              <ClipboardCheck className="size-4 text-primary" /> {m.name}
              <Badge variant="secondary" className="ml-auto capitalize">{m.style}</Badge>
            </span>
            <span className="line-clamp-2 text-xs text-muted-foreground">{m.description}</span>
            <span className="flex flex-wrap gap-1">
              {m.dimensionNames.slice(0, 8).map((d) => (
                <span key={d} className="rounded-full bg-muted px-2 py-0.5 text-[11px]">{d}</span>
              ))}
              {m.dimensionNames.length > 8 && <span className="text-[11px] text-muted-foreground">+{m.dimensionNames.length - 8}</span>}
            </span>
          </button>
        ))}
      </div>
    </div>
  );
}
