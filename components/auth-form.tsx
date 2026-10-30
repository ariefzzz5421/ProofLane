"use client";
import { useState, useRef, useEffect, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Button } from "./ui/button";
import { Input } from "./ui/input";
export function AuthForm({ mode }: { mode: "login" | "register" }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const formRef = useRef<HTMLFormElement>(null);
  useEffect(() => {
    if (formRef.current) formRef.current.dataset.hydrated = "true";
  }, []);
  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setBusy(true);
    setError("");
    const data = Object.fromEntries(new FormData(event.currentTarget));
    try {
      const response = await fetch(`/api/v1/admin/${mode}`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(data),
      });
      const result = await response.json();
      if (!response.ok)
        throw new Error(result.error?.message || "Sign in failed.");
      router.push("/dashboard");
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Request failed.");
    } finally {
      setBusy(false);
    }
  }
  return (
    <main className="container" style={{ maxWidth: 480, paddingTop: "8vh" }}>
      <Link className="brand" href="/">
        <span className="brand-mark">Q</span>QuestKernel
      </Link>
      <div className="card" style={{ marginTop: "2rem" }}>
        <div className="card-content form-stack">
          <div>
            <div className="eyebrow">Developer workspace</div>
            <h1 style={{ letterSpacing: "-.05em" }}>
              {mode === "login" ? "Welcome back" : "Create your workspace"}
            </h1>
            <p className="muted">
              {mode === "login"
                ? "Sign in to manage real campaigns."
                : "Start with a free organization and persistent demo data."}
            </p>
          </div>
          <form
            ref={formRef}
            method="post"
            onSubmit={submit}
            className="form-stack"
          >
            {mode === "register" && (
              <>
                <label>
                  Organization name
                  <Input name="organization" required minLength={2} />
                </label>
                <label>
                  Organization slug
                  <Input
                    name="slug"
                    required
                    pattern="[a-z0-9-]{3,48}"
                    placeholder="my-project"
                  />
                </label>
              </>
            )}
            <label>
              Email
              <Input name="email" type="email" required autoComplete="email" />
            </label>
            <label>
              Password
              <Input
                name="password"
                type="password"
                required
                minLength={mode === "register" ? 12 : 1}
                autoComplete={
                  mode === "register" ? "new-password" : "current-password"
                }
              />
            </label>
            {error && (
              <div className="notice error" role="alert">
                {error}
              </div>
            )}
            <Button disabled={busy}>
              {busy
                ? "Working…"
                : mode === "login"
                  ? "Sign in"
                  : "Create organization"}
            </Button>
          </form>
          <p className="small muted">
            {mode === "login" ? (
              <>
                New here? <Link href="/register">Create an organization</Link>
              </>
            ) : (
              <>
                Already have an account? <Link href="/login">Sign in</Link>
              </>
            )}
          </p>
        </div>
      </div>
    </main>
  );
}
