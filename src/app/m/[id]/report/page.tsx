import { notFound, redirect } from "next/navigation";
import { getCurrentUser } from "@/server/auth";
import { HttpError } from "@/server/access";
import { loadMeetingContext } from "@/server/meetings/context";
import { buildMeetingState } from "@/server/meetings/state";
import { ReportView } from "@/components/meeting/report-view";

export const metadata = { title: "Meeting report" };

export default async function ReportPage({ params, searchParams }: PageProps<"/m/[id]/report">) {
  const { id } = await params;
  const sp = await searchParams;
  const user = await getCurrentUser();
  if (!user) redirect(`/login?next=/m/${id}/report`);
  let ctx;
  try {
    ctx = await loadMeetingContext(id, user);
  } catch (e) {
    if (e instanceof HttpError && e.status === 404) notFound();
    if (e instanceof HttpError && e.status === 403) redirect("/home");
    throw e;
  }
  const state = await buildMeetingState(ctx, user);
  return <ReportView initial={state} autoPrint={sp.print === "1"} />;
}
