"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Monogram } from "@/components/brand";
import { acceptInvitation } from "@/lib/actions/invites";
import { createBrowserClient } from "@/lib/supabase/client";
import type { InvitationDetails } from "@/lib/validations/invites";

interface AcceptInviteClientProps {
  token?: string;
  invitation?: InvitationDetails | null;
  inviteError?: string | null;
}

export function AcceptInviteClient({
  token,
  invitation,
  inviteError,
}: AcceptInviteClientProps) {
  const [fullName, setFullName] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [isLoggedIn, setIsLoggedIn] = useState<boolean | null>(null);
  const [sessionEmail, setSessionEmail] = useState<string | null>(null);
  const router = useRouter();

  useEffect(() => {
    if (token) {
      sessionStorage.setItem("uplevel.pendingInviteToken", token);
    }
  }, [token]);

  useEffect(() => {
    let cancelled = false;
    async function checkSession() {
      try {
        const supabase = createBrowserClient();
        const { data: { user } } = await supabase.auth.getUser();
        if (cancelled) return;
        setIsLoggedIn(Boolean(user));
        setSessionEmail(user?.email ?? null);
      } catch {
        if (!cancelled) setIsLoggedIn(false);
      }
    }
    checkSession();
    return () => { cancelled = true; };
  }, []);

  async function handleJoin() {
    if (!token || !invitation) return;
    setError(null);
    setLoading(true);
    try {
      const result = await acceptInvitation(token);
      if (result.status === "success") {
        router.refresh();
        router.push("/dashboard");
        return;
      }
      setError(result.error ?? "Could not accept the invitation.");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not accept the invitation.");
    } finally {
      setLoading(false);
    }
  }

  async function handleSignUpAndJoin(e: React.FormEvent) {
    e.preventDefault();
    if (!token || !invitation) return;
    setError(null);
    setNotice(null);
    setLoading(true);
    try {
      const supabase = createBrowserClient();
      const { data, error: signUpError } = await supabase.auth.signUp({
        email: invitation.email.toLowerCase(),
        password,
        options: { data: { full_name: fullName } },
      });
      if (signUpError) {
        if (/already registered/i.test(signUpError.message)) {
          setError("This email is already registered. Sign in below, then revisit this link.");
        } else {
          setError(signUpError.message);
        }
        return;
      }
      if (!data.session) {
        setNotice("Account created! Check your inbox to confirm your email, then sign in and revisit this link.");
        return;
      }
      const result = await acceptInvitation(token, fullName);
      if (result.status !== "success") {
        setError(result.error ?? "Could not complete your invitation.");
        return;
      }
      router.refresh();
      router.push("/dashboard");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not sign you up.");
    } finally {
      setLoading(false);
    }
  }

  if (inviteError || !invitation) {
    return (
      <ErrorState inviteError={inviteError} />
    );
  }

  if (isLoggedIn === null) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-muted/40 px-4">
        <div className="w-full max-w-md text-center">
          <Monogram className="mx-auto mb-4 size-12 rounded-xl" />
          <p className="text-sm text-muted-foreground">Loading…</p>
        </div>
      </div>
    );
  }

  if (isLoggedIn) {
    return (
      <JoinState
        invitation={invitation}
        sessionEmail={sessionEmail}
        error={error}
        loading={loading}
        onJoin={handleJoin}
      />
    );
  }

  return (
    <SignUpState
      invitation={invitation}
      fullName={fullName}
      setFullName={setFullName}
      password={password}
      setPassword={setPassword}
      error={error}
      notice={notice}
      loading={loading}
      onSubmit={handleSignUpAndJoin}
    />
  );
}

