"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import {
  Phone,
  PhoneCall,
  Hash,
  Server,
  FileText,
  Plus,
  Trash2,
  Edit2,
  CheckCircle2,
  Clock,
  ArrowDownLeft,
  ArrowUpRight,
  Mic,
  User,
  ShieldCheck,
  AlertCircle,
  ExternalLink,
} from "lucide-react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { PhoneNumberDialog } from "./phone-number-dialog";
import { CarrierSettingsForm } from "./carrier-settings-form";
import { LogCallDialog, SendSmsDialog } from "@/app/(dashboard)/telecom/telecom-dialog";
import {
  TELECOM_CALL_STATUS_BADGE_CLASSES,
  TELECOM_DIRECTION_BADGE_CLASSES,
  TELECOM_SMS_STATUS_BADGE_CLASSES,
  counterpartNumber,
  formatCallDuration,
  formatTelecomDateTime,
} from "@/app/(dashboard)/telecom/telecom-meta";
import {
  deletePhoneNumber,
  type PhoneNumberWithAgent,
} from "@/lib/actions/phone-numbers";
import {
  getCalls,
  getSmsMessages,
  getTelecomMetrics,
  type TelecomCallRow,
  type TelecomSmsRow,
  type TelecomMetrics,
  type TelecomContactOption,
} from "@/lib/actions/telecom";
import type { PhoneCarrierSettings } from "@/types/database";
import type { Dictionary, Locale } from "@/lib/i18n/get-dictionary";
import { cn } from "@/lib/utils";

interface PhoneNumbersViewProps {
  phoneNumbers: PhoneNumberWithAgent[];
  carrierSettings: PhoneCarrierSettings | null;
  initialCalls: TelecomCallRow[];
  initialSms: TelecomSmsRow[];
  initialMetrics: TelecomMetrics;
  initialContacts: TelecomContactOption[];
  orgMembers: { id: string; name: string; email: string | null }[];
  canManage: boolean;
  platform: Dictionary["platform"];
  locale: Locale;
}

