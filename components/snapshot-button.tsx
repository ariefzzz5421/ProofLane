"use client";
import { useState } from "react";
import { Button } from "./ui/button";
export function SnapshotButton({ campaignId }: { campaignId: string }) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  async function create() {
    setBusy(true);
    setError("");
    try {
      const r = await fetch(`/api/v1/campaigns/${campaignId}/snapshot`, {
        method: "POST",
      });
      const data = await r.json();
      if (!r.ok) throw new Error(data.error?.message || "Snapshot failed.");
      window.location.href = data.downloadUrl;
    } catch (err) {
      setError(err instanceof Error ? err.message : "Snapshot failed.");
    } finally {
      setBusy(false);
    }
  }
  return (
    <div className="row">
      <Button disabled={busy} onClick={create}>
        {busy ? "Preparing…" : "Create eligibility snapshot CSV"}
      </Button>
      {error && (
        <span className="small" style={{ color: "var(--bad)" }}>
          {error}
        </span>
      )}
    </div>
  );
}
