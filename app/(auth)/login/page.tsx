"use client";

import { Suspense, useEffect, useState } from "react";
import { createBrowserClient } from "@/lib/supabase/client";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import { acceptInvitation } from "@/lib/actions/invites";
import {
  checkAccountPendingStatus,
  handleInitialEmployeeLogin,
  type AccountPendingStatusResult,
} from "@/lib/actions/employees";
import { Monogram } from "@/components/brand";
import { PENDING_INVITE_STORAGE_KEY } from "@/lib/validations/invites";
import { CheckCircle2, Sparkles, ArrowRight } from "lucide-react";

function LoginForm() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [fullName, setFullName] = useState("");
  const [pendingStatus, setPendingStatus] =
    useState<AccountPendingStatusResult | null>(null);
  const [isCheckingAccount, setIsCheckingAccount] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const router = useRouter();
  const searchParams = useSearchParams();

  // If a token was provided in the query string, direct immediately to the dedicated accept page.
  useEffect(() => {
    const token = searchParams.get("token");
    if (token && token.trim()) {
      router.replace(`/accept-invite?token=${encodeURIComponent(token.trim())}`);
    }
  }, [searchParams, router]);

  // Proactively check if this email is an invited or directly added user without a password
  useEffect(() => {
    const cleanEmail = email.trim().toLowerCase();
    if (!cleanEmail || !cleanEmail.includes("@") || !cleanEmail.includes(".")) {
      setPendingStatus(null);
      return;
    }

    let active = true;
    const timeout = setTimeout(async () => {
      setIsCheckingAccount(true);
      try {
        const result = await checkAccountPendingStatus(cleanEmail);
        if (active) {
          if (result.status === "pending_invite") {
            setPendingStatus(result);
            if (result.suggestedName && !fullName) {
              setFullName(result.suggestedName);
            }
          } else if (result.status === "needs_password_setup") {
            setPendingStatus(result);
            if (result.fullName && !fullName) {
              setFullName(result.fullName);
            }
          } else {
            setPendingStatus(null);
          }
        }
      } catch {
        if (active) setPendingStatus(null);
      } finally {
        if (active) setIsCheckingAccount(false);
      }
    }, 400);

    return () => {
      active = false;
      clearTimeout(timeout);
    };
  }, [email, fullName]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);

    const cleanEmail = email.trim().toLowerCase();
    if (!cleanEmail) {
      setError("Please enter your email address.");
      return;
    }

    if (pendingStatus && pendingStatus.status !== "normal" && password.length < 8) {
      setError("Your password must be at least 8 characters.");
      return;
    }

    setLoading(true);

    try {
      const supabase = createBrowserClient();

      // First try standard password sign-in
      const { error: signInError } = await supabase.auth.signInWithPassword({
        email: cleanEmail,
        password,
      });

      if (signInError) {
        // If credentials failed, check if this is an invited user or directly added employee
        // who needs their initial chosen password registered.
        const initialResult = await handleInitialEmployeeLogin({
          email: cleanEmail,
          password,
          fullName: fullName.trim() || undefined,
        });

        if (initialResult.status === "registered") {
          const retry = await supabase.auth.signInWithPassword({
            email: cleanEmail,
            password,
          });
          if (retry.error) {
            setError(retry.error.message);
            return;
          }
        } else if (initialResult.status === "error") {
          setError(initialResult.error);
          return;
        } else {
          setError(signInError.message);
          return;
        }
      }

      // If the user signed up through an invitation link and then confirmed
      // their email, the pending token is waiting in sessionStorage —
      // finalize the invite now that they are authenticated.
      const pendingInviteToken = sessionStorage.getItem(
        PENDING_INVITE_STORAGE_KEY
      );
      if (pendingInviteToken) {
        const result = await acceptInvitation(pendingInviteToken);
        sessionStorage.removeItem(PENDING_INVITE_STORAGE_KEY);
        if (result.status === "success") {
          // Invited members skip onboarding — land straight on the dashboard.
          router.refresh();
          router.push("/dashboard");
          return;
        }
        // Token expired/revoked/wrong email — fall through to the normal flow.
      }

      // Session cookies are written by the SSR browser client before this
      // resolves, so refresh first (server re-reads the session from
      // cookies) and then navigate. /dashboard's layout forwards users
      // with no organization on to /onboarding.
      router.refresh();
      router.push("/dashboard");
    } catch (err) {
      // Misconfiguration (missing env vars) or network failure — show it
      // instead of hanging on the loading state forever.
      setError(
        err instanceof Error
          ? err.message
          : "Could not sign you in. Please try again."
      );
    } finally {
      setLoading(false);
    }
  }

  const isInvite = pendingStatus?.status === "pending_invite";
  const isSetup = pendingStatus?.status === "needs_password_setup";
  const isFirstTimeUser = isInvite || isSetup;

  return (
    <div className="flex min-h-screen items-center justify-center bg-muted/40 px-4">
      <div className="w-full max-w-md">
        <div className="mb-8 text-center">
          <Monogram className="mx-auto mb-4 size-12 rounded-xl" />
          <h1 className="text-2xl font-bold">
            {isFirstTimeUser ? "Set Up Your Account" : "Welcome back"}
          </h1>
          <p className="mt-1 text-sm text-muted-foreground">
            {isInvite
              ? `You've been invited to ${pendingStatus.organizationName}`
              : isSetup
              ? `Activate your account for ${pendingStatus.organizationName}`
              : "Sign in to your SpeciaLevel workspace"}
          </p>
        </div>

        <form
          onSubmit={handleSubmit}
          className="space-y-4 rounded-xl border border-border bg-card p-6 shadow-sm"
        >
          {isInvite && (
            <div className="rounded-lg border border-primary/20 bg-primary/5 p-3.5 text-sm">
              <div className="flex items-start gap-2.5">
                <Sparkles className="mt-0.5 size-4 shrink-0 text-primary" />
                <div className="space-y-1">
                  <p className="font-medium text-foreground">
                    Invitation Found
                  </p>
                  <p className="text-xs text-muted-foreground leading-relaxed">
                    You have a pending invite to join{" "}
                    <strong className="text-foreground">
                      {pendingStatus.organizationName}
                    </strong>{" "}
                    as <strong>{pendingStatus.roleName}</strong>. Choose a
                    password below to enter your workspace.
                  </p>
                  <Link
                    href={`/accept-invite?token=${pendingStatus.token}`}
                    className="inline-flex items-center gap-1 text-xs font-medium text-primary hover:underline pt-0.5"
                  >
                    Open dedicated invitation page
                    <ArrowRight className="size-3" />
                  </Link>
                </div>
              </div>
            </div>
          )}

          {isSetup && (
            <div className="rounded-lg border border-primary/20 bg-primary/5 p-3.5 text-sm">
              <div className="flex items-start gap-2.5">
                <CheckCircle2 className="mt-0.5 size-4 shrink-0 text-primary" />
                <div className="space-y-1">
                  <p className="font-medium text-foreground">
                    Direct Workspace Access
                  </p>
                  <p className="text-xs text-muted-foreground leading-relaxed">
                    Your account has been added to{" "}
                    <strong className="text-foreground">
                      {pendingStatus.organizationName}
                    </strong>
                    . Create your password to sign in immediately.
                  </p>
                </div>
              </div>
            </div>
          )}

          {isInvite && (
            <div className="space-y-2">
              <label htmlFor="fullName" className="text-sm font-medium">
                Full Name
              </label>
              <input
                id="fullName"
                type="text"
                placeholder="Jane Smith"
                value={fullName}
                onChange={(e) => setFullName(e.target.value)}
                autoComplete="name"
                className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
              />
            </div>
          )}

          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <label htmlFor="email" className="text-sm font-medium">
                Email
              </label>
              {isCheckingAccount && (
                <span className="text-xs text-muted-foreground animate-pulse">
                  Checking account…
                </span>
              )}
            </div>
            <input
              id="email"
              type="email"
              placeholder="you@company.com"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              autoComplete="email"
              className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            />
          </div>

          <div className="space-y-2">
            <label htmlFor="password" className="text-sm font-medium">
              {isFirstTimeUser ? "Choose Password" : "Password"}
            </label>
            <input
              id="password"
              type="password"
              placeholder={isFirstTimeUser ? "At least 8 characters" : "••••••••"}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              minLength={isFirstTimeUser ? 8 : undefined}
              autoComplete={isFirstTimeUser ? "new-password" : "current-password"}
              className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            />
            <p className="text-xs text-muted-foreground">
              {isFirstTimeUser
                ? "Must be at least 8 characters long."
                : "Directly added and invited employees can set their password on their first login."}
            </p>
          </div>

          {error && (
            <p role="alert" className="text-sm text-destructive">
              {error}
            </p>
          )}

          <button
            type="submit"
            disabled={loading}
            className="inline-flex h-10 w-full items-center justify-center rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/90 disabled:opacity-50"
          >
            {loading
              ? isFirstTimeUser
                ? "Setting up account…"
                : "Signing in…"
              : isFirstTimeUser
              ? "Set password & enter workspace"
              : "Sign in"}
          </button>

          <p className="text-center text-sm text-muted-foreground">
            Don&apos;t have an account?{" "}
            <Link
              href="/signup"
              className="font-medium text-primary hover:underline"
            >
              Sign up
            </Link>
          </p>
        </form>
      </div>
    </div>
  );
}

export default function LoginPage() {
  return (
    <Suspense
      fallback={
        <div className="flex min-h-screen items-center justify-center bg-muted/40 px-4">
          <div className="w-full max-w-md text-center">
            <Monogram className="mx-auto mb-4 size-12 rounded-xl" />
          </div>
        </div>
      }
    >
      <LoginForm />
    </Suspense>
  );
}
