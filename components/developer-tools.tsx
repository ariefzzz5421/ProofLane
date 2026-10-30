"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "./ui/button";
import { Input } from "./ui/input";
export function DeveloperTools() {
  const router = useRouter();
  const [key, setKey] = useState("");
  const [webhookSecret, setWebhookSecret] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  async function createKey(form: FormData) {
    setBusy(true);
    setError("");
    try {
      const scopes = [
        "campaigns:read",
        "stats:read",
        "applicants:read",
        "verifications:write",
      ];
      const r = await fetch("/api/v1/admin/keys", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ name: form.get("name"), scopes }),
      });
      const data = await r.json();
      if (!r.ok) throw new Error(data.error?.message || "Key creation failed.");
      setKey(data.key);
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Request failed.");
    } finally {
      setBusy(false);
    }
  }
  async function createWebhook(form: FormData) {
    setBusy(true);
    setError("");
    try {
      const r = await fetch("/api/v1/admin/webhooks", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          url: form.get("url"),
          events: [
            "application.accepted",
            "application.rejected",
            "task.verified",
            "task.rejected",
            "campaign.full",
            "campaign.closed",
          ],
        }),
      });
      const data = await r.json();
      if (!r.ok)
        throw new Error(data.error?.message || "Webhook creation failed.");
      setWebhookSecret(data.signingSecret);
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Request failed.");
    } finally {
      setBusy(false);
    }
  }
  return (
    <div className="grid grid-2">
      <div className="card">
        <div className="card-content">
          <h3>Create scoped API key</h3>
          <p className="small muted">
            Use only on a project backend. This key can read stats/applicants
            and send custom task decisions.
          </p>
          <form action={createKey} className="form-stack">
            <label>
              Key name
              <Input
                name="name"
                required
                minLength={2}
                placeholder="Production backend"
              />
            </label>
            <Button disabled={busy}>Create key</Button>
          </form>
          {key && (
            <div className="notice" style={{ marginTop: "1rem" }}>
              <strong>Copy once and store securely</strong>
              <p className="code small">{key}</p>
            </div>
          )}
        </div>
      </div>
      <div className="card">
        <div className="card-content">
          <h3>Register webhook</h3>
          <p className="small muted">
            HTTPS endpoint receives signed events. Set WEBHOOK_ENCRYPTION_KEY
            first.
          </p>
          <form action={createWebhook} className="form-stack">
            <label>
              Endpoint URL
              <Input
                name="url"
                type="url"
                required
                placeholder="https://example.com/api/questkernel"
              />
            </label>
            <Button disabled={busy} variant="outline">
              Add endpoint
            </Button>
          </form>
          {webhookSecret && (
            <div className="notice" style={{ marginTop: "1rem" }}>
              <strong>Copy signing secret once</strong>
              <p className="code small">{webhookSecret}</p>
            </div>
          )}
        </div>
      </div>
      {error && (
        <div className="notice error" role="alert">
          {error}
        </div>
      )}
    </div>
  );
}
