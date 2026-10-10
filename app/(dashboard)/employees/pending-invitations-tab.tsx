"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Check, Copy, Mail, RefreshCw, Trash2, UserPlus } from "lucide-react";

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
import type { EmployeeInvitationRow } from "./page";
import { INVITATION_STATUS_BADGE_VARIANTS } from "@/lib/validations/invites";
import { RevokeEmployeeInvitationDialog } from "./revoke-employee-invitation-dialog";
import { resendInvitation, revokeInvitation } from "@/lib/actions/invites";

interface PendingInvitationsTabProps {
  invitations: EmployeeInvitationRow[];
  canManage: boolean;
  onOpenInvite: () => void;
  platform: Dictionary["platform"];
  locale: Locale;
}

const INVITATION_STATUS_LABEL_KEYS = {
  pending: "statusPending",
  accepted: "statusAccepted",
  revoked: "statusRevoked",
  expired: "statusExpired",
} as const;

function formatDate(value: string, locale: Locale): string {
  try {
    return new Intl.DateTimeFormat(
      locale.startsWith("ar") ? "ar-EG" : "en-US",
      {
        month: "short",
        day: "numeric",
        year: "numeric",
      }
    ).format(new Date(value));
  } catch {
    return value;
  }
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
    const url = `${window.location.origin}/accept-invite?token=${token}`;
    try {
      await navigator.clipboard.writeText(url);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // ignore
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
      {copied ? <Check className="size-3.5" /> : <Copy className="size-3.5" />}
      {copied ? platform.common.copied : platform.common.copyLink}
    </Button>
  );
}

export function PendingInvitationsTab({
  invitations,
  canManage,
  onOpenInvite,
  platform,
  locale,
}: PendingInvitationsTabProps) {
  const t = platform.settings;
  const tEmp = platform.employees;
  const router = useRouter();
  const [revoking, setRevoking] = useState<EmployeeInvitationRow | null>(null);
  const [revokeError, setRevokeError] = useState<string | null>(null);
  const [resendingId, setResendingId] = useState<string | null>(null);
  const [resendSuccessId, setResendSuccessId] = useState<string | null>(null);
  const [isRevoking, startRevokeTransition] = useTransition();

  const pendingCount = invitations.filter((i) => i.status === "pending").length;

  function handleRevoke() {
    if (!revoking) return;
    setRevokeError(null);
    startRevokeTransition(async () => {
      const result = await revokeInvitation(revoking.id);
      if (result.status === "success") {
        setRevoking(null);
        router.refresh();
      } else {
        setRevokeError(result.error ?? t.revokeError);
      }
    });
  }

  async function handleResend(invitation: EmployeeInvitationRow) {
    setResendingId(invitation.id);
    setResendSuccessId(null);
    try {
      const result = await resendInvitation(invitation.id);
      if (result.status === "success") {
        setResendSuccessId(invitation.id);
        router.refresh();
        setTimeout(() => setResendSuccessId(null), 3000);
      }
    } finally {
      setResendingId(null);
    }
  }

  return (
    <>
      <Card>
        <CardHeader className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <div className="flex items-center gap-2">
              <CardTitle>{t.invitationsTitle}</CardTitle>
              {pendingCount > 0 && (
                <Badge variant="secondary">
                  {t.pendingCount.replace("{count}", String(pendingCount))}
                </Badge>
              )}
            </div>
            <CardDescription>{t.invitationsDescription}</CardDescription>
          </div>

          {canManage && (
            <Button
              type="button"
              size="sm"
              onClick={onOpenInvite}
              className="gap-2 shrink-0"
            >
              <UserPlus className="size-4" />
              {tEmp?.inviteEmployee || t.inviteMember}
            </Button>
          )}
        </CardHeader>
        <CardContent>
          {invitations.length === 0 ? (
            <div className="flex flex-col items-center justify-center rounded-lg border border-dashed py-12 text-center">
              <Mail className="size-10 text-muted-foreground" />
              <p className="mt-3 text-sm font-medium">{t.emptyInvitations}</p>
              <p className="mt-1 text-xs text-muted-foreground">
                {canManage
                  ? t.emptyInvitationsHintManage
                  : t.emptyInvitationsHintView}
              </p>
            </div>
          ) : (
            <div className="rounded-md border">
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
                              <InviteLinkButton
                                token={invitation.token}
                                platform={platform}
                              />
                              {canManage && (
                                <>
                                  <Button
                                    type="button"
                                    variant="ghost"
                                    size="sm"
                                    onClick={() => handleResend(invitation)}
                                    disabled={resendingId === invitation.id}
                                    title="Resend invitation link"
                                  >
                                    {resendSuccessId === invitation.id ? (
                                      <Check className="size-3.5 text-emerald-600" />
                                    ) : (
                                      <RefreshCw
                                        className={`size-3.5 ${
                                          resendingId === invitation.id
                                            ? "animate-spin"
                                            : ""
                                        }`}
                                      />
                                    )}
                                    <span className="hidden sm:inline">
                                      {resendSuccessId === invitation.id
                                        ? platform.common.copied || "Sent"
                                        : tEmp?.resendInvite || "Resend"}
                                    </span>
                                  </Button>
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
                                    <Trash2 className="size-3.5" />
                                    <span className="hidden sm:inline">
                                      {platform.common.revoke}
                                    </span>
                                  </Button>
                                </>
                              )}
                            </>
                          )}
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>

      {revoking && (
        <RevokeEmployeeInvitationDialog
          invitation={revoking}
          error={revokeError}
          isPending={isRevoking}
          onCancel={() => setRevoking(null)}
          onConfirm={handleRevoke}
          platform={platform}
        />
      )}
    </>
  );
}

