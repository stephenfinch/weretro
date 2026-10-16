"use client";

import { useMemo, useState } from "react";
import { RefreshCw } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useMeeting } from "../use-meeting";
import { syncEstimatesAction } from "@/app/actions/integrations";
import type { EstimationItemDTO } from "@/lib/meeting-types";

function spread(it: EstimationItemDTO, cards: { label: string; value?: number | null }[]) {
  const nums = (it.votes ?? []).map((v) => cards.find((c) => c.label === v.value)?.value).filter((n): n is number => typeof n === "number");
  if (nums.length < 2) return 0;
  const mean = nums.reduce((a, b) => a + b, 0) / nums.length;
  return Math.sqrt(nums.reduce((a, v) => a + (v - mean) ** 2, 0) / nums.length);
}

export function EstimationReviewStep() {
  const { state, op } = useMeeting();
  const [sort, setSort] = useState(state.meeting.options.estimationSort ?? "original");
  const [busy, setBusy] = useState(false);
  const cards = state.meeting.deck?.cards ?? [];
  const num = (it: EstimationItemDTO) => Number(it.finalEstimate ?? it.average ?? -1);
  const items = useMemo(() => {
    const list = [...state.estimation].sort((a, b) => a.position - b.position);
    if (sort === "lowToHigh") return list.sort((a, b) => num(a) - num(b));
    if (sort === "highToLow") return list.sort((a, b) => num(b) - num(a));
    if (sort === "mostMixed") return list.sort((a, b) => spread(b, cards) - spread(a, cards));
    return list;
  }, [state.estimation, sort, cards]);
  const total = items.reduce((a, it) => a + (Number.isFinite(Number(it.finalEstimate)) ? Number(it.finalEstimate) : 0), 0);
  const syncable = items.filter((i) => i.externalSource && i.externalSource !== "csv" && i.finalEstimate);
  return (
    <div className="h-full overflow-y-auto px-4 pb-24 scrollbar-thin">
      <div className="mx-auto max-w-4xl space-y-4 pt-6">
        <div className="flex flex-wrap items-center gap-3">
          <h1 className="text-xl font-semibold">Review our estimates</h1>
          <span className="rounded-full bg-primary/10 px-3 py-1 text-sm font-medium text-primary">Total {Math.round(total * 10) / 10}</span>
          <Select value={sort} onValueChange={(v) => setSort(v as typeof sort)}>
            <SelectTrigger size="sm" className="ml-auto w-48"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="original">Original order</SelectItem>
              <SelectItem value="lowToHigh">Sort low to high</SelectItem>
              <SelectItem value="highToLow">Sort high to low</SelectItem>
              <SelectItem value="mostMixed">Sort most mixed first</SelectItem>
            </SelectContent>
          </Select>
          {syncable.length > 0 && (
            <Button
              size="sm"
              variant="outline"
              disabled={busy}
              onClick={async () => {
                setBusy(true);
                const r = await syncEstimatesAction(state.team.id, syncable.map((i) => i.id));
                setBusy(false);
                if (!r.ok) return void toast.error(r.error);
                const failed = (r.data ?? []).filter((x) => !x.ok);
                if (failed.length) toast.error(`${failed.length} failed to sync`);
                else toast.success("Estimates synced");
              }}
            >
              <RefreshCw /> Sync {syncable.length}
            </Button>
          )}
        </div>
        <div className="overflow-hidden rounded-2xl border bg-card">
          <table className="w-full text-sm">
            <thead className="bg-muted/50 text-left text-xs text-muted-foreground uppercase">
              <tr>
                <th className="p-3">Item</th>
                <th className="p-3">Votes</th>
                <th className="p-3 text-right">Average</th>
                <th className="p-3 text-right">Estimate</th>
              </tr>
            </thead>
            <tbody>
              {items.map((it) => (
                <tr key={it.id} className="border-t">
                  <td className="p-3">
                    {it.externalKey && <span className="mr-1.5 font-mono text-xs text-muted-foreground">{it.externalKey}</span>}
                    {it.title}
                    {it.syncStatus && <span className="ml-2 text-xs text-muted-foreground">({it.syncStatus.replace(/_/g, " ")})</span>}
                  </td>
                  <td className="p-3 text-muted-foreground">{it.votes?.map((v) => v.value).join(" ") ?? `${it.votedParticipantIds.length} votes`}</td>
                  <td className="p-3 text-right tabular-nums">{it.average ?? "–"}</td>
                  <td className="p-3 text-right">
                    {state.me.isFacilitator ? (
                      <input
                        defaultValue={it.finalEstimate ?? ""}
                        onBlur={(e) => e.target.value !== (it.finalEstimate ?? "") && void op("estimation.update", { id: it.id, finalEstimate: e.target.value || null })}
                        className="w-16 rounded-md border bg-background px-2 py-1 text-right font-semibold"
                      />
                    ) : (
                      <strong>{it.finalEstimate ?? "–"}</strong>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
