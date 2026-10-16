"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Copy, FilePlus2, Loader2, Plus, Sparkles, Trash2, ArrowDown, ArrowUp } from "lucide-react";
import { toast } from "sonner";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { cn } from "@/lib/utils";
import { TopicsEditor } from "@/components/meeting-setup/settings-editor";
import { RETRO_TEMPLATES, STANDUP_TEMPLATES } from "@/lib/templates";
import { BUILTIN_DECKS } from "@/lib/constants";
import type { DeckCard, TemplateBody, Topic } from "@/lib/types";
import { getHealthModelAction, saveDeckAction, saveHealthModelAction, saveTemplate } from "@/app/actions/templates";

function StartWith({ onBlank, onAi, onCopy, copyOptions, aiEnabled, busy }: { onBlank: () => void; onAi?: (prompt: string) => void; onCopy: (id: string) => void; copyOptions: { id: string; name: string }[]; aiEnabled?: boolean; busy?: boolean }) {
  const [prompt, setPrompt] = useState("");
  const [copy, setCopy] = useState("");
  return (
    <div className="grid gap-3 sm:grid-cols-3">
      <button type="button" onClick={onBlank} className="flex flex-col items-center gap-2 rounded-2xl border p-5 text-center hover:border-primary">
        <FilePlus2 className="size-7 text-primary" />
        <span className="font-medium">Blank</span>
        <span className="text-xs text-muted-foreground">Start from scratch</span>
      </button>
      <div className={cn("flex flex-col gap-2 rounded-2xl border p-4", !aiEnabled && "opacity-50")}>
        <span className="flex items-center gap-2 font-medium"><Sparkles className="size-4 text-primary" /> Generative AI</span>
        <Textarea value={prompt} disabled={!aiEnabled} onChange={(e) => setPrompt(e.target.value)} rows={3} placeholder={aiEnabled ? "Describe it, eg. a retro after a stressful launch" : "Set ANTHROPIC_API_KEY to enable"} />
        <Button size="sm" disabled={!aiEnabled || !prompt.trim() || busy} onClick={() => onAi?.(prompt)}>{busy ? <Loader2 className="animate-spin" /> : "Generate"}</Button>
      </div>
      <div className="flex flex-col gap-2 rounded-2xl border p-4">
        <span className="flex items-center gap-2 font-medium"><Copy className="size-4 text-primary" /> Copy existing</span>
        <Select value={copy} onValueChange={setCopy}>
          <SelectTrigger className="w-full"><SelectValue placeholder="Choose…" /></SelectTrigger>
          <SelectContent>{copyOptions.map((o) => <SelectItem key={o.id} value={o.id}>{o.name}</SelectItem>)}</SelectContent>
        </Select>
        <Button size="sm" variant="outline" disabled={!copy} onClick={() => onCopy(copy)}>Copy</Button>
      </div>
    </div>
  );
}

