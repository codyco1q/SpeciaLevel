"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Check, Copy, Mail, Trash2, UserPlus } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import type { Dictionary, Locale } from "@/lib/i18n/get-dictionary";
import type { InvitationRow } from "./page";
import { INVITATION_STATUS_BADGE_VARIANTS } from "@/lib/validations/invites";
import { InviteMemberDialog } from "./invite-member-dialog";
import { RevokeInvitationDialog } from "./revoke-invitation-dialog";

interface InvitationsTabProps {
  invitations: InvitationRow[];
  roles: { id: string; name: string; isSystem: boolean }[];
  departments: { id: string; name: string }[];
  canManage: boolean;
  /** Localized copy + formatters for the current render. */
  platform: Dictionary["platform"];
  locale: Locale;
}

/** Maps a stored invitation status to its localized label key. */
const INVITATION_STATUS_LABEL_KEYS = {
  pending: "statusPending",
  accepted: "statusAccepted",
  revoked: "statusRevoked",
  expired: "statusExpired",
} as const;

function formatDate(value: string, locale: Locale): string {
  return new Intl.DateTimeFormat(
    locale.startsWith("ar") ? "ar-EG" : locale,
    {
      month: "short",
      day: "numeric",
      year: "numeric",
    }
  ).format(new Date(value));
}

function InviteLinkButton({
  token,
  platform,
}: {
  token: string;
  platform: Dictionary["platform"];
}) {
  const t = platform.settings;
  const [copied, setCopied] = useState(false);

  async function copyLink() {
    const url = `${window.location.origin}/signup?invite=${token}`;
    try {
      await navigator.clipboard.writeText(url);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // Clipboard unavailable (e.g. non-secure context); do nothing.
    }
  }

  return (
    <Button
      type="button"
      variant="ghost"
      size="sm"
      onClick={copyLink}
      title={t.inviteLinkTitle}
    >
      {copied ? <Check /> : <Copy />}
      {copied ? platform.common.copied : platform.common.copyLink}
    </Button>
  );
}

export function InvitationsTab({
  invitations,
  roles,
  departments,
  canManage,
  platform,
  locale,
}: InvitationsTabProps) {
  const t = platform.settings;
  const router = useRouter();
  const [inviteOpen, setInviteOpen] = useState(false);
  const [revoking, setRevoking] = useState<InvitationRow | null>(null);
  const [revokeError, setRevokeError] = useState<string | null>(null);
  const [isRevoking, startRevokeTransition] = useTransition();

  const pendingCount = invitations.filter(
    (invitation) => invitation.status === "pending"
  ).length;

  function handleRevoke() {
    if (!revoking) return;
    setRevokeError(null);
    startRevokeTransition(async () => {
      const { revokeInvitation } = await import("@/lib/actions/invites");
      const result = await revokeInvitation(revoking.id);
      if (result.status === "success") {
        setRevoking(null);
        router.refresh();
      } else {
        setRevokeError(result.error ?? t.revokeError);
      }
    });
  }

  return (
<>
      <Card>
        <CardHeader className="flex flex-row flex-wrap items-start justify-between gap-4">
          <div>
            <CardTitle className="flex items-center gap-2">
              {t.invitationsTitle}
              {pendingCount > 0 && (
                <Badge variant="secondary">
                  {t.pendingCount.replace("{count}", String(pendingCount))}
                </Badge>
              )}
            </CardTitle>
            <CardDescription>{t.invitationsDescription}</CardDescription>
          </div>
          {canManage && (
            <Button onClick={() => setInviteOpen(true)}>
              <UserPlus />
              {t.inviteMember}
            </Button>
          )}
        </CardHeader>
        <CardContent>
          {invitations.length === 0 ? (
            <div className="flex flex-col items-center justify-center gap-2 rounded-lg border border-dashed px-6 py-12 text-center">
              <Mail className="size-6 text-muted-foreground" />
              <p className="text-sm font-medium">{t.emptyInvitations}</p>
              <p className="text-sm text-muted-foreground">
                {canManage
                  ? t.emptyInvitationsHintManage
                  : t.emptyInvitationsHintView}
              </p>
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>{t.tableEmail}</TableHead>
                  <TableHead>{t.tableRole}</TableHead>
                  <TableHead>{t.tableDepartment}</TableHead>
                  <TableHead>{t.tableSent}</TableHead>
                  <TableHead>{t.tableExpiration}</TableHead>
                  <TableHead>{t.tableStatus}</TableHead>
                  <TableHead className="text-right">
                    {platform.common.actions}
                  </TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {invitations.map((invitation) => (
                  <TableRow key={invitation.id}>
                    <TableCell className="font-medium">
                      {invitation.email}
                    </TableCell>
                    <TableCell>{invitation.roleName}</TableCell>
                    <TableCell className="text-muted-foreground">
                      {invitation.departmentName ?? "—"}
                    </TableCell>
                    <TableCell className="text-muted-foreground">
                      {formatDate(invitation.createdAt, locale)}
                    </TableCell>
                    <TableCell className="text-muted-foreground">
                      {formatDate(invitation.expiresAt, locale)}
                    </TableCell>
                    <TableCell>
                      <Badge
                        variant={
                          INVITATION_STATUS_BADGE_VARIANTS[
                            invitation.status
                          ] ?? "secondary"
                        }
                      >
                        {t[INVITATION_STATUS_LABEL_KEYS[invitation.status]] ??
                          invitation.status}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center justify-end gap-1">
                        {invitation.status === "pending" && (
                          <>
                            <InviteLinkButton token={invitation.token} platform={platform} />
                            {canManage && (
                              <Button
                                type="button"
                                variant="ghost"
                                size="sm"
                                className="text-destructive hover:text-destructive"
                                onClick={() => {
                                  setRevokeError(null);
                                  setRevoking(invitation);
                                }}
                              >
                                <Trash2 />
                                {platform.common.revoke}
                              </Button>
                            )}
                          </>
                        )}
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
      {revoking && (
        <RevokeInvitationDialog
          invitation={revoking}
          error={revokeError}
          isPending={isRevoking}
          onCancel={() => setRevoking(null)}
          onConfirm={handleRevoke}
          platform={platform}
        />
      )}
      {canManage && (
        <InviteMemberDialog
          open={inviteOpen}
          onOpenChange={setInviteOpen}
          roles={roles}
          departments={departments}
          platform={platform}
        />
      )}
    </>
  );
}