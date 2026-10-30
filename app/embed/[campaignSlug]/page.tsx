import Link from "next/link";
import { notFound } from "next/navigation";
import { eq } from "drizzle-orm";
import { db } from "@/lib/db";
import { campaigns } from "@/lib/db/schema";
export default async function Embed({
  params,
}: {
  params: Promise<{ campaignSlug: string }>;
}) {
  const c = await db.query.campaigns.findFirst({
    where: eq(campaigns.slug, (await params).campaignSlug),
  });
  if (!c || c.status === "draft") notFound();
  return (
    <div className="card">
      <div className="card-content">
        <div className="eyebrow">Powered by QuestKernel</div>
        <h3>{c.name}</h3>
        <p className="small muted">
          {Math.max(0, c.maxApplicants - c.acceptedCount)} places remain · Chain{" "}
          {c.chainId}
        </p>
        <Link
          className="button button-primary"
          href={`/c/${c.slug}`}
          target="_blank"
        >
          Open registration ↗
        </Link>
      </div>
    </div>
  );
}
