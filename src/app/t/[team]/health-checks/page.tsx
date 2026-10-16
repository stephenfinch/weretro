import { notFound } from "next/navigation";
import { and, desc, eq, isNull, isNotNull } from "drizzle-orm";
import { db, schema } from "@/db";
import { requireUser } from "@/server/auth";
import { getTeamAccess } from "@/server/access";
import { MeetingTypePage } from "@/components/meetings/meeting-type-page";
import { getHealthModelFull } from "@/server/health-models";
import { healthHistory } from "@/server/insights";
import { HealthHistoryChart } from "@/components/insights/health-history-chart";
import { Select } from "@/components/insights/model-select";

export default async function HealthChecksPage({ params, searchParams }: PageProps<"/t/[team]/health-checks">) {
  const { team } = await params;
  const sp = await searchParams;
  const user = await requireUser();
  const access = await getTeamAccess(user, team);
  if (!access) notFound();
  const used = await db
    .selectDistinct({ id: schema.meetings.healthModelId })
    .from(schema.meetings)
    .where(and(eq(schema.meetings.teamId, team), eq(schema.meetings.type, "healthCheck"), isNull(schema.meetings.deletedAt), isNotNull(schema.meetings.healthModelId)));
  const latest = await db
    .select({ id: schema.meetings.healthModelId })
    .from(schema.meetings)
    .where(and(eq(schema.meetings.teamId, team), eq(schema.meetings.type, "healthCheck"), isNull(schema.meetings.deletedAt)))
    .orderBy(desc(schema.meetings.createdAt))
    .limit(1);
  const modelId = (typeof sp.model === "string" ? sp.model : null) ?? access.team.defaultHealthModelId ?? latest[0]?.id ?? null;
  const model = modelId ? await getHealthModelFull(modelId) : null;
  const history = model ? await healthHistory([team], model.id) : null;
  const models = (await Promise.all(used.map((u) => (u.id ? getHealthModelFull(u.id) : null)))).filter(Boolean).map((m) => ({ id: m!.id, name: m!.name }));
  return (
    <div>
      {model && history && (
        <div className="mx-auto max-w-7xl px-4 pt-8">
          <div className="rounded-2xl border bg-card p-5">
            <div className="mb-2 flex items-center gap-3">
              <h2 className="text-lg font-semibold">Health history</h2>
              <Select models={models} value={model.id} />
            </div>
            <HealthHistoryChart dimensions={history.dimensions} points={history.points} min={model.minRating} max={model.maxRating} />
          </div>
        </div>
      )}
      <MeetingTypePage access={access} type="healthCheck" q={typeof sp.q === "string" ? sp.q : undefined} startLike={typeof sp.startLike === "string" ? sp.startLike : undefined} demoHref={`/demo/healthCheck?team=${team}`} />
    </div>
  );
}
