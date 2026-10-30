import Link from "next/link";
import { redirect } from "next/navigation";
import { adminMember } from "@/lib/core";
import { LogoutButton } from "@/components/logout-button";
import { OrganizationSwitcher } from "@/components/organization-switcher";
import { db } from "@/lib/db";
import { organizationMembers, organizations } from "@/lib/db/schema";
import { eq } from "drizzle-orm";
const links = [
  ["/dashboard", "Overview"],
  ["/dashboard/campaigns", "Campaigns"],
  ["/dashboard/developers", "Developers"],
  ["/dashboard/settings", "Settings"],
  ["/docs", "Documentation"],
];
export default async function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const member = await adminMember();
  if (!member) redirect("/login");
  const workspaces = await db
    .select({ id: organizations.id, name: organizations.name })
    .from(organizationMembers)
    .innerJoin(
      organizations,
      eq(organizations.id, organizationMembers.organizationId),
    )
    .where(eq(organizationMembers.userId, member.userId));
  return (
    <div className="dashboard">
      <aside className="sidebar">
        <Link href="/" className="brand">
          <span className="brand-mark">Q</span>QuestKernel
        </Link>
        <nav aria-label="Dashboard">
          {links.map(([href, label]) => (
            <Link key={href} href={href}>
              {label}
            </Link>
          ))}
        </nav>
        <div style={{ marginTop: "auto" }}>
          <div style={{ marginBottom: ".7rem" }}>
            <OrganizationSwitcher
              items={workspaces}
              active={member.organizationId}
            />
          </div>
          <LogoutButton />
        </div>
      </aside>
      <main className="dashboard-main">{children}</main>
    </div>
  );
}
