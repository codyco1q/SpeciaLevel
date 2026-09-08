import { redirect } from "next/navigation";
import Sidebar from "@/components/sidebar";
import { getCurrentUserContext } from "@/lib/auth/session";

// Auth-gated pages read cookies + user data at request time —
// never prerender them at build time (especially when env vars
// aren't available during `next build`).
export const dynamic = "force-dynamic";

export default async function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const userContext = await getCurrentUserContext();

  if (!userContext) {
    redirect("/login");
  }

  return (
    <div className="flex h-screen overflow-hidden">
      <Sidebar
        permissions={userContext.permissions}
        organizationName={userContext.organization?.name}
        userFullName={userContext.profile.full_name ?? undefined}
        userEmail={userContext.user.email}
      />
      <main className="flex-1 overflow-y-auto bg-background">{children}</main>
    </div>
  );
}
