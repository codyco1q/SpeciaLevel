"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Lock, User, Eye, EyeOff, Loader2, AlertCircle, ShieldAlert } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { adminLoginAction } from "@/lib/actions/admin-auth";

export function AdminLoginForm() {
  const router = useRouter();
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (!username.trim() || !password) {
      setError("Please provide both username and password.");
      return;
    }

    startTransition(async () => {
      const res = await adminLoginAction({ username, password });
      if (res.success) {
        router.push("/admin");
        router.refresh();
      } else {
        setError(res.error || "Authentication failed.");
      }
    });
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      {error && (
        <div className="flex items-start gap-2.5 p-3 rounded-lg bg-destructive/10 border border-destructive/20 text-destructive text-xs leading-relaxed animate-in fade-in duration-200">
          <AlertCircle className="size-4 shrink-0 mt-0.5" />
          <span>{error}</span>
        </div>
      )}

      <div className="space-y-1.5">
        <Label htmlFor="admin-username" className="text-xs font-medium text-foreground">
          Admin Username
        </Label>
        <div className="relative">
          <User className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-muted-foreground" />
          <Input
            id="admin-username"
            name="username"
            type="text"
            required
            autoComplete="username"
            autoCapitalize="none"
            autoCorrect="off"
            spellCheck="false"
            value={username}
            onChange={(e) => setUsername(e.target.value)}
            placeholder="admin"
            className="pl-9 text-sm h-10"
            disabled={isPending}
          />
        </div>
      </div>

      <div className="space-y-1.5">
        <Label htmlFor="admin-password" className="text-xs font-medium text-foreground">
          Admin Password
        </Label>
        <div className="relative">
          <Lock className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-muted-foreground" />
          <Input
            id="admin-password"
            name="password"
            type={showPassword ? "text" : "password"}
            required
            autoComplete="current-password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder="••••••••"
            className="pl-9 pr-10 text-sm h-10"
            disabled={isPending}
          />
          <button
            type="button"
            onClick={() => setShowPassword(!showPassword)}
            tabIndex={-1}
            aria-label={showPassword ? "Hide password" : "Show password"}
            className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors"
          >
            {showPassword ? <EyeOff className="size-4" /> : <Eye className="size-4" />}
          </button>
        </div>
      </div>

      <Button
        type="submit"
        disabled={isPending}
        className="w-full h-10 text-sm font-semibold gap-2 mt-2 bg-amber-600 hover:bg-amber-700 text-white"
      >
        {isPending ? (
          <>
            <Loader2 className="size-4 animate-spin" />
            <span>Authenticating...</span>
          </>
        ) : (
          <>
            <ShieldAlert className="size-4" />
            <span>Sign In to Admin Console</span>
          </>
        )}
      </Button>
    </form>
  );
}
