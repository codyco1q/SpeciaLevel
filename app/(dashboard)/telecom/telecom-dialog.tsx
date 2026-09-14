"use client";

import { useState, useTransition } from "react";
import { LoaderCircle } from "lucide-react";
import { z } from "zod";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  TELECOM_CALL_STATUSES,
  TELECOM_DIRECTIONS,
  createCallLogInputSchema,
  createSmsInputSchema,
  type TelecomCallStatus,
  type TelecomDirection,
} from "@/lib/validations/telecom";
import {
  logCall,
  sendSms,
  type TelecomContactOption,
} from "@/lib/actions/telecom";
import type { Dictionary } from "@/lib/i18n/get-dictionary";

const NO_CONTACT = "__none__";

/** Pulls {fieldKey: [...]} from a Zod issue batch for inline errors. */
function parseFieldErrors(issues: z.ZodIssue[]): Record<string, string[]> {
  const fieldErrors: Record<string, string[]> = {};
  for (const issue of issues) {
    const key = issue.path?.[0];
    if (typeof key === "string") {
      (fieldErrors[key] ??= []).push(issue.message);
    }
  }
  return fieldErrors;
}

interface ContactSelectProps {
  id: string;
  value: string;
  onValueChange: (value: string) => void;
  contacts: TelecomContactOption[];
  placeholder: string;
  disabled?: boolean;
}

/** Optional contact picker shared by both dialogs. */
function ContactSelect({
  id,
  value,
  onValueChange,
  contacts,
  placeholder,
  disabled = false,
}: ContactSelectProps) {
  if (contacts.length === 0) {
    return <p className="text-sm text-muted-foreground">{placeholder}</p>;
  }
  return (
    <Select value={value} onValueChange={onValueChange} disabled={disabled}>
      <SelectTrigger id={id} className="w-full">
        <SelectValue placeholder={placeholder} />
      </SelectTrigger>
      <SelectContent>
        <SelectItem value={NO_CONTACT}>{placeholder}</SelectItem>
        {contacts.map((contact) => (
          <SelectItem key={contact.id} value={contact.id}>
            {contact.name}
            {contact.phone ? ` · ${contact.phone}` : ""}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}

interface LogCallDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  contacts: TelecomContactOption[];
  onLogged: () => void;
  platform: Dictionary["platform"];
}

export function LogCallDialog({
  open,
  onOpenChange,
  contacts,
  onLogged,
  platform,
}: LogCallDialogProps) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90vh] max-w-2xl overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{platform.telecom.logCallDialog.title}</DialogTitle>
          <DialogDescription>
            {platform.telecom.logCallDialog.description}
          </DialogDescription>
        </DialogHeader>
        <LogCallForm
          key={open ? "log-open" : "log-closed"}
          contacts={contacts}
          onOpenChange={onOpenChange}
          onLogged={onLogged}
          platform={platform}
        />
      </DialogContent>
    </Dialog>
  );
}

function LogCallForm({
  contacts,
  onOpenChange,
  onLogged,
  platform,
}: Omit<LogCallDialogProps, "open">) {
  const t = platform.telecom;
  const schema = createCallLogInputSchema(t.errors);
  const [isPending, startTransition] = useTransition();

  const [contactId, setContactId] = useState("");
  const [direction, setDirection] = useState<TelecomDirection>("outbound");
  const [status, setStatus] = useState<TelecomCallStatus>("completed");
  const [fromNumber, setFromNumber] = useState("");
  const [toNumber, setToNumber] = useState("");
  const [durationSeconds, setDurationSeconds] = useState("");
  const [recordingUrl, setRecordingUrl] = useState("");
  const [summary, setSummary] = useState("");
  const [serverError, setServerError] = useState<string | null>(null);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string[]>>({});

  function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setServerError(null);
    setFieldErrors({});

    const parsed = schema.safeParse({
      contactId: contactId || null,
      direction,
      status,
      fromNumber,
      toNumber,
      durationSeconds:
        durationSeconds === "" ? undefined : Number(durationSeconds),
      recordingUrl: recordingUrl || null,
      summary,
    });

    if (!parsed.success) {
      setFieldErrors(parseFieldErrors(parsed.error.issues));
      return;
    }

    startTransition(async () => {
      const result = await logCall(parsed.data);
      if (result.status === "error") {
        setServerError(result.error);
        return;
      }
      onLogged();
      onOpenChange(false);
    });
  }
