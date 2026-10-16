"use client";

import { useState } from "react";
import { ArrowDown, ArrowUp, ExternalLink, FileUp, GripVertical, Pencil, Trash2, Spade } from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { BUILTIN_DECKS } from "@/lib/constants";
import type { EstimationItemDTO } from "@/lib/meeting-types";
import { useMeeting } from "../use-meeting";
import { searchIssuesAction } from "@/app/actions/integrations";

export function EstimationItemList({ editable }: { editable: boolean }) {
  const { state, op } = useMeeting();
  const [title, setTitle] = useState("");
  const items = [...state.estimation].sort((a, b) => a.position - b.position);
  return (
    <div className="space-y-2">
      <ul className="divide-y overflow-hidden rounded-2xl border bg-card">
        {items.map((it, i) => (
          <ItemRow key={it.id} it={it} index={i} total={items.length} editable={editable} onMove={(d) => {
            const other = items[i + d];
            if (!other) return;
            void op("estimation.update", { id: it.id, position: other.position });
            void op("estimation.update", { id: other.id, position: it.position });
          }} />
        ))}
        {!items.length && <li className="py-8 text-center text-sm text-muted-foreground">No estimation items yet</li>}
      </ul>
      {editable && (
        <form
          onSubmit={(e) => {
            e.preventDefault();
            if (!title.trim()) return;
            void op("estimation.add", { title });
            setTitle("");
          }}
          className="flex items-center gap-2 rounded-2xl border bg-card px-3 focus-within:ring-2 focus-within:ring-ring/30"
        >
          <Spade className="size-4 text-muted-foreground" />
          <input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Add estimation item…" className="h-11 flex-1 bg-transparent text-sm outline-none" />
          {title.trim() && <Button size="xs" type="submit">Add</Button>}
        </form>
      )}
    </div>
  );
}

function ItemRow({ it, index, total, editable, onMove }: { it: EstimationItemDTO; index: number; total: number; editable: boolean; onMove: (d: number) => void }) {
  const { op } = useMeeting();
  const [editing, setEditing] = useState(false);
  const [title, setTitle] = useState(it.title);
  return (
    <li className="group flex items-center gap-3 px-3 py-2.5">
      <GripVertical className="size-4 text-muted-foreground/50" />
      {editing ? (
        <form className="flex-1" onSubmit={(e) => { e.preventDefault(); void op("estimation.update", { id: it.id, title }); setEditing(false); }}>
          <Input autoFocus value={title} onChange={(e) => setTitle(e.target.value)} onBlur={() => setEditing(false)} className="h-8" />
        </form>
      ) : (
        <div className="min-w-0 flex-1">
          <p className="truncate text-sm">
            {it.externalKey && <span className="mr-1.5 font-mono text-xs text-muted-foreground">{it.externalKey}</span>}
            {it.title}
          </p>
        </div>
      )}
      {it.url && (
        <a href={it.url} target="_blank" rel="noreferrer" className="text-muted-foreground hover:text-foreground" aria-label="Open item">
          <ExternalLink className="size-4" />
        </a>
      )}
      {it.finalEstimate && <span className="rounded-lg bg-primary/10 px-2 py-0.5 text-sm font-semibold text-primary">{it.finalEstimate}</span>}
      {editable && (
        <span className="flex opacity-0 transition group-hover:opacity-100">
          <Button variant="ghost" size="icon-xs" disabled={index === 0} onClick={() => onMove(-1)} aria-label="Move up"><ArrowUp /></Button>
          <Button variant="ghost" size="icon-xs" disabled={index === total - 1} onClick={() => onMove(1)} aria-label="Move down"><ArrowDown /></Button>
          <Button variant="ghost" size="icon-xs" onClick={() => { setTitle(it.title); setEditing(true); }} aria-label="Edit"><Pencil /></Button>
          <Button variant="ghost" size="icon-xs" onClick={() => void op("estimation.delete", { id: it.id })} aria-label="Delete"><Trash2 /></Button>
        </span>
      )}
    </li>
  );
}

