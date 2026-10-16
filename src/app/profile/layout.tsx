import Link from "next/link";
import { cookies } from "next/headers";
import { requireUser } from "@/server/auth";
import { canViewInsights, getOrgUser, isOrgAdmin, listUserOrgs } from "@/server/access";
import { AppHeader } from "@/components/shell/app-header";
import { NavTabs } from "@/components/shell/nav-tabs";

export default async function ProfileLayout({ children }: LayoutProps<"/profile">) {
  const user = await requireUser("/profile");
  const orgs = await listUserOrgs(user.id);
  const last = (await cookies()).get("wr_org")?.value;
  const org = orgs.find((o) => o.org.slug === last)?.org ?? orgs[0]?.org;
  const orgUser = org ? await getOrgUser(org.id, user.id) : null;
  return (
    <div className="flex min-h-screen flex-col bg-canvas">
      <AppHeader user={user} org={org ? { id: org.id, slug: org.slug, name: org.name, color: org.color } : undefined} isAdmin={isOrgAdmin(orgUser)} canInsights={canViewInsights(orgUser)} />
      <div className="border-b bg-background">
        <div className="mx-auto max-w-3xl px-4 pt-6">
          {org && <Link href={`/o/${org.slug}`} className="text-xs text-muted-foreground hover:text-foreground">← Back to {org.name}</Link>}
          <h1 className="mt-1 text-2xl font-semibold tracking-tight">Your profile</h1>
          <NavTabs
            className="mt-3"
            items={[
              { href: "/profile", label: "Profile", exact: true },
              { href: "/profile/notifications", label: "Notifications" },
            ]}
          />
        </div>
      </div>
      <main className="mx-auto w-full max-w-3xl flex-1 px-4 py-8">{children}</main>
    </div>
  );
}
