import { LogoMark } from "@/components/brand";
import Link from "next/link";
import { listUserOrgs } from "@/server/access";
import type { CurrentUser } from "@/server/auth";
import { mediaUrl } from "@/server/meetings/state";
import { OrgSwitcher, UserMenu } from "./user-menu";
import { NavTabs } from "./nav-tabs";
import { SearchButton } from "./search";

export async function AppHeader({
  user,
  org,
  isAdmin,
  canInsights,
  extra,
}: {
  user: CurrentUser;
  org?: { slug: string; name: string; color: string; id: string };
  isAdmin?: boolean;
  canInsights?: boolean;
  /** Slot rendered before search, eg. the getting-started checklist. */
  extra?: React.ReactNode;
}) {
  const orgs = await listUserOrgs(user.id);
  const base = org ? `/o/${org.slug}` : "";
  const items = org
    ? [
        { href: base, label: "Home", exact: true },
        { href: `${base}/teams`, label: "Teams" },
        ...(isAdmin ? [{ href: `${base}/users`, label: "Users" }] : []),
        ...(canInsights ? [{ href: `${base}/insights`, label: "Insights" }] : []),
        ...(isAdmin ? [{ href: `${base}/settings`, label: "Settings" }] : []),
      ]
    : [];
  return (
    <header className="sticky top-0 z-40 border-b bg-background/85 backdrop-blur no-print">
      <div className="mx-auto flex h-14 max-w-7xl items-center gap-3 px-4">
        <Link href="/home" aria-label="WeRetro home"><LogoMark /></Link>
        <OrgSwitcher orgs={orgs.map((o) => ({ slug: o.org.slug, name: o.org.name, color: o.org.color }))} current={org} />
        {items.length > 0 && <NavTabs items={items} className="ml-2 hidden h-14 items-end md:flex" />}
        <div className="ml-auto flex items-center gap-2">
          {extra}
          {org && <SearchButton orgId={org.id} />}
          <UserMenu user={{ name: user.name, email: user.email, color: user.color, avatarUrl: mediaUrl(user.avatarMediaId) }} />
        </div>
      </div>
      {items.length > 0 && <NavTabs items={items} className="px-2 md:hidden" />}
    </header>
  );
}
