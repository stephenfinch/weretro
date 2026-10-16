"use client";

import { useMeeting } from "./use-meeting";

import { useRef, useState } from "react";
import { BarChart3, Gift, ImagePlus, Loader2, Paperclip, PenTool, Search, Sticker } from "lucide-react";
import { toast } from "sonner";
import type { Attachment } from "@/lib/types";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";

export function Attachments({ items, onRemove }: { items: Attachment[]; onRemove?: (i: number) => void }) {
  const media = items.filter((a) => a.type === "image" || a.type === "gif");
  if (!media.length) return null;
  return (
    <div className="mt-1.5 grid gap-1.5">
      {media.map((a, i) => (
        <div key={i} className="group/att relative overflow-hidden rounded-lg">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={a.url} alt={a.alt ?? ""} className="max-h-64 w-full rounded-lg object-cover" loading="lazy" />
          {onRemove && (
            <button type="button" onClick={() => onRemove(i)} className="absolute top-1 right-1 rounded-full bg-black/60 px-2 text-xs text-white opacity-0 group-hover/att:opacity-100">
              Remove
            </button>
          )}
        </div>
      ))}
    </div>
  );
}

export async function uploadImage(file: File): Promise<string | null> {
  const fd = new FormData();
  fd.append("file", file);
  const res = await fetch("/api/media", { method: "POST", body: fd });
  const json = await res.json();
  if (!res.ok) {
    toast.error(json.error ?? "Upload failed");
    return null;
  }
  return json.url as string;
}

export function AttachMenu({
  onAttach,
  onPoll,
  onKudos,
  onWhiteboard,
}: {
  onAttach: (a: Attachment) => void;
  onPoll?: () => void;
  onKudos?: () => void;
  onWhiteboard?: () => void;
}) {
  const { state } = useMeeting();
  const allow = state.team.attachments;
  const [open, setOpen] = useState(false);
  const [gif, setGif] = useState(false);
  const [busy, setBusy] = useState(false);
  const file = useRef<HTMLInputElement>(null);
  if (!allow.images && !allow.gifs && !onPoll && !onKudos && !onWhiteboard) return null;
  return (
    <>
      <Popover open={open} onOpenChange={setOpen}>
        <PopoverTrigger asChild>
          <button type="button" className="inline-flex size-7 items-center justify-center rounded-full text-muted-foreground hover:bg-muted hover:text-foreground" aria-label="Insert">
            {busy ? <Loader2 className="size-4 animate-spin" /> : <Paperclip className="size-4" />}
          </button>
        </PopoverTrigger>
        <PopoverContent align="end" className="w-52 p-1">
          {allow.images && <MenuButton icon={ImagePlus} label="Upload image" onClick={() => { setOpen(false); file.current?.click(); }} />}
          {allow.gifs && <MenuButton icon={Sticker} label="GIF" onClick={() => { setOpen(false); setGif(true); }} />}
          {onPoll && <MenuButton icon={BarChart3} label="Poll" onClick={() => { setOpen(false); onPoll(); }} />}
          {onKudos && <MenuButton icon={Gift} label="Kudos" onClick={() => { setOpen(false); onKudos(); }} />}
          {onWhiteboard && <MenuButton icon={PenTool} label="Whiteboard" onClick={() => { setOpen(false); onWhiteboard(); }} />}
        </PopoverContent>
      </Popover>
      <input
        ref={file}
        type="file"
        accept="image/*"
        hidden
        onChange={async (e) => {
          const f = e.target.files?.[0];
          e.target.value = "";
          if (!f) return;
          setBusy(true);
          const url = await uploadImage(f);
          setBusy(false);
          if (url) onAttach({ type: "image", url });
        }}
      />
      <GifDialog open={gif} onOpenChange={setGif} onPick={(url) => onAttach({ type: "gif", url })} />
    </>
  );
}

function MenuButton({ icon: Icon, label, onClick }: { icon: typeof ImagePlus; label: string; onClick: () => void }) {
  return (
    <button type="button" onClick={onClick} className="flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-sm hover:bg-muted">
      <Icon className="size-4 text-muted-foreground" /> {label}
    </button>
  );
}

const CHIPS = ["Thanks", "Celebrate", "Yes", "Idea", "Hmm", "Blocked"];

export function GifDialog({ open, onOpenChange, onPick }: { open: boolean; onOpenChange: (o: boolean) => void; onPick: (url: string) => void }) {
  const [q, setQ] = useState("");
  const [results, setResults] = useState<{ id: string; preview: string; url: string; title: string }[]>([]);
  const [msg, setMsg] = useState<string | null>(null);
  const [provider, setProvider] = useState<string | null>(null);
  const search = async (term: string) => {
    setQ(term);
    const res = await fetch(`/api/gifs?q=${encodeURIComponent(term)}`);
    const json = await res.json();
    setResults(json.results ?? []);
    setProvider(json.provider);
    setMsg(json.message ?? null);
  };
  return (
    <Dialog open={open} onOpenChange={(o) => { onOpenChange(o); if (o && !results.length) void search("celebrate"); }}>
      <DialogContent className="max-w-xl">
        <DialogHeader>
          <DialogTitle>Animated GIFs</DialogTitle>
        </DialogHeader>
        <form onSubmit={(e) => { e.preventDefault(); void search(q); }} className="flex gap-2">
          <Input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search GIFs…" autoFocus />
          <Button type="submit" variant="outline"><Search /></Button>
        </form>
        <div className="flex flex-wrap gap-1.5">
          {CHIPS.map((c) => (
            <button key={c} type="button" onClick={() => void search(c)} className="rounded-full border px-2.5 py-0.5 text-xs hover:bg-muted">{c}</button>
          ))}
        </div>
        {msg && <p className="text-sm text-muted-foreground">{msg}</p>}
        <div className="grid max-h-[50vh] grid-cols-3 gap-2 overflow-y-auto">
          {results.map((g) => (
            <button key={g.id} type="button" onClick={() => { onPick(g.url); onOpenChange(false); }} className="overflow-hidden rounded-lg">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={g.preview} alt={g.title} className="h-28 w-full object-cover" loading="lazy" />
            </button>
          ))}
        </div>
        {provider && <p className="text-right text-[11px] text-muted-foreground">Powered by {provider}</p>}
      </DialogContent>
    </Dialog>
  );
}
