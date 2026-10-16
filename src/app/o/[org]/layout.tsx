import { notFound } from "next/navigation";
import { requireUser } from "@/server/auth";
import { getOrgAccess } from "@/server/access";
import { AppHeader } from "@/components/shell/app-header";
import { RememberOrg } from "@/components/shell/remember-org";

export default async function OrgLayout({ children, params }: LayoutProps<"/o/[org]">) {
  const { org: slug } = await params;
  const user = await requireUser(`/o/${slug}`);
  const access = await getOrgAccess(user, slug);
  if (!access) notFound();
  return (
    <div className="flex min-h-screen flex-col bg-canvas">
      <RememberOrg slug={access.org.slug} />
      <AppHeader user={user} org={{ id: access.org.id, slug: access.org.slug, name: access.org.name, color: access.org.color }} isAdmin={access.isAdmin} canInsights={access.canInsights} />
      <main className="flex-1">{children}</main>
    </div>
  );
}
