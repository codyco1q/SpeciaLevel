"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  LayoutDashboard,
  CalendarDays,
  Clock,
  Users,
  Building2,
  ShieldCheck,
  Settings,
  LogOut,
} from "lucide-react";
import { hasPermission } from "@/lib/auth/rbac";
import { cn } from "@/lib/utils";

export interface SidebarNavItem {
  label: string;
  href: string;
  icon: typeof LayoutDashboard;
  permission: string;
}

interface SidebarProps {
  permissions: string[];
  organizationName?: string;
  userFullName?: string;
  userEmail?: string;
}

export default function Sidebar({
  permissions,
  organizationName,
  userFullName,
  userEmail,
}: SidebarProps) {
  const pathname = usePathname();

  const navItems: SidebarNavItem[] = [
    {
      label: "Dashboard",
      href: "/dashboard",
      icon: LayoutDashboard,
      permission: "dashboard.view",
    },
    {
      label: "Calendar",
      href: "/calendar",
      icon: CalendarDays,
      permission: "calendar.view",
    },
    {
      label: "Time Tracking",
      href: "/time",
      icon: Clock,
      permission: "time_tracking.view_self",
    },
    {
      label: "Employees",
      href: "/employees",
      icon: Users,
      permission: "employees.view",
    },
    {
      label: "Departments",
      href: "/departments",
      icon: Building2,
      permission: "departments.view",
    },
    {
      label: "Roles & Permissions",
      href: "/roles",
      icon: ShieldCheck,
      permission: "roles.view",
    },
  ];

  const visibleItems = navItems.filter((item) =>
    hasPermission(item.permission, permissions)
  );

  // Settings is footer chrome, not a main nav item — but it must still be
  // permission-driven, not hard-coded visible for every role.
  const canViewSettings =
    hasPermission("settings.view", permissions) ||
    hasPermission("settings.manage", permissions);

  return (
    <aside className="flex h-full w-64 flex-col border-r border-border bg-card">
      {/* Logo */}
      <div className="flex items-center gap-2 border-b border-border px-6 py-5">
        <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary text-primary-foreground">
          <span className="text-sm font-bold">UL</span>
        </div>
        <div>
          <p className="text-sm font-semibold">UpLevel</p>
          {organizationName && (
            <p className="text-xs text-muted-foreground">{organizationName}</p>
          )}
        </div>
      </div>

      {/* Nav items */}
      <nav className="flex-1 space-y-1 overflow-y-auto px-3 py-4">
        {visibleItems.map((item) => {
          const Icon = item.icon;
          const isActive = pathname === item.href;
          return (
            <Link
              key={item.href}
              href={item.href}
              className={cn(
                "flex items-center gap-3 rounded-md px-3 py-2 text-sm font-medium transition-colors",
                isActive
                  ? "bg-primary/10 text-primary"
                  : "text-muted-foreground hover:bg-muted hover:text-foreground"
              )}
            >
              <Icon className="h-4 w-4" />
              {item.label}
            </Link>
          );
        })}
      </nav>

      {/* Footer */}
      <div className="border-t border-border p-4">
        <div className="mb-2 flex items-center gap-3">
          <div className="flex h-8 w-8 items-center justify-center rounded-full bg-muted text-sm font-semibold">
            {(userFullName || userEmail || "U").charAt(0).toUpperCase()}
          </div>
          <div className="min-w-0 flex-1">
            <p className="truncate text-sm font-medium">
              {userFullName || "User"}
            </p>
            <p className="truncate text-xs text-muted-foreground">
              {userEmail}
            </p>
          </div>
        </div>
        {canViewSettings ? (
          <Link
            href="/settings"
            className="flex items-center gap-3 rounded-md px-3 py-2 text-sm font-medium text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
          >
            <Settings className="h-4 w-4" />
            Settings
          </Link>
        ) : null}
        <form action="/auth/signout" method="post">
          <button
            type="submit"
            className="flex w-full items-center gap-3 rounded-md px-3 py-2 text-sm font-medium text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
          >
            <LogOut className="h-4 w-4" />
            Sign out
          </button>
        </form>
      </div>
    </aside>
  );
}
