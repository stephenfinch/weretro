"use server";

import { revalidatePath } from "next/cache";
import { and, eq } from "drizzle-orm";
import { db, schema } from "@/db";
import { requireUser } from "@/server/auth";
import { assertTeamAccess, getOrgAccess, HttpError } from "@/server/access";
import { loadMeetingContext, canFacilitateMeeting } from "@/server/meetings/context";
import { saveHealthModel, type HealthModelInput, getHealthModelFull } from "@/server/health-models";
import type { DeckCard, TemplateBody } from "@/lib/types";

type Result<T = unknown> = { ok: true; data?: T } | { ok: false; error: string };
async function wrap<T>(fn: () => Promise<T>): Promise<Result<T>> {
  try {
    return { ok: true, data: await fn() };
  } catch (e) {
    if (e instanceof HttpError) return { ok: false, error: e.message };
    console.error(e);
    return { ok: false, error: "Something went wrong" };
  }
}

async function canManageTemplates(userId: string, teamId: string | null, orgId: string) {
  const user = await requireUser();
  if (teamId) {
    const access = await assertTeamAccess(user, teamId);
    if (!access.isAdmin && !access.can("startRetrospectives") && !access.can("startStandups")) throw new HttpError(403, "You can't manage templates for this team");
    return access.org.id;
  }
  const org = await getOrgAccess(user, orgId);
  if (!org?.isAdmin) throw new HttpError(403, "Only organization admins can manage account templates");
  void userId;
  return org.org.id;
}

export async function saveTemplateFromMeeting(meetingId: string, name: string) {
  return wrap(async () => {
    const user = await requireUser();
    const ctx = await loadMeetingContext(meetingId, user);
    if (!canFacilitateMeeting(ctx)) throw new HttpError(403, "Only facilitators can save templates");
    const [t] = await db
      .insert(schema.templates)
      .values({
        orgId: ctx.team.orgId,
        teamId: ctx.team.id,
        meetingType: ctx.meeting.type,
        name: name.slice(0, 100),
        descriptionShort: ctx.meeting.topics.map((t) => t.title).join(" · ").slice(0, 200),
        body: { topics: ctx.meeting.topics, options: { background: ctx.meeting.options.background ?? null } },
        createdById: user.id,
      })
      .returning();
    revalidatePath(`/t/${ctx.team.id}`, "layout");
    return { id: t.id };
  });
}

export async function saveTemplate(input: { id?: string; teamId: string | null; orgId: string; meetingType: "retrospective" | "standup"; name: string; descriptionShort?: string; body: TemplateBody; aiGenerated?: boolean }) {
  return wrap(async () => {
    const user = await requireUser();
    const orgId = await canManageTemplates(user.id, input.teamId, input.orgId);
    if (!input.name.trim()) throw new HttpError(400, "Template name is required");
    if (!input.body.topics.length) throw new HttpError(400, "Add at least one topic");
    const values = {
      name: input.name.trim().slice(0, 100),
      descriptionShort: input.descriptionShort ?? input.body.topics.map((t) => t.title).join(" · ").slice(0, 200),
      body: input.body,
      updatedAt: new Date(),
    };
    if (input.id) {
      await db.update(schema.templates).set(values).where(eq(schema.templates.id, input.id));
      revalidatePath("/", "layout");
      return { id: input.id };
    }
    const [t] = await db
      .insert(schema.templates)
      .values({ ...values, orgId, teamId: input.teamId, meetingType: input.meetingType, createdById: user.id, aiGenerated: !!input.aiGenerated })
      .returning();
    revalidatePath("/", "layout");
    return { id: t.id };
  });
}

export async function updateTemplateScope(id: string, patch: { sharedWithOtherTeams?: boolean; moveToAccount?: boolean; delete?: boolean }) {
  return wrap(async () => {
    const user = await requireUser();
    const [t] = await db.select().from(schema.templates).where(eq(schema.templates.id, id)).limit(1);
    if (!t) throw new HttpError(404, "Template not found");
    await canManageTemplates(user.id, t.teamId, t.orgId!);
    if (patch.delete) await db.update(schema.templates).set({ deletedAt: new Date() }).where(eq(schema.templates.id, id));
    else if (patch.moveToAccount) {
      const org = await getOrgAccess(user, t.orgId!);
      if (!org?.isAdmin) throw new HttpError(403, "Only organization admins can move templates to the account");
      await db.update(schema.templates).set({ teamId: null }).where(eq(schema.templates.id, id));
    } else if (patch.sharedWithOtherTeams !== undefined) await db.update(schema.templates).set({ sharedWithOtherTeams: patch.sharedWithOtherTeams }).where(eq(schema.templates.id, id));
    revalidatePath("/", "layout");
  });
}

