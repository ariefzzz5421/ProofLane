"use client";
import { useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { Button } from "./ui/button";
import { Input } from "./ui/input";
export function CampaignForm({ organizationId }: { organizationId: string }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  async function submit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setBusy(true);
    setError("");
    const form = new FormData(e.currentTarget);
    const input = {
      organizationId,
      name: form.get("name"),
      slug: form.get("slug"),
      description: form.get("description"),
      logoUrl: form.get("logoUrl") || undefined,
      projectUrl: form.get("projectUrl") || undefined,
      chainId: Number(form.get("chainId")),
      maxApplicants: Number(form.get("maxApplicants")),
      startsAt: form.get("startsAt")
        ? new Date(String(form.get("startsAt"))).toISOString()
        : undefined,
      endsAt: form.get("endsAt")
        ? new Date(String(form.get("endsAt"))).toISOString()
        : undefined,
      requirements: form.get("requirements"),
      reward: form.get("reward"),
      termsUrl: form.get("termsUrl") || undefined,
      privacyUrl: form.get("privacyUrl") || undefined,
      status: form.get("status"),
    };
    try {
      const response = await fetch("/api/v1/campaigns", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(input),
      });
      const data = await response.json();
      if (!response.ok)
        throw new Error(data.error?.message || "Could not create campaign.");
      router.push(`/dashboard/campaigns/${data.id}/tasks`);
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Request failed.");
    } finally {
      setBusy(false);
    }
  }
  return (
    <form onSubmit={submit} className="card">
      <div className="card-content form-grid">
        <label>
          Campaign name
          <Input
            name="name"
            required
            minLength={3}
            placeholder="Builder Season 1"
          />
        </label>
        <label>
          Unique slug
          <Input
            name="slug"
            required
            pattern="[a-z0-9-]{3,80}"
            placeholder="builder-season-1"
          />
        </label>
        <label className="span-2">
          Description
          <textarea name="description" rows={3} maxLength={3000} />
        </label>
        <label>
          Logo URL
          <Input name="logoUrl" type="url" placeholder="https://…" />
        </label>
        <label>
          Project URL
          <Input name="projectUrl" type="url" placeholder="https://…" />
        </label>
        <label>
          Chain ID
          <Input
            name="chainId"
            type="number"
            min={1}
            defaultValue={1}
            required
          />
        </label>
        <label>
          Maximum accepted applicants
          <Input
            name="maxApplicants"
            type="number"
            min={1}
            defaultValue={5000}
            required
          />
        </label>
        <label>
          Starts at (optional)
          <Input name="startsAt" type="datetime-local" />
        </label>
        <label>
          Ends at (optional)
          <Input name="endsAt" type="datetime-local" />
        </label>
        <label className="span-2">
          Registration requirements
          <textarea name="requirements" rows={2} />
        </label>
        <label className="span-2">
          Reward description
          <textarea name="reward" rows={2} />
        </label>
        <label>
          Terms URL
          <Input name="termsUrl" type="url" />
        </label>
        <label>
          Privacy URL
          <Input name="privacyUrl" type="url" />
        </label>
        <label>
          Initial status
          <select name="status" defaultValue="draft">
            <option value="draft">Draft</option>
            <option value="scheduled">Scheduled</option>
            <option value="live">Live</option>
          </select>
        </label>
        <div className="span-2 notice small">
          Before opening registration, add required tasks on the next screen.
          Once applicants are accepted, task rules are locked.
        </div>
        {error && (
          <div className="span-2 notice error" role="alert">
            {error}
          </div>
        )}
        <div className="span-2">
          <Button disabled={busy}>
            {busy ? "Creating…" : "Create campaign and add tasks"}
          </Button>
        </div>
      </div>
    </form>
  );
}
