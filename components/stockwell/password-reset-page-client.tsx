"use client";

import { workspaceRequest } from "@/lib/stockwell/use-workspace";
import Link from "next/link";
import { useEffect, useState, type FormEvent } from "react";

export function ForgotPasswordPageClient() {
  const [busy, setBusy] = useState(false),
    [error, setError] = useState(""),
    [sent, setSent] = useState(false);
  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setBusy(true);
    setError("");
    try {
      const email = String(new FormData(event.currentTarget).get("email") || "");
      await workspaceRequest({ action: "request-password-reset", email });
      setSent(true);
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Could not request a password reset.");
    } finally {
      setBusy(false);
    }
  }
  return (
    <AuthShell title="Reset your password" description="Enter your account email and we’ll send a reset link.">
      {sent ? (
        <p role="status">If an account matches that email, a password-reset link is on its way.</p>
      ) : (
        <form onSubmit={submit}>
          <label className="field"><span>Email</span><input name="email" type="email" autoComplete="email" required /></label>
          {error && <p className="form-error" role="alert">{error}</p>}
          <button className="primary" disabled={busy}>{busy ? "Sending…" : "Email reset link"}</button>
        </form>
      )}
      <p><Link href="/sign-in">Back to sign in</Link></p>
    </AuthShell>
  );
}

export function ResetPasswordPageClient() {
  const [token, setToken] = useState(""),
    [busy, setBusy] = useState(false),
    [error, setError] = useState(""),
    [complete, setComplete] = useState(false),
    [showPassword, setShowPassword] = useState(false);
  useEffect(() => setToken(new URLSearchParams(location.search).get("token") || ""), []);
  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const data = new FormData(event.currentTarget), password = String(data.get("password") || "");
    setError("");
    if (!token) return setError("This password-reset link is invalid or has expired.");
    if (password !== data.get("confirmPassword")) return setError("Passwords do not match.");
    setBusy(true);
    try {
      await workspaceRequest({ action: "reset-password", token, password });
      setComplete(true);
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Could not reset your password.");
    } finally {
      setBusy(false);
    }
  }
  return (
    <AuthShell title="Choose a new password" description="Use at least 12 characters. Your other signed-in sessions will be closed.">
      {complete ? <p role="status">Password updated. <Link href="/sign-in">Sign in</Link> with your new password.</p> : (
        <form onSubmit={submit}>
          <label className="field"><span>New password</span><div className="auth-password-input"><input name="password" type={showPassword ? "text" : "password"} autoComplete="new-password" required minLength={12} maxLength={128} /><button type="button" className="auth-password-toggle" onClick={() => setShowPassword((visible) => !visible)}>{showPassword ? "Hide" : "Show"}</button></div></label>
          <label className="field"><span>Confirm new password</span><input name="confirmPassword" type={showPassword ? "text" : "password"} autoComplete="new-password" required minLength={12} maxLength={128} /></label>
          {error && <p className="form-error" role="alert">{error}</p>}
          <button className="primary" disabled={busy || !token}>{busy ? "Updating…" : "Update password"}</button>
        </form>
      )}
      {!complete && <p><Link href="/forgot-password">Request a new link</Link></p>}
    </AuthShell>
  );
}

function AuthShell({ title, description, children }: { title: string; description: string; children: React.ReactNode }) {
  return <main className="auth-shell"><section className="auth-intro"><Link className="brand" href="/">STOCKHALE.</Link><span className="eyebrow">ACCOUNT SECURITY</span><h1>{title}</h1><p>{description}</p></section><section className="auth-card"><h2>{title}</h2>{children}</section></main>;
}
