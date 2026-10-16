/**
 * Seeds a demo organization with teams, people, a finished retrospective,
 * a health check, an estimation session and some actions.
 *
 *   pnpm db:seed
 *
 * Sign in as avery@weretro.dev / weretro-demo afterwards.
 */
import Module from "node:module";
import path from "node:path";

try {
  process.loadEnvFile(".env.local");
} catch {}

// Server modules import "server-only", which throws outside Next.js. Point it at an empty module.
const M = Module as unknown as { _resolveFilename: (request: string, ...rest: unknown[]) => string };
const resolve = M._resolveFilename;
M._resolveFilename = function (request: string, ...rest: unknown[]) {
  if (request === "server-only") return path.join(__dirname, "empty-module.cjs");
  return resolve.call(this, request, ...rest);
};

async function main() {
  const { db, schema } = await import("../src/db");
  const { eq } = await import("drizzle-orm");
  const { createUser, findUserByEmail } = await import("../src/server/auth");
  const { createOrganization, createTeam, addTeamMember, ensureOrgUser } = await import("../src/server/orgs");
  const { createMeeting } = await import("../src/server/meetings/create");
  const { loadMeetingContext } = await import("../src/server/meetings/context");
  const { applyOp } = await import("../src/server/meetings/ops");
  const { ensureBuiltinHealthModels } = await import("../src/server/health-models");

  if (await findUserByEmail("avery@weretro.dev")) {
    console.log("Seed data already exists (avery@weretro.dev). Nothing to do.");
    process.exit(0);
  }

  const password = "weretro-demo";
  const avery = await createUser({ email: "avery@weretro.dev", name: "Avery Morgan", password, verified: true });
  const people = await Promise.all(
    [
      ["blake@weretro.dev", "Blake Chen"],
      ["casey@weretro.dev", "Casey Okafor"],
      ["drew@weretro.dev", "Drew Larsen"],
      ["emery@weretro.dev", "Emery Santos"],
    ].map(([email, name]) => createUser({ email, name, password, verified: true })),
  );

  const org = await createOrganization(avery, "Acme Software");
  const product = await createTeam(avery, org.id, { name: "Product Squad", description: "Builds the customer-facing app", color: "#6366F1" });
  const platform = await createTeam(avery, org.id, { name: "Platform", description: "Infrastructure and developer tools", color: "#0EA5E9" });
  await createTeam(avery, org.id, { name: "Engineering", isProgram: true, memberTeamIds: [product.id, platform.id], color: "#A855F7" });
  for (const p of people) {
    await ensureOrgUser(org.id, p.id);
    await addTeamMember(product.id, p.id, ["member"]);
  }
  await addTeamMember(platform.id, people[0].id, ["member"]);
  await addTeamMember(platform.id, people[2].id, ["member"]);

  const as = async (meetingId: string, user: typeof avery, op: Record<string, unknown>) => {
    const ctx = await loadMeetingContext(meetingId, user, { autoJoin: true });
    return applyOp(ctx, op as never);
  };
  const daysAgo = (n: number) => new Date(Date.now() - n * 86400000).toISOString().slice(0, 10);

  // ── A finished retrospective ────────────────────────────────────────────
  const retro = await createMeeting(avery, product.id, { type: "retrospective", templateId: "builtin:start-stop-continue", date: daysAgo(14), title: "Sprint 41 retro" });
  const topics = retro.topics;
  const ideas: [number, number, string][] = [
    [0, 0, "Pair on the hardest tickets"],
    [1, 0, "Write a short design doc before big changes"],
    [0, 1, "Merging without a second review"],
    [2, 1, "Starting work that isn't refined"],
    [3, 1, "Late-night deploys"],
    [1, 2, "Demo every Friday"],
    [4, 2, "Keep the bug-bash hour"],
    [2, 2, "Short daily standups"],
  ];
  const all = [avery, ...people];
  const ideaIds: string[] = [];
  for (const [who, topic, text] of ideas) {
    const r = (await as(retro.id, all[who], { type: "idea.add", topicId: topics[Math.min(topic, topics.length - 1)].id, text })) as { id: string };
    ideaIds.push(r.id);
  }
  const ctx = await loadMeetingContext(retro.id, avery);
  const voteIdx = ctx.meeting.steps.findIndex((s) => s.key === "vote");
  await as(retro.id, avery, { type: "step.goto", index: voteIdx });
  for (const [i, u] of all.entries()) {
    for (const t of [ideaIds[2], ideaIds[3], ideaIds[i % ideaIds.length]]) await as(retro.id, u, { type: "vote.cast", targetId: t }).catch(() => {});
  }
  await as(retro.id, avery, { type: "action.add", kind: "action", title: "Require one approving review before merge", assigneeIds: [people[0].id], dueDate: daysAgo(-7) });
  await as(retro.id, avery, { type: "action.add", kind: "action", title: "Add a 'ready for dev' checklist to the board", assigneeIds: [people[1].id] });
  await as(retro.id, avery, { type: "action.add", kind: "agreement", title: "No deploys after 4pm on Fridays" });
  await as(retro.id, avery, { type: "kudos.give", toUserId: people[2].id, kudosType: "thankYou", message: "Thanks for untangling the release!" }).catch(() => {});
  await as(retro.id, avery, { type: "meeting.close" });

  // ── Health checks (two, so trends show up) ───────────────────────────────
  await ensureBuiltinHealthModels();
  const dims = await db.select().from(schema.healthDimensions).where(eq(schema.healthDimensions.modelId, "builtin-team-radar"));
  for (const [n, offset] of [[40, 0], [10, 1]] as const) {
    const hc = await createMeeting(avery, product.id, { type: "healthCheck", healthModelId: "builtin-team-radar", date: daysAgo(n) });
    for (const u of all) for (const d of dims) await as(hc.id, u, { type: "health.rate", dimensionId: d.id, value: Math.max(1, Math.min(5, 2 + offset + Math.floor(Math.random() * 3))) });
    await as(hc.id, avery, { type: "meeting.close" });
  }

  // ── An open estimation session ───────────────────────────────────────────
  const est = await createMeeting(avery, product.id, { type: "estimation", deckId: "fibonacci" });
  await as(est.id, avery, { type: "estimation.add", items: [{ title: "Search across meetings" }, { title: "CSV export of actions" }, { title: "Dark mode for reports" }] });

  // ── A daily standup series ───────────────────────────────────────────────
  await createMeeting(avery, platform.id, { type: "standup", title: "Platform daily" });

  // ── Team-level items ─────────────────────────────────────────────────────
  await db.insert(schema.actionItems).values([
    { teamId: product.id, kind: "action", title: "Update the onboarding guide", assigneeIds: [people[3].id], createdById: avery.id, position: 10 },
    { teamId: product.id, kind: "parked", title: "Should we switch to two-week sprints?", createdById: avery.id, position: 1 },
    { teamId: platform.id, kind: "agreement", title: "Every service has an owner listed in the catalog", createdById: avery.id, position: 1 },
  ]);

  console.log("Seeded Acme Software.");
  console.log("Sign in as avery@weretro.dev (or blake/casey/drew/emery@weretro.dev) with password: weretro-demo");
  process.exit(0);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
