"use client";

import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
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
}

export function SettingsClient({
  organization,
  profile,
  userEmail,
  roles,
  departments,
  invitations,
  canManage,
}: SettingsClientProps) {
  return (
    <div className="mx-auto max-w-4xl">
      <div className="mb-6">
        <h1 className="text-2xl font-bold tracking-tight">Settings</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Manage your organization, member invitations, and personal profile.
        </p>
      </div>

      <Tabs defaultValue="general">
        <TabsList>
          <TabsTrigger value="general">General</TabsTrigger>
          <TabsTrigger value="invitations">Invitations</TabsTrigger>
          <TabsTrigger value="profile">Profile</TabsTrigger>
        </TabsList>

        <TabsContent value="general">
          <GeneralSettingsTab organization={organization} canManage={canManage} />
        </TabsContent>

        <TabsContent value="invitations">
          <InvitationsTab
            invitations={invitations}
            roles={roles}
            departments={departments}
            canManage={canManage}
          />
        </TabsContent>

        <TabsContent value="profile">
          <ProfileTab profile={profile} userEmail={userEmail} />
        </TabsContent>
      </Tabs>
    </div>
  );
}