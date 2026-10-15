"use client";
import { workspaceRequest } from "@/lib/stockwell/use-workspace";
import { cacheKey } from "@/lib/stockwell/workspace";
import { useEffect, useState, type FormEvent } from "react";
export function AuthPageClient({
  signup = false,
  team = false,
  allowPublicSignup = true,
}: {
  signup?: boolean;
  team?: boolean;
  allowPublicSignup?: boolean;
}) {
  const [error, setError] = useState(""),
    [busy, setBusy] = useState(false),
    [invite, setInvite] = useState(""),
    [showPassword, setShowPassword] = useState(false);
  const teamSignup = signup && (team || !!invite);
  const publicSignupUnavailable =
    signup && !team && !invite && !allowPublicSignup;
  useEffect(() => {
    setInvite(new URLSearchParams(location.search).get("invite") || "");
  }, []);
  async function submit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setBusy(true);
    setError("");
    const data = Object.fromEntries(new FormData(e.currentTarget));
    try {
      if (signup && data.password !== data.confirmPassword)
        throw new Error("Passwords do not match.");
      if (team && !invite)
        throw new Error(
          "Open the signup link provided by your workspace owner."
        );
      const w = await workspaceRequest({
        ...Object.fromEntries(
          Object.entries(data).filter(([key]) => key !== "confirmPassword")
        ),
        invite,
        action: teamSignup ? "team-signup" : signup ? "signup" : "signin",
      });
      const existing = localStorage.getItem(cacheKey(w.id));
      const cached = existing ? JSON.parse(existing) : null;
      if (cached?.queue?.length && cached.workspace.member.id !== w.member.id)
        throw new Error(
          "Pending records belong to another user. Sign in as that user to sync them first."
        );
      localStorage.setItem(
        cacheKey(w.id),
        JSON.stringify(
          cached?.queue?.length
            ? { ...cached, workspace: { ...w, store: cached.workspace.store } }
            : { workspace: w, revision: w.revision, queue: [] }
        )
      );
      localStorage.setItem("stockwell.active", w.id);
      location.assign("/workspace");
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
          STOCKHALE.
        </a>
        <span className="eyebrow">YOUR STORE. IN GOOD ORDER.</span>
        <h1>
          {signup
            ? teamSignup
              ? "Your place on the team."
              : publicSignupUnavailable
                ? "New accounts are closed."
                : "A workspace for your business."
            : "Welcome back to your store."}
        </h1>
        <p>
          Stock, sales, and your team — connected wherever your day takes you.
        </p>
      </section>
      <section className="auth-card">
        <h2>
          {signup
            ? teamSignup
              ? "Team member signup"
              : publicSignupUnavailable
                ? "Signup unavailable"
                : "Create your workspace"
            : "Sign in"}
        </h2>
        <p>
          {signup
            ? teamSignup
              ? "Use the email assigned by your workspace owner and create your own password."
              : publicSignupUnavailable
                ? "New account creation is currently unavailable. If you were invited to a workspace, open the signup link from your workspace owner."
                : "Enter your details to get started."
            : "Use your account to open StockHale."}
        </p>
        {!publicSignupUnavailable && (
          <form onSubmit={submit}>
            {signup && (
              <label className="field">
                <span>Your name</span>
                <input
                  name="name"
                  required
                  maxLength={200}
                  autoComplete="name"
                />
              </label>
            )}
            {signup && !team && !invite && (
              <label className="field">
                <span>Store name</span>
                <input name="storeName" required maxLength={200} />
              </label>
            )}
            <label className="field">
              <span>{teamSignup ? "Assigned email" : "Email"}</span>
              <input name="email" type="email" required autoComplete="email" />
            </label>
            <div className="field">
              <span>
                <label htmlFor="auth-password">Password</label>
              </span>
              <div className="auth-password-input">
                <input
                  id="auth-password"
                  name="password"
                  type={showPassword ? "text" : "password"}
                  required
                  minLength={signup ? 12 : 1}
                  maxLength={128}
                  autoComplete={signup ? "new-password" : "current-password"}
                />
                <button
                  type="button"
                  className="auth-password-toggle"
                  aria-label={showPassword ? "Hide password" : "Show password"}
                  aria-controls="auth-password"
                  onClick={() => setShowPassword((visible) => !visible)}
                >
                  {showPassword ? "Hide" : "Show"}
                </button>
              </div>
            </div>
            {signup && (
              <label className="field">
                <span>Confirm password</span>
                <input
                  name="confirmPassword"
                  type={showPassword ? "text" : "password"}
                  required
                  minLength={12}
                  maxLength={128}
                  autoComplete="new-password"
                />
              </label>
            )}
            {signup && <small>At least 12 characters.</small>}
            {signup && (
              <label className="auth-legal-consent">
                <input name="legalConsent" type="checkbox" required />
                <span>
                  I agree to the{" "}
                  <a href="/terms-and-conditions" target="_blank" rel="noreferrer">
                    Terms &amp; Conditions
                  </a>{" "}
                  and acknowledge the{" "}
                  <a href="/privacy-policy" target="_blank" rel="noreferrer">
                    Privacy Policy
                  </a>.
                </span>
              </label>
            )}
            {team && !invite && (
              <p role="alert" className="form-error">
                Open the signup link provided by your workspace owner to join
                their workspace.
              </p>
            )}
            {error && (
              <p className="form-error" role="alert">
                {error}
              </p>
            )}
            <button className="primary" disabled={busy || (team && !invite)}>
              {busy
                ? "Please wait…"
                : signup
                  ? teamSignup
                    ? "Join workspace"
                    : "Create account"
                  : "Sign in"}
            </button>
          </form>
        )}
        {!publicSignupUnavailable && (
          <p>
            {signup
              ? "Already have an account?"
              : allowPublicSignup
                ? "New to StockHale?"
                : ""}{" "}
            {signup ? (
              <a href="/sign-in">Sign in</a>
            ) : allowPublicSignup ? (
              <a href="/sign-up">Sign up</a>
            ) : null}
          </p>
        )}
        {!signup && (
          <p>
            <a href="/forgot-password">Forgot your password?</a>
          </p>
        )}
        {!team && !invite && (
          <p>
            <a href="/team-sign-up">Team member signup</a>
          </p>
        )}
      </section>
    </main>
  );
}
