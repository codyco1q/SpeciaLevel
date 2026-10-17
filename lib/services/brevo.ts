import "server-only";

export interface SendInvitationEmailParams {
  recipientEmail: string;
  inviteUrl: string;
  organizationName?: string;
  roleName?: string;
  inviterName?: string;
  inviterEmail?: string;
}

export interface BrevoSendResult {
  success: boolean;
  messageId?: string;
  error?: string;
}

function escapeHtml(str: string): string {
  return str
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}

function buildInvitationEmailHtml({
  organizationName,
  roleName,
  inviterName,
  inviterEmail,
  recipientEmail,
  inviteUrl,
}: {
  organizationName: string;
  roleName: string;
  inviterName: string;
  inviterEmail?: string;
  recipientEmail: string;
  inviteUrl: string;
}): string {
  const safeOrg = escapeHtml(organizationName);
  const safeRole = escapeHtml(roleName);
  const safeInviter = escapeHtml(inviterName);
  const safeEmail = escapeHtml(recipientEmail);
  const safeUrl = escapeHtml(inviteUrl);
  const inviterDisplay =
    inviterEmail && inviterEmail !== inviterName
      ? `${safeInviter} (${escapeHtml(inviterEmail)})`
      : safeInviter;

  return `<!DOCTYPE html>
<html>
<head>
<meta charset="utf-8">
<title>Invitation to join ${safeOrg}</title>
</head>
<body style="margin:0;padding:0;background-color:#090d16;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;color:#f8fafc;line-height:1.6;">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background-color:#090d16;padding:36px 16px;">
    <tr><td align="center">
      <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:560px;background-color:#111827;border-radius:16px;border:1px solid #1f2937;overflow:hidden;box-shadow:0 10px 25px -5px rgba(0,0,0,0.5);">
        <tr><td style="height:4px;background:linear-gradient(90deg,#6366f1 0%,#8b5cf6 50%,#ec4899 100%);">&nbsp;</td></tr>
        <tr><td style="padding:28px 36px 12px 36px;">
          <table role="presentation" cellpadding="0" cellspacing="0"><tr>
            <td style="vertical-align:middle;">
              <div style="width:36px;height:36px;border-radius:10px;background:linear-gradient(135deg,#6366f1 0%,#8b5cf6 50%,#d946ef 100%);text-align:center;line-height:36px;color:#ffffff;font-weight:800;font-size:14px;">SL</div>
            </td>
            <td style="vertical-align:middle;padding-left:12px;">
              <span style="font-size:18px;font-weight:700;color:#ffffff;">SpeciaLevel</span>
            </td>
          </tr></table>
        </td></tr>
        <tr><td style="padding:12px 36px 32px 36px;">
          <h1 style="margin:0 0 16px 0;font-size:22px;font-weight:700;color:#ffffff;line-height:1.3;">
            You've been invited to join <span style="color:#a5b4fc;">${safeOrg}</span>
          </h1>
          <p style="margin:0 0 24px 0;font-size:15px;color:#94a3b8;line-height:1.6;">
            <strong style="color:#e2e8f0;">${safeInviter}</strong> has invited you to join <strong style="color:#e2e8f0;">${safeOrg}</strong> as a <strong style="color:#818cf8;">${safeRole}</strong> on SpeciaLevel.
          </p>
          <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin-bottom:28px;background-color:#1a2234;border-radius:12px;border:1px solid #2d3748;">
            <tr><td style="padding:16px 20px;">
              <table role="presentation" width="100%" cellpadding="0" cellspacing="0">
                <tr><td style="padding:5px 0;font-size:13px;color:#94a3b8;width:120px;">Workspace</td><td style="padding:5px 0;font-size:14px;color:#f1f5f9;font-weight:600;">${safeOrg}</td></tr>
                <tr><td style="padding:5px 0;font-size:13px;color:#94a3b8;">Role</td><td style="padding:5px 0;font-size:14px;color:#a5b4fc;font-weight:600;">${safeRole}</td></tr>
                <tr><td style="padding:5px 0;font-size:13px;color:#94a3b8;">Invited By</td><td style="padding:5px 0;font-size:14px;color:#e2e8f0;">${inviterDisplay}</td></tr>
                <tr><td style="padding:5px 0;font-size:13px;color:#94a3b8;">Email</td><td style="padding:5px 0;font-size:14px;color:#e2e8f0;">${safeEmail}</td></tr>
              </table>
            </td></tr>
          </table>
          <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin-bottom:24px;">
            <tr><td align="center">
              <a href="${safeUrl}" target="_blank" rel="noopener noreferrer" style="display:inline-block;background-color:#6366f1;background-image:linear-gradient(135deg,#6366f1 0%,#7c3aed 100%);color:#ffffff;text-decoration:none;font-size:15px;font-weight:600;padding:14px 36px;border-radius:10px;box-shadow:0 4px 14px rgba(99,102,241,0.4);text-align:center;">
                Accept Invitation &rarr;
              </a>
            </td></tr>
          </table>
          <p style="margin:0 0 20px 0;font-size:13px;color:#94a3b8;text-align:center;">This invitation link is valid for <strong style="color:#cbd5e1;">7 days</strong>.</p>
          <div style="margin-top:20px;padding-top:16px;border-top:1px solid #1f2937;font-size:12px;color:#64748b;line-height:1.6;word-break:break-all;">
            Button not working? Copy and paste this link into your browser:<br>
            <a href="${safeUrl}" style="color:#818cf8;text-decoration:underline;">${safeUrl}</a>
          </div>
        </td></tr>
        <tr><td style="padding:20px 36px;background-color:#0b0f19;border-top:1px solid #1f2937;text-align:center;font-size:12px;color:#64748b;">
          <p style="margin:0 0 4px 0;">This email was sent to ${safeEmail} because an administrator invited you to SpeciaLevel.</p>
          <p style="margin:0;">If you were not expecting this invitation, you can safely ignore this email.</p>
        </td></tr>
      </table>
    </td></tr>
  </table>
</body>
</html>`;
}

