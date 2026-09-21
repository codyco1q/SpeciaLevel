"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import {
  Bell,
  Calendar,
  UserCheck,
  Receipt,
  Info,
  CheckCircle2,
  AlertTriangle,
  CheckCheck,
  Inbox,
} from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  getUserNotifications,
  markNotificationAsRead,
  markAllNotificationsAsRead,
} from "@/lib/actions/notifications";
import type { SystemNotification, NotificationType } from "@/types/database";
import type { Dictionary, Locale } from "@/lib/i18n/get-dictionary";
import { cn } from "@/lib/utils";

interface NotificationsPopoverProps {
  platform: Dictionary["platform"];
  locale: Locale;
}

function formatRelativeTime(
  dateString: string,
  t: Dictionary["platform"]["notifications"]
) {
  const diffMs = Date.now() - new Date(dateString).getTime();
  const diffMins = Math.floor(diffMs / 60000);
  const diffHours = Math.floor(diffMins / 60);
  const diffDays = Math.floor(diffHours / 24);

  if (diffMins < 1) return t.justNow;
  if (diffMins < 60) return t.minutesAgo.replace("{minutes}", String(diffMins));
  if (diffHours < 24) return t.hoursAgo.replace("{hours}", String(diffHours));
  return t.daysAgo.replace("{days}", String(diffDays));
}

function getNotificationIcon(type: NotificationType) {
  switch (type) {
    case "booking":
      return <Calendar className="size-4 text-blue-500 dark:text-blue-400" />;
    case "lead":
      return <UserCheck className="size-4 text-amber-500 dark:text-amber-400" />;
    case "invoice":
      return <Receipt className="size-4 text-emerald-500 dark:text-emerald-400" />;
    case "success":
      return <CheckCircle2 className="size-4 text-emerald-500 dark:text-emerald-400" />;
    case "warning":
      return <AlertTriangle className="size-4 text-rose-500 dark:text-rose-400" />;
    case "info":
    default:
      return <Info className="size-4 text-sky-500 dark:text-sky-400" />;
  }
}

function getIconContainerBg(type: NotificationType) {
  switch (type) {
    case "booking":
      return "bg-blue-500/10 dark:bg-blue-500/20";
    case "lead":
      return "bg-amber-500/10 dark:bg-amber-500/20";
    case "invoice":
      return "bg-emerald-500/10 dark:bg-emerald-500/20";
    case "success":
      return "bg-emerald-500/10 dark:bg-emerald-500/20";
    case "warning":
      return "bg-rose-500/10 dark:bg-rose-500/20";
    case "info":
    default:
      return "bg-sky-500/10 dark:bg-sky-500/20";
  }
}

