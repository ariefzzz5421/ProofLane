"use client";
import { useEffect, useState } from "react";
import Image from "next/image";
import { Button } from "./ui/button";
type Campaign = {
  id: string;
  name: string;
  slug: string;
  description: string;
  logoUrl: string | null;
  projectUrl: string | null;
  chainId: number;
  maxApplicants: number;
  acceptedCount: number;
  remaining: number;
  status: string;
  reward: string;
  requirements: string;
  termsUrl: string | null;
  privacyUrl: string | null;
};
type Task = {
  id: string;
  title: string;
  description: string;
  type: string;
  required: boolean;
};
type TaskStatus = { taskId: string; status: string; detail: string | null };
type Ethereum = {
  request: (args: { method: string; params?: unknown[] }) => Promise<unknown>;
};
export function ParticipantFlow({
  campaign,
  tasks,
  discordResult,
}: {
  campaign: Campaign;
  tasks: Task[];
  discordResult?: string;
}) {
  const [address, setAddress] = useState("");
  const [statuses, setStatuses] = useState<TaskStatus[]>([]);
  const [application, setApplication] = useState<{
    id: string;
    eligibility: string;
    acceptedAt: string;
  } | null>(null);
  const [busy, setBusy] = useState("");
  const [error, setError] = useState(
    discordResult === "error" || discordResult === "cancelled"
      ? "Discord authorization did not complete. Retry the task."
      : "",
  );
  const [notice, setNotice] = useState(
    discordResult === "verified"
      ? "Discord membership verified."
      : discordResult === "pending"
        ? "Discord verification is pending. Retry later."
        : discordResult === "unsupported"
          ? "Discord integration is not configured."
          : "",
  );
  const [evidence, setEvidence] = useState<Record<string, string>>({});
  const [accepted, setAccepted] = useState(campaign.acceptedCount);
  const provider = () => (window as Window & { ethereum?: Ethereum }).ethereum;
  async function loadMe() {
    const response = await fetch(
      `/api/v1/campaigns/${campaign.id}/applications/me`,
      { cache: "no-store" },
    );
    if (!response.ok) return;
    const data = await response.json();
    setAddress(data.wallet.address);
    setStatuses(data.tasks);
    setApplication(data.application);
  }
  useEffect(() => {
    const controller = new AbortController();
    fetch(`/api/v1/campaigns/${campaign.id}/applications/me`, {
      cache: "no-store",
      signal: controller.signal,
    })
      .then((r) => (r.ok ? r.json() : null))
      .then((data) => {
        if (data) {
          setAddress(data.wallet.address);
          setStatuses(data.tasks);
          setApplication(data.application);
        }
      })
      .catch(() => {});
    return () => controller.abort();
  }, [campaign.id]);
  async function signIn() {
    setBusy("wallet");
    setError("");
    setNotice("");
    try {
      const ethereum = provider();
      if (!ethereum)
        throw new Error(
          "No EVM wallet was found. Install a wallet extension and reload.",
        );
      const accounts = (await ethereum.request({
        method: "eth_requestAccounts",
      })) as string[];
      const account = accounts[0];
      if (!account) throw new Error("Wallet did not return an account.");
      const chain = Number(
        BigInt((await ethereum.request({ method: "eth_chainId" })) as string),
      );
      if (chain !== campaign.chainId)
        throw new Error(
          `Switch your wallet to chain ID ${campaign.chainId} and retry.`,
        );
      const challenge = await fetch("/api/v1/auth/challenge", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ address: account, chainId: chain }),
      });
      const data = await challenge.json();
      if (!challenge.ok)
        throw new Error(data.error?.message || "Challenge failed.");
      const signature = (await ethereum.request({
        method: "personal_sign",
        params: [data.message, account],
      })) as string;
      const verified = await fetch("/api/v1/auth/verify", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ message: data.message, signature }),
      });
      const result = await verified.json();
      if (!verified.ok)
        throw new Error(result.error?.message || "Signature was rejected.");
      setAddress(result.address);
      setNotice("Wallet ownership verified. Complete required tasks.");
      await loadMe();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Wallet sign-in failed.");
    } finally {
      setBusy("");
    }
  }
  async function verify(task: Task) {
    if (task.type === "discord") {
      setBusy(task.id);
      setError("");
      try {
        const query = new URLSearchParams({
          campaignId: campaign.id,
          taskId: task.id,
        });
        const response = await fetch(
          "/api/v1/discord/start?" + query.toString(),
        );
        const data = await response.json();
        if (!response.ok)
          throw new Error(
            data.error?.message || "Discord verification is unavailable.",
          );
        window.location.assign(data.url);
      } catch (err) {
        setError(
          err instanceof Error ? err.message : "Discord verification failed.",
        );
        setBusy("");
      }
      return;
    }
    setBusy(task.id);
    setError("");
    setNotice("");
    try {
      const response = await fetch(
        `/api/v1/campaigns/${campaign.id}/verify-task`,
        {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({
            taskId: task.id,
            evidence: evidence[task.id],
          }),
        },
      );
      const data = await response.json();
      if (!response.ok)
        throw new Error(data.error?.message || "Verification failed.");
      setStatuses((prev) => [
        ...prev.filter((t) => t.taskId !== task.id),
        { taskId: task.id, status: data.status, detail: data.detail },
      ]);
      setNotice(data.detail);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Verification failed.");
    } finally {
      setBusy("");
    }
  }
  async function submit() {
    setBusy("submit");
    setError("");
    setNotice("");
    try {
      const response = await fetch(
        `/api/v1/campaigns/${campaign.id}/applications`,
        {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ idempotencyKey: crypto.randomUUID() }),
        },
      );
      const data = await response.json();
      if (!response.ok)
        throw new Error(data.error?.message || "Application failed.");
      await loadMe();
      const fresh = await fetch(`/api/v1/campaigns/${campaign.id}`, {
        cache: "no-store",
      });
      if (fresh.ok) setAccepted((await fresh.json()).campaign.acceptedCount);
      setNotice(
        data.duplicate
          ? "Your existing application was found."
          : "Application committed. Your receipt is below.",
      );
    } catch (err) {
      setError(err instanceof Error ? err.message : "Application failed.");
    } finally {
      setBusy("");
    }
  }
  async function signOut() {
    setError("");
    try {
      const response = await fetch("/api/v1/auth/logout", { method: "POST" });
      if (!response.ok) throw new Error("Could not end wallet session.");
      setAddress("");
      setStatuses([]);
      setApplication(null);
      setNotice("Wallet session ended.");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Sign out failed.");
    }
  }
  const full = accepted >= campaign.maxApplicants;
  const canSubmit =
    address && campaign.status === "live" && !full && !application;
  return (
    <div className="container" style={{ maxWidth: 900, paddingTop: "2.5rem" }}>
      <div className="eyebrow">
        {campaign.slug.startsWith("demo-")
          ? "Demo environment · real database writes"
          : "Hosted campaign"}
      </div>
      <div className="row" style={{ alignItems: "start", marginTop: ".8rem" }}>
        {campaign.logoUrl && (
          <Image
            src={campaign.logoUrl}
            alt={`${campaign.name} logo`}
            width={64}
            height={64}
            unoptimized
            style={{ borderRadius: 12 }}
          />
        )}
        <div>
          <h1
            style={{
              fontSize: "clamp(2rem,5vw,3.6rem)",
              letterSpacing: "-.06em",
              margin: 0,
            }}
          >
            {campaign.name}
          </h1>
          <p className="muted">{campaign.description}</p>
          {campaign.projectUrl && (
            <a
              href={campaign.projectUrl}
              target="_blank"
              rel="noopener noreferrer"
            >
              Project website ↗
            </a>
          )}
        </div>
      </div>
      <div className="grid grid-2 section">
        <div className="card">
          <div className="card-content">
            <div className="row between">
              <strong>Registration capacity</strong>
              <span className={`status ${full ? "full" : campaign.status}`}>
                {full ? "Full" : campaign.status}
              </span>
            </div>
            <div className="metric">
              {accepted.toLocaleString("en-US")}{" "}
              <span className="muted small">
                / {campaign.maxApplicants.toLocaleString("en-US")}
              </span>
            </div>
            <div className="progress">
              <span
                style={{
                  width: `${Math.min(100, (accepted / campaign.maxApplicants) * 100)}%`,
                }}
              />
            </div>
            <p className="small muted">
              {Math.max(0, campaign.maxApplicants - accepted).toLocaleString(
                "en-US",
              )}{" "}
              places remain. Counts come from committed registrations.
            </p>
          </div>
        </div>
        <div className="card">
          <div className="card-content">
            <strong>Campaign details</strong>
            <p className="muted small">
              {campaign.requirements ||
                "Connect a wallet and complete required tasks."}
            </p>
            <p className="small">
              <strong>Reward:</strong> {campaign.reward || "See project terms."}
            </p>
            <div className="row small">
              {campaign.termsUrl && <a href={campaign.termsUrl}>Terms ↗</a>}
              {campaign.privacyUrl && (
                <a href={campaign.privacyUrl}>Privacy ↗</a>
              )}
            </div>
          </div>
        </div>
      </div>
      <section>
        <div className="section-head">
          <div>
            <div className="eyebrow">Identity</div>
            <h2>Connect and sign</h2>
          </div>
        </div>
        <div className="notice row between">
          <div>
            {address ? (
              <>
                <strong className="code">{address}</strong>
                <div className="small muted">
                  Authenticated on chain {campaign.chainId}
                </div>
              </>
            ) : (
              <span className="muted">
                A secure one-time SIWE challenge proves wallet ownership. No gas
                or approvals.
              </span>
            )}
          </div>
          <div className="row">
            <Button onClick={signIn} disabled={!!busy}>
              {busy === "wallet"
                ? "Waiting for wallet…"
                : address
                  ? "Switch / reconnect wallet"
                  : "Sign in with EVM wallet"}
            </Button>
            {address && (
              <Button variant="outline" onClick={signOut} disabled={!!busy}>
                Sign out
              </Button>
            )}
          </div>
        </div>
      </section>
      <section className="section">
        <div className="section-head">
          <div>
            <div className="eyebrow">Verification</div>
            <h2>Campaign tasks</h2>
          </div>
        </div>
        <div className="stack">
          {tasks.map((task) => {
            const status = statuses.find((s) => s.taskId === task.id);
            return (
              <div className="card" key={task.id}>
                <div className="card-content">
                  <div className="row between">
                    <div>
                      <strong>{task.title}</strong>
                      <span className="small muted">
                        {" "}
                        · {task.required ? "Required" : "Optional"}
                      </span>
                      <p className="small muted">{task.description}</p>
                    </div>
                    <span className={`status ${status?.status || ""}`}>
                      {status?.status?.replace("_", " ") || "Not started"}
                    </span>
                  </div>
                  {status?.detail && (
                    <p className="small muted">{status.detail}</p>
                  )}
                  {(task.type === "manual" || task.type === "transaction") && (
                    <label className="small">
                      {task.type === "transaction"
                        ? "Transaction hash"
                        : "Evidence or reference"}
                      <input
                        className="input"
                        value={evidence[task.id] || ""}
                        onChange={(e) =>
                          setEvidence((prev) => ({
                            ...prev,
                            [task.id]: e.target.value,
                          }))
                        }
                        placeholder={
                          task.type === "transaction"
                            ? "0x…"
                            : "Link or short explanation"
                        }
                        maxLength={2000}
                      />
                    </label>
                  )}
                  <div style={{ marginTop: ".8rem" }}>
                    <Button
                      variant="outline"
                      size="sm"
                      disabled={
                        !address || !!busy || status?.status === "verified"
                      }
                      onClick={() => verify(task)}
                    >
                      {busy === task.id
                        ? "Checking…"
                        : status?.status === "verified"
                          ? "Verified"
                          : task.type === "discord"
                            ? "Connect Discord"
                            : "Verify task"}
                    </Button>
                  </div>
                </div>
              </div>
            );
          })}
          {!tasks.length && (
            <div className="notice">This campaign has no tasks.</div>
          )}
        </div>
      </section>
      <section className="section">
        <div className="eyebrow">Application</div>
        <h2>Submit registration</h2>
        {application ? (
          <div className="notice success">
            <strong>Accepted application</strong>
            <p className="code small">Receipt ID: {application.id}</p>
            <p className="small">
              Eligibility: {application.eligibility}. Stored at{" "}
              {new Date(application.acceptedAt).toLocaleString("en-US")}.
            </p>
          </div>
        ) : (
          <div className="notice">
            <p className="muted small">
              The server checks every required task and commits a slot and
              application together. A button click alone never records success.
            </p>
            <Button disabled={!canSubmit || !!busy} onClick={submit}>
              {busy === "submit"
                ? "Submitting…"
                : full
                  ? "Campaign full"
                  : "Submit application"}
            </Button>
          </div>
        )}
        {error && (
          <p className="notice error" role="alert">
            {error}
          </p>
        )}
        {notice && (
          <p className="notice" role="status">
            {notice}
          </p>
        )}
      </section>
    </div>
  );
}
