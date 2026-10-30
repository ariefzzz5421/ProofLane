"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "./ui/button";
export function EligibilityControl({
  campaignId,
  applicationId,
  initial,
}: {
  campaignId: string;
  applicationId: string;
  initial: string;
}) {
  const router = useRouter();
  const [value, setValue] = useState(initial);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  async function save() {
    const reason = window.prompt(
      "Reason for eligibility decision (stored in audit log):",
    );
    if (!reason) return;
    setBusy(true);
    setError("");
    try {
      const r = await fetch(
        `/api/v1/campaigns/${campaignId}/applicants/${applicationId}`,
        {
          method: "PATCH",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ eligibility: value, reason }),
        },
      );
      const data = await r.json();
      if (!r.ok) throw new Error(data.error?.message || "Decision failed.");
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Decision failed.");
    } finally {
      setBusy(false);
    }
  }
  return (
    <div className="row">
      <select
        value={value}
        onChange={(e) => setValue(e.target.value)}
        style={{ minWidth: 120 }}
      >
        <option value="eligible">Eligible</option>
        <option value="pending">Pending</option>
        <option value="rejected">Rejected</option>
      </select>
      <Button
        size="sm"
        variant="outline"
        disabled={busy || value === initial}
        onClick={save}
      >
        Save
      </Button>
      {error && (
        <span className="small" style={{ color: "var(--bad)" }}>
          {error}
        </span>
      )}
    </div>
  );
}
