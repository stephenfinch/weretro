import Link from "next/link";
import { format, parseISO } from "date-fns";
import { HeartPulse, LayoutGrid, MessagesSquare, Spade } from "lucide-react";
import type { MeetingListItem } from "@/server/queries";
import { AvatarStack } from "@/components/user-avatar";
import { Badge } from "@/components/ui/badge";
import { MEETING_TYPE_LABEL, STEP_LABEL } from "@/lib/constants";
import type { MeetingType, StepKey } from "@/lib/types";
import { TopicIcon } from "@/components/meeting-setup/settings-editor";

const ICON = { retrospective: LayoutGrid, standup: MessagesSquare, healthCheck: HeartPulse, estimation: Spade } as const;

export function MeetingCard({ m, compact }: { m: MeetingListItem; compact?: boolean }) {
  const Icon = ICON[m.type as MeetingType] ?? LayoutGrid;
  return (
    <Link href={`/m/${m.id}`} className="group flex flex-col gap-3 rounded-2xl border bg-card p-4 shadow-xs transition hover:-translate-y-0.5 hover:border-primary/50 hover:shadow-md">
      <div className="flex items-start gap-3">
        <span className="flex size-9 shrink-0 items-center justify-center rounded-xl bg-primary/10 text-primary">
          <Icon className="size-5" />
        </span>
        <div className="min-w-0 flex-1">
          <p className="truncate font-medium group-hover:text-primary">{m.title || m.templateName || MEETING_TYPE_LABEL[m.type as MeetingType]}</p>
          <p className="text-xs text-muted-foreground">
            {format(parseISO(m.date), "EEE, MMM d, yyyy")}
            {m.templateName && m.title ? ` · ${m.templateName}` : ""}
          </p>
        </div>
        {m.status === "open" ? (
          <Badge>{m.stepKey ? STEP_LABEL[m.stepKey as StepKey] : "Open"}</Badge>
        ) : (
          <Badge variant="secondary">Closed</Badge>
        )}
      </div>
      {!compact && m.type === "retrospective" && m.topics.length > 0 && (
        <div className="flex gap-1">
          {m.topics.slice(0, 6).map((t) => (
            <span key={t.id} className="flex size-6 items-center justify-center rounded-md" style={{ background: `${t.color}1f` }} title={t.title}>
              <TopicIcon name={t.icon} color={t.color} className="size-3.5" />
            </span>
          ))}
        </div>
      )}
      <div className="flex items-center gap-3 text-xs text-muted-foreground">
        {m.participants.length > 0 && <AvatarStack people={m.participants} size={22} />}
        {m.type === "retrospective" && <span>{m.ideaCount} ideas</span>}
        {m.type === "standup" && (
          <span>
            {m.updateCount} updates{m.blockerCount ? ` · ${m.blockerCount} blockers` : ""}
          </span>
        )}
        {m.actionCount > 0 && <span>{m.actionCount} actions</span>}
      </div>
    </Link>
  );
}
