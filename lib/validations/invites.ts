import { z } from "zod";
import type { ComponentProps } from "react";
import type { Badge } from "@/components/ui/badge";

/**
 * Zod schema + shared types for the Member Invitations tab.
 */

export const invitationSchema = z.object({
  email: z.string().trim().email("Enter a valid email address."),
  role_id: z
    .string()
    .trim()
    .min(1, "Select a role.")
    .uuid("Select a valid role."),
  // "none" is the sentinel value used by the Radix Select for "no department".
  department_id: z
    .string()
    .trim()
    .refine(
      (value) =>
        value === "" ||
        value === "none" ||
        z.string().uuid().safeParse(value).success,
      "Select a valid department."
    )
    .optional(),
});

export type InvitationFormValues = z.infer<typeof invitationSchema>;

export interface InviteActionState {
  status: "idle" | "success" | "error";
  error?: string | null;
  fieldErrors?: Record<string, string[] | undefined>;
}

export const initialInviteActionState: InviteActionState = {
  status: "idle",
};

export const INVITATION_STATUS_LABELS: Record<string, string> = {
  pending: "Pending",
  accepted: "Accepted",
  revoked: "Revoked",
  expired: "Expired",
};

export const INVITATION_STATUS_BADGE_VARIANTS: Record<
  string,
  ComponentProps<typeof Badge>["variant"]
> = {
  pending: "secondary",
  accepted: "default",
  revoked: "outline",
  expired: "destructive",
};

// ---------------------------------------------------------------------------
// Public invite acceptance (signup?invite=<token>)
// ---------------------------------------------------------------------------

/**
 * Browser-storage key for a pending invite token. Saved during invite-aware
 * sign-up and consumed by the login page after the user confirms their email
 * and signs in, so the invite can still be finalized without a session.
 */
export const PENDING_INVITE_STORAGE_KEY = "uplevel.pendingInviteToken";

/** Public invite context rendered by the sign-up page for a valid token. */
export interface InvitationDetails {
  token: string;
  email: string;
  organizationName: string;
  roleName: string;
  departmentName: string | null;
  expiresAt: string;
}

export type InvitationLookupResult =
  | { status: "valid"; invitation: InvitationDetails }
  | { status: "expired" }
  | { status: "revoked" }
  | { status: "accepted" }
  | { status: "not_found" };

export type AcceptInvitationResult =
  | { status: "success" }
  | { status: "error"; error: string };