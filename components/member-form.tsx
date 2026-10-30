"use client";
import { useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { Input } from "./ui/input";
import { Button } from "./ui/button";
export function MemberForm() {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  async function add(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setBusy(true);
    setError("");
    const form = new FormData(e.currentTarget);
    try {
      const r = await fetch("/api/v1/admin/members", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          email: form.get("email"),
          role: form.get("role"),
        }),
      });
      const data = await r.json();
      if (!r.ok)
        throw new Error(data.error?.message || "Could not add member.");
      (e.target as HTMLFormElement).reset();
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Request failed.");
    } finally {
      setBusy(false);
    }
  }
  return (
    <form onSubmit={add} className="form-grid">
      <label>
        Existing account email
        <Input name="email" type="email" required />
      </label>
      <label>
        Role
        <select name="role">
          <option value="viewer">Viewer</option>
          <option value="admin">Admin</option>
        </select>
      </label>
      <div className="span-2">
        <Button disabled={busy}>{busy ? "Adding…" : "Add team member"}</Button>
      </div>
      {error && <div className="span-2 notice error">{error}</div>}
    </form>
  );
}
