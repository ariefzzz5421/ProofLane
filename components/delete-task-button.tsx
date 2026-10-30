"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "./ui/button";
export function DeleteTaskButton({
  campaignId,
  taskId,
}: {
  campaignId: string;
  taskId: string;
}) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  return (
    <div className="row">
      <Button
        variant="ghost"
        size="sm"
        disabled={busy}
        onClick={async () => {
          if (
            !window.confirm(
              "Delete this task and its unaccepted verification evidence?",
            )
          )
            return;
          setBusy(true);
          setError("");
          try {
            const r = await fetch(
              `/api/v1/campaigns/${campaignId}/tasks/${taskId}`,
              { method: "DELETE" },
            );
            const data = await r.json();
            if (!r.ok) throw new Error(data.error?.message || "Delete failed.");
            router.refresh();
          } catch (err) {
            setError(err instanceof Error ? err.message : "Delete failed.");
          } finally {
            setBusy(false);
          }
        }}
      >
        Delete
      </Button>
      {error && (
        <span className="small" style={{ color: "var(--bad)" }}>
          {error}
        </span>
      )}
    </div>
  );
}
