import { notFound, redirect } from "next/navigation";
import { eq } from "drizzle-orm";
import { db, schema } from "@/db";
import { getCurrentUser } from "@/server/auth";
import { HttpError } from "@/server/access";
import { loadMeetingContext } from "@/server/meetings/context";
import { buildMeetingState } from "@/server/meetings/state";
import { MeetingRoom } from "@/components/meeting/room";

export default async function MeetingPage({ params, searchParams }: PageProps<"/m/[id]">) {
  const { id } = await params;
  const sp = await searchParams;
  const user = await getCurrentUser();
  if (!user) redirect(`/login?next=/m/${id}`);
  let ctx;
  try {
    ctx = await loadMeetingContext(id, user, { autoJoin: true });
  } catch (e) {
    if (e instanceof HttpError && e.status === 404) notFound();
    if (e instanceof HttpError && e.status === 403) redirect(user.isGuest ? "/login" : "/home");
    throw e;
  }
  const state = await buildMeetingState(ctx, user);
  const integrations = user.isGuest
    ? []
    : await db.select({ id: schema.integrations.id, type: schema.integrations.type, name: schema.integrations.name }).from(schema.integrations).where(eq(schema.integrations.teamId, ctx.team.id));
  const series = ctx.meeting.seriesId ? (await db.select().from(schema.meetingSeries).where(eq(schema.meetingSeries.id, ctx.meeting.seriesId)).limit(1))[0] : null;
  return <MeetingRoom initial={state} integrations={integrations} schedule={series?.schedule ?? null} screen={sp.view === "screen"} />;
}
