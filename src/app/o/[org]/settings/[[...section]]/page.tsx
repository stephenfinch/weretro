import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { and, asc, desc, eq, isNull } from "drizzle-orm";
import { db, schema } from "@/db";
import { requireUser } from "@/server/auth";
import { getOrgAccess } from "@/server/access";
import { listHealthModels } from "@/server/health-models";
import { mediaUrl } from "@/server/meetings/state";
import { AI_MODEL, aiEnabledFor } from "@/server/ai";
import { cn } from "@/lib/utils";
import { ApiKeysSection, DecksSection, HealthModelsSection, TemplatesSection } from "@/components/settings/sections";
import { OrgAiSection, OrgDangerSection, OrgGeneralSection, OrgSecuritySection } from "@/components/settings/org-sections";

export const metadata = { title: "Organization settings" };

const SECTIONS = [
  ["general", "General"],
  ["security", "Security & access"],
  ["ai", "AI"],
  ["retrospectives", "Retrospective templates"],
  ["standups", "Standup templates"],
  ["health-checks", "Health models"],
  ["estimations", "Estimation decks"],
  ["api", "API keys"],
  ["danger", "Danger zone"],
] as const;

export default async function OrgSettingsPage({ params }: PageProps<"/o/[org]/settings/[[...section]]">) {
  const { org: slug, section: parts } = await params;
  const section = parts?.[0] ?? "general";
  const user = await requireUser();
  const access = await getOrgAccess(user, slug);
  if (!access) notFound();
  if (!access.isAdmin) redirect(`/o/${slug}`);
  const { org } = access;
  const base = `/o/${slug}/settings`;
  const ai = aiEnabledFor(org);

  let content: React.ReactNode;
  switch (section) {
    case "general":
      content = <OrgGeneralSection org={{ id: org.id, name: org.name, color: org.color, slug: org.slug, logoUrl: mediaUrl(org.logoMediaId) }} />;
      break;
    case "security":
      content = <OrgSecuritySection orgId={org.id} settings={org.settings} />;
      break;
    case "ai":
      content = <OrgAiSection orgId={org.id} settings={org.settings} configured={!!process.env.ANTHROPIC_API_KEY} model={AI_MODEL} />;
      break;
    case "retrospectives":
    case "standups": {
      const type = section === "retrospectives" ? "retrospective" : "standup";
      const rows = await db
        .select()
        .from(schema.templates)
        .where(and(eq(schema.templates.orgId, org.id), isNull(schema.templates.teamId), eq(schema.templates.meetingType, type), isNull(schema.templates.deletedAt)))
        .orderBy(asc(schema.templates.name));
      content = (
        <TemplatesSection
          teamId={null}
          orgId={org.id}
          meetingType={type}
          team={rows.map((t) => ({ id: t.id, name: t.name, descriptionShort: t.descriptionShort, body: t.body, teamId: t.teamId, sharedWithOtherTeams: t.sharedWithOtherTeams }))}
          account={[]}
          aiEnabled={ai}
          isOrgAdmin
        />
      );
      break;
    }
    case "health-checks": {
      const models = (await listHealthModels(org.id, "", { includeArchived: true })).filter((m) => !m.builtinKey);
      content = (
        <HealthModelsSection
          teamId={null}
          orgId={org.id}
          models={models.map((m) => ({ id: m.id, name: m.name, style: m.style, teamId: m.teamId, orgId: m.orgId, archivedAt: m.archivedAt, dimensionNames: m.dimensionNames, builtinKey: m.builtinKey }))}
          defaultModelId={null}
          aiEnabled={ai}
          isOrgAdmin
        />
      );
      break;
    }
    case "estimations": {
      const decks = await db
        .select()
        .from(schema.estimationDecks)
        .where(and(eq(schema.estimationDecks.orgId, org.id), isNull(schema.estimationDecks.teamId), isNull(schema.estimationDecks.deletedAt)))
        .orderBy(asc(schema.estimationDecks.name));
      content = <DecksSection teamId={null} orgId={org.id} decks={decks.map((d) => ({ id: d.id, name: d.name, cards: d.cards, teamId: d.teamId }))} defaultDeckId={null} isOrgAdmin />;
      break;
    }
    case "api": {
      const keys = await db.select().from(schema.apiKeys).where(and(eq(schema.apiKeys.orgId, org.id), isNull(schema.apiKeys.teamId))).orderBy(desc(schema.apiKeys.createdAt));
      content = <ApiKeysSection orgId={org.id} teamId={null} keys={keys} />;
      break;
    }
    case "danger":
      content = <OrgDangerSection orgId={org.id} orgName={org.name} isOwner={access.isOwner} />;
      break;
    default:
      notFound();
  }

  return (
    <div className="mx-auto flex max-w-7xl flex-col gap-6 px-4 py-8 md:flex-row">
      <nav className="flex shrink-0 gap-1 overflow-x-auto md:w-56 md:flex-col">
        <p className="hidden px-3 pb-2 text-xs font-semibold tracking-wide text-muted-foreground uppercase md:block">Organization settings</p>
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
