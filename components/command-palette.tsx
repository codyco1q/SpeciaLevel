"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import {
  LayoutDashboard,
  CalendarDays,
  Clock,
  Users,
  Building2,
  BarChart3,
  ShieldCheck,
  CheckSquare,
  MessageSquare,
  PhoneCall,
  FormInput,
  TrendingUp,
  Contact,
  Receipt,
  Zap,
  Puzzle,
  Settings,
  Sparkles,
  PlusCircle,
  Link as LinkIcon,
  Check,
  User,
  DollarSign,
  Loader2,
} from "lucide-react";

import {
  CommandDialog,
  CommandInput,
  CommandList,
  CommandEmpty,
  CommandGroup,
  CommandItem,
  CommandShortcut,
  CommandSeparator,
} from "@/components/ui/command";
import { hasPermission } from "@/lib/auth/rbac";
import {
  searchCommandEntities,
  getPersonalBookingSlug,
  type CommandSearchContact,
  type CommandSearchDeal,
} from "@/lib/actions/command-search";
import type { Dictionary, Locale } from "@/lib/i18n/get-dictionary";

interface NavItemConfig {
  href: string;
  key: keyof Dictionary["platform"]["commandPalette"]["items"];
  icon: typeof LayoutDashboard;
  permission?: string;
  keywords: string[];
}

const NAV_CONFIG: NavItemConfig[] = [
  { href: "/dashboard", key: "dashboard", icon: LayoutDashboard, permission: "dashboard.view", keywords: ["dashboard", "overview", "home", "لوحة التحكم"] },
  { href: "/contacts", key: "contacts", icon: Contact, permission: "crm.view", keywords: ["contacts", "crm", "people", "companies", "directory", "جهات الاتصال"] },
  { href: "/crm", key: "crm", icon: TrendingUp, permission: "crm.view", keywords: ["crm", "deals", "pipeline", "leads", "إدارة علاقات العملاء"] },
  { href: "/calendar", key: "calendar", icon: CalendarDays, permission: "calendar.view", keywords: ["calendar", "events", "appointments", "meetings", "التقويم"] },
  { href: "/forms", key: "forms", icon: FormInput, permission: "forms.view", keywords: ["forms", "inbound", "lead capture", "نماذج"] },
  { href: "/invoicing", key: "invoicing", icon: Receipt, permission: "invoicing.view", keywords: ["invoicing", "billing", "invoices", "payments", "الفواتير"] },
  { href: "/chat", key: "chat", icon: MessageSquare, permission: "chat.view", keywords: ["chat", "messages", "team", "channels", "المحادثات"] },
  { href: "/tasks", key: "tasks", icon: CheckSquare, permission: "tasks.view", keywords: ["tasks", "todos", "projects", "المهام"] },
  { href: "/automations", key: "automations", icon: Zap, permission: "automations.view", keywords: ["automations", "workflows", "triggers", "الأتمتة"] },
  { href: "/telecom", key: "telecom", icon: PhoneCall, permission: "telecom.view", keywords: ["telecom", "calls", "sms", "phone", "الاتصالات"] },
  { href: "/analytics", key: "analytics", icon: BarChart3, permission: "analytics.view", keywords: ["analytics", "bi", "metrics", "reports", "التحليلات"] },
  { href: "/ai", key: "ai", icon: Sparkles, permission: "ai.view", keywords: ["ai", "agents", "prompts", "tools", "الذكاء الاصطناعي"] },
  { href: "/time", key: "time", icon: Clock, permission: "time_tracking.view_self", keywords: ["time tracking", "clock in", "timesheet", "تتبع الوقت"] },
  { href: "/employees", key: "employees", icon: Users, permission: "employees.view", keywords: ["employees", "team", "staff", "directory", "الموظفون"] },
  { href: "/departments", key: "departments", icon: Building2, permission: "departments.view", keywords: ["departments", "teams", "الأقسام"] },
  { href: "/roles", key: "roles", icon: ShieldCheck, permission: "roles.view", keywords: ["roles", "permissions", "access", "الأدوار"] },
  { href: "/modules", key: "modules", icon: Puzzle, keywords: ["modules", "apps", "features", "الوحدات"] },
  { href: "/settings", key: "settings", icon: Settings, permission: "settings.view", keywords: ["settings", "preferences", "organization", "profile", "الإعدادات"] },
];

interface CommandPaletteProps {
  platform: Dictionary["platform"];
  locale: Locale;
  permissions: string[];
}

