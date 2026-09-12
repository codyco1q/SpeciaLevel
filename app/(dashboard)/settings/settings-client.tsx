"use client";

import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import type { Dictionary, Locale } from "@/lib/i18n/get-dictionary";
import type { InvitationRow } from "./page";
import { GeneralSettingsTab } from "./general-settings-tab";
import { InvitationsTab } from "./invitations-tab";
import { ProfileTab } from "./profile-tab";

export interface SettingsClientProps {
  organization: { id: string; name: string; slug: string; timezone: string };
  profile: { fullName: string | null; jobTitle: string | null };
  userEmail: string;
  roles: { id: string; name: string; isSystem: boolean }[];
  departments: { id: string; name: string }[];
  invitations: InvitationRow[];
  canManage: boolean;
  /** Localized copy + formatters for the current render. */
  platform: Dictionary["platform"];
  locale: Locale;
}

export function SettingsClient({
  organization,
  profile,
  userEmail,
  roles,
  departments,
  invitations,
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

      <Tabs defaultValue="general">
        <TabsList>
          <TabsTrigger value="general">{t.tabGeneral}</TabsTrigger>
          <TabsTrigger value="invitations">{t.tabInvitations}</TabsTrigger>
          <TabsTrigger value="profile">{t.tabProfile}</TabsTrigger>
        </TabsList>

        <TabsContent value="general">
          <GeneralSettingsTab
            organization={organization}
            canManage={canManage}
            platform={platform}
          />
        </TabsContent>

        <TabsContent value="invitations">
          <InvitationsTab
            invitations={invitations}
            roles={roles}
            departments={departments}
            canManage={canManage}
            platform={platform}
            locale={locale}
          />
        </TabsContent>

        <TabsContent value="profile">
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