export function PhoneNumbersView({
  phoneNumbers,
  carrierSettings,
  initialCalls,
  initialSms,
  initialMetrics,
  initialContacts,
  orgMembers,
  canManage,
  platform,
  locale,
}: PhoneNumbersViewProps) {
  const t = platform.phoneNumbers;
  const [activeTab, setActiveTab] = useState<string>("inventory");

  // Phone numbers inventory state
  const [numbersList, setNumbersList] = useState<PhoneNumberWithAgent[]>(phoneNumbers);
  const [addDialogOpen, setAddDialogOpen] = useState(false);
  const [editingNumber, setEditingNumber] = useState<PhoneNumberWithAgent | null>(null);

  // Telecom audit logs state
  const [calls, setCalls] = useState(initialCalls);
  const [sms, setSms] = useState(initialSms);
  const [metrics, setMetrics] = useState(initialMetrics);
  const [auditSubTab, setAuditSubTab] = useState<"calls" | "sms">("calls");
  const [logCallOpen, setLogCallOpen] = useState(false);
  const [sendSmsOpen, setSendSmsOpen] = useState(false);

  const [isDeleting, startDeleteTransition] = useTransition();

  const handleDeleteNumber = (id: string) => {
    if (!window.confirm(t.inventory.deleteConfirm)) return;
    startDeleteTransition(async () => {
      const res = await deletePhoneNumber(id);
      if (res.status === "success") {
        setNumbersList((prev) => prev.filter((n) => n.id !== id));
      }
    });
  };

  const refreshAuditLogs = async () => {
    const [nextCalls, nextSms, nextMetrics] = await Promise.all([
      getCalls("all"),
      getSmsMessages(),
      getTelecomMetrics(),
    ]);
    if (nextCalls) setCalls(nextCalls);
    if (nextSms) setSms(nextSms);
    if (nextMetrics) setMetrics(nextMetrics);
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 border-b pb-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">{t.title}</h1>
          <p className="text-xs text-muted-foreground mt-0.5">
            {t.subtitle}
          </p>
        </div>

        <Tabs value={activeTab} onValueChange={setActiveTab} className="w-auto">
          <TabsList className="grid grid-cols-3 w-[450px]">
            <TabsTrigger value="inventory" className="gap-2 text-xs">
              <Hash className="h-3.5 w-3.5" />
              <span>{t.tabs.inventory}</span>
            </TabsTrigger>
            <TabsTrigger value="carrier" className="gap-2 text-xs">
              <Server className="h-3.5 w-3.5" />
              <span>{t.tabs.carrier}</span>
            </TabsTrigger>
            <TabsTrigger value="auditLogs" className="gap-2 text-xs">
              <FileText className="h-3.5 w-3.5" />
              <span>{t.tabs.auditLogs}</span>
            </TabsTrigger>
          </TabsList>
        </Tabs>
      </div>

      {/* TAB 1: Numbers Inventory */}
      {activeTab === "inventory" && (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-base font-semibold">{t.inventory.title}</h2>
              <p className="text-xs text-muted-foreground">
                {t.inventory.description}
              </p>
            </div>

            {canManage && (
              <Button
                size="sm"
                onClick={() => setAddDialogOpen(true)}
                className="gap-1.5 text-xs"
              >
                <Plus className="h-4 w-4" />
                <span>{t.inventory.addNumber}</span>
              </Button>
            )}
          </div>

          {numbersList.length === 0 ? (
            <Card>
              <CardContent className="flex flex-col items-center justify-center p-12 text-center text-muted-foreground">
                <Hash className="h-12 w-12 opacity-30 text-primary mb-3" />
                <h3 className="text-sm font-semibold text-foreground">
                  {t.inventory.noNumbers}
                </h3>
                <p className="text-xs max-w-sm mt-1 mb-4">
                  {t.inventory.noNumbersHint}
                </p>
                {canManage && (
                  <Button
                    size="sm"
                    onClick={() => setAddDialogOpen(true)}
                    className="gap-1.5 text-xs"
                  >
                    <Plus className="h-4 w-4" />
                    <span>{t.inventory.addNumber}</span>
                  </Button>
                )}
              </CardContent>
            </Card>
          ) : (
            <div className="rounded-xl border bg-card overflow-hidden shadow-sm">
              <div className="overflow-x-auto">
                <table className="w-full text-xs text-start">
                  <thead>
                    <tr className="border-b bg-muted/40 font-medium text-muted-foreground">
                      <th className="p-3 text-start">{t.inventory.number}</th>
                      <th className="p-3 text-start">{t.inventory.friendlyName}</th>
                      <th className="p-3 text-start">{t.inventory.capabilities}</th>
                      <th className="p-3 text-start">{t.inventory.assignedAgent}</th>
                      <th className="p-3 text-start">{t.inventory.status}</th>
                      {canManage && <th className="p-3 text-end">Actions</th>}
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border/60">
                    {numbersList.map((num) => (
                      <tr key={num.id} className="hover:bg-muted/30 transition-colors">
                        <td className="p-3 font-mono font-medium text-foreground">
                          {num.phone_number}
                        </td>
                        <td className="p-3 text-muted-foreground">
                          {num.friendly_name || "—"}
                        </td>
                        <td className="p-3">
                          <div className="flex items-center gap-1.5">
                            {num.capabilities?.voice && (
                              <Badge variant="outline" className="text-[10px] px-1.5 py-0 bg-blue-50 text-blue-700 border-blue-200 dark:bg-blue-950/40 dark:text-blue-300">
                                {t.inventory.voice}
                              </Badge>
                            )}
                            {num.capabilities?.sms && (
                              <Badge variant="outline" className="text-[10px] px-1.5 py-0 bg-purple-50 text-purple-700 border-purple-200 dark:bg-purple-950/40 dark:text-purple-300">
                                {t.inventory.sms}
                              </Badge>
                            )}
                          </div>
                        </td>
                        <td className="p-3 text-muted-foreground">
                          {num.assigned_user?.full_name ? (
                            <span className="flex items-center gap-1.5">
                              <User className="h-3.5 w-3.5 opacity-60" />
                              {num.assigned_user.full_name}
                            </span>
                          ) : (
                            <span className="italic text-muted-foreground/60">
                              {t.inventory.unassigned}
                            </span>
                          )}
                        </td>
                        <td className="p-3">
                          <Badge
                            variant="outline"
                            className={cn(
                              "text-[10px] px-1.5 py-0",
                              num.status === "active"
                                ? "border-emerald-300 bg-emerald-50 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-300"
                                : "border-zinc-300 bg-zinc-100 text-zinc-600 dark:bg-zinc-800 dark:text-zinc-300"
                            )}
                          >
                            {num.status === "active"
                              ? t.inventory.active
                              : num.status === "pending"
                              ? t.inventory.pending
                              : t.inventory.inactive}
                          </Badge>
                        </td>
                        {canManage && (
                          <td className="p-3 text-end">
                            <div className="flex items-center justify-end gap-1">
                              <Button
                                variant="ghost"
                                size="sm"
                                onClick={() => setEditingNumber(num)}
                                className="h-7 w-7 p-0"
                              >
                                <Edit2 className="h-3.5 w-3.5 text-muted-foreground" />
                              </Button>
                              <Button
                                variant="ghost"
                                size="sm"
                                onClick={() => handleDeleteNumber(num.id)}
                                disabled={isDeleting}
                                className="h-7 w-7 p-0 text-destructive hover:bg-destructive/10"
                              >
                                <Trash2 className="h-3.5 w-3.5" />
                              </Button>
                            </div>
                          </td>
                        )}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>
      )}

      {/* TAB 2: Carrier BYOC */}
      {activeTab === "carrier" && (
        <CarrierSettingsForm
          carrierSettings={carrierSettings}
          canManage={canManage}
          platform={platform}
        />
      )}

      {/* TAB 3: Audit Logs */}
      {activeTab === "auditLogs" && (
        <div className="space-y-6">
          {/* Metrics summary */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <Card>
              <CardContent className="p-4">
                <p className="text-xs text-muted-foreground">{platform.telecom.metrics.totalCalls}</p>
                <p className="text-xl font-bold mt-1">{metrics.totalCalls}</p>
              </CardContent>
            </Card>

            <Card>
              <CardContent className="p-4">
                <p className="text-xs text-muted-foreground">{platform.telecom.metrics.minutesLogged}</p>
                <p className="text-xl font-bold mt-1">{metrics.totalMinutes}m</p>
              </CardContent>
            </Card>

            <Card>
              <CardContent className="p-4">
                <p className="text-xs text-muted-foreground">{platform.telecom.metrics.missedCalls}</p>
                <p className="text-xl font-bold mt-1">{metrics.missedCalls}</p>
              </CardContent>
            </Card>

            <Card>
              <CardContent className="p-4">
                <p className="text-xs text-muted-foreground">{platform.telecom.metrics.totalSms}</p>
                <p className="text-xl font-bold mt-1">{metrics.totalSms}</p>
              </CardContent>
            </Card>
          </div>

          {/* Sub-tabs header & actions */}
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
            <div className="flex items-center gap-2">
              <Button
                variant={auditSubTab === "calls" ? "default" : "outline"}
                size="sm"
                onClick={() => setAuditSubTab("calls")}
                className="text-xs h-8"
              >
                {t.auditLogs.callsTab} ({calls.length})
              </Button>
              <Button
                variant={auditSubTab === "sms" ? "default" : "outline"}
                size="sm"
                onClick={() => setAuditSubTab("sms")}
                className="text-xs h-8"
              >
                {t.auditLogs.smsTab} ({sms.length})
              </Button>
            </div>

            {canManage && (
              <div className="flex items-center gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setLogCallOpen(true)}
                  className="gap-1.5 text-xs h-8"
                >
                  <PhoneCall className="h-3.5 w-3.5" />
                  <span>{platform.telecom.logCall}</span>
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setSendSmsOpen(true)}
                  className="gap-1.5 text-xs h-8"
                >
                  <ArrowUpRight className="h-3.5 w-3.5" />
                  <span>{platform.telecom.sendSms}</span>
                </Button>
              </div>
            )}
          </div>

          {auditSubTab === "calls" ? (
            calls.length === 0 ? (
              <Card>
                <CardContent className="p-8 text-center text-muted-foreground text-xs">
                  No call logs recorded yet.
                </CardContent>
              </Card>
            ) : (
              <div className="rounded-xl border bg-card overflow-hidden shadow-sm">
                <div className="overflow-x-auto">
                  <table className="w-full text-xs text-start">
                    <thead>
                      <tr className="border-b bg-muted/40 font-medium text-muted-foreground">
                        <th className="p-3 text-start">Direction</th>
                        <th className="p-3 text-start">Contact</th>
                        <th className="p-3 text-start">Number</th>
                        <th className="p-3 text-start">Duration</th>
                        <th className="p-3 text-start">Status</th>
                        <th className="p-3 text-start">Summary</th>
                        <th className="p-3 text-end">Date & Time</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-border/60">
                      {calls.map((call) => (
                        <tr key={call.id} className="hover:bg-muted/30 transition-colors">
                          <td className="p-3">
                            <Badge
                              variant="outline"
                              className={cn(
                                "text-[10px] px-1.5 py-0 capitalize",
                                TELECOM_DIRECTION_BADGE_CLASSES[call.direction]
                              )}
                            >
                              {call.direction}
                            </Badge>
                          </td>
                          <td className="p-3">
                            {call.contact ? (
                              <Link
                                href={`/contacts/${call.contact.id}`}
                                className="font-medium text-primary hover:underline inline-flex items-center gap-1"
                              >
                                {call.contact.name}
                                <ExternalLink className="h-2.5 w-2.5 opacity-60" />
                              </Link>
                            ) : (
                              <span className="text-muted-foreground">—</span>
                            )}
                          </td>
                          <td className="p-3 font-mono text-muted-foreground">
                            {counterpartNumber(call.direction, call.fromNumber, call.toNumber)}
                          </td>
                          <td className="p-3 font-mono">
                            {formatCallDuration(call.durationSeconds)}
                          </td>
                          <td className="p-3">
                            <Badge
                              variant="outline"
                              className={cn(
                                "text-[10px] px-1.5 py-0 capitalize",
                                TELECOM_CALL_STATUS_BADGE_CLASSES[call.status]
                              )}
                            >
                              {call.status}
                            </Badge>
                          </td>
                          <td className="p-3 max-w-[200px] truncate text-muted-foreground">
                            {call.summary || "—"}
                          </td>
                          <td className="p-3 text-end text-muted-foreground whitespace-nowrap">
                            {formatTelecomDateTime(call.createdAt, locale)}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )
          ) : (
            sms.length === 0 ? (
              <Card>
                <CardContent className="p-8 text-center text-muted-foreground text-xs">
                  No SMS records found.
                </CardContent>
              </Card>
            ) : (
              <div className="rounded-xl border bg-card overflow-hidden shadow-sm">
                <div className="overflow-x-auto">
                  <table className="w-full text-xs text-start">
                    <thead>
                      <tr className="border-b bg-muted/40 font-medium text-muted-foreground">
                        <th className="p-3 text-start">Direction</th>
                        <th className="p-3 text-start">Contact</th>
                        <th className="p-3 text-start">Number</th>
                        <th className="p-3 text-start">Message</th>
                        <th className="p-3 text-start">Status</th>
                        <th className="p-3 text-end">Date & Time</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-border/60">
                      {sms.map((msg) => (
                        <tr key={msg.id} className="hover:bg-muted/30 transition-colors">
                          <td className="p-3">
                            <Badge
                              variant="outline"
                              className={cn(
                                "text-[10px] px-1.5 py-0 capitalize",
                                TELECOM_DIRECTION_BADGE_CLASSES[msg.direction]
                              )}
                            >
                              {msg.direction}
                            </Badge>
                          </td>
                          <td className="p-3">
                            {msg.contact ? (
                              <Link
                                href={`/contacts/${msg.contact.id}`}
                                className="font-medium text-primary hover:underline inline-flex items-center gap-1"
                              >
                                {msg.contact.name}
                                <ExternalLink className="h-2.5 w-2.5 opacity-60" />
                              </Link>
                            ) : (
                              <span className="text-muted-foreground">—</span>
                            )}
                          </td>
                          <td className="p-3 font-mono text-muted-foreground">
                            {counterpartNumber(msg.direction, msg.fromNumber, msg.toNumber)}
                          </td>
                          <td className="p-3 max-w-[280px] truncate text-muted-foreground">
                            {msg.body}
                          </td>
                          <td className="p-3">
                            <Badge
                              variant="outline"
                              className={cn(
                                "text-[10px] px-1.5 py-0 capitalize",
                                TELECOM_SMS_STATUS_BADGE_CLASSES[msg.status]
                              )}
                            >
                              {msg.status}
                            </Badge>
                          </td>
                          <td className="p-3 text-end text-muted-foreground whitespace-nowrap">
                            {formatTelecomDateTime(msg.createdAt, locale)}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )
          )}
        </div>
      )}
      {/* Dialogs */}
      <PhoneNumberDialog
        open={addDialogOpen || !!editingNumber}
        onOpenChange={(open) => {
          if (!open) {
            setAddDialogOpen(false);
            setEditingNumber(null);
          }
        }}
        editingNumber={editingNumber}
        agentOptions={orgMembers}
        platform={platform}
      />

      <LogCallDialog
        open={logCallOpen}
        onOpenChange={setLogCallOpen}
        contacts={initialContacts}
        onLogged={refreshAuditLogs}
        platform={platform}
      />

      <SendSmsDialog
        open={sendSmsOpen}
        onOpenChange={setSendSmsOpen}
        contacts={initialContacts}
        onSent={refreshAuditLogs}
        platform={platform}
      />
    </div>
  );
}
