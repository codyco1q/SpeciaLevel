import { redirect } from "next/navigation";
import { getCurrentUserContext } from "@/lib/auth/session";
import OnboardingForm from "./onboarding-form";

// Auth-gated page reads cookies + user context at request time.
export const dynamic = "force-dynamic";

export default async function OnboardingPage() {
  const userContext = await getCurrentUserContext();

  if (!userContext) {
    redirect("/login");
  }

  // Users who already belong to an organization have no business here.
  if (userContext.organization) {
    redirect("/dashboard");
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-muted/40 px-4">
      <div className="w-full max-w-md">
        <div className="mb-8 text-center">
          <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-xl bg-primary text-primary-foreground">
            <span className="text-lg font-bold">UL</span>
          </div>
          <h1 className="text-2xl font-bold">Set up your workspace</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Create your organization to get started
          </p>
        </div>

        <OnboardingForm
          email={userContext.user.email}
          fullName={userContext.profile.full_name}
        />
      </div>
    </div>
  );
}