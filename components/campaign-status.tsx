"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "./ui/button";
export function CampaignStatus({ id, status }: { id: string; status: string }) {
  const router = useRouter();
  const [value, setValue] = useState(status);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  return (
    <div className="row">
      <select
        value={value}
        onChange={(e) => setValue(e.target.value)}
        style={{ width: 160 }}
      >
        <option value="draft">Draft</option>
        <option value="scheduled">Scheduled</option>
        <option value="live">Live</option>
        <option value="paused">Paused</option>
        <option value="closed">Closed</option>
      </select>
      <Button
        variant="outline"
        disabled={busy || value === status}
        onClick={async () => {
          setBusy(true);
          setError("");
          try {
            const r = await fetch(`/api/v1/campaigns/${id}`, {
              method: "PATCH",
              headers: { "content-type": "application/json" },
              body: JSON.stringify({ status: value }),
            });
            const data = await r.json();
            if (!r.ok) throw new Error(data.error?.message || "Update failed.");
            router.refresh();
          } catch (err) {
            setError(err instanceof Error ? err.message : "Update failed.");
          } finally {
            setBusy(false);
          }
        }}
      >
        Save status
      </Button>
      {error && (
        <span className="small" style={{ color: "var(--bad)" }}>
          {error}
        </span>
      )}
    </div>
  );
}
