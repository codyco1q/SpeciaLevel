import { redirect } from "next/navigation";
import { ShieldAlert, LockKeyhole } from "lucide-react";
import { getAdminSession } from "@/lib/auth/admin";
import { Monogram } from "@/components/brand";
import { Badge } from "@/components/ui/badge";
import { AdminLoginForm } from "./admin-login-form";

export const dynamic = "force-dynamic";

export default async function AdminLoginPage() {
  const session = await getAdminSession();
  if (session.isAuthenticated) {
    redirect("/admin");
  }

  return (
    <div className="min-h-screen flex items-center justify-center p-4 bg-muted/30">
      <div className="w-full max-w-sm space-y-6">
        <div className="flex flex-col items-center text-center space-y-2">
          <div className="relative">
            <Monogram className="size-12 rounded-xl text-base shadow-xl" />
            <div className="absolute -bottom-1 -right-1 size-5 rounded-full bg-amber-500 text-amber-950 flex items-center justify-center shadow-xs">
              <ShieldAlert className="size-3" />
            </div>
          </div>
          <div className="pt-2">
            <div className="flex items-center justify-center gap-2">
              <h1 className="text-xl font-bold tracking-tight text-foreground">
                Platform Admin
              </h1>
              <Badge variant="outline" className="text-[10px] font-mono border-amber-500/40 text-amber-600 bg-amber-500/10">
                CORE
              </Badge>
            </div>
            <p className="text-xs text-muted-foreground mt-1">
              Isolated administrative governance for SpeciaLevel
            </p>
          </div>
        </div>

        <div className="rounded-2xl border border-border bg-card p-6 shadow-sm space-y-4">
          <div className="flex items-center gap-2 text-xs font-medium text-muted-foreground pb-2 border-b border-border">
            <LockKeyhole className="size-3.5 text-amber-500" />
            <span>Secure Admin Authentication</span>
          </div>

          <AdminLoginForm />
        </div>

        <p className="text-center text-[11px] text-muted-foreground">
          Platform-level credentials required. Unauthorized access attempts are monitored and recorded.
        </p>
      </div>
    </div>
  );
}
