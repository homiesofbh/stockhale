import { AuthPageClient } from "./auth-page-client";

export function AuthPage({
  signup = false,
  team = false,
}: {
  signup?: boolean;
  team?: boolean;
}) {
  return (
    <AuthPageClient
      signup={signup}
      team={team}
      allowPublicSignup={process.env.DISABLE_PUBLIC_SIGNUP !== "true"}
    />
  );
}
