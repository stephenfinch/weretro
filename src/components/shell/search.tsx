"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Search } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";

type Result = { kind: string; text: string; href: string; team: string; date: string };

export function SearchButton({ orgId }: { orgId: string }) {
  const [open, setOpen] = useState(false);
  const [q, setQ] = useState("");
  const [results, setResults] = useState<Result[] | null>(null);
  const [loading, setLoading] = useState(false);
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        setOpen((o) => !o);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);
  useEffect(() => {
    if (q.trim().length < 2) {
      setResults(null);
      return;
    }
    setLoading(true);
    const t = setTimeout(async () => {
      const res = await fetch(`/api/search?org=${orgId}&q=${encodeURIComponent(q)}`);
      const json = await res.json();
      setResults(json.results ?? []);
      setLoading(false);
    }, 250);
    return () => clearTimeout(t);
  }, [q, orgId]);
  return (
    <>
      <Button variant="outline" size="sm" className="hidden gap-2 text-muted-foreground sm:inline-flex" onClick={() => setOpen(true)}>
        <Search className="size-4" /> Search <kbd className="rounded border bg-muted px-1 text-[10px]">⌘K</kbd>
      </Button>
      <Button variant="ghost" size="icon" className="sm:hidden" onClick={() => setOpen(true)} aria-label="Search">
        <Search />
      </Button>
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>Search</DialogTitle>
          </DialogHeader>
          <Input autoFocus value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search ideas, actions, agreements, comments and updates…" className="h-11" />
          <div className="max-h-[60vh] min-h-24 overflow-y-auto">
            {!results && <p className="py-6 text-center text-sm text-muted-foreground">Type a few characters to search. Only closed meetings are searched.</p>}
            {loading && <p className="py-2 text-center text-xs text-muted-foreground">Searching…</p>}
            {results && !results.length && !loading && <p className="py-6 text-center text-sm text-muted-foreground">No matches for “{q}”</p>}
            <ul className="divide-y">
              {results?.map((r, i) => (
                <li key={i}>
                  <Link href={r.href} onClick={() => setOpen(false)} className="flex flex-col gap-1 px-2 py-3 hover:bg-muted rounded-lg">
                    <span className="line-clamp-2 text-sm">{r.text}</span>
                    <span className="flex items-center gap-2 text-xs text-muted-foreground">
                      <Badge variant="secondary">{r.kind}</Badge> {r.team} · {r.date}
                    </span>
                  </Link>
                </li>
              ))}
            </ul>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}
