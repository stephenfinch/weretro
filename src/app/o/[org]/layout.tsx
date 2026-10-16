import { notFound } from "next/navigation";
import { requireUser } from "@/server/auth";
import { getOrgAccess } from "@/server/access";
import { AppHeader } from "@/components/shell/app-header";
import { RememberOrg } from "@/components/shell/remember-org";
import { GettingStarted } from "@/components/shell/getting-started";
import { orgChecklist } from "@/server/getting-started";

export default async function OrgLayout({ children, params }: LayoutProps<"/o/[org]">) {
  const { org: slug } = await params;
  const user = await requireUser(`/o/${slug}`);
  const access = await getOrgAccess(user, slug);
  if (!access) notFound();
  const checklist = access.isAdmin ? await orgChecklist(user, access.org) : [];
  return (
    <div className="flex min-h-screen flex-col bg-canvas">
      <RememberOrg slug={access.org.slug} />
      <AppHeader user={user} org={{ id: access.org.id, slug: access.org.slug, name: access.org.name, color: access.org.color }} isAdmin={access.isAdmin} canInsights={access.canInsights} extra={access.isAdmin ? <GettingStarted items={checklist} total={2} /> : null} />
      <main className="flex-1">{children}</main>
    </div>
  );
}
