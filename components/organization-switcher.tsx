"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
export function OrganizationSwitcher({
  items,
  active,
}: {
  items: { id: string; name: string }[];
  active: string;
}) {
  const router = useRouter();
  const [value, setValue] = useState(active);
  const [busy, setBusy] = useState(false);
  return (
    <label className="small">
      Workspace
      <select
        value={value}
        disabled={busy}
        onChange={async (e) => {
          const next = e.target.value;
          setValue(next);
          setBusy(true);
          const r = await fetch("/api/v1/admin/active-organization", {
            method: "POST",
            headers: { "content-type": "application/json" },
            body: JSON.stringify({ organizationId: next }),
          });
          if (r.ok) {
            router.push("/dashboard");
            router.refresh();
          } else {
            setValue(active);
            alert("Could not switch workspace.");
          }
          setBusy(false);
        }}
      >
        {items.map((item) => (
          <option key={item.id} value={item.id}>
            {item.name}
          </option>
        ))}
      </select>
    </label>
  );
}