function buildInvitationEmailText({
  organizationName,
  roleName,
  inviterName,
  inviteUrl,
}: {
  organizationName: string;
  roleName: string;
  inviterName: string;
  inviteUrl: string;
}): string {
  return `You've been invited to join ${organizationName}!

${inviterName} has invited you to join the ${organizationName} team as a ${roleName} on SpeciaLevel.

Click the link below to accept your invitation, confirm your details, and set up your account:
${inviteUrl}

This invitation link is valid for 7 days.

If you weren't expecting this invitation, please ignore this email.

---
Sent by SpeciaLevel
`;
}

/**
 * Dispatches an automated transactional employee invitation email using Brevo's REST API.
 * Reads BREVO_API_KEY and BREVO_SENDER_EMAIL from environment variables.
 * Gracefully logs failures without throwing exceptions.
 */
export async function sendInvitationEmailViaBrevo({
  recipientEmail,
  inviteUrl,
  organizationName,
  roleName,
  inviterName,
  inviterEmail,
}: SendInvitationEmailParams): Promise<BrevoSendResult> {
  const apiKey = process.env.BREVO_API_KEY;
  const senderEmail = process.env.BREVO_SENDER_EMAIL;

  if (!apiKey || !senderEmail) {
    console.warn(
      "[brevo] BREVO_API_KEY or BREVO_SENDER_EMAIL is not configured. Transactional email dispatch skipped.",
      { hasApiKey: Boolean(apiKey), hasSenderEmail: Boolean(senderEmail) }
    );
    return {
      success: false,
      error: "Brevo credentials not configured",
    };
  }

  const effectiveOrgName = (organizationName || "").trim() || "SpeciaLevel Workspace";
  const effectiveRoleName = (roleName || "").trim() || "Team Member";
  const effectiveInviterName = (inviterName || "").trim() || "An administrator";

  const subject = `You've been invited to join ${effectiveOrgName}`;
  const senderName = effectiveOrgName
    ? `${effectiveOrgName} (via SpeciaLevel)`
    : "SpeciaLevel";

  const htmlContent = buildInvitationEmailHtml({
    organizationName: effectiveOrgName,
    roleName: effectiveRoleName,
    inviterName: effectiveInviterName,
    inviterEmail,
    recipientEmail,
    inviteUrl,
  });

  const textContent = buildInvitationEmailText({
    organizationName: effectiveOrgName,
    roleName: effectiveRoleName,
    inviterName: effectiveInviterName,
    inviteUrl,
  });

  const payload = {
    sender: {
      name: senderName,
      email: senderEmail,
    },
    to: [
      {
        email: recipientEmail,
      },
    ],
    subject,
    htmlContent,
    textContent,
  };

  try {
    const res = await fetch("https://api.brevo.com/v3/smtp/email", {
      method: "POST",
      headers: {
        accept: "application/json",
        "content-type": "application/json",
        "api-key": apiKey,
      },
      body: JSON.stringify(payload),
    });

    if (!res.ok) {
      let errorDetail = "";
      try {
        const errorJson = await res.json();
        errorDetail = JSON.stringify(errorJson);
      } catch {
        errorDetail = await res.text();
      }
      console.error(
        `[brevo] Transactional email delivery failed with status ${res.status}:`,
        errorDetail
      );
      return {
        success: false,
        error: `Brevo API error (${res.status}): ${errorDetail}`,
      };
    }

    const data = (await res.json().catch(() => ({}))) as { messageId?: string };
    console.log(
      `[brevo] Invitation email successfully dispatched to ${recipientEmail} for ${effectiveOrgName} (messageId: ${data.messageId})`
    );

    return {
      success: true,
      messageId: data.messageId,
    };
  } catch (error) {
    console.error("[brevo] Unexpected error during email dispatch:", error);
    return {
      success: false,
      error: error instanceof Error ? error.message : String(error),
    };
  }
}

