import "server-only";
import { and, asc, eq, inArray, isNull, or, sql } from "drizzle-orm";
import { db, schema } from "@/db";
import { BUILTIN_HEALTH_MODELS } from "@/lib/health-models-data";

let ensured: Promise<void> | null = null;

export function ensureBuiltinHealthModels() {
  if (!ensured) {
    ensured = (async () => {
      const existing = await db
        .select({ key: schema.healthModels.builtinKey })
        .from(schema.healthModels)
        .where(sql`${schema.healthModels.builtinKey} is not null`);
      const have = new Set(existing.map((e) => e.key));
      for (const m of BUILTIN_HEALTH_MODELS) {
        if (have.has(m.key)) continue;
        const modelId = `builtin-${m.key}`;
        await db.insert(schema.healthModels).values({
          id: modelId,
          builtinKey: m.key,
          name: m.name,
          description: m.description,
          style: m.style,
          minRating: m.minRating,
          maxRating: m.maxRating,
          category: m.category,
          tags: m.tags,
          attribution: m.attribution ?? "",
          notApplicableOption: m.notApplicableOption ?? false,
        }).onConflictDoNothing();
        let dimPos = 0;
        for (const [gi, g] of m.groups.entries()) {
          const groupId = `${modelId}-g${gi + 1}`;
          await db.insert(schema.healthDimensionGroups).values({ id: groupId, modelId, name: g.name, description: g.description ?? "", position: gi }).onConflictDoNothing();
          for (const d of g.dimensions) {
            dimPos++;
            await db
              .insert(schema.healthDimensions)
              .values({
                id: `${modelId}-d${dimPos}`,
                modelId,
                groupId,
                name: d.name,
                description: d.description,
                minLabel: d.minLabel ?? "",
                maxLabel: d.maxLabel ?? "",
                valueLabels: d.valueLabels ?? null,
                position: dimPos,
              })
              .onConflictDoNothing();
          }
        }
      }
    })().catch((e) => {
      ensured = null;
      throw e;
    });
  }
  return ensured;
}

export type HealthModel = typeof schema.healthModels.$inferSelect;
export type HealthDimension = typeof schema.healthDimensions.$inferSelect;
export type HealthGroup = typeof schema.healthDimensionGroups.$inferSelect;
export type HealthModelFull = HealthModel & { groups: (HealthGroup & { dimensions: HealthDimension[] })[]; dimensions: HealthDimension[] };

export async function listHealthModels(orgId: string, teamId: string, opts: { includeArchived?: boolean } = {}) {
  await ensureBuiltinHealthModels();
  const models = await db
    .select()
    .from(schema.healthModels)
    .where(
      and(
        isNull(schema.healthModels.deletedAt),
        opts.includeArchived ? undefined : isNull(schema.healthModels.archivedAt),
        or(
          sql`${schema.healthModels.builtinKey} is not null`,
          and(eq(schema.healthModels.orgId, orgId), isNull(schema.healthModels.teamId)),
          eq(schema.healthModels.teamId, teamId),
        ),
      ),
    )
    .orderBy(asc(schema.healthModels.name));
  const ids = models.map((m) => m.id);
  const dims = ids.length
    ? await db
        .select({ modelId: schema.healthDimensions.modelId, name: schema.healthDimensions.name })
        .from(schema.healthDimensions)
        .where(and(inArray(schema.healthDimensions.modelId, ids), isNull(schema.healthDimensions.deletedAt)))
        .orderBy(asc(schema.healthDimensions.position))
    : [];
  return models.map((m) => ({ ...m, dimensionNames: dims.filter((d) => d.modelId === m.id).map((d) => d.name) }));
}

