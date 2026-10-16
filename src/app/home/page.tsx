import { redirect } from "next/navigation";
import { cookies } from "next/headers";
import { requireUser } from "@/server/auth";
import { listUserOrgs } from "@/server/access";

export default async function HomeRedirect() {
  const user = await requireUser("/home");
  if (user.isGuest) redirect("/login");
  const orgs = await listUserOrgs(user.id);
  if (!orgs.length) redirect("/onboarding");
  const last = (await cookies()).get("wr_org")?.value;
  const org = orgs.find((o) => o.org.slug === last)?.org ?? orgs[0].org;
  redirect(`/o/${org.slug}`);
}