export async function saveHealthModelAction(input: HealthModelInput & { id?: string; teamId: string | null; orgId: string; aiGenerated?: boolean }) {
  return wrap(async () => {
    const user = await requireUser();
    const orgId = await canManageTemplates(user.id, input.teamId, input.orgId);
    if (input.id) {
      const existing = await getHealthModelFull(input.id);
      if (existing?.builtinKey) throw new HttpError(400, "Built-in models can't be edited. Copy it instead.");
    }
    if (!input.name.trim()) throw new HttpError(400, "Health model name is required");
    if (!input.groups.some((g) => g.dimensions.length)) throw new HttpError(400, "Add at least one dimension");
    const id = await saveHealthModel(input, { orgId, teamId: input.teamId, userId: user.id, id: input.id, aiGenerated: input.aiGenerated });
    revalidatePath("/", "layout");
    return { id };
  });
}

export async function updateHealthModelScope(id: string, patch: { archived?: boolean; moveToAccount?: boolean; delete?: boolean }) {
  return wrap(async () => {
    const user = await requireUser();
    const [m] = await db.select().from(schema.healthModels).where(eq(schema.healthModels.id, id)).limit(1);
    if (!m || m.builtinKey) throw new HttpError(400, "Built-in models can't be changed");
    await canManageTemplates(user.id, m.teamId, m.orgId!);
    if (patch.delete) await db.update(schema.healthModels).set({ deletedAt: new Date() }).where(eq(schema.healthModels.id, id));
    else if (patch.moveToAccount) await db.update(schema.healthModels).set({ teamId: null }).where(eq(schema.healthModels.id, id));
    else if (patch.archived !== undefined) await db.update(schema.healthModels).set({ archivedAt: patch.archived ? new Date() : null }).where(eq(schema.healthModels.id, id));
    revalidatePath("/", "layout");
  });
}

export async function getHealthModelAction(id: string) {
  await requireUser();
  return getHealthModelFull(id);
}

export async function saveDeckAction(input: { id?: string; teamId: string | null; orgId: string; name: string; cards: DeckCard[] }) {
  return wrap(async () => {
    const user = await requireUser();
    const orgId = await canManageTemplates(user.id, input.teamId, input.orgId);
    const cards = input.cards.filter((c) => c.label.trim());
    if (!input.name.trim()) throw new HttpError(400, "Deck name is required");
    if (cards.length < 2) throw new HttpError(400, "Add at least two cards");
    const labels = cards.map((c) => c.label.trim());
    if (new Set(labels).size !== labels.length) throw new HttpError(400, "Card labels must be unique");
    const normalized = cards.map((c) => {
      const n = Number(c.label);
      return { label: c.label.trim(), value: c.special ? undefined : Number.isFinite(n) ? n : c.label === "½" ? 0.5 : undefined, description: c.description, special: c.special };
    });
    if (input.id) {
      await db.update(schema.estimationDecks).set({ name: input.name, cards: normalized }).where(eq(schema.estimationDecks.id, input.id));
      revalidatePath("/", "layout");
      return { id: input.id };
    }
    const existing = await db
      .select({ id: schema.estimationDecks.id })
      .from(schema.estimationDecks)
      .where(and(eq(schema.estimationDecks.name, input.name), input.teamId ? eq(schema.estimationDecks.teamId, input.teamId) : eq(schema.estimationDecks.orgId, orgId)));
    if (existing.length) throw new HttpError(400, "A deck with this name already exists");
    const [d] = await db.insert(schema.estimationDecks).values({ orgId, teamId: input.teamId, name: input.name, cards: normalized, createdById: user.id }).returning();
    revalidatePath("/", "layout");
    return { id: d.id };
  });
}

export async function updateDeckScope(id: string, patch: { moveToAccount?: boolean; delete?: boolean }) {
  return wrap(async () => {
    const user = await requireUser();
    const [d] = await db.select().from(schema.estimationDecks).where(eq(schema.estimationDecks.id, id)).limit(1);
    if (!d) throw new HttpError(404, "Deck not found");
    await canManageTemplates(user.id, d.teamId, d.orgId!);
    if (patch.delete) await db.update(schema.estimationDecks).set({ deletedAt: new Date() }).where(eq(schema.estimationDecks.id, id));
    else if (patch.moveToAccount) await db.update(schema.estimationDecks).set({ teamId: null }).where(eq(schema.estimationDecks.id, id));
    revalidatePath("/", "layout");
  });
}