return (
    <form onSubmit={submit} className="space-y-4">
      <div className="grid gap-4 sm:grid-cols-2">
        <div className="grid gap-2">
          <Label>{t.logCallDialog.contactLabel}</Label>
          <ContactSelect
            id="log-phone"
            value={contactId}
            onValueChange={(value) =>
              value === NO_CONTACT ? setContactId("") : setContactId(value)
            }
            contacts={contacts}
            placeholder={t.logCallDialog.contactPlaceholder}
          />
          <p className="text-xs text-muted-foreground">
            {t.logCallDialog.contactOptional}
          </p>
        </div>

        <div className="grid gap-4 sm:grid-cols-2">
          <div className="grid gap-2">
            <Label>{t.logCallDialog.directionLabel}</Label>
            <Select
              value={direction}
              onValueChange={(value) =>
                setDirection(value as TelecomDirection)
              }
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {TELECOM_DIRECTIONS.map((value) => (
                  <SelectItem key={value} value={value}>
                    {t.directions[value]}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="grid gap-2">
            <Label>{t.logCallDialog.statusLabel}</Label>
            <Select
              value={status}
              onValueChange={(value) =>
                setStatus(value as TelecomCallStatus)
              }
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {TELECOM_CALL_STATUSES.map((value) => (
                  <SelectItem key={value} value={value}>
                    {t.callStatuses[value]}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <div className="grid gap-2">
          <Label>{t.logCallDialog.fromNumberLabel}</Label>
          <Input
            value={fromNumber}
            onChange={(event) => setFromNumber(event.target.value)}
            placeholder={t.logCallDialog.fromNumberPlaceholder}
            className="font-mono tabular-nums"
            dir="ltr"
          />
          {fieldErrors.fromNumber && (
            <p className="text-xs text-destructive">{fieldErrors.fromNumber[0]}</p>
          )}
        </div>
        <div className="grid gap-2">
          <Label>{t.logCallDialog.toNumberLabel}</Label>
          <Input
            value={toNumber}
            onChange={(event) => setToNumber(event.target.value)}
            placeholder={t.logCallDialog.toNumberPlaceholder}
            className="font-mono tabular-nums"
            dir="ltr"
          />
          {fieldErrors.toNumber && (
            <p className="text-xs text-destructive">{fieldErrors.toNumber[0]}</p>
          )}
        </div>
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <div className="grid gap-2">
          <Label>{t.logCallDialog.durationLabel}</Label>
          <Input
            type="number"
            min={0}
            step={1}
            inputMode="numeric"
            value={durationSeconds}
            onChange={(event) => setDurationSeconds(event.target.value)}
            className="tabular-nums"
            dir="ltr"
          />
          {fieldErrors.durationSeconds && (
            <p className="text-xs text-destructive">
              {fieldErrors.durationSeconds[0]}
            </p>
          )}
        </div>
        <div className="grid gap-2">
          <Label>{t.logCallDialog.recordingUrlLabel}</Label>
          <Input
            value={recordingUrl}
            onChange={(event) => setRecordingUrl(event.target.value)}
            placeholder={t.logCallDialog.recordingUrlPlaceholder}
            dir="ltr"
          />
          {fieldErrors.recordingUrl && (
            <p className="text-xs text-destructive">
              {fieldErrors.recordingUrl[0]}
            </p>
          )}
        </div>
      </div>

      <div className="grid gap-2">
        <Label>{t.logCallDialog.summaryLabel}</Label>
        <Textarea
          value={summary}
          onChange={(event) => setSummary(event.target.value)}
          placeholder={t.logCallDialog.summaryPlaceholder}
        />
        {fieldErrors.summary && (
          <p className="text-xs text-destructive">{fieldErrors.summary[0]}</p>
        )}
      </div>

      {serverError && (
        <p role="alert" className="text-sm text-destructive">
          {serverError}
        </p>
      )}

      <DialogFooter>
        <Button type="submit" disabled={isPending}>
          {isPending && <LoaderCircle className="size-4 animate-spin" />}
          {t.logCallDialog.submit}
        </Button>
      </DialogFooter>
    </form>
  );
}
interface SendSmsDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  contacts: TelecomContactOption[];
  onSent: () => void;
  platform: Dictionary["platform"];
}

export function SendSmsDialog({
  open,
  onOpenChange,
  contacts,
  onSent,
  platform,
}: SendSmsDialogProps) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90vh] max-w-2xl overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{platform.telecom.sendSmsDialog.title}</DialogTitle>
          <DialogDescription>
            {platform.telecom.sendSmsDialog.description}
          </DialogDescription>
        </DialogHeader>
        <SendSmsForm
          key={open ? "sms-open" : "sms-closed"}
          contacts={contacts}
          onOpenChange={onOpenChange}
          onSent={onSent}
          platform={platform}
        />
      </DialogContent>
    </Dialog>
  );
}

function SendSmsForm({
  contacts,
  onOpenChange,
  onSent,
  platform,
}: Omit<SendSmsDialogProps, "open">) {
  const t = platform.telecom;
  const schema = createSmsInputSchema(t.errors);
  const [isPending, startTransition] = useTransition();

  const [contactId, setContactId] = useState("");
  const [direction, setDirection] = useState<TelecomDirection>("outbound");
  const [fromNumber, setFromNumber] = useState("");
  const [toNumber, setToNumber] = useState("");
  const [body, setBody] = useState("");
  const [serverError, setServerError] = useState<string | null>(null);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string[]>>({});

  function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setServerError(null);
    setFieldErrors({});

    const parsed = schema.safeParse({
      contactId: contactId || null,
      direction,
      fromNumber,
      toNumber,
      body,
    });

    if (!parsed.success) {
      setFieldErrors(parseFieldErrors(parsed.error.issues));
      return;
    }

    startTransition(async () => {
      const result = await sendSms(parsed.data);
      if (result.status === "error") {
        setServerError(result.error);
        return;
      }
      onSent();
      onOpenChange(false);
    });
  }

  return (
    <form onSubmit={submit} className="space-y-4">
      <div className="grid gap-4 sm:grid-cols-2">
        <div className="grid gap-2">
          <Label>{t.sendSmsDialog.contactLabel}</Label>
          <ContactSelect
            id="sms-contact"
            value={contactId}
            onValueChange={(value) =>
              value === NO_CONTACT ? setContactId("") : setContactId(value)
            }
            contacts={contacts}
            placeholder={t.sendSmsDialog.contactPlaceholder}
          />
          <p className="text-xs text-muted-foreground">
            {t.sendSmsDialog.contactOptional}
          </p>
        </div>

        <div className="grid gap-2">
          <Label>{t.sendSmsDialog.directionLabel}</Label>
          <Select
            value={direction}
            onValueChange={(value) =>
              setDirection(value as TelecomDirection)
            }
          >
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {TELECOM_DIRECTIONS.map((value) => (
                <SelectItem key={value} value={value}>
                  {t.directions[value]}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <div className="grid gap-2">
          <Label>{t.sendSmsDialog.fromNumberLabel}</Label>
          <Input
            value={fromNumber}
            onChange={(event) => setFromNumber(event.target.value)}
            placeholder={t.sendSmsDialog.fromNumberPlaceholder}
            className="font-mono tabular-nums"
            dir="ltr"
          />
          {fieldErrors.fromNumber && (
            <p className="text-xs text-destructive">{fieldErrors.fromNumber[0]}</p>
          )}
        </div>
        <div className="grid gap-2">
          <Label>{t.sendSmsDialog.toNumberLabel}</Label>
          <Input
            value={toNumber}
            onChange={(event) => setToNumber(event.target.value)}
            placeholder={t.sendSmsDialog.toNumberPlaceholder}
            className="font-mono tabular-nums"
            dir="ltr"
          />
          {fieldErrors.toNumber && (
            <p className="text-xs text-destructive">{fieldErrors.toNumber[0]}</p>
          )}
        </div>
      </div>

      <div className="grid gap-2">
        <Label>{t.sendSmsDialog.bodyLabel}</Label>
        <Textarea
          value={body}
          onChange={(event) => setBody(event.target.value)}
          placeholder={t.sendSmsDialog.bodyPlaceholder}
          className="min-h-32"
        />
        {fieldErrors.body && (
          <p className="text-xs text-destructive">{fieldErrors.body[0]}</p>
        )}
        <p className="text-right text-xs text-muted-foreground">
          {t.sendSmsDialog.bodyCount.replace("{count}", String(body.length))}
        </p>
      </div>

      {serverError && (
        <p role="alert" className="text-sm text-destructive">
          {serverError}
        </p>
      )}

      <DialogFooter>
        <Button type="submit" disabled={isPending}>
          {isPending && <LoaderCircle className="size-4 animate-spin" />}
          {t.sendSmsDialog.submit}
        </Button>
      </DialogFooter>
    </form>
  );
}