"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Plus } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { createTeamAction, requestTeamAction } from "@/app/actions/teams";
import { PALETTE } from "@/lib/constants";
import { cn } from "@/lib/utils";

export function CreateTeamDialog({ orgId, canCreate, trigger, program, teams }: { orgId: string; canCreate: boolean; trigger?: React.ReactNode; program?: boolean; teams?: { id: string; name: string }[] }) {
  const [open, setOpen] = useState(false);
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [color, setColor] = useState(PALETTE[Math.floor(Math.random() * 16)]);
  const [emails, setEmails] = useState("");
  const [admins, setAdmins] = useState("");
  const [selected, setSelected] = useState<string[]>([]);
  const [pending, start] = useTransition();
  const router = useRouter();
  const submit = () =>
    start(async () => {
      if (!canCreate) {
        const r = await requestTeamAction(orgId, { name, message: description });
        if (!r.ok) return void toast.error(r.error);
        toast.success("Your request was sent to the organization admins");
        setOpen(false);
        return;
      }
      const split = (s: string) => s.split(/[\s,;]+/).map((e) => e.trim()).filter(Boolean);
      const r = await createTeamAction(orgId, { name, description, color, inviteEmails: split(emails), adminEmails: split(admins), isProgram: program, memberTeamIds: selected });
      if (!r.ok) return void toast.error(r.error);
      setOpen(false);
      router.push(`/t/${r.data!.id}`);
    });
  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        {trigger ?? (
          <Button size="sm">
            <Plus /> {canCreate ? (program ? "Create program" : "Create team") : "Request team"}
          </Button>
        )}
      </DialogTrigger>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>{canCreate ? (program ? "Create a program" : "Create a team") : "Request a new team"}</DialogTitle>
          <DialogDescription>
            {program ? "Programs group several teams so you can run cross-team meetings and see shared insights." : canCreate ? "Teams run meetings and track actions together." : "Your request will be sent to the organization admins for approval."}
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-4">
          <div className="space-y-1.5">
            <Label>Name</Label>
            <Input value={name} onChange={(e) => setName(e.target.value)} placeholder={program ? "Mobile program" : "Team name"} autoFocus />
          </div>
          <div className="space-y-1.5">
            <Label>{canCreate ? "Description" : "Message for admins"}</Label>
            <Textarea value={description} onChange={(e) => setDescription(e.target.value)} rows={2} />
          </div>
          {canCreate && (
            <>
              <div className="space-y-1.5">
                <Label>Color</Label>
                <div className="flex flex-wrap gap-2">
                  {PALETTE.slice(0, 16).map((c) => (
                    <button key={c} type="button" onClick={() => setColor(c)} className={cn("size-6 rounded-full ring-offset-2 ring-offset-background", color === c && "ring-2 ring-foreground")} style={{ background: c }} />
                  ))}
                </div>
              </div>
              {program && teams && (
                <div className="space-y-1.5">
                  <Label>Teams in this program</Label>
                  <div className="max-h-40 space-y-1 overflow-y-auto rounded-lg border p-2">
                    {teams.map((t) => (
                      <label key={t.id} className="flex items-center gap-2 text-sm">
                        <input type="checkbox" checked={selected.includes(t.id)} onChange={(e) => setSelected((s) => (e.target.checked ? [...s, t.id] : s.filter((x) => x !== t.id)))} />
                        {t.name}
                      </label>
                    ))}
                  </div>
                </div>
              )}
              <div className="space-y-1.5">
                <Label>Invite admins <span className="font-normal text-muted-foreground">(optional)</span></Label>
                <Input value={admins} onChange={(e) => setAdmins(e.target.value)} placeholder="lead@company.com" />
              </div>
              <div className="space-y-1.5">
                <Label>Invite members <span className="font-normal text-muted-foreground">(optional, comma separated)</span></Label>
                <Textarea value={emails} onChange={(e) => setEmails(e.target.value)} rows={2} placeholder="ana@company.com, ben@company.com" />
              </div>
            </>
          )}
        </div>
        <DialogFooter>
          <Button variant="ghost" onClick={() => setOpen(false)}>Cancel</Button>
          <Button disabled={!name.trim() || pending} onClick={submit}>{canCreate ? "Create" : "Send request"}</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
