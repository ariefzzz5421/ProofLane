"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "./ui/button";
export function RemoveMemberButton({ userId }: { userId: string }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  return (
    <Button
      variant="ghost"
      size="sm"
      disabled={busy}
      onClick={async () => {
        if (!window.confirm("Remove this team member?")) return;
        setBusy(true);
        const r = await fetch(`/api/v1/admin/members/${userId}`, {
          method: "DELETE",
        });
        if (r.ok) router.refresh();
        else alert("Could not remove member.");
        setBusy(false);
      }}
    >
      Remove
    </Button>
  );
}
