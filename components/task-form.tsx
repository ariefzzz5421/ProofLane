"use client";
import { useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { Button } from "./ui/button";
import { Input } from "./ui/input";
export function TaskForm({ campaignId }: { campaignId: string }) {
  const router = useRouter();
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  async function submit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setBusy(true);
    setError("");
    const form = new FormData(e.currentTarget);
    const config: Record<string, unknown> = {};
    const chainId = Number(form.get("chainId"));
    if (chainId) config.chainId = chainId;
    const contract = String(form.get("contract") || "");
    if (contract) config.contract = contract;
    const minimum = String(form.get("minimum") || "");
    if (minimum) config.minimum = minimum;
    const guildId = String(form.get("guildId") || "");
    if (guildId) config.guildId = guildId;
    const confirmations = Number(form.get("confirmations"));
    if (confirmations) config.confirmations = confirmations;
    const eventTopic = String(form.get("eventTopic") || "");
    if (eventTopic) config.eventTopic = eventTopic;
    try {
      const response = await fetch(`/api/v1/campaigns/${campaignId}/tasks`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          title: form.get("title"),
          description: form.get("description"),
          type: form.get("type"),
          required: form.get("required") === "on",
          config,
        }),
      });
      const data = await response.json();
      if (!response.ok)
        throw new Error(data.error?.message || "Could not add task.");
      (e.target as HTMLFormElement).reset();
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Request failed.");
    } finally {
      setBusy(false);
    }
  }
  return (
    <form onSubmit={submit} className="form-grid">
      <label>
        Task title
        <Input name="title" required minLength={3} />
      </label>
      <label>
        Verification type
        <select name="type">
          <option value="wallet">Wallet signature</option>
          <option value="token">ERC-20 balance</option>
          <option value="nft">NFT balance</option>
          <option value="transaction">EVM transaction</option>
          <option value="manual">Manual review</option>
          <option value="discord">Discord (requires integration)</option>
          <option value="x">X (requires official API)</option>
          <option value="custom">Custom backend</option>
        </select>
      </label>
      <label className="span-2">
        Description
        <textarea name="description" rows={2} />
      </label>
      <label>
        Chain ID for on-chain task
        <Input name="chainId" type="number" min={1} />
      </label>
      <label>
        Contract address
        <Input name="contract" placeholder="0x…" />
      </label>
      <label>
        Discord Guild ID
        <Input name="guildId" placeholder="123456789012345678" />
      </label>
      <label>
        Minimum balance
        <Input name="minimum" type="number" min={1} />
      </label>
      <label>
        Required confirmations
        <Input name="confirmations" type="number" min={1} defaultValue={12} />
      </label>
      <label className="span-2">
        Required event topic (optional, transaction tasks)
        <Input name="eventTopic" placeholder="0x… 32-byte topic" />
      </label>
      <label className="row">
        <input name="required" type="checkbox" defaultChecked /> Required before
        registration
      </label>
      <div className="span-2 notice small">
        Wallet and on-chain checks can verify automatically. Discord requires
        configured OAuth, bot credentials and a guild ID. X remains Unsupported
        until official API access is available. Manual evidence stays Pending
        until review.
      </div>
      {error && <div className="span-2 notice error">{error}</div>}
      <div className="span-2">
        <Button disabled={busy}>{busy ? "Adding…" : "Add task"}</Button>
      </div>
    </form>
  );
}