export function CommandPalette({
  platform,
  locale,
  permissions,
}: CommandPaletteProps) {
  const router = useRouter();
  const [open, setOpen] = React.useState(false);
  const [search, setSearch] = React.useState("");
  const [searching, setSearching] = React.useState(false);
  const [contacts, setContacts] = React.useState<CommandSearchContact[]>([]);
  const [deals, setDeals] = React.useState<CommandSearchDeal[]>([]);
  const [copiedLink, setCopiedLink] = React.useState(false);

  const t = platform.commandPalette;

  // Global shortcut listener: Cmd+K / Ctrl+K
  React.useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key.toLowerCase() === "k" && (e.metaKey || e.ctrlKey)) {
        e.preventDefault();
        setOpen((prev) => !prev);
      }
    };

    const handleOpenEvent = () => setOpen(true);

    window.addEventListener("keydown", handleKeyDown);
    window.addEventListener("open-command-palette", handleOpenEvent);
    window.addEventListener("toggle-command-palette", () =>
      setOpen((prev) => !prev)
    );

    return () => {
      window.removeEventListener("keydown", handleKeyDown);
      window.removeEventListener("open-command-palette", handleOpenEvent);
      window.removeEventListener(
        "toggle-command-palette",
        () => setOpen((prev) => !prev)
      );
    };
  }, []);

  // Debounced live entity search
  React.useEffect(() => {
    const trimmed = search.trim();
    if (trimmed.length < 2) {
      setContacts([]);
      setDeals([]);
      setSearching(false);
      return;
    }

    setSearching(true);
    const timeoutId = setTimeout(async () => {
      try {
        const results = await searchCommandEntities(trimmed);
        setContacts(results.contacts);
        setDeals(results.deals);
      } catch (err) {
        console.error("[CommandPalette] Search error:", err);
      } finally {
        setSearching(false);
      }
    }, 200);

    return () => clearTimeout(timeoutId);
  }, [search]);

  // Reset search when palette is closed
  React.useEffect(() => {
    if (!open) {
      setSearch("");
      setContacts([]);
      setDeals([]);
      setSearching(false);
      setCopiedLink(false);
    }
  }, [open]);

  const runCommand = React.useCallback((command: () => void) => {
    setOpen(false);
    command();
  }, []);

  const handleCopyBookingLink = async () => {
    try {
      const slug = await getPersonalBookingSlug();
      if (slug && typeof window !== "undefined") {
        const url = `${window.location.origin}/book/${slug}`;
        await navigator.clipboard.writeText(url);
        setCopiedLink(true);
        setTimeout(() => {
          setCopiedLink(false);
          setOpen(false);
        }, 1200);
      } else {
        runCommand(() => router.push("/calendar"));
      }
    } catch {
      runCommand(() => router.push("/calendar"));
    }
  };

  const canViewCrm = hasPermission("crm.view", permissions);
  const canManageCrm = hasPermission("crm.manage", permissions);
  const canViewInvoicing = hasPermission("invoicing.view", permissions);
  const canManageInvoicing = hasPermission("invoicing.manage", permissions);
  const canViewCalendar = hasPermission("calendar.view", permissions);
  const canViewForms = hasPermission("forms.view", permissions);
  const canViewChat = hasPermission("chat.view", permissions);
  const canViewTasks = hasPermission("tasks.view", permissions);
  const canViewAutomations = hasPermission("automations.view", permissions);
  const canViewTelecom = hasPermission("telecom.view", permissions);
  const canViewAnalytics = hasPermission("analytics.view", permissions);
  const canViewAi = hasPermission("ai.view", permissions);
  const canViewTime = hasPermission("time_tracking.view_self", permissions);
  const canViewEmployees = hasPermission("employees.view", permissions);
  const canViewDepartments = hasPermission("departments.view", permissions);
  const canViewRoles = hasPermission("roles.view", permissions);
  const canViewSettings =
    hasPermission("settings.view", permissions) ||
    hasPermission("settings.manage", permissions);

  const isRtl = locale.startsWith("ar");

  const visibleNav = NAV_CONFIG.filter(
    (item) => !item.permission || hasPermission(item.permission, permissions)
  );

  return (
    <CommandDialog
      open={open}
      onOpenChange={setOpen}
      title={t.searchPlaceholder}
      description={t.triggerPlaceholder}
    >
      <CommandInput
        placeholder={t.searchPlaceholder}
        value={search}
        onValueChange={setSearch}
      />
      <CommandList>
        {searching && (
          <div className="flex items-center justify-center gap-2 py-6 text-sm text-muted-foreground">
            <Loader2 className="size-4 animate-spin" />
            <span>{t.searching}</span>
          </div>
        )}

        <CommandEmpty>{t.emptyState}</CommandEmpty>

        {contacts.length > 0 && (
          <CommandGroup heading={t.groups.contacts}>
            {contacts.map((contact) => (
              <CommandItem
                key={`contact-${contact.id}`}
                value={`contact-${contact.name}-${contact.email}-${contact.company ?? ""}`}
                onSelect={() =>
                  runCommand(() => router.push(`/contacts/${contact.id}`))
                }
              >
                <div className="flex size-7 shrink-0 items-center justify-center rounded-full bg-primary/10 text-primary">
                  <User className="size-3.5" />
                </div>
                <div className="flex flex-col min-w-0 flex-1">
                  <span className="font-medium truncate">{contact.name}</span>
                  <span className="text-xs text-muted-foreground truncate">
                    {contact.email}
                    {contact.company ? ` • ${contact.company}` : ""}
                  </span>
                </div>
              </CommandItem>
            ))}
          </CommandGroup>
        )}

        {deals.length > 0 && (
          <CommandGroup heading={t.groups.deals}>
            {deals.map((deal) => (
              <CommandItem
                key={`deal-${deal.id}`}
                value={`deal-${deal.title}-${deal.stage}`}
                onSelect={() =>
                  runCommand(() => router.push(`/crm?dealId=${deal.id}`))
                }
              >
                <div className="flex size-7 shrink-0 items-center justify-center rounded-full bg-emerald-500/10 text-emerald-600 dark:text-emerald-400">
                  <DollarSign className="size-3.5" />
                </div>
                <div className="flex flex-col min-w-0 flex-1">
                  <span className="font-medium truncate">{deal.title}</span>
                  <span className="text-xs text-muted-foreground capitalize truncate">
                    {t.hints.dealInStage
                      .replace("{stage}", deal.stage)
                      .replace(
                        "{value}",
                        new Intl.NumberFormat(isRtl ? "ar-EG" : "en-US", {
                          style: "currency",
                          currency: deal.currency || "USD",
                          maximumFractionDigits: 0,
                        }).format(deal.value)
                      )}
                  </span>
                </div>
              </CommandItem>
            ))}
          </CommandGroup>
        )}

        {contacts.length > 0 || deals.length > 0 ? <CommandSeparator /> : null}

        <CommandGroup heading={t.groups.actions}>
          {canManageCrm && (
            <CommandItem
              value="action-create-contact"
              keywords={["create contact", "add contact", "new contact", "جهة اتصال"]}
              onSelect={() =>
                runCommand(() => router.push("/contacts?new=true"))
              }
            >
              <PlusCircle className="size-4 text-primary" />
              <div className="flex flex-col">
                <span>{t.actions.createContact}</span>
                <span className="text-[11px] text-muted-foreground">
                  {t.actions.createContactHint}
                </span>
              </div>
            </CommandItem>
          )}

          {canManageCrm && (
            <CommandItem
              value="action-create-deal"
              keywords={["create deal", "add deal", "new deal", "pipeline", "صفقة"]}
              onSelect={() => runCommand(() => router.push("/crm?new=true"))}
            >
              <TrendingUp className="size-4 text-emerald-500" />
              <div className="flex flex-col">
                <span>{t.actions.createDeal}</span>
                <span className="text-[11px] text-muted-foreground">
                  {t.actions.createDealHint}
                </span>
              </div>
            </CommandItem>
          )}

          {canManageInvoicing && (
            <CommandItem
              value="action-create-invoice"
              keywords={["create invoice", "new invoice", "bill", "فاتورة"]}
              onSelect={() =>
                runCommand(() => router.push("/invoicing?new=true"))
              }
            >
              <Receipt className="size-4 text-blue-500" />
              <div className="flex flex-col">
                <span>{t.actions.createInvoice}</span>
                <span className="text-[11px] text-muted-foreground">
                  {t.actions.createInvoiceHint}
                </span>
              </div>
            </CommandItem>
          )}

          {canViewCalendar && (
            <CommandItem
              value="action-book-appointment"
              keywords={["book appointment", "calendar", "schedule", "booking link", "حجز", "موعد"]}
              onSelect={handleCopyBookingLink}
            >
              {copiedLink ? (
                <Check className="size-4 text-emerald-500" />
              ) : (
                <LinkIcon className="size-4 text-purple-500" />
              )}
              <div className="flex flex-col">
                <span>
                  {copiedLink
                    ? t.actions.bookingLinkCopied
                    : t.actions.copyBookingLink}
                </span>
                <span className="text-[11px] text-muted-foreground">
                  {t.actions.copyBookingLinkHint}
                </span>
              </div>
              {copiedLink && (
                <CommandShortcut className="text-emerald-500 font-semibold">
                  ✓
                </CommandShortcut>
              )}
            </CommandItem>
          )}
        </CommandGroup>

        <CommandSeparator />

        <CommandGroup heading={t.groups.navigation}>
          {visibleNav.map((item) => {
            const Icon = item.icon;
            const label = t.items[item.key];
            return (
              <CommandItem
                key={item.href}
                value={`nav-${item.href}`}
                keywords={item.keywords}
                onSelect={() => runCommand(() => router.push(item.href))}
              >
                <Icon className="size-4 text-muted-foreground" />
                <span>{label}</span>
              </CommandItem>
            );
          })}
        </CommandGroup>
      </CommandList>
    </CommandDialog>
  );
}
