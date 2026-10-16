import crypto from "crypto";
import { cookies } from "next/headers";

export const ADMIN_COOKIE_NAME = "specialevel_admin_session";
const SESSION_DURATION_SECONDS = 60 * 60 * 24 * 7; // 7 days

export function getAdminConfig() {
  const username = (
    process.env.ADMIN_USERNAME ||
    process.env.SUPER_ADMIN_USERNAME ||
    "admin"
  ).trim();

  const password = (
    process.env.ADMIN_PASSWORD ||
    process.env.SUPER_ADMIN_PASSWORD ||
    "admin"
  ).trim();

  const secret = (
    process.env.ADMIN_SESSION_SECRET ||
    process.env.SUPABASE_SERVICE_ROLE_KEY ||
    "specialevel-super-admin-internal-secret-2026"
  ).trim();

  return { username, password, secret };
}

/**
 * Constant-time comparison between two strings to mitigate timing attacks.
 */
function safeCompare(a: string, b: string): boolean {
  const bufA = Buffer.from(a);
  const bufB = Buffer.from(b);
  if (bufA.length !== bufB.length) {
    // Compare against itself to maintain constant time execution
    crypto.timingSafeEqual(bufA, bufA);
    return false;
  }
  return crypto.timingSafeEqual(bufA, bufB);
}

/**
 * Verifies admin credentials against environment variables.
 */
export function verifyAdminCredentials(
  inputUsername: unknown,
  inputPassword: unknown
): boolean {
  if (typeof inputUsername !== "string" || typeof inputPassword !== "string") {
    return false;
  }

  const { username, password } = getAdminConfig();
  const trimmedUser = inputUsername.trim();
  const trimmedPass = inputPassword.trim();

  if (!trimmedUser || !trimmedPass) {
    return false;
  }

  const userMatches = safeCompare(trimmedUser.toLowerCase(), username.toLowerCase());
  const passMatches = safeCompare(trimmedPass, password);

  return userMatches && passMatches;
}

/**
 * Creates an HMAC-SHA256 signed token for the admin session.
 */
export function createAdminToken(username: string): string {
  const { secret } = getAdminConfig();
  const now = Math.floor(Date.now() / 1000);
  const payload = {
    u: username,
    iat: now,
    exp: now + SESSION_DURATION_SECONDS,
  };

  const payloadB64 = Buffer.from(JSON.stringify(payload)).toString("base64url");
  const signature = crypto
    .createHmac("sha256", secret)
    .update(payloadB64)
    .digest("base64url");

  return `${payloadB64}.${signature}`;
}

/**
 * Verifies the validity and expiration of an admin session token.
 */
export function verifyAdminToken(token: string | undefined | null): {
  valid: boolean;
  username?: string;
} {
  if (!token || typeof token !== "string") {
    return { valid: false };
  }

  const parts = token.split(".");
  if (parts.length !== 2) {
    return { valid: false };
  }

  const [payloadB64, signature] = parts;
  const { secret } = getAdminConfig();

  const expectedSignature = crypto
    .createHmac("sha256", secret)
    .update(payloadB64)
    .digest("base64url");

  if (!safeCompare(signature, expectedSignature)) {
    return { valid: false };
  }

  try {
    const raw = Buffer.from(payloadB64, "base64url").toString("utf-8");
    const payload = JSON.parse(raw);
    const now = Math.floor(Date.now() / 1000);

    if (!payload || typeof payload !== "object") {
      return { valid: false };
    }

    if (typeof payload.exp === "number" && payload.exp < now) {
      return { valid: false };
    }

    return {
      valid: true,
      username: typeof payload.u === "string" ? payload.u : "admin",
    };
  } catch {
    return { valid: false };
  }
}

/**
 * Retrieves the current admin session from server cookies.
 */
export async function getAdminSession(): Promise<{
  isAuthenticated: boolean;
  username?: string;
}> {
  try {
    const cookieStore = await cookies();
    const token = cookieStore.get(ADMIN_COOKIE_NAME)?.value;
    const result = verifyAdminToken(token);
    if (!result.valid) {
      return { isAuthenticated: false };
    }
    return {
      isAuthenticated: true,
      username: result.username || "admin",
    };
  } catch {
    return { isAuthenticated: false };
  }
}

/**
 * Sets the admin session cookie.
 */
export async function setAdminSession(username: string): Promise<void> {
  const token = createAdminToken(username);
  const cookieStore = await cookies();
  cookieStore.set(ADMIN_COOKIE_NAME, token, {
    path: "/",
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    maxAge: SESSION_DURATION_SECONDS,
  });
}

/**
 * Clears the admin session cookie and any active support impersonation session.
 */
export async function clearAdminSession(): Promise<void> {
  const cookieStore = await cookies();
  cookieStore.delete(ADMIN_COOKIE_NAME);
  cookieStore.delete("impersonate_org_id");
}