export async function getHealthModelFull(id: string): Promise<HealthModelFull | null> {
  await ensureBuiltinHealthModels();
  const [model] = await db.select().from(schema.healthModels).where(eq(schema.healthModels.id, id)).limit(1);
  if (!model) return null;
  const groups = await db
    .select()
    .from(schema.healthDimensionGroups)
    .where(and(eq(schema.healthDimensionGroups.modelId, id), isNull(schema.healthDimensionGroups.deletedAt)))
    .orderBy(asc(schema.healthDimensionGroups.position));
  const dimensions = await db
    .select()
    .from(schema.healthDimensions)
    .where(and(eq(schema.healthDimensions.modelId, id), isNull(schema.healthDimensions.deletedAt)))
    .orderBy(asc(schema.healthDimensions.position));
  return {
    ...model,
    groups: groups.map((g) => ({ ...g, dimensions: dimensions.filter((d) => d.groupId === g.id) })),
    dimensions,
  };
}

export type HealthModelInput = {
  name: string;
  description?: string;
  style: string;
  minRating: number;
  maxRating: number;
  notApplicableOption?: boolean;
  flipOrder?: boolean;
  valueLabels?: string[] | null;
  groups: {
    id?: string;
    name: string;
    description?: string;
    dimensions: { id?: string; name: string; description?: string; minLabel?: string; maxLabel?: string; valueLabels?: string[] | null }[];
  }[];
};

export async function saveHealthModel(input: HealthModelInput, scope: { orgId: string; teamId: string | null; userId: string; id?: string; aiGenerated?: boolean }) {
  return db.transaction(async (tx) => {
    let modelId = scope.id;
    const values = {
      name: input.name,
      description: input.description ?? "",
      style: input.style,
      minRating: input.minRating,
      maxRating: input.maxRating,
      notApplicableOption: !!input.notApplicableOption,
      flipOrder: !!input.flipOrder,
      valueLabels: input.valueLabels ?? null,
      updatedAt: new Date(),
    };
    if (modelId) {
      await tx.update(schema.healthModels).set(values).where(eq(schema.healthModels.id, modelId));
    } else {
      const [m] = await tx
        .insert(schema.healthModels)
        .values({ ...values, orgId: scope.orgId, teamId: scope.teamId, createdById: scope.userId, category: "custom", aiGenerated: !!scope.aiGenerated })
        .returning();
      modelId = m.id;
    }
    const keepGroupIds: string[] = [];
    const keepDimIds: string[] = [];
    let dimPos = 0;
    for (const [gi, g] of input.groups.entries()) {
      let groupId = g.id;
      if (groupId) {
        await tx.update(schema.healthDimensionGroups).set({ name: g.name, description: g.description ?? "", position: gi }).where(eq(schema.healthDimensionGroups.id, groupId));
      } else {
        const [row] = await tx.insert(schema.healthDimensionGroups).values({ modelId, name: g.name, description: g.description ?? "", position: gi }).returning();
        groupId = row.id;
      }
      keepGroupIds.push(groupId);
      for (const d of g.dimensions) {
        dimPos++;
        const dv = {
          name: d.name,
          description: d.description ?? "",
          minLabel: d.minLabel ?? "",
          maxLabel: d.maxLabel ?? "",
          valueLabels: d.valueLabels ?? null,
          position: dimPos,
          groupId,
        };
        if (d.id) {
          await tx.update(schema.healthDimensions).set(dv).where(eq(schema.healthDimensions.id, d.id));
          keepDimIds.push(d.id);
        } else {
          const [row] = await tx.insert(schema.healthDimensions).values({ ...dv, modelId }).returning();
          keepDimIds.push(row.id);
        }
      }
    }
    const now = new Date();
    const allGroups = await tx.select({ id: schema.healthDimensionGroups.id }).from(schema.healthDimensionGroups).where(eq(schema.healthDimensionGroups.modelId, modelId));
    for (const g of allGroups) if (!keepGroupIds.includes(g.id)) await tx.update(schema.healthDimensionGroups).set({ deletedAt: now }).where(eq(schema.healthDimensionGroups.id, g.id));
    const allDims = await tx.select({ id: schema.healthDimensions.id }).from(schema.healthDimensions).where(eq(schema.healthDimensions.modelId, modelId));
    for (const d of allDims) if (!keepDimIds.includes(d.id)) await tx.update(schema.healthDimensions).set({ deletedAt: now }).where(eq(schema.healthDimensions.id, d.id));
    return modelId;
  });
}
