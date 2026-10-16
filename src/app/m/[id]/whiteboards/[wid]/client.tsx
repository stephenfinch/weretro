"use client";
import dynamic from "next/dynamic";
const WhiteboardCanvas = dynamic(() => import("@/components/meeting/whiteboard-canvas"), { ssr: false });
export function WhiteboardPage({ id }: { id: string }) {
  return (
    <div className="h-dvh">
      <WhiteboardCanvas id={id} readOnly />
    </div>
  );
}
