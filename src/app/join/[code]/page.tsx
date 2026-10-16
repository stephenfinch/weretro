import { redirect } from "next/navigation";
import { getCurrentUser } from "@/server/auth";
import { joinTeamByCode } from "@/server/orgs";

export default async function JoinCodePage({ params }: PageProps<"/join/[code]">) {
  const { code } = await params;
  const user = await getCurrentUser();
  if (!user || user.isGuest) redirect(`/signup?next=${encodeURIComponent(`/join/${code}`)}`);
  const team = await joinTeamByCode(user, code);
  if (!team) redirect("/join");
  redirect(`/t/${team.id}`);
}
