"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";

import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { acceptInvitation } from "@/lib/actions/invites";
import { createBrowserClient } from "@/lib/supabase/client";
import {
  PENDING_INVITE_STORAGE_KEY,
  type InvitationDetails,
} from "@/lib/validations/invites";

interface SignupFormProps {
  inviteToken?: string;
  invitation?: InvitationDetails | null;
  inviteError?: string | null;
}

export default function SignupForm({
  inviteToken,
  invitation,
  inviteError,
}: SignupFormProps) {
  const [fullName, setFullName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const router = useRouter();

  const joinedEmail = invitation?.email ?? email;

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setNotice(null);
    setLoading(true);

    try {
      // Persist the invite token before signing up so the invite can still be
      // finalized afterwards: after email confirmation + sign-in, or when the
      // email is already registered and the user signs in (login page).
      if (invitation) {
        sessionStorage.setItem(PENDING_INVITE_STORAGE_KEY, invitation.token);
      }

      const supabase = createBrowserClient();
      const { data, error: signUpError } = await supabase.auth.signUp({
        email: joinedEmail.toLowerCase(),
        password,
        options: {
          data: { full_name: fullName },
        },
      });

      if (signUpError) {
        if (invitation && /already registered/i.test(signUpError.message)) {
          setError(
            `${signUpError.message} Sign in and your invitation will be applied automatically.`
          );
        } else {
          setError(signUpError.message);
        }
        return;
      }

      // Email confirmation is enabled — no session yet. The pending token is
      // already in sessionStorage; the login page finalizes it after sign-in.
      if (!data.session) {
        setNotice(
          "Account created. Check your inbox to confirm your email, then sign in to accept your invitation."
        );
        return;
      }

      if (invitation) {
        const result = await acceptInvitation(invitation.token, fullName);
        sessionStorage.removeItem(PENDING_INVITE_STORAGE_KEY);
        if (result.status !== "success") {
          setError(
            result.error ??
              "Could not complete your invitation. Please try again."
          );
          return;
        }
        // Invited signups skip onboarding entirely — the profile now points
        // at the inviting org with the assigned role/permissions.
        router.refresh();
        router.push("/dashboard");
        return;
      }

      router.refresh();
      router.push("/onboarding");
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : "Could not create your account. Please try again."
      );
    } finally {
      setLoading(false);
    }
  }

  const submitLabel = loading
    ? "Creating account…"
    : invitation
      ? "Accept invitation"
      : "Create account";

  return (
    <div className="flex min-h-screen items-center justify-center bg-muted/40 px-4 py-8">
      <div className="w-full max-w-md">
        <div className="mb-8 text-center">
          <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-xl bg-primary text-primary-foreground">
            <span className="text-lg font-bold">UL</span>
          </div>
          {invitation ? (
            <>
              <h1 className="text-2xl font-bold">
                You&apos;ve been invited to join{" "}
                <span className="text-primary">
                  {invitation.organizationName}
                </span>
              </h1>
              <p className="mt-1 text-sm text-muted-foreground">
                Set up your password to accept the invitation
              </p>
            </>
          ) : (
            <>
              <h1 className="text-2xl font-bold">Create your account</h1>
              <p className="mt-1 text-sm text-muted-foreground">
                Join UpLevel and start your workspace
              </p>
            </>
          )}
        </div>

        {inviteToken && inviteError && (
          <div className="mb-4 space-y-3">
            <Alert variant="destructive">
              <AlertTitle>Invitation link not available</AlertTitle>
              <AlertDescription>
                {inviteError} If you need access, ask the person who invited you
                for a new link.
              </AlertDescription>
            </Alert>
            <Button asChild variant="outline" className="w-full">
              <Link href="/signup">Continue with standard sign-up</Link>
            </Button>
          </div>
        )}

        <Card className="shadow-sm">
          <CardContent>
            <form onSubmit={handleSubmit} noValidate className="space-y-4">
            {invitation && (
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
            )}

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
                placeholder="you@company.com"
                value={joinedEmail}
                onChange={(e) => setEmail(e.target.value)}
                disabled={Boolean(invitation)}
                autoComplete="email"
                required
              />
              {invitation && (
                <p className="text-xs text-muted-foreground">
                  Set by your invitation and can&apos;t be changed.
                </p>
              )}
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

            <Button type="submit" disabled={loading} className="w-full" size="lg">
              {submitLabel}
            </Button>

            <p className="text-center text-sm text-muted-foreground">
              Already have an account?{" "}
              <Link
                href="/login"
                className="font-medium text-primary hover:underline"
              >
                Sign in{invitation ? " to accept your invitation" : ""}
              </Link>
            </p>
            </form>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}