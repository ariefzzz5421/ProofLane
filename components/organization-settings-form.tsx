"use client";
import { useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { Button } from "./ui/button";
import { Input } from "./ui/input";
export function OrganizationSettingsForm({
  id,
  name,
  slug,
}: {
  id: string;
  name: string;
  slug: string;
}) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [saved, setSaved] = useState(false);
  async function submit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setBusy(true);
    setError("");
    setSaved(false);
    const form = new FormData(e.currentTarget);
    try {
      const r = await fetch(`/api/v1/admin/organizations/${id}`, {
        method: "PATCH",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          name: form.get("name"),
          slug: form.get("slug"),
        }),
      });
      const data = await r.json();
      if (!r.ok) throw new Error(data.error?.message || "Update failed.");
      setSaved(true);
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Update failed.");
    } finally {
      setBusy(false);
    }
  }
  return (
    <form onSubmit={submit} className="form-stack">
      <label>
        Name
        <Input name="name" defaultValue={name} required />
      </label>
      <label>
        Slug
        <Input
          name="slug"
          defaultValue={slug}
          required
          pattern="[a-z0-9-]{3,48}"
        />
      </label>
      <Button disabled={busy}>{busy ? "Saving…" : "Save organization"}</Button>
      {error && <div className="notice error">{error}</div>}
      {saved && <div className="notice success">Organization updated.</div>}
    </form>
  );
}
