"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "./ui/button";
export function ReviewButtons({
  campaignId,
  verificationId,
}: {
  campaignId: string;
  verificationId: string;
}) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  async function review(status: "verified" | "rejected") {
    setBusy(true);
    setError("");
    try {
      const response = await fetch(
        `/api/v1/campaigns/${campaignId}/review-task`,
        {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ verificationId, status }),
        },
      );
      const data = await response.json();
      if (!response.ok)
        throw new Error(data.error?.message || "Review failed.");
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Review failed.");
    } finally {
      setBusy(false);
    }
  }
  return (
    <div className="row">
      <Button size="sm" disabled={busy} onClick={() => review("verified")}>
        Approve
      </Button>
      <Button
        size="sm"
        variant="outline"
        disabled={busy}
        onClick={() => review("rejected")}
      >
        Reject
      </Button>
      {error && (
        <span className="small" style={{ color: "var(--bad)" }}>
          {error}
        </span>
      )}
    </div>
  );
}
