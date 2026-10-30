import { eq } from "drizzle-orm";
import { db } from "@/lib/db";
import {
  organizations,
  subscriptionPlans,
  organizationMembers,
  users,
} from "@/lib/db/schema";
import { adminMember, monthKey } from "@/lib/core";
import { Card, CardContent } from "@/components/ui/card";
import { MemberForm } from "@/components/member-form";
import { RemoveMemberButton } from "@/components/remove-member-button";
import { CreateOrganizationForm } from "@/components/create-organization-form";
import { OrganizationSettingsForm } from "@/components/organization-settings-form";
export default async function Settings() {
  const member = (await adminMember())!;
  const org = await db.query.organizations.findFirst({
    where: eq(organizations.id, member.organizationId),
  });
  const plan =
    org &&
    (await db.query.subscriptionPlans.findFirst({
      where: eq(subscriptionPlans.id, org.planId),
    }));
  const usage = await db.query.usageCounters.findFirst({
    where: (u, { and, eq }) =>
      and(eq(u.organizationId, member.organizationId), eq(u.month, monthKey())),
  });
  const members = await db
    .select({
      userId: users.id,
      email: users.email,
      role: organizationMembers.role,
    })
    .from(organizationMembers)
    .innerJoin(users, eq(users.id, organizationMembers.userId))
    .where(eq(organizationMembers.organizationId, member.organizationId));
  return (
    <>
      <div className="page-head">
        <div>
          <div className="eyebrow">Organization</div>
          <h1>Settings</h1>
          <p className="muted">
            Plan and usage are tracked. Billing is not connected.
          </p>
        </div>
      </div>
      <div className="grid grid-2">
        <Card>
          <CardContent>
            <h3>{org?.name}</h3>
            <p className="small muted">Slug: {org?.slug}</p>
            <p className="small muted">Your role: {member.role}</p>
            <p className="small muted">
              Organization ID:{" "}
              <span className="code">{member.organizationId}</span>
            </p>
            {member.role === "owner" && org && (
              <OrganizationSettingsForm
                id={org.id}
                name={org.name}
                slug={org.slug}
              />
            )}
          </CardContent>
        </Card>
        <Card>
          <CardContent>
            <h3>{plan?.name || "Free"} plan</h3>
            <p className="small muted">
              {plan?.maxCampaigns || 2} campaigns ·{" "}
              {plan?.monthlyApplicants || 5000} monthly applicants ·{" "}
              {plan?.teamSeats || 1} seats
            </p>
            <p className="small">
              This month: {usage?.applicants || 0} applicants,{" "}
              {usage?.verifications || 0} verification attempts,{" "}
              {usage?.apiCalls || 0} API calls.
            </p>
            <div className="notice small">
              Payment processing is not configured. Plan upgrades are
              unavailable in this MVP.
            </div>
          </CardContent>
        </Card>
      </div>
      <section className="section">
        <h2>Team</h2>
        <div className="table-wrap">
          <table>
            <thead>
              <tr>
                <th>Email</th>
                <th>Role</th>
                <th>Action</th>
              </tr>
            </thead>
            <tbody>
              {members.map((person) => (
                <tr key={person.userId}>
                  <td>{person.email}</td>
                  <td>
                    <span className="status">{person.role}</span>
                  </td>
                  <td>
                    {member.role === "owner" && person.role !== "owner" && (
                      <RemoveMemberButton userId={person.userId} />
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        {member.role === "owner" && (
          <div className="card" style={{ marginTop: "1rem" }}>
            <div className="card-content">
              <h3>Add existing QuestKernel user</h3>
              <p className="small muted">
                The person must register an account first. Free plan allows{" "}
                {plan?.teamSeats || 3} seats.
              </p>
              <MemberForm />
            </div>
          </div>
        )}
      </section>
      <section className="section">
        <h2>Another organization</h2>
        <div className="card">
          <div className="card-content">
            <p className="small muted">
              Create a separate workspace with isolated campaigns, credentials,
              and applicants.
            </p>
            <CreateOrganizationForm />
          </div>
        </div>
      </section>
      <section className="section">
        <h2>Privacy and retention</h2>
        <div className="notice">
          QuestKernel stores wallet addresses, task evidence and audit history
          for campaign administration. Set links to your project terms and
          privacy policy before launch. Data deletion currently requires an
          administrator database operation; a self-service deletion workflow is
          not yet available.
        </div>
      </section>
    </>
  );
}
