"use client";

import { useState, useTransition } from "react";
import {
  Clock,
  MessageSquareText,
  Phone,
  PhoneIncoming,
  PhoneMissed,
  PhoneOutgoing,
  Plus,
  Send,
  type LucideIcon,
} from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from "@/components/ui/tabs";
import { cn } from "@/lib/utils";
import { type TelecomDirection } from "@/lib/validations/telecom";
import {
  TELECOM_CALL_STATUS_BADGE_CLASSES,
  TELECOM_DIRECTION_BADGE_CLASSES,
  TELECOM_SMS_STATUS_BADGE_CLASSES,
  formatCallDuration,
  formatTelecomDateTime,
  counterpartNumber,
} from "./telecom-meta";
import {
  getCalls,
  getSmsMessages,
  getTelecomMetrics,
  type TelecomCallRow,
  type TelecomMetrics,
  type TelecomSmsRow,
  type TelecomContactOption,
} from "@/lib/actions/telecom";
import type { Dictionary, Locale } from "@/lib/i18n/get-dictionary";
import { LogCallDialog, SendSmsDialog } from "./telecom-dialog";

const DIRECTION_FILTERS: ("all" | TelecomDirection)[] = [
  "all",
  "inbound",
  "outbound",
];

interface MetricCardProps {
  icon: LucideIcon;
  label: string;
  value: string;
  hint: string;
}

function MetricCard({ icon: Icon, label, value, hint }: MetricCardProps) {
  return (
    <div className="rounded-xl border border-border bg-card p-6 shadow-sm">
      <div className="mb-2 flex items-center gap-2">
        <Icon className="size-4 text-muted-foreground" />
        <h3 className="text-sm font-semibold">{label}</h3>
      </div>
      <p className="text-3xl font-bold tracking-tight tabular-nums">{value}</p>
      <p className="mt-1 text-xs text-muted-foreground">{hint}</p>
    </div>
  );
}

interface TelecomViewProps {
  initialCalls: TelecomCallRow[];
  initialSms: TelecomSmsRow[];
  initialMetrics: TelecomMetrics;
  initialContacts: TelecomContactOption[];
  canManage: boolean;
  platform: Dictionary["platform"];
  locale: Locale;
}

/**
 * Telecommunications orchestrator: KPI cards, call log + SMS tables,
 * and the "Log Call" / "Send SMS" quick actions. Mutations go through
 * the shared server actions and the row + metric lists are refetched
 * afterwards — the same "revalidate + refetch" loop the other modules
 * use, so data stays in sync across role + locale switches.
 */
