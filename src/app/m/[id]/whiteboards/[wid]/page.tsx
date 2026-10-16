import { redirect } from "next/navigation";
import { getCurrentUser } from "@/server/auth";
import { WhiteboardPage } from "./client";

export default async function Page({ params }: PageProps<"/m/[id]/whiteboards/[wid]">) {
  const { id, wid } = await params;
  const user = await getCurrentUser();
  if (!user) redirect(`/login?next=/m/${id}/whiteboards/${wid}`);
  return <WhiteboardPage id={wid} />;
}
