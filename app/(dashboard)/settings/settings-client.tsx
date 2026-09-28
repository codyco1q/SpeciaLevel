"use client";

import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import type { Dictionary, Locale } from "@/lib/i18n/get-dictionary";
import type { Organization } from "@/types/database";
import { GeneralBrandingTab } from "./general-branding-tab";
import { SecurityTab } from "./security-tab";
import { BillingDefaultsTab } from "./billing-defaults-tab";
import { ProfileTab } from "./profile-tab";

export interface SettingsClientProps {
  organization: Organization;
  profile: { fullName: string | null; jobTitle: string | null };
  userEmail: string;
  canManage: boolean;
  platform: Dictionary["platform"];
  locale: Locale;
}

export function SettingsClient({
  organization,
  profile,
  userEmail,
  canManage,
  platform,
  locale,
}: SettingsClientProps) {
  const t = platform.settings;

  return (
    <div className="mx-auto max-w-4xl">
      <div className="mb-6">
        <h1 className="text-2xl font-bold tracking-tight">{t.title}</h1>
        <p className="mt-1 text-sm text-muted-foreground">{t.subtitle}</p>
      </div>

      <Tabs defaultValue="general" className="space-y-6">
        <TabsList className="grid w-full grid-cols-2 sm:grid-cols-4">
          <TabsTrigger value="general">{t.tabGeneral || "General & Branding"}</TabsTrigger>
          <TabsTrigger value="security">{t.tabSecurity || "Security & Controls"}</TabsTrigger>
          <TabsTrigger value="billing">{t.tabBilling || "Invoicing & Defaults"}</TabsTrigger>
          <TabsTrigger value="profile">{t.tabProfile || "Profile"}</TabsTrigger>
        </TabsList>

        <TabsContent value="general" className="space-y-4">
          <GeneralBrandingTab
            organization={organization}
            canManage={canManage}
            platform={platform}
          />
        </TabsContent>

        <TabsContent value="security" className="space-y-4">
          <SecurityTab
            organization={organization}
            canManage={canManage}
            platform={platform}
          />
        </TabsContent>

        <TabsContent value="billing" className="space-y-4">
          <BillingDefaultsTab
            organization={organization}
            canManage={canManage}
            platform={platform}
          />
        </TabsContent>

        <TabsContent value="profile" className="space-y-4">
          <ProfileTab
            profile={profile}
            userEmail={userEmail}
            platform={platform}
            locale={locale}
          />
        </TabsContent>
      </Tabs>
    </div>
  );
}