export function PrepareStep() {
  const { state, op } = useMeeting();
  const [importing, setImporting] = useState(false);
  const editable = state.me.isFacilitator || state.me.canContribute;
  return (
    <div className="h-full overflow-y-auto px-4 pb-24 scrollbar-thin">
      <div className="mx-auto max-w-3xl space-y-5 pt-8">
        <div className="flex items-center gap-3">
          <span className="flex size-12 items-center justify-center rounded-2xl bg-primary/10 text-primary"><Spade className="size-6" /></span>
          <div>
            <h1 className="text-2xl font-semibold">Estimation items</h1>
            <p className="text-sm text-muted-foreground">Deck: {state.meeting.deck?.name} — {state.meeting.deck?.cards.map((c) => c.label).join(" ")}</p>
          </div>
          <div className="ml-auto flex gap-2">
            {state.me.isFacilitator && (
              <Select
                value={BUILTIN_DECKS.find((d) => d.name === state.meeting.deck?.name)?.id ?? "custom"}
                onValueChange={(v) => {
                  const d = BUILTIN_DECKS.find((x) => x.id === v);
                  if (d) void op("meeting.update", { deck: d });
                }}
              >
                <SelectTrigger size="sm" className="w-44"><SelectValue placeholder="Deck style" /></SelectTrigger>
                <SelectContent>
                  {BUILTIN_DECKS.map((d) => (
                    <SelectItem key={d.id} value={d.id}>Deck: {d.name}</SelectItem>
                  ))}
                  {!BUILTIN_DECKS.some((d) => d.name === state.meeting.deck?.name) && <SelectItem value="custom">Deck: {state.meeting.deck?.name}</SelectItem>}
                </SelectContent>
              </Select>
            )}
            {editable && (
              <Button variant="outline" size="sm" onClick={() => setImporting(true)}>
                <FileUp /> Import
              </Button>
            )}
          </div>
        </div>
        <EstimationItemList editable={editable} />
        {state.me.isFacilitator && state.estimation.length > 0 && (
          <div className="flex justify-center pt-4">
            <Button
              size="lg"
              onClick={() => {
                const idx = state.meeting.steps.findIndex((s) => s.key === "estimate");
                if (idx >= 0) void op("step.goto", { index: idx });
              }}
            >
              Estimate →
            </Button>
          </div>
        )}
      </div>
      <ImportDialog open={importing} onOpenChange={setImporting} />
    </div>
  );
}

function parseCsv(text: string) {
  const rows: string[][] = [];
  let row: string[] = [];
  let cell = "";
  let q = false;
  for (let i = 0; i < text.length; i++) {
    const ch = text[i];
    if (q) {
      if (ch === '"' && text[i + 1] === '"') { cell += '"'; i++; }
      else if (ch === '"') q = false;
      else cell += ch;
    } else if (ch === '"') q = true;
    else if (ch === ",") { row.push(cell); cell = ""; }
    else if (ch === "\n" || ch === "\r") {
      if (ch === "\r" && text[i + 1] === "\n") i++;
      row.push(cell); rows.push(row); row = []; cell = "";
    } else cell += ch;
  }
  if (cell || row.length) { row.push(cell); rows.push(row); }
  return rows.filter((r) => r.some((c) => c.trim()));
}

