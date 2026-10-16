import type { Metadata } from "next";
import { getAdminSession } from "@/lib/auth/admin";
import { AdminNavbar } from "./admin-navbar";

export const metadata: Metadata = {
  title: "SpeciaLevel Platform Admin",
  description: "Platform-wide Multi-Tenant Control Panel and Global Governance",
};

export const dynamic = "force-dynamic";

export default async function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const session = await getAdminSession();

  return (
    <div className="min-h-screen bg-background text-foreground flex flex-col antialiased">
      {session.isAuthenticated && <AdminNavbar username={session.username || "admin"} />}
      <main className="flex-1 flex flex-col">{children}</main>
    </div>
  );
}
