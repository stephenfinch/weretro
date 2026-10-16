"use client";

import Link from "next/link";
import { ArrowLeft, Printer } from "lucide-react";
import type { MeetingStateDTO } from "@/lib/meeting-types";
import { Button } from "@/components/ui/button";
import { LogoMark } from "@/components/brand";
import { MeetingContext, useMeetingSync } from "./use-meeting";
import { MeetingReport } from "./steps/share";

export function ReportView({ initial, autoPrint }: { initial: MeetingStateDTO; autoPrint?: boolean }) {
  const ctx = useMeetingSync(initial);
  return (
    <MeetingContext.Provider value={ctx}>
      <div className="min-h-screen bg-background">
        <header className="no-print sticky top-0 z-10 flex items-center gap-3 border-b bg-background/90 px-4 py-2 backdrop-blur">
          <Button variant="ghost" size="sm" asChild>
            <Link href={`/m/${initial.meeting.id}`}><ArrowLeft /> Back to meeting</Link>
          </Button>
          <div className="ml-auto">
            <Button size="sm" onClick={() => window.print()} ref={(el) => { if (el && autoPrint) setTimeout(() => window.print(), 600); }}>
              <Printer /> Print or save as PDF
            </Button>
          </div>
        </header>
        <main className="mx-auto max-w-4xl px-6 py-8 print:max-w-none print:p-0">
          <div className="mb-6 flex items-center gap-2 text-sm text-muted-foreground">
            <LogoMark className="size-5" /> {initial.team.name}
          </div>
          <MeetingReport printable />
        </main>
      </div>
    </MeetingContext.Provider>
  );
}