// ── Templates ────────────────────────────────────────────────────────────
export function TemplateEditor({
  open,
  onOpenChange,
  teamId,
  orgId,
  meetingType,
  existing,
  custom,
  aiEnabled,
}: {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  teamId: string | null;
  orgId: string;
  meetingType: "retrospective" | "standup";
  existing?: { id: string; name: string; descriptionShort: string; body: TemplateBody } | null;
  custom: { id: string; name: string; body: TemplateBody }[];
  aiEnabled?: boolean;
}) {
  const router = useRouter();
  const [stage, setStage] = useState<"start" | "edit">(existing ? "edit" : "start");
  const [name, setName] = useState(existing?.name ?? "");
  const [desc, setDesc] = useState(existing?.descriptionShort ?? "");
  const [topics, setTopics] = useState<Topic[]>(existing?.body.topics ?? []);
  const [busy, setBusy] = useState(false);
  const [ai, setAi] = useState(false);
  const builtins = meetingType === "retrospective" ? RETRO_TEMPLATES : STANDUP_TEMPLATES;
  const all = [...custom.map((c) => ({ id: c.id, name: c.name, body: c.body })), ...builtins.map((b) => ({ id: b.id, name: b.name, body: b.body }))];
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-3xl">
        <DialogHeader>
          <DialogTitle>{existing ? `Edit ${existing.name}` : `New ${meetingType} template`}</DialogTitle>
        </DialogHeader>
        {stage === "start" ? (
          <StartWith
            aiEnabled={aiEnabled}
            busy={busy}
            copyOptions={all.map((a) => ({ id: a.id, name: a.name }))}
            onBlank={() => {
              setTopics([{ id: "t1", title: meetingType === "standup" ? "What did you do?" : "Topic 1", color: "#22C55E", icon: "smile", description: "" }]);
              setStage("edit");
            }}
            onCopy={(id) => {
              const t = all.find((x) => x.id === id)!;
              setName(`Copy of ${t.name}`);
              setTopics(structuredClone(t.body.topics));
              setStage("edit");
            }}
            onAi={async (prompt) => {
              setBusy(true);
              const res = await fetch("/api/ai/generate", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ kind: "template", prompt, meetingType, orgId }) });
              const json = await res.json();
              setBusy(false);
              if (!res.ok) return void toast.error(json.error);
              setName(json.name);
              setDesc(json.description);
              setTopics(json.topics);
              setAi(true);
              setStage("edit");
            }}
          />
        ) : (
          <div className="space-y-4">
            <div className="grid gap-3 sm:grid-cols-2">
              <div className="space-y-1.5"><Label>Template name</Label><Input value={name} onChange={(e) => setName(e.target.value)} /></div>
              <div className="space-y-1.5"><Label>Short description</Label><Input value={desc} onChange={(e) => setDesc(e.target.value)} /></div>
            </div>
            <TopicsEditor type={meetingType} topics={topics} onChange={setTopics} />
          </div>
        )}
        {stage === "edit" && (
          <DialogFooter>
            <Button
              disabled={busy}
              onClick={async () => {
                setBusy(true);
                const r = await saveTemplate({ id: existing?.id, teamId, orgId, meetingType, name, descriptionShort: desc, body: { topics }, aiGenerated: ai });
                setBusy(false);
                if (!r.ok) return void toast.error(r.error);
                toast.success("Template saved");
                onOpenChange(false);
                router.refresh();
              }}
            >
              Save template
            </Button>
          </DialogFooter>
        )}
      </DialogContent>
    </Dialog>
  );
}

// ── Health models ────────────────────────────────────────────────────────
type Dim = { id?: string; name: string; description: string; minLabel: string; maxLabel: string; valueLabels: string[] | null };
type Group = { id?: string; name: string; description: string; dimensions: Dim[] };

