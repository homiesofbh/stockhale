"use client";
import { useState, useEffect, type FormEvent } from "react";
import { workspaceRequest } from "@/lib/stockwell/use-workspace";
import { cacheKey } from "@/lib/stockwell/workspace";
export function AuthPage({ signup = false }: { signup?: boolean }) {
  const [error, setError] = useState(""),
    [busy, setBusy] = useState(false),
    [invite, setInvite] = useState("");
  useEffect(() => {
    setInvite(new URLSearchParams(location.search).get("invite") || "");
  }, []);
  async function submit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setBusy(true);
    setError("");
    const data = Object.fromEntries(new FormData(e.currentTarget));
    try {
      const w = await workspaceRequest({
        ...data,
        invite,
        action: signup ? "signup" : "signin",
      });
      const existing = localStorage.getItem(cacheKey(w.id));
      const cached = existing ? JSON.parse(existing) : null;
      localStorage.setItem(
        cacheKey(w.id),
        JSON.stringify(
          cached?.queue?.length
            ? { ...cached, workspace: { ...w, store: cached.workspace.store } }
            : { workspace: w, revision: w.revision, queue: [] },
        ),
      );
      localStorage.setItem("stockwell.active", w.id);
      location.assign("/");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not sign in");
    } finally {
      setBusy(false);
    }
  }
  return (
    <main className="auth-shell">
      <section className="auth-intro">
        <a className="brand" href="/">
          STOCKWELL.
        </a>
        <span className="eyebrow">YOUR STORE. IN GOOD ORDER.</span>
        <h1>
          {signup
            ? "A workspace for your business."
            : "Welcome back to your store."}
        </h1>
        <p>
          Stock, sales, and your team — connected wherever your day takes you.
        </p>
      </section>
      <section className="auth-card">
        <h2>
          {signup
            ? invite
              ? "Join your workspace"
              : "Create your workspace"
            : "Sign in"}
        </h2>
        <p>
          {signup
            ? "Enter your details to get started."
            : "Use your account to open Stockwell."}
        </p>
        <form onSubmit={submit}>
          {signup && (
            <label className="field">
              <span>Your name</span>
              <input name="name" required maxLength={200} autoComplete="name" />
            </label>
          )}
          {signup && !invite && (
            <label className="field">
              <span>Store name</span>
              <input name="storeName" required maxLength={200} />
            </label>
          )}
          <label className="field">
            <span>Email</span>
            <input name="email" type="email" required autoComplete="email" />
          </label>
          <label className="field">
            <span>Password</span>
            <input
              name="password"
              type="password"
              required
              minLength={signup ? 12 : 1}
              maxLength={128}
              autoComplete={signup ? "new-password" : "current-password"}
            />
          </label>
          {signup && <small>At least 12 characters.</small>}
          {error && (
            <p className="form-error" role="alert">
              {error}
            </p>
          )}
          <button className="primary" disabled={busy}>
            {busy ? "Please wait…" : signup ? "Create account" : "Sign in"}
          </button>
        </form>
        <p>
          {signup ? "Already have an account?" : "New to Stockwell?"}{" "}
          <a href={signup ? "/sign-in" : "/sign-up"}>
            {signup ? "Sign in" : "Sign up"}
          </a>
        </p>
      </section>
    </main>
  );
}
