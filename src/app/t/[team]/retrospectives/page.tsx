import { notFound } from "next/navigation";
import { requireUser } from "@/server/auth";
import { getTeamAccess } from "@/server/access";
import { MeetingTypePage } from "@/components/meetings/meeting-type-page";

export default async function Page({ params, searchParams }: PageProps<"/t/[team]/retrospectives">) {
  const { team } = await params;
  const sp = await searchParams;
  const user = await requireUser();
  const access = await getTeamAccess(user, team);
  if (!access) notFound();
  return <MeetingTypePage access={access} type="retrospective" q={typeof sp.q === "string" ? sp.q : undefined} demoHref={`/demo/retrospective?team=${team}`} />;
}
