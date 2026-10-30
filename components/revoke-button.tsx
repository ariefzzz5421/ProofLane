"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "./ui/button";
export function RevokeButton({
  kind,
  id,
}: {
  kind: "keys" | "webhooks";
  id: string;
}) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  return (
    <Button
      variant="outline"
      size="sm"
      disabled={busy}
      onClick={async () => {
        setBusy(true);
        const r = await fetch(`/api/v1/admin/${kind}/${id}`, {
          method: "DELETE",
        });
        if (r.ok) router.refresh();
        else alert("Could not revoke.");
        setBusy(false);
      }}
    >
      {busy ? "Working…" : kind === "keys" ? "Revoke" : "Disable"}
    </Button>
  );
}
