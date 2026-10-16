import Link from "next/link";
import { Archive, Users } from "lucide-react";
import { Badge } from "@/components/ui/badge";

export function TeamLogo({ name, color, logoUrl, size = 40 }: { name: string; color: string; logoUrl?: string | null; size?: number }) {
  return (
    <span className="inline-flex shrink-0 items-center justify-center overflow-hidden rounded-xl font-semibold text-white" style={{ width: size, height: size, background: color, fontSize: size * 0.36 }}>
      {logoUrl ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={logoUrl} alt="" className="size-full object-cover" />
      ) : (
        name.slice(0, 3).toLowerCase()
      )}
    </span>
  );
}

export function TeamCard({ team, role, memberCount, openActions }: { team: { id: string; name: string; color: string; logoUrl?: string | null; archived?: boolean; isProgram?: boolean }; role?: string | null; memberCount?: number; openActions?: number }) {
  return (
    <Link href={`/t/${team.id}`} className="group flex flex-col items-center gap-3 rounded-2xl border bg-card p-5 text-center shadow-xs transition hover:-translate-y-0.5 hover:shadow-md">
      <TeamLogo name={team.name} color={team.color} logoUrl={team.logoUrl} size={56} />
      <div className="space-y-1">
        <p className="font-medium group-hover:text-primary">{team.name}</p>
        <div className="flex flex-wrap items-center justify-center gap-1.5 text-xs text-muted-foreground">
          {role && <Badge variant="secondary" className="uppercase">{role}</Badge>}
          {team.isProgram && <Badge variant="outline">Program</Badge>}
          {team.archived && (
            <Badge variant="outline"><Archive className="size-3" /> Archived</Badge>
          )}
          {memberCount !== undefined && (
            <span className="inline-flex items-center gap-1"><Users className="size-3" /> {memberCount}</span>
          )}
          {!!openActions && <span>{openActions} open actions</span>}
        </div>
      </div>
    </Link>
  );
}