function ImportDialog({ open, onOpenChange }: { open: boolean; onOpenChange: (o: boolean) => void }) {
  const { state, op } = useMeeting();
  const [csv, setCsv] = useState("");
  const [source, setSource] = useState("jira");
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<{ key: string; title: string; status: string; points: number | null; url: string }[]>([]);
  const [selected, setSelected] = useState<string[]>([]);
  const [busy, setBusy] = useState(false);
  const imported = new Set(state.estimation.map((e) => e.externalKey));
  const importCsv = async () => {
    const rows = parseCsv(csv);
    const header = rows[0]?.map((h) => h.trim().toLowerCase()) ?? [];
    const hasHeader = header.some((h) => ["title", "summary", "name", "key", "id"].includes(h));
    const ti = hasHeader ? Math.max(0, header.findIndex((h) => ["title", "summary", "name"].includes(h))) : 0;
    const ki = hasHeader ? header.findIndex((h) => ["key", "id", "issue key"].includes(h)) : -1;
    const di = hasHeader ? header.findIndex((h) => h === "description") : -1;
    const ui = hasHeader ? header.findIndex((h) => h === "url" || h === "link") : -1;
    const items = rows.slice(hasHeader ? 1 : 0).map((r) => ({ title: r[ti], externalKey: ki >= 0 ? r[ki] : undefined, description: di >= 0 ? r[di] : undefined, url: ui >= 0 ? r[ui] : undefined, externalSource: "csv" }));
    if (!items.length) return void toast.error("No rows found");
    await op("estimation.add", { items });
    toast.success(`Imported ${items.length} items`);
    setCsv("");
    onOpenChange(false);
  };
  const search = async () => {
    setBusy(true);
    const r = await searchIssuesAction(state.team.id, source, source === "jira" && query.includes("=") ? { jql: query } : source === "azure" && /select/i.test(query) ? { wiql: query } : { text: query });
    setBusy(false);
    if (!r.ok) return void toast.error(r.error);
    setResults(r.data ?? []);
  };
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle>Import estimation items</DialogTitle>
          <DialogDescription>Import items and push estimates back to your task tools.</DialogDescription>
        </DialogHeader>
        <Tabs defaultValue="csv">
          <TabsList>
            <TabsTrigger value="csv">CSV / paste</TabsTrigger>
            <TabsTrigger value="tools">Jira · GitHub · Linear · Azure</TabsTrigger>
          </TabsList>
          <TabsContent value="csv" className="space-y-3 pt-2">
            <Textarea rows={8} value={csv} onChange={(e) => setCsv(e.target.value)} placeholder={"title,key,url\nAdd dark mode,ENG-12,https://…\n\nOr just paste one item per line"} className="font-mono text-xs" />
            <div className="flex items-center justify-between">
              <label className="cursor-pointer text-sm text-primary hover:underline">
                Upload CSV file
                <input type="file" accept=".csv,text/csv,text/plain" hidden onChange={async (e) => { const f = e.target.files?.[0]; if (f) setCsv(await f.text()); }} />
              </label>
              <Button onClick={importCsv} disabled={!csv.trim()}>Import</Button>
            </div>
          </TabsContent>
          <TabsContent value="tools" className="space-y-3 pt-2">
            <div className="flex gap-2">
              <Select value={source} onValueChange={setSource}>
                <SelectTrigger className="w-32"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="jira">Jira</SelectItem>
                  <SelectItem value="github">GitHub</SelectItem>
                  <SelectItem value="linear">Linear</SelectItem>
                  <SelectItem value="azure">Azure</SelectItem>
                </SelectContent>
              </Select>
              <Input value={query} onChange={(e) => setQuery(e.target.value)} placeholder={source === "jira" ? "Search text or JQL…" : source === "azure" ? "Search text or WIQL…" : "Search…"} onKeyDown={(e) => e.key === "Enter" && void search()} />
              <Button variant="outline" onClick={search} disabled={busy}>{busy ? "Loading…" : "Search"}</Button>
            </div>
            <div className="max-h-72 overflow-y-auto rounded-xl border">
              <table className="w-full text-sm">
                <tbody>
                  {results.map((r) => (
                    <tr key={r.key} className={cn("border-b last:border-0", imported.has(r.key) && "opacity-50")}>
                      <td className="w-8 p-2">
                        <input type="checkbox" disabled={imported.has(r.key)} checked={selected.includes(r.key)} onChange={(e) => setSelected((s) => (e.target.checked ? [...s, r.key] : s.filter((x) => x !== r.key)))} />
                      </td>
                      <td className="p-2 font-mono text-xs">{r.key.length > 12 ? "" : r.key}</td>
                      <td className="p-2">{r.title}</td>
                      <td className="p-2 text-xs text-muted-foreground">{r.status}</td>
                      <td className="p-2 text-right text-xs">{imported.has(r.key) ? "Imported" : r.points ?? ""}</td>
                    </tr>
                  ))}
                  {!results.length && (
                    <tr><td className="p-6 text-center text-muted-foreground">Search to find items. Configure integrations in team settings.</td></tr>
                  )}
                </tbody>
              </table>
            </div>
            <DialogFooter>
              <Button
                disabled={!selected.length}
                onClick={async () => {
                  const items = results.filter((r) => selected.includes(r.key)).map((r) => ({ title: r.title, externalKey: r.key, url: r.url, externalSource: source }));
                  await op("estimation.add", { items });
                  toast.success(`Imported ${items.length} items`);
                  setSelected([]);
                  onOpenChange(false);
                }}
              >
                Import {selected.length || ""} selected
              </Button>
            </DialogFooter>
          </TabsContent>
        </Tabs>
      </DialogContent>
    </Dialog>
  );
}
