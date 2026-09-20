import { redirect } from "next/navigation";
import { getCurrentUserContext } from "@/lib/auth/session";

export const dynamic = "force-dynamic";

/**
 * Root Application Gateway
 *
 * Redirects:
 * - Authenticated users with an organization -> /dashboard
 * - Authenticated users without an organization -> /onboarding
 * - Unauthenticated users -> /login
 */
export default async function RootPage() {
  const userContext = await getCurrentUserContext();

  if (userContext?.organization) {
    redirect("/dashboard");
  }

  if (userContext) {
    redirect("/onboarding");
  }

  redirect("/login");
}
