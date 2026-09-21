import { redirect } from "next/navigation";
import Sidebar from "@/components/sidebar";
import { DashboardHeader } from "@/components/dashboard-header";
import { CommandPalette } from "@/components/command-palette";
import { getCurrentUserContext } from "@/lib/auth/session";
import { getDictionary, getLocale } from "@/lib/i18n/get-dictionary";

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

  // New signups have a profile but no organization — send them to
  // onboarding before they can access the workspace.
  if (!userContext.organization) {
    redirect("/onboarding");
  }

  const dict = await getDictionary();
  const locale = await getLocale();

  // A user whose every role is the restricted Client role gets the scoped
  // client portal shell (client-scoped nav items + hub dashboard).
  const isClient =
    userContext.roles.length > 0 &&
    userContext.roles.every((role) => role.key === "client");

  return (
    <div className="flex h-screen overflow-hidden print:h-auto print:overflow-visible">
      <Sidebar
        permissions={userContext.permissions}
        organizationName={userContext.organization?.name}
        userFullName={userContext.profile.full_name ?? undefined}
        userEmail={userContext.user.email}
        locale={locale}
        isClient={isClient}
        platform={dict.platform}
      />
      {/* Logical main container: the flex row flips automatically under
          dir="rtl", so the sidebar lands on the right and the content on
          the left without any layout-specific overrides. */}
      <div className="flex flex-1 flex-col overflow-hidden min-w-0">
        <DashboardHeader
          platform={dict.platform}
          locale={locale}
          permissions={userContext.permissions}
          userFullName={userContext.profile.full_name ?? undefined}
          userEmail={userContext.user.email}
          organizationName={userContext.organization?.name}
        />
        <main className="flex-1 overflow-y-auto bg-background print:h-auto print:overflow-visible print:bg-white">
          {children}
        </main>
      </div>
      <CommandPalette
        platform={dict.platform}
        locale={locale}
        permissions={userContext.permissions}
      />
    </div>
  );
}
