"use client";

import { useTransition } from "react";
import { MoreHorizontal, Pause, Play, Trash2, Copy } from "lucide-react";
import { toast } from "sonner";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { deleteSeriesAction, setSeriesActive } from "@/app/actions/meetings";

export function SeriesActions({ teamId, seriesId, active, canManage }: { teamId: string; seriesId: string; active: boolean; canManage: boolean }) {
  const [, start] = useTransition();
  return (
    <DropdownMenu>
      <DropdownMenuTrigger className="rounded-md p-1 text-muted-foreground hover:bg-muted" aria-label="Series options">
        <MoreHorizontal className="size-4" />
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end">
        <DropdownMenuItem
          onSelect={() => {
            void navigator.clipboard.writeText(`${window.location.origin}/t/${teamId}/series/${seriesId}`);
            toast.success("Link copied");
          }}
        >
          <Copy /> Copy link to the current meeting
        </DropdownMenuItem>
        {canManage && (
          <>
            <DropdownMenuItem onSelect={() => start(async () => void (await setSeriesActive(teamId, seriesId, !active)))}>
              {active ? <Pause /> : <Play />} {active ? "Pause series" : "Resume series"}
            </DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuItem
              variant="destructive"
              onSelect={() => {
                if (!confirm("Delete this series and all its meetings? You can restore it for 30 days.")) return;
                start(async () => {
                  const r = await deleteSeriesAction(teamId, seriesId);
                  if (!r.ok) toast.error(r.error);
                });
              }}
            >
              <Trash2 /> Delete series
            </DropdownMenuItem>
          </>
        )}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
