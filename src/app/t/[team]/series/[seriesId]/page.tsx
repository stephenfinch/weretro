import { notFound, redirect } from "next/navigation";
import { requireUser } from "@/server/auth";
import { getTeamAccess } from "@/server/access";
import { ensureCurrentMeeting } from "@/server/meetings/series";

/** "Join the current meeting" link for a recurring series. */
export default async function SeriesRedirect({ params }: PageProps<"/t/[team]/series/[seriesId]">) {
  const { team, seriesId } = await params;
  const user = await requireUser();
  if (!(await getTeamAccess(user, team))) notFound();
  const m = await ensureCurrentMeeting(seriesId);
  if (!m) redirect(`/t/${team}/standups`);
  redirect(`/m/${m.id}`);
}
