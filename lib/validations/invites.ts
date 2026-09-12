import { z } from "zod";
import type { ComponentProps } from "react";
import type { Badge } from "@/components/ui/badge";

/**
 * Zod schema + shared types for the Member Invitations tab.
 *
 * i18n: validation messages are parameterized through
 * `createInvitationSchema(messages)` so the invite dialog and the server
 * action can pass localized messages from the active dictionary. The
 * exported `invitationSchema` keeps the English defaults as a fallback.
 */

/** Localized string messages consumed by the invitation schema. */
export interface InviteValidationMessages {
  emailInvalid: string;
  selectRole: string;
  selectValidRole: string;
  selectValidDepartment: string;
}

export const DEFAULT_INVITE_VALIDATION_MESSAGES: InviteValidationMessages = {
  emailInvalid: "Enter a valid email address.",
  selectRole: "Select a role.",
  selectValidRole: "Select a valid role.",
  selectValidDepartment: "Select a valid department.",
};

export function createInvitationSchema(
  messages: InviteValidationMessages = DEFAULT_INVITE_VALIDATION_MESSAGES
) {
  return z.object({
    email: z.string().trim().email(messages.emailInvalid),
    role_id: z
      .string()
      .trim()
      .min(1, messages.selectRole)
      .uuid(messages.selectValidRole),
    // "none" is the sentinel value used by the Radix Select for "no department".
    department_id: z
      .string()
      .trim()
      .refine(
        (value) =>
          value === "" ||
          value === "none" ||
          z.string().uuid().safeParse(value).success,
        messages.selectValidDepartment
      )
      .optional(),
  });
}

export const invitationSchema = createInvitationSchema();

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