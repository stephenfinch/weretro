import { notFound } from "next/navigation";
import { requireUser } from "@/server/auth";
import { getTeamAccess } from "@/server/access";
import { MeetingTypePage } from "@/components/meetings/meeting-type-page";

export default async function Page({ params, searchParams }: PageProps<"/t/[team]/estimations">) {
  const { team } = await params;
  const sp = await searchParams;
  const user = await requireUser();
  const access = await getTeamAccess(user, team);
  if (!access) notFound();
  return <MeetingTypePage access={access} type="estimation" q={typeof sp.q === "string" ? sp.q : undefined} startLike={typeof sp.startLike === "string" ? sp.startLike : undefined} demoHref={`/demo/estimation?team=${team}`} />;
}