function ErrorState({ inviteError }: { inviteError?: string | null }) {
  return (
    <div className="flex min-h-screen items-center justify-center bg-muted/40 px-4">
      <div className="w-full max-w-md">
        <div className="mb-8 text-center">
          <Monogram className="mx-auto mb-4 size-12 rounded-xl" />
          <h1 className="text-2xl font-bold">Invitation</h1>
        </div>
        <Card className="shadow-sm">
          <CardContent className="space-y-4 pt-6">
            <p className="text-sm text-destructive">
              {inviteError ?? "This invitation link is invalid or has expired."}
            </p>
            <div className="flex flex-col gap-2">
              <Button asChild variant="outline" className="w-full">
                <Link href="/login">Sign in</Link>
              </Button>
              <Button asChild variant="ghost" className="w-full">
                <Link href="/signup">Create a new account</Link>
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}


function JoinState({
  invitation,
  sessionEmail,
  error,
  loading,
  onJoin,
}: {
  invitation: InvitationDetails;
  sessionEmail: string | null;
  error: string | null;
  loading: boolean;
  onJoin: () => void;
}) {
  const emailMismatch =
    sessionEmail &&
    sessionEmail.toLowerCase() !== invitation.email.toLowerCase();

  return (
    <div className="flex min-h-screen items-center justify-center bg-muted/40 px-4">
      <div className="w-full max-w-md">
        <div className="mb-8 text-center">
          <Monogram className="mx-auto mb-4 size-12 rounded-xl" />
          <h1 className="text-2xl font-bold">
            Join {invitation.organizationName}
          </h1>
          <p className="mt-1 text-sm text-muted-foreground">
            You&apos;ve been invited to join as{" "}
            <span className="font-medium text-foreground">
              {invitation.roleName}
            </span>
          </p>
        </div>
        <Card className="shadow-sm">
          <CardContent className="space-y-4 pt-6">
            <div className="flex flex-wrap items-center gap-2 rounded-lg bg-muted/50 px-3 py-2 text-sm">
              <span className="text-muted-foreground">Role:</span>
              <Badge variant="secondary">{invitation.roleName}</Badge>
              {invitation.departmentName && (
                <Badge variant="outline">{invitation.departmentName}</Badge>
              )}
            </div>
            {emailMismatch && (
              <p className="text-sm text-destructive">
                This invitation was sent to{" "}
                <span className="font-medium">{invitation.email}</span> but
                you&apos;re signed in as{" "}
                <span className="font-medium">{sessionEmail}</span>. Please
                sign out and sign in with the correct account.
              </p>
            )}
            {error && (
              <p role="alert" className="text-sm text-destructive">{error}</p>
            )}
            <Button
              onClick={onJoin}
              disabled={loading || Boolean(emailMismatch)}
              className="w-full"
              size="lg"
            >
              {loading ? "Joining…" : `Join ${invitation.organizationName}`}
            </Button>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}


function SignUpState({
  invitation,
  fullName,
  setFullName,
  password,
  setPassword,
  error,
  notice,
  loading,
  onSubmit,
}: {
  invitation: InvitationDetails;
  fullName: string;
  setFullName: (v: string) => void;
  password: string;
  setPassword: (v: string) => void;
  error: string | null;
  notice: string | null;
  loading: boolean;
  onSubmit: (e: React.FormEvent) => void;
}) {
  return (
    <div className="flex min-h-screen items-center justify-center bg-muted/40 px-4">
      <div className="w-full max-w-md">
        <div className="mb-8 text-center">
          <Monogram className="mx-auto mb-4 size-12 rounded-xl" />
          <h1 className="text-2xl font-bold">Accept Invitation</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Join{" "}
            <span className="font-medium text-foreground">
              {invitation.organizationName}
            </span>
          </p>
        </div>
        <Card className="shadow-sm">
          <CardContent className="pt-6">
            <form onSubmit={onSubmit} noValidate className="space-y-4">
              <div className="flex flex-wrap items-center gap-2 rounded-lg bg-muted/50 px-3 py-2 text-sm">
                <span className="text-muted-foreground">
                  You&apos;ll join as{" "}
                  <span className="font-medium text-foreground">
                    {invitation.roleName}
                  </span>
                </span>
                {invitation.departmentName && (
                  <Badge variant="outline">{invitation.departmentName}</Badge>
                )}
              </div>
              <div className="space-y-2">
                <Label htmlFor="fullName">Full Name</Label>
                <Input
                  id="fullName"
                  type="text"
                  placeholder="Jane Smith"
                  value={fullName}
                  onChange={(e) => setFullName(e.target.value)}
                  autoComplete="name"
                  required
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="email">Email</Label>
                <Input
                  id="email"
                  type="email"
                  value={invitation.email}
                  disabled
                  autoComplete="email"
                />
                <p className="text-xs text-muted-foreground">
                  Set by your invitation and can&apos;t be changed.
                </p>
              </div>
              <div className="space-y-2">
                <Label htmlFor="password">Password</Label>
                <Input
                  id="password"
                  type="password"
                  placeholder="At least 8 characters"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  autoComplete="new-password"
                  required
                  minLength={8}
                />
              </div>
              {error && (
                <p role="alert" className="text-sm text-destructive">
                  {error}
                </p>
              )}
              {notice && (
                <p
                  role="status"
                  className="rounded-md border border-border bg-muted/60 px-3 py-2 text-sm"
                >
                  {notice}
                </p>
              )}
              <Button
                type="submit"
                disabled={loading}
                className="w-full"
                size="lg"
              >
                {loading ? "Creating account…" : "Create account & join"}
              </Button>
              <p className="text-center text-sm text-muted-foreground">
                Already have an account?{" "}
                <Link
                  href="/login"
                  className="font-medium text-primary hover:underline"
                >
                  Sign in to accept your invitation
                </Link>
              </p>
            </form>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