export function TelecomView({
  initialCalls,
  initialSms,
  initialMetrics,
  initialContacts,
  canManage,
  platform,
  locale,
}: TelecomViewProps) {
  const t = platform.telecom;

  const [calls, setCalls] = useState(initialCalls);
  const [sms, setSms] = useState(initialSms);
  const [metrics, setMetrics] = useState(initialMetrics);
  const [contacts] = useState(initialContacts);
  const [directionFilter, setDirectionFilter] = useState<
    "all" | TelecomDirection
  >("all");
  const [logDialogOpen, setLogDialogOpen] = useState(false);
  const [smsDialogOpen, setSmsDialogOpen] = useState(false);

  const [, startTransition] = useTransition();

  function handleDirectionChange(value: "all" | TelecomDirection) {
    setDirectionFilter(value);
    startTransition(async () => {
      const rows = await getCalls(value);
      if (rows) setCalls(rows);
    });
  }

  async function refreshAll() {
    const [nextCalls, nextSms, nextMetrics] = await Promise.all([
      getCalls(directionFilter),
      getSmsMessages(),
      getTelecomMetrics(),
    ]);
    if (nextCalls) setCalls(nextCalls);
    if (nextSms) setSms(nextSms);
    if (nextMetrics) setMetrics(nextMetrics);
  }

  function handleLogged() {
    void refreshAll();
  }

  function handleSent() {
    void refreshAll();
  }

  const filteredCalls =
    directionFilter === "all"
      ? calls
      : calls.filter((call) => call.direction === directionFilter);

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">{t.title}</h1>
          <p className="mt-1 text-sm text-muted-foreground">{t.subtitle}</p>
        </div>
        {canManage && (
          <div className="flex gap-2">
            <Button onClick={() => setLogDialogOpen(true)}>
              <Plus />
              {t.logCall}
            </Button>
            <Button variant="outline" onClick={() => setSmsDialogOpen(true)}>
              <Send />
              {t.sendSms}
            </Button>
          </div>
        )}
      </div>

      {/* KPI cards */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <MetricCard
          icon={Phone}
          label={t.metrics.totalCalls}
          value={String(metrics.totalCalls)}
          hint={t.metrics.totalCallsHint}
        />
        <MetricCard
          icon={Clock}
          label={t.metrics.minutesLogged}
          value={String(metrics.totalMinutes)}
          hint={t.metrics.minutesLoggedHint}
        />
        <MetricCard
          icon={PhoneMissed}
          label={t.metrics.missedCalls}
          value={String(metrics.missedCalls)}
          hint={t.metrics.missedCallsHint.replace(
            "{rate}",
            String(metrics.missedCallRate)
          )}
        />
        <MetricCard
          icon={MessageSquareText}
          label={t.metrics.totalSms}
          value={String(metrics.totalSms)}
          hint={t.metrics.totalSmsHint}
        />
      </div>

      <Tabs defaultValue="calls">
        <TabsList>
          <TabsTrigger value="calls">{t.tabs.calls}</TabsTrigger>
          <TabsTrigger value="sms">{t.tabs.sms}</TabsTrigger>
        </TabsList>

        <TabsContent value="calls" className="space-y-3">
          <div className="flex flex-wrap items-center gap-2">
            {DIRECTION_FILTERS.map((value) => (
              <Button
                key={value}
                type="button"
                size="sm"
                variant={directionFilter === value ? "default" : "outline"}
                onClick={() => handleDirectionChange(value)}
              >
                {value === "all" ? t.allDirections : t.directions[value]}
              </Button>
            ))}
          </div>
{filteredCalls.length === 0 ? (
            <div className="rounded-lg border border-dashed border-border p-8 text-center">
              <p className="text-sm font-medium">{t.empty.noCalls}</p>
              <p className="mt-1 text-xs text-muted-foreground">
                {t.empty.noCallsHint}
              </p>
            </div>
          ) : (
            <div className="overflow-hidden rounded-lg border border-border bg-card">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>{t.callsTable.direction}</TableHead>
                    <TableHead>{t.callsTable.contact}</TableHead>
                    <TableHead>{t.callsTable.number}</TableHead>
                    <TableHead>{t.callsTable.duration}</TableHead>
                    <TableHead>{t.callsTable.status}</TableHead>
                    <TableHead>{t.callsTable.agent}</TableHead>
                    <TableHead>{t.callsTable.recording}</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredCalls.map((call) => (
                    <TableRow key={call.id}>
                      <TableCell>
                        <Badge
                          variant="outline"
                          className={cn(
                            "gap-1",
                            TELECOM_DIRECTION_BADGE_CLASSES[call.direction]
                          )}
                        >
                          {call.direction === "inbound" ? (
                            <PhoneIncoming className="size-3" />
                          ) : (
                            <PhoneOutgoing className="size-3" />
                          )}
                          {t.directions[call.direction]}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        <span className="font-medium">
                          {call.contact?.name ?? "—"}
                        </span>
                      </TableCell>
                      <TableCell>
                        <span
                          className="font-mono text-sm tabular-nums"
                          dir="ltr"
                        >
                          {counterpartNumber(
                            call.direction,
                            call.fromNumber,
                            call.toNumber
                          )}
                        </span>
                      </TableCell>
                      <TableCell>
                        <span className="tabular-nums">
                          {formatCallDuration(call.durationSeconds)}
                        </span>
                      </TableCell>
                      <TableCell>
                        <span
                          className={cn(
                            "inline-flex rounded-full border px-2 py-0.5 text-xs font-medium",
                            TELECOM_CALL_STATUS_BADGE_CLASSES[call.status]
                          )}
                        >
                          {t.callStatuses[call.status]}
                        </span>
                      </TableCell>
                      <TableCell>
                        {call.agent ? (
                          <span className="text-sm">
                            {call.agent.fullName ?? call.agent.email ?? "—"}
                          </span>
                        ) : (
                          <span className="text-muted-foreground">—</span>
                        )}
                      </TableCell>
                      <TableCell>
                        {call.recordingUrl ? (
                          <audio
                            controls
                            preload="none"
                            src={call.recordingUrl}
                            className="h-8 w-40"
                          />
                        ) : (
                          <span className="text-muted-foreground">—</span>
                        )}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </TabsContent>
<TabsContent value="sms" className="space-y-3">
          <p className="text-sm text-muted-foreground">{t.metrics.totalSmsHint}</p>

          {sms.length === 0 ? (
            <div className="rounded-lg border border-dashed border-border p-8 text-center">
              <p className="text-sm font-medium">{t.empty.noSms}</p>
              <p className="mt-1 text-xs text-muted-foreground">
                {t.empty.noSmsHint}
              </p>
            </div>
          ) : (
            <div className="overflow-hidden rounded-lg border border-border bg-card">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>{t.smsTable.direction}</TableHead>
                    <TableHead>{t.smsTable.contact}</TableHead>
                    <TableHead>{t.smsTable.number}</TableHead>
                    <TableHead>{t.smsTable.body}</TableHead>
                    <TableHead>{t.smsTable.status}</TableHead>
                    <TableHead>{t.smsTable.sentAt}</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {sms.map((message) => (
                    <TableRow key={message.id}>
                      <TableCell>
                        <Badge
                          variant="outline"
                          className="gap-1"
                        >
                          {message.direction === "inbound" ? (
                            <PhoneIncoming className="size-3" />
                          ) : (
                            <PhoneOutgoing className="size-3" />
                          )}
                          {t.directions[message.direction]}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        <span className="font-medium">
                          {message.contact?.name ?? "—"}
                        </span>
                      </TableCell>
                      <TableCell>
                        <span
                          className="font-mono text-sm tabular-nums"
                          dir="ltr"
                        >
                          {message.direction === "outbound"
                            ? message.toNumber
                            : message.fromNumber}
                        </span>
                      </TableCell>
                      <TableCell className="max-w-md">
                        <p className="line-clamp-2 text-sm">{message.body}</p>
                      </TableCell>
                      <TableCell>
                        <span
                          className={cn(
                            "inline-flex rounded-full border px-2 py-0.5 text-xs font-medium",
                            TELECOM_SMS_STATUS_BADGE_CLASSES[message.status]
                          )}
                        >
                          {t.smsStatuses[message.status]}
                        </span>
                      </TableCell>
                      <TableCell className="whitespace-nowrap text-muted-foreground">
                        {formatTelecomDateTime(message.createdAt, locale)}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </TabsContent>
      </Tabs>

      <LogCallDialog
        open={logDialogOpen}
        onOpenChange={setLogDialogOpen}
        contacts={contacts}
        onLogged={handleLogged}
        platform={platform}
      />
      <SendSmsDialog
        open={smsDialogOpen}
        onOpenChange={setSmsDialogOpen}
        contacts={contacts}
        onSent={handleSent}
        platform={platform}
      />
    </div>
  );
}