"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ChevronDown, Copy, ExternalLink, Home, LogOut, Menu, Pencil, PlayCircle, RotateCcw, Save, Settings2, StopCircle, Trash2, UserCheck, Lock, WifiOff, LayoutGrid } from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuLabel, DropdownMenuSeparator, DropdownMenuSub, DropdownMenuSubContent, DropdownMenuSubTrigger, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { LogoMark } from "@/components/brand";
import { AvatarStack } from "@/components/user-avatar";
import { MEETING_TYPE_LABEL, MEETING_TYPE_PATH, STEP_LABEL } from "@/lib/constants";
import { useMeeting } from "./use-meeting";
import { enabledSteps } from "./helpers";
import { deleteMeetingAction } from "@/app/actions/meetings";
import { saveTemplateFromMeeting } from "@/app/actions/templates";

export function MeetingTopBar({ onCustomize }: { onCustomize: () => void }) {
  const { state, op, connected } = useMeeting();
  const router = useRouter();
  const [nav, setNav] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const steps = enabledSteps(state);
  const fac = state.me.isFacilitator;
  const label = MEETING_TYPE_LABEL[state.meeting.type];
  const online = state.participants.filter((p) => p.online && !p.isMe);
  const isStandup = state.meeting.type === "standup";
  const goto = (index: number) => {
    if (!fac) return;
    void op("step.goto", { index });
  };
  return (
    <header className="no-print flex h-14 shrink-0 items-center gap-2 border-b bg-background/90 px-2 backdrop-blur">
      <Button variant="ghost" size="icon" onClick={() => setNav(true)} aria-label="Menu">
        <Menu />
      </Button>
      {!isStandup ? (
        <nav className="flex min-w-0 items-stretch overflow-x-auto scrollbar-thin">
          {steps.map((s, i) => {
            const current = s.index === state.meeting.stepIndex;
            const past = s.index < state.meeting.stepIndex;
            return (
              <button
                key={s.key}
                type="button"
                disabled={!fac}
                onClick={() => goto(s.index)}
                className={cn(
                  "relative flex h-14 shrink-0 items-center px-3 text-xs font-semibold tracking-wide uppercase transition-colors sm:px-4",
                  current ? "bg-primary text-primary-foreground" : past ? "text-muted-foreground" : "text-foreground/80",
                  fac && !current && "hover:bg-muted",
                  i > 0 && "border-l",
                )}
              >
                {STEP_LABEL[s.key]}
              </button>
            );
          })}
        </nav>
      ) : (
        <span className="rounded-lg bg-primary px-3 py-1.5 text-xs font-semibold tracking-wide text-primary-foreground uppercase">Standup</span>
      )}
      <div className="ml-2 hidden min-w-0 flex-col md:flex">
        <span className="truncate text-sm font-medium">{state.meeting.title || state.meeting.templateName || label}</span>
        <span className="truncate text-xs text-muted-foreground">
          {state.team.name} · {state.meeting.date}
        </span>
      </div>
      <div className="ml-auto flex shrink-0 items-center gap-2">
        {!connected && (
          <span className="flex items-center gap-1 rounded-full bg-amber-500/15 px-2 py-1 text-xs text-amber-700 dark:text-amber-300">
            <WifiOff className="size-3" /> Reconnecting…
          </span>
        )}
        {state.meeting.status === "closed" && (
          <span className="flex items-center gap-1 rounded-full bg-muted px-2 py-1 text-xs font-medium">
            <Lock className="size-3" /> Closed
          </span>
        )}
        {isStandup && state.meeting.status === "open" && !fac && (
          <span className="rounded-full border px-2.5 py-1 text-xs font-medium text-muted-foreground">
            {state.meeting.collectingUntil ? `Collecting until ${new Date(state.meeting.collectingUntil).toLocaleTimeString([], { hour: "numeric", minute: "2-digit" })}` : "Collecting"}
          </span>
        )}
        {online.length > 0 && <span className="hidden sm:inline-flex"><AvatarStack people={online.map((p) => ({ name: p.name, color: p.color, avatarUrl: p.avatarUrl }))} max={4} size={26} /></span>}
        {state.me.canFacilitate && (
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button size="sm" variant={fac ? "default" : "outline"} className="rounded-full">
                {fac ? (state.meeting.presenting?.active ? "Presenting" : "You are facilitating") : isStandup ? "Start facilitating" : "Facilitate"}
                <ChevronDown />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-64">
              {!fac ? (
                <>
                  <DropdownMenuItem onSelect={() => void op("facilitate.start")}>
                    <PlayCircle /> {state.participants.some((p) => p.isFacilitating) ? "Join facilitating" : "Start facilitating"}
                  </DropdownMenuItem>
                  {state.participants.some((p) => p.isFacilitating && !p.isMe) && (
                    <DropdownMenuItem onSelect={() => void op("facilitate.start", { exclusive: true })}>
                      <UserCheck /> Take over facilitation
                    </DropdownMenuItem>
                  )}
                </>
              ) : (
                <>
                  <DropdownMenuLabel className="text-xs text-muted-foreground">Facilitation</DropdownMenuLabel>
                  <DropdownMenuItem onSelect={() => void op("facilitate.stop")}>
                    <StopCircle /> Stop facilitating
                  </DropdownMenuItem>
                  <DropdownMenuSub>
                    <DropdownMenuSubTrigger>
                      <UserCheck /> Hand over to
                    </DropdownMenuSubTrigger>
                    <DropdownMenuSubContent className="max-h-72 overflow-y-auto">
                      {state.participants
                        .filter((p) => !p.isMe && p.userId)
                        .map((p) => (
                          <DropdownMenuItem key={p.id} onSelect={() => void op("facilitate.handOver", { participantId: p.id })}>
                            {p.name} {!p.online && <span className="text-xs text-muted-foreground">away</span>}
                          </DropdownMenuItem>
                        ))}
                    </DropdownMenuSubContent>
                  </DropdownMenuSub>
                </>
              )}
              <DropdownMenuSeparator />
              <DropdownMenuItem onSelect={onCustomize}>
                <Settings2 /> Customize {label.toLowerCase()}…
              </DropdownMenuItem>
              <DropdownMenuItem onSelect={() => window.open(`/m/${state.meeting.id}`, "_blank")}>
                <ExternalLink /> Open in new tab
              </DropdownMenuItem>
              <DropdownMenuItem onSelect={() => window.open(`/m/${state.meeting.id}?view=screen`, "wr-screen", "width=1280,height=800")}>
                <LayoutGrid /> Open screen share window
              </DropdownMenuItem>
              <DropdownMenuItem
                onSelect={() => {
                  void navigator.clipboard.writeText(`${window.location.origin}/m/${state.meeting.id}`);
                  toast.success("Link copied");
                }}
              >
                <Copy /> Copy link
              </DropdownMenuItem>
              {(state.meeting.type === "retrospective" || state.meeting.type === "standup") && (
                <DropdownMenuItem
                  onSelect={async () => {
                    const name = window.prompt("Template name", state.meeting.templateName ? `${state.meeting.templateName} (copy)` : state.meeting.title || "My template");
                    if (!name) return;
                    const r = await saveTemplateFromMeeting(state.meeting.id, name);
                    if (!r.ok) toast.error(r.error);
                    else toast.success("Template saved to team templates");
                  }}
                >
                  <Save /> Save as template…
                </DropdownMenuItem>
              )}
              <DropdownMenuItem onSelect={() => router.push(`/t/${state.team.id}/${MEETING_TYPE_PATH[state.meeting.type]}?startLike=${state.meeting.id}`)}>
                <Pencil /> Start new like this…
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              {state.meeting.status === "open" ? (
                <DropdownMenuItem onSelect={() => void op("meeting.close")}>
                  <Lock /> Close {label.toLowerCase()}
                </DropdownMenuItem>
              ) : (
                <DropdownMenuItem onSelect={() => void op("meeting.reopen")}>
                  <RotateCcw /> Reopen {label.toLowerCase()}
                </DropdownMenuItem>
              )}
              <DropdownMenuItem variant="destructive" onSelect={() => setConfirmDelete(true)}>
                <Trash2 /> Delete {label.toLowerCase()}…
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        )}
        <Button variant="outline" size="sm" className="rounded-full" asChild>
          <Link href={state.me.isGuest ? "/" : `/t/${state.team.id}`}>Exit</Link>
        </Button>
      </div>
      <Sheet open={nav} onOpenChange={setNav}>
        <SheetContent side="left" className="w-72">
          <SheetHeader>
            <SheetTitle className="flex items-center gap-2">
              <LogoMark className="size-6" /> {state.team.name}
            </SheetTitle>
          </SheetHeader>
          <nav className="flex flex-col gap-1 px-4">
            {!state.me.isGuest && (
              <>
                <Link href={`/t/${state.team.id}`} className="flex items-center gap-2 rounded-lg px-2 py-2 text-sm hover:bg-muted">
                  <Home className="size-4" /> Team home
                </Link>
                <Link href={`/t/${state.team.id}/${MEETING_TYPE_PATH[state.meeting.type]}`} className="flex items-center gap-2 rounded-lg px-2 py-2 text-sm hover:bg-muted">
                  <LayoutGrid className="size-4" /> All {label.toLowerCase()}s
                </Link>
              </>
            )}
            <a href="/logout" className="flex items-center gap-2 rounded-lg px-2 py-2 text-sm hover:bg-muted">
              <LogOut className="size-4" /> Sign out
            </a>
          </nav>
        </SheetContent>
      </Sheet>
      <AlertDialog open={confirmDelete} onOpenChange={setConfirmDelete}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete this {label.toLowerCase()}?</AlertDialogTitle>
            <AlertDialogDescription>
              {state.meeting.seriesId ? "Only this occurrence is deleted. The rest of the series stays." : "You can restore it for 30 days from team settings."}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            {state.meeting.seriesId && (
              <AlertDialogAction
                variant="outline"
                onClick={async () => {
                  const r = await deleteMeetingAction(state.meeting.id, { cancelRecurrence: true });
                  if (r.ok) router.push(`/t/${state.team.id}`);
                }}
              >
                Delete and cancel recurrence
              </AlertDialogAction>
            )}
            <AlertDialogAction
              onClick={async () => {
                const r = await deleteMeetingAction(state.meeting.id);
                if (!r.ok) return void toast.error(r.error);
                router.push(`/t/${state.team.id}`);
              }}
            >
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </header>
  );
}
