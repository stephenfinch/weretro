import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { and, asc, desc, eq, isNull } from "drizzle-orm";
import { db, schema } from "@/db";
import { requireUser } from "@/server/auth";
import { getOrgAccess } from "@/server/access";
import { listHealthModels } from "@/server/health-models";
import { mediaUrl } from "@/server/meetings/state";
import { AI_MODEL, aiFeature } from "@/server/ai";
import { cn } from "@/lib/utils";
import { ApiKeysSection, DecksSection, HealthModelsSection, TemplatesSection } from "@/components/settings/sections";
import { OrgConnectedAppsSection, OrgDangerSection, OrgFeaturesSection, OrgGeneralSection, OrgPoliciesSection, OrgRolesSection, OrgSecuritySection, OrgSsoSection } from "@/components/settings/org-sections";
import { currentIp } from "@/server/ip";
import { appUrl } from "@/server/auth";

export const metadata = { title: "Organization settings" };

const SECTIONS: { heading: string; items: [string, string][] }[] = [
  { heading: "Account", items: [["general", "General"]] },
  { heading: "Meetings", items: [["retrospectives", "Retrospectives"], ["standups", "Standups"], ["health-checks", "Health checks"], ["estimations", "Estimations"]] },
  { heading: "Controls", items: [["policies", "Team policies"], ["roles", "Roles & permissions"], ["features", "AI & features"]] },
  { heading: "Security & access", items: [["security", "Security"], ["sso", "SSO & provisioning"], ["api", "API & connected apps"]] },
];

export default async function OrgSettingsPage({ params }: PageProps<"/o/[org]/settings/[[...section]]">) {
  const { org: slug, section: parts } = await params;
  const section = parts?.[0] ?? "general";
  const user = await requireUser();
  const access = await getOrgAccess(user, slug);
  if (!access) notFound();
  if (!access.isAdmin) redirect(`/o/${slug}`);
  const { org } = access;
  const base = `/o/${slug}/settings`;

  let content: React.ReactNode;
  switch (section) {
    case "general":
      content = (
        <div className="space-y-6">
          <OrgGeneralSection org={{ id: org.id, name: org.name, color: org.color, slug: org.slug, logoUrl: mediaUrl(org.logoMediaId), coverUrl: mediaUrl(org.coverMediaId) }} />
          <OrgDangerSection orgId={org.id} orgName={org.name} isOwner={access.isOwner} />
        </div>
      );
      break;
    case "policies":
      content = <OrgPoliciesSection orgId={org.id} settings={org.settings} />;
      break;
    case "roles":
      content = <OrgRolesSection orgId={org.id} settings={org.settings} />;
      break;
    case "features":
      content = <OrgFeaturesSection orgId={org.id} settings={org.settings} configured={!!process.env.ANTHROPIC_API_KEY} model={AI_MODEL} />;
      break;
    case "security":
      content = <OrgSecuritySection orgId={org.id} settings={org.settings} currentIp={await currentIp()} />;
      break;
    case "sso":
      content = (
        <OrgSsoSection
          orgId={org.id}
          settings={org.settings}
          urls={{ acs: appUrl(`/api/sso/${org.id}/acs`), entityId: appUrl(`/api/sso/${org.id}/metadata`), metadata: appUrl(`/api/sso/${org.id}/metadata`), login: appUrl(`/sso/${org.slug}`), scim: appUrl("/api/scim/v2") }}
        />
      );
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
          aiEnabled={aiFeature(org, "generateTemplates")}
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
          aiEnabled={aiFeature(org, "generateHealthModels")}
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
      const grants = await db
        .select({ id: schema.oauthGrants.id, clientName: schema.oauthClients.name, userName: schema.users.name, createdAt: schema.oauthGrants.createdAt, lastUsedAt: schema.oauthGrants.lastUsedAt })
        .from(schema.oauthGrants)
        .innerJoin(schema.oauthClients, eq(schema.oauthClients.id, schema.oauthGrants.clientId))
        .innerJoin(schema.users, eq(schema.users.id, schema.oauthGrants.userId))
        .where(and(eq(schema.oauthGrants.orgId, org.id), isNull(schema.oauthGrants.revokedAt)))
        .orderBy(desc(schema.oauthGrants.createdAt));
      content = (
        <div className="space-y-6">
          <OrgConnectedAppsSection orgId={org.id} settings={org.settings} grants={grants} mcpUrl={appUrl("/api/mcp")} />
          <ApiKeysSection orgId={org.id} teamId={null} keys={keys} />
        </div>
      );
      break;
    }
    default:
      notFound();
  }

  return (
    <div className="mx-auto flex max-w-7xl flex-col gap-6 px-4 py-8 md:flex-row">
      <nav className="flex shrink-0 gap-1 overflow-x-auto md:w-56 md:flex-col">
        {SECTIONS.map((g) => (
          <div key={g.heading} className="flex gap-1 md:mb-3 md:flex-col">
            <p className="hidden px-3 pb-1 text-xs font-semibold tracking-wide text-muted-foreground uppercase md:block">{g.heading}</p>
            {g.items.map(([key, label]) => (
              <Link key={key} href={key === "general" ? base : `${base}/${key}`} className={cn("rounded-lg px-3 py-2 text-sm whitespace-nowrap hover:bg-muted", section === key ? "bg-muted font-medium" : "text-muted-foreground")}>
                {label}
              </Link>
            ))}
          </div>
        ))}
      </nav>
      <div className="min-w-0 flex-1">{content}</div>
    </div>
  );
}
