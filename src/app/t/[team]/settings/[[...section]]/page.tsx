import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { and, desc, eq, gt, isNotNull } from "drizzle-orm";
import { db, schema } from "@/db";
import { requireUser } from "@/server/auth";
import { getTeamAccess, isOrgAdmin } from "@/server/access";
import { teamDecks, teamTemplates } from "@/server/queries";
import { listHealthModels } from "@/server/health-models";
import { mediaUrl } from "@/server/meetings/state";
import { aiEnabledFor } from "@/server/ai";
import { integrationDef } from "@/lib/integrations";
import { cn } from "@/lib/utils";
import { ApiKeysSection, DecksSection, DeletedSection, GeneralSection, HealthModelsSection, IntegrationsSection, RolesSection, TemplatesSection } from "@/components/settings/sections";

const daysAgo = (n: number) => new Date(Date.now() - n * 86400000);

const SECTIONS = [
  ["general", "General"],
  ["retrospectives", "Retrospectives"],
  ["standups", "Standups"],
  ["health-checks", "Health checks"],
  ["estimations", "Estimations"],
  ["integrations", "Integrations"],
  ["api", "API keys"],
  ["roles", "Roles & permissions"],
  ["deleted", "Recently deleted"],
] as const;

export default async function TeamSettingsPage({ params }: PageProps<"/t/[team]/settings/[[...section]]">) {
  const { team: teamId, section: sectionParts } = await params;
  const section = sectionParts?.[0] ?? "general";
  const user = await requireUser();
  const access = await getTeamAccess(user, teamId);
  if (!access) notFound();
  if (!access.isAdmin) redirect(`/t/${teamId}`);
  const { team, org } = access;
  const orgAdmin = isOrgAdmin(access.orgUser);
  const ai = aiEnabledFor(org);
  const base = `/t/${teamId}/settings`;

  let content: React.ReactNode = null;
  switch (section) {
    case "general":
      content = (
        <GeneralSection
          team={{ id: team.id, name: team.name, description: team.description, color: team.color, tags: team.tags, language: team.language, logoUrl: mediaUrl(team.logoMediaId), coverUrl: mediaUrl(team.coverMediaId), archived: !!team.archivedAt }}
        />
      );
      break;
    case "retrospectives":
    case "standups": {
      const type = section === "retrospectives" ? "retrospective" : "standup";
      const rows = await teamTemplates(org.id, teamId, type);
      const map = (t: (typeof rows)[number]) => ({ id: t.id, name: t.name, descriptionShort: t.descriptionShort, body: t.body, teamId: t.teamId, sharedWithOtherTeams: t.sharedWithOtherTeams });
      content = (
        <TemplatesSection
          teamId={teamId}
          orgId={org.id}
          meetingType={type}
          team={rows.filter((t) => t.teamId === teamId).map(map)}
          account={rows.filter((t) => !t.teamId).map(map)}
          latestLink={`/t/${teamId}/latest/${type}`}
          aiEnabled={ai}
          isOrgAdmin={orgAdmin}
        />
      );
      break;
    }
    case "health-checks": {
      const models = await listHealthModels(org.id, teamId, { includeArchived: true });
      content = (
        <HealthModelsSection
          teamId={teamId}
          orgId={org.id}
          models={models.map((m) => ({ id: m.id, name: m.name, style: m.style, teamId: m.teamId, orgId: m.orgId, archivedAt: m.archivedAt, dimensionNames: m.dimensionNames, builtinKey: m.builtinKey }))}
          defaultModelId={team.defaultHealthModelId}
          latestLink={`/t/${teamId}/latest/healthCheck`}
          aiEnabled={ai}
          isOrgAdmin={orgAdmin}
        />
      );
      break;
    }
    case "estimations": {
      const decks = await teamDecks(org.id, teamId);
      content = <DecksSection teamId={teamId} orgId={org.id} decks={decks.map((d) => ({ id: d.id, name: d.name, cards: d.cards, teamId: d.teamId }))} defaultDeckId={team.defaultDeckId} latestLink={`/t/${teamId}/latest/estimation`} isOrgAdmin={orgAdmin} />;
      break;
    }
    case "integrations": {
      const rows = await db.select().from(schema.integrations).where(eq(schema.integrations.teamId, teamId)).orderBy(desc(schema.integrations.createdAt));
      // never send secrets to the browser
      const safe = rows.map((r) => {
        const def = integrationDef(r.type);
        const config = Object.fromEntries(Object.entries(r.config).filter(([k]) => !def?.fields.find((f) => f.key === k)?.secret));
        return { id: r.id, type: r.type, name: r.name, status: r.status, lastError: r.lastError, config };
      });
      content = <IntegrationsSection teamId={teamId} integrations={safe} />;
      break;
    }
    case "api": {
      const keys = await db.select().from(schema.apiKeys).where(eq(schema.apiKeys.teamId, teamId)).orderBy(desc(schema.apiKeys.createdAt));
      content = <ApiKeysSection orgId={org.id} teamId={teamId} keys={keys} disabled={org.settings.teamApiKeys === false} />;
      break;
    }
    case "roles":
      content = <RolesSection teamId={teamId} permissions={team.options.permissions ?? {}} />;
      break;
    case "deleted": {
      const cutoff = daysAgo(30);
      const [meetings, series] = await Promise.all([
        db
          .select({ id: schema.meetings.id, title: schema.meetings.title, type: schema.meetings.type, date: schema.meetings.date, deletedAt: schema.meetings.deletedAt })
          .from(schema.meetings)
          .where(and(eq(schema.meetings.teamId, teamId), isNotNull(schema.meetings.deletedAt), gt(schema.meetings.deletedAt, cutoff)))
          .orderBy(desc(schema.meetings.deletedAt)),
        db
          .select({ id: schema.meetingSeries.id, title: schema.meetingSeries.title, type: schema.meetingSeries.type, deletedAt: schema.meetingSeries.deletedAt })
          .from(schema.meetingSeries)
          .where(and(eq(schema.meetingSeries.teamId, teamId), isNotNull(schema.meetingSeries.deletedAt), gt(schema.meetingSeries.deletedAt, cutoff)))
          .orderBy(desc(schema.meetingSeries.deletedAt)),
      ]);
      content = <DeletedSection teamId={teamId} meetings={meetings.map((m) => ({ ...m, deletedAt: m.deletedAt! }))} series={series.map((s) => ({ ...s, deletedAt: s.deletedAt! }))} />;
      break;
    }
    default:
      notFound();
  }

  return (
    <div className="mx-auto flex max-w-7xl flex-col gap-6 px-4 py-8 md:flex-row">
      <nav className="flex shrink-0 gap-1 overflow-x-auto md:w-56 md:flex-col">
        {SECTIONS.map(([key, label]) => (
          <Link key={key} href={key === "general" ? base : `${base}/${key}`} className={cn("rounded-lg px-3 py-2 text-sm whitespace-nowrap hover:bg-muted", section === key ? "bg-muted font-medium" : "text-muted-foreground")}>
            {label}
          </Link>
        ))}
      </nav>
      <div className="min-w-0 flex-1">{content}</div>
    </div>
  );
}
