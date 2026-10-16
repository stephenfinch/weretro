"use client";

import dynamic from "next/dynamic";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { useMeeting } from "./use-meeting";

const WhiteboardCanvas = dynamic(() => import("./whiteboard-canvas"), { ssr: false });

export function WhiteboardDialog({ id, onClose }: { id: string | null; onClose: () => void }) {
  const { state } = useMeeting();
  const wb = state.whiteboards.find((w) => w.id === id);
  const readOnly = !state.me.participantId || state.me.role === "observer" || (wb?.editPermission === "creator" && wb.createdById !== state.me.userId && !state.me.isFacilitator);
  return (
    <Dialog open={!!id} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="flex h-[90vh] max-w-[95vw] flex-col gap-0 p-0 sm:max-w-[95vw]">
        <DialogHeader className="border-b px-4 py-3">
          <DialogTitle>{wb?.title ?? "Whiteboard"}</DialogTitle>
        </DialogHeader>
        <div className="min-h-0 flex-1">{id && <WhiteboardCanvas id={id} readOnly={readOnly} title={wb?.title} />}</div>
      </DialogContent>
    </Dialog>
  );
}