export function HealthModelEditor({
  open,
  onOpenChange,
  teamId,
  orgId,
  modelId,
  copyOptions,
  aiEnabled,
}: {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  teamId: string | null;
  orgId: string;
  modelId?: string | null;
  copyOptions: { id: string; name: string }[];
  aiEnabled?: boolean;
}) {
  const router = useRouter();
  const [stage, setStage] = useState<"start" | "edit">(modelId ? "edit" : "start");
  const [loaded, setLoaded] = useState(false);
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [style, setStyle] = useState("numeric");
  const [range, setRange] = useState(5);
  const [na, setNa] = useState(false);
  const [flip, setFlip] = useState(false);
  const [groups, setGroups] = useState<Group[]>([]);
  const [busy, setBusy] = useState(false);
  const [ai, setAi] = useState(false);
  const load = async (id: string, copy: boolean) => {
    const m = await getHealthModelAction(id);
    if (!m) return;
    setName(copy ? `Copy of ${m.name}` : m.name);
    setDescription(m.description);
    setStyle(m.style);
    setRange(m.maxRating - m.minRating + 1);
    setNa(m.notApplicableOption);
    setFlip(m.flipOrder);
    setGroups(m.groups.map((g) => ({ id: copy ? undefined : g.id, name: g.name, description: g.description, dimensions: g.dimensions.map((d) => ({ id: copy ? undefined : d.id, name: d.name, description: d.description, minLabel: d.minLabel, maxLabel: d.maxLabel, valueLabels: d.valueLabels })) })));
    setStage("edit");
  };
  if (open && modelId && !loaded) {
    setLoaded(true);
    void Promise.resolve().then(() => load(modelId, false));
  }
  const updDim = (gi: number, di: number, patch: Partial<Dim>) => setGroups(groups.map((g, i) => (i === gi ? { ...g, dimensions: g.dimensions.map((d, j) => (j === di ? { ...d, ...patch } : d)) } : g)));
  const n = style === "happiness" ? (range === 3 ? 3 : 5) : style === "favorability" ? 3 : range;
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-3xl">
        <DialogHeader><DialogTitle>{modelId ? `Edit ${name || "health model"}` : "New health model"}</DialogTitle></DialogHeader>
        {stage === "start" ? (
          <StartWith
            aiEnabled={aiEnabled}
            busy={busy}
            copyOptions={copyOptions}
            onBlank={() => {
              setGroups([{ name: "", description: "", dimensions: [{ name: "", description: "", minLabel: "", maxLabel: "", valueLabels: null }] }]);
              setStage("edit");
            }}
            onCopy={(id) => void load(id, true)}
            onAi={async (prompt) => {
              setBusy(true);
              const res = await fetch("/api/ai/generate", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ kind: "healthModel", prompt, orgId }) });
              const json = await res.json();
              setBusy(false);
              if (!res.ok) return void toast.error(json.error);
              setName(json.name);
              setDescription(json.description);
              setStyle(json.style);
              setGroups(json.groups.map((g: Group) => ({ ...g, description: "", dimensions: g.dimensions.map((d) => ({ ...d, valueLabels: null })) })));
              setAi(true);
              setStage("edit");
            }}
          />
        ) : (
          <div className="space-y-4">
            <div className="grid gap-3 sm:grid-cols-2">
              <div className="space-y-1.5"><Label>Health model</Label><Input value={name} onChange={(e) => setName(e.target.value)} placeholder="Health model name" /></div>
              <div className="space-y-1.5">
                <Label>Style</Label>
                <Select value={style} onValueChange={setStyle}>
                  <SelectTrigger className="w-full"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="numeric">Numeric</SelectItem>
                    <SelectItem value="happiness">Happiness</SelectItem>
                    <SelectItem value="likert">Likert</SelectItem>
                    <SelectItem value="matrix">Matrix</SelectItem>
                    <SelectItem value="favorability">Favorability</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
            <Textarea value={description} onChange={(e) => setDescription(e.target.value)} placeholder="Description" rows={2} />
            <div className="flex flex-wrap items-center gap-4 text-sm">
              {(style === "numeric" || style === "matrix" || style === "happiness") && (
                <label className="flex items-center gap-2">Range
                  <Select value={String(range)} onValueChange={(v) => setRange(Number(v))}>
                    <SelectTrigger size="sm" className="w-20"><SelectValue /></SelectTrigger>
                    <SelectContent>{(style === "happiness" ? [3, 5] : [3, 4, 5, 6, 7, 10]).map((r) => <SelectItem key={r} value={String(r)}>1–{r}</SelectItem>)}</SelectContent>
                  </Select>
                </label>
              )}
              <label className="flex items-center gap-2"><Switch checked={na} onCheckedChange={setNa} /> Include N/A</label>
              <label className="flex items-center gap-2"><Switch checked={flip} onCheckedChange={setFlip} /> Flip order</label>
            </div>
            {groups.map((g, gi) => (
              <div key={gi} className="space-y-2 rounded-2xl border p-3">
                <div className="flex gap-2">
                  <Input value={g.name} onChange={(e) => setGroups(groups.map((x, i) => (i === gi ? { ...x, name: e.target.value } : x)))} placeholder="Category title… (optional)" className="font-medium" />
                  {groups.length > 1 && <Button variant="ghost" size="icon" onClick={() => confirm("Delete this category and its dimensions?") && setGroups(groups.filter((_, i) => i !== gi))}><Trash2 /></Button>}
                </div>
                {g.dimensions.map((d, di) => (
                  <div key={di} className="space-y-1.5 rounded-xl bg-muted/40 p-3">
                    <div className="flex gap-2">
                      <Input value={d.name} onChange={(e) => updDim(gi, di, { name: e.target.value })} placeholder="Name…" className="font-medium" />
                      <Button variant="ghost" size="icon-sm" disabled={di === 0} onClick={() => setGroups(groups.map((x, i) => { if (i !== gi) return x; const ds = [...x.dimensions]; [ds[di - 1], ds[di]] = [ds[di], ds[di - 1]]; return { ...x, dimensions: ds }; }))}><ArrowUp /></Button>
                      <Button variant="ghost" size="icon-sm" disabled={di === g.dimensions.length - 1} onClick={() => setGroups(groups.map((x, i) => { if (i !== gi) return x; const ds = [...x.dimensions]; [ds[di + 1], ds[di]] = [ds[di], ds[di + 1]]; return { ...x, dimensions: ds }; }))}><ArrowDown /></Button>
                      <Button variant="ghost" size="icon-sm" onClick={() => confirm("Delete this dimension? Past ratings for it will be lost.") && setGroups(groups.map((x, i) => (i === gi ? { ...x, dimensions: x.dimensions.filter((_, j) => j !== di) } : x)))}><Trash2 /></Button>
                    </div>
                    <Input value={d.description} onChange={(e) => updDim(gi, di, { description: e.target.value })} placeholder="Description…" />
                    {style === "matrix" ? (
                      <div className="grid gap-1">
                        {Array.from({ length: n }, (_, k) => (
                          <Input key={k} value={d.valueLabels?.[k] ?? ""} onChange={(e) => { const v = [...(d.valueLabels ?? Array(n).fill(""))]; v[k] = e.target.value; updDim(gi, di, { valueLabels: v }); }} placeholder={`Rating ${k + 1} label`} className="h-8 text-xs" />
                        ))}
                      </div>
                    ) : (
                      style !== "likert" && style !== "favorability" && (
                        <div className="grid grid-cols-2 gap-2">
                          <Input value={d.minLabel} onChange={(e) => updDim(gi, di, { minLabel: e.target.value })} placeholder="Min label" className="h-8 text-xs" />
                          <Input value={d.maxLabel} onChange={(e) => updDim(gi, di, { maxLabel: e.target.value })} placeholder="Max label" className="h-8 text-xs" />
                        </div>
                      )
                    )}
                  </div>
                ))}
                <Button size="sm" variant="outline" onClick={() => setGroups(groups.map((x, i) => (i === gi ? { ...x, dimensions: [...x.dimensions, { name: "", description: "", minLabel: "", maxLabel: "", valueLabels: null }] } : x)))}><Plus /> Add dimension</Button>
              </div>
            ))}
            <Button size="sm" variant="ghost" onClick={() => setGroups([...groups, { name: "", description: "", dimensions: [{ name: "", description: "", minLabel: "", maxLabel: "", valueLabels: null }] }])}><Plus /> Add category</Button>
          </div>
        )}
        {stage === "edit" && (
          <DialogFooter>
            <Button
              disabled={busy}
              onClick={async () => {
                setBusy(true);
                const r = await saveHealthModelAction({
                  id: modelId ?? undefined,
                  teamId,
                  orgId,
                  aiGenerated: ai,
                  name,
                  description,
                  style,
                  minRating: 1,
                  maxRating: n,
                  notApplicableOption: na,
                  flipOrder: flip,
                  groups: groups.map((g) => ({ ...g, dimensions: g.dimensions.filter((d) => d.name.trim()) })).filter((g) => g.dimensions.length),
                });
                setBusy(false);
                if (!r.ok) return void toast.error(r.error);
                toast.success("Health model saved");
                onOpenChange(false);
                router.refresh();
              }}
            >
              Save health model
            </Button>
          </DialogFooter>
        )}
      </DialogContent>
    </Dialog>
  );
}

