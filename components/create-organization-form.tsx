"use client";
import { useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { Button } from "./ui/button";
import { Input } from "./ui/input";
export function CreateOrganizationForm() {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  async function submit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setBusy(true);
    setError("");
    const form = new FormData(e.currentTarget);
    try {
      const r = await fetch("/api/v1/admin/organizations", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          name: form.get("name"),
          slug: form.get("slug"),
        }),
      });
      const data = await r.json();
      if (!r.ok)
        throw new Error(
          data.error?.message || "Could not create organization.",
        );
      router.push("/dashboard");
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Request failed.");
    } finally {
      setBusy(false);
    }
  }
  return (
    <form onSubmit={submit} method="post" className="form-grid">
      <label>
        Name
        <Input name="name" required minLength={2} />
      </label>
      <label>
        Unique slug
        <Input
          name="slug"
          required
          pattern="[a-z0-9-]{3,48}"
          placeholder="another-project"
        />
      </label>
      <div className="span-2">
        <Button disabled={busy}>
          {busy ? "Creating…" : "Create organization"}
        </Button>
      </div>
      {error && <div className="span-2 notice error">{error}</div>}
    </form>
  );
}