export function NotificationsPopover({ platform, locale }: NotificationsPopoverProps) {
  const router = useRouter();
  const t = platform.notifications;

  const [notifications, setNotifications] = React.useState<SystemNotification[]>([]);
  const [unreadCount, setUnreadCount] = React.useState(0);
  const [isOpen, setIsOpen] = React.useState(false);

  const fetchNotifications = React.useCallback(async () => {
    const res = await getUserNotifications();
    setNotifications(res.notifications);
    setUnreadCount(res.unreadCount);
  }, []);

  React.useEffect(() => {
    fetchNotifications();
    const interval = setInterval(fetchNotifications, 25000);
    return () => clearInterval(interval);
  }, [fetchNotifications]);

  const handleOpenChange = (open: boolean) => {
    setIsOpen(open);
    if (open) {
      fetchNotifications();
    }
  };

  const handleMarkAllAsRead = async () => {
    setNotifications((prev) => prev.map((n) => ({ ...n, is_read: true })));
    setUnreadCount(0);
    await markAllNotificationsAsRead();
  };

  const handleItemClick = async (notification: SystemNotification) => {
    if (!notification.is_read) {
      setNotifications((prev) =>
        prev.map((n) => (n.id === notification.id ? { ...n, is_read: true } : n))
      );
      setUnreadCount((prev) => Math.max(0, prev - 1));
      markNotificationAsRead(notification.id);
    }

    setIsOpen(false);

    if (notification.link) {
      router.push(notification.link);
    }
  };

  return (
    <DropdownMenu open={isOpen} onOpenChange={handleOpenChange}>
      <DropdownMenuTrigger asChild>
        <button
          type="button"
          aria-label={t.title}
          className={cn(
            "relative inline-flex size-9 items-center justify-center rounded-lg border border-border/80 bg-muted/40 text-muted-foreground transition-all duration-150",
            "hover:border-primary/40 hover:bg-muted/70 hover:text-foreground focus:outline-hidden focus:ring-2 focus:ring-ring/40"
          )}
        >
          <Bell className="size-4 text-muted-foreground transition-colors hover:text-foreground" />
          {unreadCount > 0 && (
            <span className="absolute -top-1 -end-1 flex size-4 items-center justify-center rounded-full bg-rose-600 text-[10px] font-bold text-white shadow-xs">
              {unreadCount > 9 ? "9+" : unreadCount}
            </span>
          )}
        </button>
      </DropdownMenuTrigger>

      <DropdownMenuContent
        align="end"
        sideOffset={8}
        className="w-80 sm:w-96 rounded-xl border border-border bg-popover/95 p-0 shadow-xl backdrop-blur-md"
      >
        {/* Header */}
        <div className="flex items-center justify-between border-b border-border/70 px-4 py-3">
          <div className="flex items-center gap-2">
            <span className="text-sm font-semibold text-foreground">{t.title}</span>
            {unreadCount > 0 && (
              <span className="rounded-full bg-rose-500/10 px-2 py-0.5 text-[11px] font-medium text-rose-600 dark:text-rose-400">
                {t.unreadCount.replace("{count}", String(unreadCount))}
              </span>
            )}
          </div>
          {unreadCount > 0 && (
            <button
              type="button"
              onClick={handleMarkAllAsRead}
              className="flex items-center gap-1 text-xs font-medium text-muted-foreground hover:text-primary transition-colors cursor-pointer"
            >
              <CheckCheck className="size-3.5" />
              <span>{t.markAllAsRead}</span>
            </button>
          )}
        </div>

        {/* Notifications List */}
        <div className="max-h-[380px] overflow-y-auto divide-y divide-border/40">
          {notifications.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-10 px-4 text-center">
              <div className="flex size-10 items-center justify-center rounded-full bg-muted/60 text-muted-foreground mb-2.5">
                <Inbox className="size-5" />
              </div>
              <p className="text-xs font-medium text-foreground">{t.emptyState}</p>
              <p className="text-[11px] text-muted-foreground mt-0.5 max-w-[220px]">
                {t.emptyStateHint}
              </p>
            </div>
          ) : (
            notifications.map((notification) => (
              <div
                key={notification.id}
                onClick={() => handleItemClick(notification)}
                role="button"
                tabIndex={0}
                onKeyDown={(e) => {
                  if (e.key === "Enter" || e.key === " ") {
                    handleItemClick(notification);
                  }
                }}
                className={cn(
                  "group relative flex items-start gap-3 p-3.5 text-start transition-colors cursor-pointer select-none",
                  notification.is_read
                    ? "hover:bg-muted/40"
                    : "bg-primary/5 hover:bg-primary/10"
                )}
              >
                {/* Icon Pill */}
                <div
                  className={cn(
                    "flex size-8 shrink-0 items-center justify-center rounded-lg mt-0.5",
                    getIconContainerBg(notification.type)
                  )}
                >
                  {getNotificationIcon(notification.type)}
                </div>

                {/* Content */}
                <div className="flex-1 min-w-0">
                  <div className="flex items-center justify-between gap-2">
                    <p
                      className={cn(
                        "text-xs truncate",
                        notification.is_read
                          ? "font-medium text-foreground"
                          : "font-semibold text-foreground"
                      )}
                    >
                      {notification.title}
                    </p>
                    <span className="shrink-0 text-[10px] text-muted-foreground">
                      {formatRelativeTime(notification.created_at, t)}
                    </span>
                  </div>
                  <p className="text-xs text-muted-foreground line-clamp-2 mt-0.5 leading-relaxed">
                    {notification.message}
                  </p>
                </div>

                {/* Unread Indicator Dot */}
                {!notification.is_read && (
                  <span className="size-2 shrink-0 rounded-full bg-rose-500 mt-2" />
                )}
              </div>
            ))
          )}
        </div>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
