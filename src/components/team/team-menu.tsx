"use client";

import { useState, useTransition } from "react";
import { Archive, ArchiveRestore, DoorOpen, MoreHorizontal, Trash2, UserPlus, KeyRound } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { archiveTeamAction, deleteTeamAction, leaveTeamAction, requestTeamAccess } from "@/app/actions/teams";
import { InviteDialog } from "./invite-dialog";

export function TeamMenu({ teamId, isAdmin, isMember, archived, code, canInvite }: { teamId: string; isAdmin: boolean; isMember: boolean; archived: boolean; code: string; canInvite: boolean }) {
  const [confirm, setConfirm] = useState<null | "delete" | "leave" | "archive">(null);
  const [invite, setInvite] = useState(false);
  const [pending, start] = useTransition();
  return (
    <>
      <div className="flex items-center gap-2">
        {canInvite && !archived && (
          <Button size="sm" variant="outline" onClick={() => setInvite(true)}>
            <UserPlus /> Invite
          </Button>
        )}
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="ghost" size="icon-sm" aria-label="Team options">
              <MoreHorizontal />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-52">
            {!isMember && (
              <>
                <DropdownMenuItem onSelect={() => start(async () => { const r = await requestTeamAccess(teamId, "member"); toast[r.ok ? "success" : "error"](r.ok ? "Access requested" : r.error); })}>
                  <KeyRound /> Request member access
                </DropdownMenuItem>
                <DropdownMenuItem onSelect={() => start(async () => { const r = await requestTeamAccess(teamId, "admin"); toast[r.ok ? "success" : "error"](r.ok ? "Access requested" : r.error); })}>
                  <KeyRound /> Request admin access
                </DropdownMenuItem>
              </>
            )}
            {isMember && (
              <DropdownMenuItem onSelect={() => setConfirm("leave")}>
                <DoorOpen /> Leave this team
              </DropdownMenuItem>
            )}
            {isAdmin && (
              <>
                <DropdownMenuSeparator />
                <DropdownMenuItem onSelect={() => (archived ? start(async () => void (await archiveTeamAction(teamId, false))) : setConfirm("archive"))}>
                  {archived ? <ArchiveRestore /> : <Archive />} {archived ? "Unarchive team" : "Archive team"}
                </DropdownMenuItem>
                <DropdownMenuItem variant="destructive" onSelect={() => setConfirm("delete")}>
                  <Trash2 /> Delete team
                </DropdownMenuItem>
              </>
            )}
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
      <InviteDialog teamId={teamId} code={code} open={invite} onOpenChange={setInvite} trigger={null} />
      <AlertDialog open={!!confirm} onOpenChange={(o) => !o && setConfirm(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{confirm === "delete" ? "Delete this team?" : confirm === "leave" ? "Leave this team?" : "Archive this team?"}</AlertDialogTitle>
            <AlertDialogDescription>
              {confirm === "delete"
                ? "This deletes the team along with its actions and meetings."
                : confirm === "leave"
                  ? "To rejoin you'll need a team admin to invite you again."
                  : "The team becomes read-only and its open meetings are closed. You can unarchive it later."}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              disabled={pending}
              onClick={() =>
                start(async () => {
                  if (confirm === "delete") await deleteTeamAction(teamId);
                  else if (confirm === "leave") await leaveTeamAction(teamId);
                  else await archiveTeamAction(teamId, true);
                  setConfirm(null);
                })
              }
            >
              {confirm === "delete" ? "Delete team" : confirm === "leave" ? "Leave team" : "Archive team"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
