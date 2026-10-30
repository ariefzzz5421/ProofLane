import { adminMember } from "@/lib/core";
import { CampaignForm } from "@/components/campaign-form";
export default async function NewCampaign() {
  const member = (await adminMember())!;
  return (
    <>
      <div className="page-head">
        <div>
          <div className="eyebrow">Campaign builder</div>
          <h1>New campaign</h1>
          <p className="muted">
            Define the public page and capacity. Next, add verification tasks.
          </p>
        </div>
      </div>
      {member.role === "viewer" ? (
        <div className="notice">Viewer access is read-only.</div>
      ) : (
        <CampaignForm organizationId={member.organizationId} />
      )}
    </>
  );
}
