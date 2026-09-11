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
import type { InvitationRow } from "./page";
import {
  INVITATION_STATUS_BADGE_VARIANTS,
  INVITATION_STATUS_LABELS,
} from "@/lib/validations/invites";
import { InviteMemberDialog } from "./invite-member-dialog";
import { RevokeInvitationDialog } from "./revoke-invitation-dialog";

interface InvitationsTabProps {
  invitations: InvitationRow[];
  roles: { id: string; name: string; isSystem: boolean }[];
  departments: { id: string; name: string }[];
  canManage: boolean;
}

function formatDate(value: string): string {
  return new Intl.DateTimeFormat(undefined, {
    month: "short",
    day: "numeric",
    year: "numeric",
  }).format(new Date(value));
}

function InviteLinkButton({ token }: { token: string }) {
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
      title="Copy the signup link for this invitation"
    >
      {copied ? <Check /> : <Copy />}
      {copied ? "Copied" : "Copy link"}
    </Button>
  );
}

export function InvitationsTab({
  invitations,
  roles,
  departments,
  canManage,
}: InvitationsTabProps) {
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
        setRevokeError(result.error ?? "Could not revoke the invitation.");
      }
    });
  }

  return (
<>
      <Card>
        <CardHeader className="flex flex-row flex-wrap items-start justify-between gap-4">
          <div>
            <CardTitle className="flex items-center gap-2">
              Member Invitations
              {pendingCount > 0 && (
                <Badge variant="secondary">{pendingCount} pending</Badge>
              )}
            </CardTitle>
            <CardDescription>
              Invite teammates with a signup link. Invitations expire after 7
              days.
            </CardDescription>
          </div>
          {canManage && (
            <Button onClick={() => setInviteOpen(true)}>
              <UserPlus />
              Invite member
            </Button>
          )}
        </CardHeader>
        <CardContent>
          {invitations.length === 0 ? (
            <div className="flex flex-col items-center justify-center gap-2 rounded-lg border border-dashed px-6 py-12 text-center">
              <Mail className="size-6 text-muted-foreground" />
              <p className="text-sm font-medium">No invitations yet</p>
              <p className="text-sm text-muted-foreground">
                {canManage
                  ? "Invite your first teammate to get started."
                  : "Invitations sent by your organization will appear here."}
              </p>
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Email</TableHead>
                  <TableHead>Role</TableHead>
                  <TableHead>Department</TableHead>
                  <TableHead>Sent</TableHead>
                  <TableHead>Expiration</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
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
                      {formatDate(invitation.createdAt)}
                    </TableCell>
                    <TableCell className="text-muted-foreground">
                      {formatDate(invitation.expiresAt)}
                    </TableCell>
                    <TableCell>
                      <Badge
                        variant={
                          INVITATION_STATUS_BADGE_VARIANTS[
                            invitation.status
                          ] ?? "secondary"
                        }
                      >
                        {INVITATION_STATUS_LABELS[invitation.status] ??
                          invitation.status}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center justify-end gap-1">
                        {invitation.status === "pending" && (
                          <>
                            <InviteLinkButton token={invitation.token} />
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
                                Revoke
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
        />
      )}
      {canManage && (
        <InviteMemberDialog
          open={inviteOpen}
          onOpenChange={setInviteOpen}
          roles={roles}
          departments={departments}
        />
      )}
    </>
  );
}