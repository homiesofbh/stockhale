import { betterAuth, type BetterAuthOptions } from "better-auth";
import { hashPassword, verifyPassword } from "better-auth/crypto";
import { PostgresDialect } from "kysely";
import { scryptSync, timingSafeEqual } from "node:crypto";
import type { PoolClient } from "pg";
import { db } from "./database";

function publicSignupDisabled() {
  return process.env.DISABLE_PUBLIC_SIGNUP === "true";
}

function passwordResetDeliveryConfigured() {
  return !!(process.env.RESEND_API_KEY && process.env.RESEND_FROM);
}

async function sendPasswordResetEmail({
  email,
  token,
}: {
  email: string;
  token: string;
}) {
  const baseURL = process.env.BETTER_AUTH_URL || process.env.STOCKWELL_ORIGIN;
  if (!baseURL || !passwordResetDeliveryConfigured())
    throw new Error("Password reset email is not configured.");
  const resetURL = new URL("/reset-password", baseURL);
  resetURL.searchParams.set("token", token);
  const url = resetURL.href;
  const htmlURL = url.replace(/&/g, "&amp;").replace(/"/g, "&quot;");
  const response = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${process.env.RESEND_API_KEY}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      from: process.env.RESEND_FROM,
      to: [email],
      subject: "Reset your StockHale password",
      text: `Reset your StockHale password: ${url}\n\nThis link expires in one hour and can only be used once. If you did not request a reset, you can safely ignore this email.`,
      html: `<p>Reset your StockHale password:</p><p><a href="${htmlURL}">Reset password</a></p><p>This link expires in one hour and can only be used once. If you did not request a reset, you can safely ignore this email.</p>`,
    }),
    signal: AbortSignal.timeout(8000),
  });
  if (!response.ok) throw new Error("Password reset email could not be sent.");
}

function createAuth(database: BetterAuthOptions["database"], allowTeamSignup = false) {
  const secret = process.env.BETTER_AUTH_SECRET;
  const baseURL = process.env.BETTER_AUTH_URL || process.env.STOCKWELL_ORIGIN;
  if (!secret || secret.length < 32 || !baseURL)
    throw Object.assign(
      new Error(
        "Authentication is not configured. Set BETTER_AUTH_SECRET (at least 32 characters) and BETTER_AUTH_URL.",
      ),
      { status: 503 },
    );
  return betterAuth({
    appName: "StockHale",
    secret,
    baseURL,
    trustedOrigins: [new URL(baseURL).origin],
    database,
    user: { modelName: "users" },
    account: { modelName: "auth_accounts" },
    verification: { modelName: "auth_verifications" },
    session: {
      modelName: "auth_sessions",
      expiresIn: 7 * 86400,
      updateAge: 86400,
      cookieCache: { enabled: false },
    },
    emailAndPassword: {
      enabled: true,
      // Better Auth blocks its sign-up API when public signup is disabled.
      // Invited team members use a separately scoped instance that permits signup.
      disableSignUp: publicSignupDisabled() && !allowTeamSignup,
      minPasswordLength: 12,
      maxPasswordLength: 128,
      revokeSessionsOnPasswordReset: true,
      sendResetPassword: async ({ user, token }) => {
        // Do not hold the response open for a mail provider. Better Auth has
        // already created the short-lived, single-use verification token.
        void sendPasswordResetEmail({ email: user.email, token }).catch(
          (error) => console.error("Password reset email failed:", error),
        );
      },
      password: {
        hash: hashPassword,
        // Preserve passwords when importing the previous SQLite database.
        verify: async ({ hash, password }) => {
          if (/^stockwell-legacy:[a-f0-9]{32}:[a-f0-9]{128}$/.test(hash)) {
            const [, salt, key] = hash.split(":");
            return timingSafeEqual(
              scryptSync(password, salt, 64),
              Buffer.from(key, "hex"),
            );
          }
          return verifyPassword({ hash, password });
        },
      },
    },
    advanced: {
      cookiePrefix: "stockwell",
      defaultCookieAttributes: { httpOnly: true, sameSite: "strict" },
    },
  });
}

export { passwordResetDeliveryConfigured };

let auth: ReturnType<typeof createAuth> | undefined;
export function getAuth(client?: PoolClient, allowTeamSignup = false) {
  if (!client) return (auth ??= createAuth(db()));
  // Account, credential, session and workspace creation share one transaction.
  // The outer transaction owns this connection and its release/commit lifecycle.
  const scopedClient = new Proxy(client, {
    get(target, key) {
      if (key === "release") return () => {};
      const value = Reflect.get(target, key);
      return typeof value === "function" ? value.bind(target) : value;
    },
  });
  return createAuth({
    dialect: new PostgresDialect({
      pool: {
        options: {},
        connect: async () => scopedClient,
        end: async () => {},
      },
    }),
    type: "postgres",
    transaction: false,
  }, allowTeamSignup);
}