// ── Estimation decks ─────────────────────────────────────────────────────
export function DeckEditor({ open, onOpenChange, teamId, orgId, existing, custom }: { open: boolean; onOpenChange: (o: boolean) => void; teamId: string | null; orgId: string; existing?: { id: string; name: string; cards: DeckCard[] } | null; custom: { id: string; name: string; cards: DeckCard[] }[] }) {
  const router = useRouter();
  const [stage, setStage] = useState<"start" | "edit">(existing ? "edit" : "start");
  const [name, setName] = useState(existing?.name ?? "");
  const [cards, setCards] = useState<DeckCard[]>(existing?.cards ?? []);
  const [busy, setBusy] = useState(false);
  const all = [...custom, ...BUILTIN_DECKS];
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-2xl">
        <DialogHeader><DialogTitle>{existing ? "Edit custom deck" : "New custom deck"}</DialogTitle></DialogHeader>
        {stage === "start" ? (
          <StartWith
            copyOptions={all.map((d) => ({ id: d.id, name: d.name }))}
            onBlank={() => { setCards([{ label: "1" }, { label: "2" }, { label: "3" }]); setStage("edit"); }}
            onCopy={(id) => { const d = all.find((x) => x.id === id)!; setName(`Copy of ${d.name}`); setCards(structuredClone(d.cards)); setStage("edit"); }}
          />
        ) : (
          <div className="space-y-3">
            <div className="space-y-1.5"><Label>Deck name</Label><Input value={name} onChange={(e) => setName(e.target.value)} placeholder="My custom deck" /></div>
            <p className="text-xs text-muted-foreground">The team&apos;s estimate is calculated from votes: numeric cards are averaged; text cards pick the middle card in deck order.</p>
            {cards.map((c, i) => (
              <div key={i} className="flex gap-2">
                <Input value={c.label} onChange={(e) => setCards(cards.map((x, j) => (j === i ? { ...x, label: e.target.value } : x)))} placeholder="Label" className="w-24" />
                <Input value={c.description ?? ""} onChange={(e) => setCards(cards.map((x, j) => (j === i ? { ...x, description: e.target.value } : x)))} placeholder={c.special === "coffee" ? "Need a break (optional)" : c.special === "unsure" ? "Unsure (optional)" : "Description (optional)"} />
                <Select value={c.special ?? "none"} onValueChange={(v) => setCards(cards.map((x, j) => (j === i ? { ...x, special: v === "none" ? undefined : (v as "coffee") } : x)))}>
                  <SelectTrigger className="w-28"><SelectValue /></SelectTrigger>
                  <SelectContent><SelectItem value="none">Normal</SelectItem><SelectItem value="unsure">Unsure</SelectItem><SelectItem value="coffee">Coffee</SelectItem></SelectContent>
                </Select>
                <Button variant="ghost" size="icon" onClick={() => setCards(cards.filter((_, j) => j !== i))}><Trash2 /></Button>
              </div>
            ))}
            <Button size="sm" variant="outline" onClick={() => setCards([...cards, { label: "" }])}><Plus /> Add card</Button>
          </div>
        )}
        {stage === "edit" && (
          <DialogFooter>
            <Button disabled={busy} onClick={async () => {
              setBusy(true);
              const r = await saveDeckAction({ id: existing?.id, teamId, orgId, name, cards });
              setBusy(false);
              if (!r.ok) return void toast.error(r.error);
              toast.success("Deck saved");
              onOpenChange(false);
              router.refresh();
            }}>{existing ? "Save deck" : "Create deck"}</Button>
          </DialogFooter>
        )}
      </DialogContent>
    </Dialog>
  );
}
