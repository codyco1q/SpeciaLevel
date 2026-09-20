"use client";

import { useMemo, useState, useTransition } from "react";
import { Check, LoaderCircle, Link2 } from "lucide-react";
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
  MARKETING_CHANNELS,
  MARKETING_STATUSES,
  createCampaignInputSchema,
  type CampaignFormValues,
  type MarketingChannel,
  type MarketingStatus,
} from "@/lib/validations/marketing";
import {
  createCampaign,
  updateCampaign,
  type MarketingCampaignRow,
} from "@/lib/actions/marketing";
import type { Dictionary } from "@/lib/i18n/get-dictionary";
import {
  MARKETING_UTM_MEDIUMS,
  MARKETING_UTM_SOURCES,
  buildUtmUrl,
  slugify,
  type MarketingUtmMedium,
} from "./marketing-meta";

interface MarketingDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** When set, the dialog runs in edit mode pre-filled with this row. */
  campaign?: MarketingCampaignRow | null;
  /** Called after a successful create/update. */
  onSaved: () => void;
  /** Localized copy for the current render. */
  platform: Dictionary["platform"];
}

/**
 * Create/edit campaign dialog. The form lives in a keyed child component
 * so every open remounts it with pristine (or pre-filled) state — the
 * React-recommended way to reset a form without a state-resetting effect.
 *
 * The UTM generator derives the source from the chosen channel, lets the
 * user pick a medium, auto-suggests the campaign param from the campaign
 * name, and renders a live preview URL that can be copied to the clipboard.
 */
export function MarketingDialog({
  open,
  onOpenChange,
  campaign = null,
  onSaved,
  platform,
}: MarketingDialogProps) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90vh] sm:max-w-3xl md:max-w-4xl overflow-hidden flex flex-col p-6">
        <MarketingCampaignForm
          key={
            open
              ? campaign
                ? `marketing-edit-${campaign.id}`
                : "marketing-create-open"
              : "marketing-closed"
          }
          campaign={campaign}
          onOpenChange={onOpenChange}
          onSaved={onSaved}
          platform={platform}
        />
      </DialogContent>
    </Dialog>
  );
}

function parseFieldErrors(
  issues: z.ZodIssue[]
): Record<string, string[]> {
  const fieldErrors: Record<string, string[]> = {};
  for (const issue of issues) {
    const key = issue.path[0];
    if (typeof key === "string") {
      (fieldErrors[key] ??= []).push(issue.message);
    }
  }
  return fieldErrors;
}

function MarketingCampaignForm({
  campaign,
  onOpenChange,
  onSaved,
  platform,
}: Omit<MarketingDialogProps, "open">) {
  const t = platform.marketing;
  const common = platform.common;
  const isEditing = Boolean(campaign);

  const [isPending, startTransition] = useTransition();
  const [serverError, setServerError] = useState<string | null>(null);
  const [fieldErrors, setFieldErrors] = useState<
    Partial<Record<keyof CampaignFormValues, string[] | undefined>>
  >({});

  // Campaign fields.
  const [name, setName] = useState(campaign?.name ?? "");
  const [description, setDescription] = useState(campaign?.description ?? "");
  const [channel, setChannel] = useState<MarketingChannel | "">(
    campaign ? (campaign.channel as MarketingChannel) : ""
  );
  const [status, setStatus] = useState<MarketingStatus>(
    campaign ? (campaign.status as MarketingStatus) : "draft"
  );
  const [budget, setBudget] = useState(
    campaign ? String(campaign.budget ?? "") : ""
  );
  const [spend, setSpend] = useState(
    campaign ? String(campaign.spend ?? "") : ""
  );
  const [startDate, setStartDate] = useState(campaign?.startDate ?? "");
  const [endDate, setEndDate] = useState(campaign?.endDate ?? "");
  const [targetAudience, setTargetAudience] = useState(
    campaign?.targetAudience ?? ""
  );

  // UTM generator state.
  const [utmCampaign, setUtmCampaign] = useState(campaign?.utmCampaign ?? "");
  const [utmTouched, setUtmTouched] = useState(Boolean(campaign?.utmCampaign));
  const [utmBaseUrl, setUtmBaseUrl] = useState("");
  const [utmMedium, setUtmMedium] = useState<MarketingUtmMedium>("cpc");
  const [isCopied, setIsCopied] = useState(false);

  const utmSource = channel ? MARKETING_UTM_SOURCES[channel] : "";

  const utmUrl = useMemo(
    () =>
      buildUtmUrl(
        utmBaseUrl,
        utmSource || "unknown",
        utmMedium,
        utmCampaign || slugify(name) || "campaign"
      ),
    [utmBaseUrl, utmSource, utmMedium, utmCampaign, name]
  );

  /** Keep the UTM campaign param in sync with the name until it's edited. */
  function handleNameChange(value: string) {
    setName(value);
    if (!utmTouched) {
      setUtmCampaign(slugify(value));
    }
  }

  function fieldError(key: keyof CampaignFormValues): string | undefined {
    return fieldErrors[key]?.[0];
  }

  async function handleCopyUtm() {
    try {
      await navigator.clipboard.writeText(utmUrl);
      setIsCopied(true);
      setTimeout(() => setIsCopied(false), 1800);
    } catch {
      // Clipboard can be blocked; the preview text stays visible to copy.
    }
  }

  function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setServerError(null);

    const payload = {
      name,
      description,
      channel,
      status,
      budget: Number(budget || 0),
      spend: Number(spend || 0),
      startDate,
      endDate,
      targetAudience,
      utmCampaign,
    };

    const parsed = createCampaignInputSchema(t.errors).safeParse(payload);
    if (!parsed.success) {
      setFieldErrors(parseFieldErrors(parsed.error.issues));
      setServerError(t.errors.highlightFields);
      return;
    }
    setFieldErrors({});

    startTransition(async () => {
      const result = campaign
        ? await updateCampaign(campaign.id, payload)
        : await createCampaign(payload);
      if (result.status === "error") {
        setServerError(result.error);
        if (result.fieldErrors) setFieldErrors(result.fieldErrors);
        return;
      }
      onSaved();
    });
  }

  return (
    <>
      <DialogHeader>
        <DialogTitle>
          {isEditing ? t.editCampaign : t.dialog.createTitle}
        </DialogTitle>
        <DialogDescription>{t.dialog.description}</DialogDescription>
      </DialogHeader>

      <form onSubmit={handleSubmit} className="flex flex-col flex-1 min-h-0">
        <div className="max-h-[85vh] overflow-y-auto px-1 space-y-5 flex-1 pe-2">
        {/* Name + status */}
        <div className="grid gap-4 sm:grid-cols-2">
          <div className="grid gap-2">
            <Label htmlFor="campaign-name">{t.dialog.nameLabel}</Label>
            <Input
              id="campaign-name"
              value={name}
              onChange={(event) => handleNameChange(event.target.value)}
              placeholder={t.dialog.namePlaceholder}
            />
            {fieldError("name") && (
              <p className="text-xs text-destructive">{fieldError("name")}</p>
            )}
          </div>
          <div className="grid gap-2">
            <Label htmlFor="campaign-status">{t.dialog.statusLabel}</Label>
            <Select
              value={status}
              onValueChange={(value) => setStatus(value as MarketingStatus)}
            >
              <SelectTrigger id="campaign-status" className="w-full">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {MARKETING_STATUSES.map((value) => (
                  <SelectItem key={value} value={value}>
                    {t.statuses[value]}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>

        {/* Channel + target audience */}
        <div className="grid gap-4 sm:grid-cols-2">
          <div className="grid gap-2">
            <Label htmlFor="campaign-channel">{t.dialog.channelLabel}</Label>
            <Select
              value={channel}
              onValueChange={(value) => setChannel(value as MarketingChannel)}
            >
              <SelectTrigger id="campaign-channel" className="w-full">
                <SelectValue placeholder={t.dialog.channelPlaceholder} />
              </SelectTrigger>
              <SelectContent>
                {MARKETING_CHANNELS.map((value) => (
                  <SelectItem key={value} value={value}>
                    {t.channels[value]}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            {fieldError("channel") && (
              <p className="text-xs text-destructive">{fieldError("channel")}</p>
            )}
          </div>
          <div className="grid gap-2">
            <Label htmlFor="campaign-target-audience">
              {t.dialog.targetAudienceLabel}
            </Label>
            <Input
              id="campaign-target-audience"
              value={targetAudience}
              onChange={(event) => setTargetAudience(event.target.value)}
              placeholder={t.dialog.targetAudiencePlaceholder}
            />
            {fieldError("targetAudience") && (
              <p className="text-xs text-destructive">
                {fieldError("targetAudience")}
              </p>
            )}
          </div>
        </div>

        <div className="grid gap-2">
          <Label htmlFor="campaign-description">
            {t.dialog.descriptionLabel}{" "}
            <span className="text-muted-foreground">
              {t.dialog.descriptionOptional}
            </span>
          </Label>
          <Textarea
            id="campaign-description"
            rows={2}
            value={description}
            onChange={(event) => setDescription(event.target.value)}
            placeholder={t.dialog.descriptionPlaceholder}
          />
        </div>

        {/* Budget + spend */}
        <div className="grid gap-4 sm:grid-cols-2">
          <div className="grid gap-2">
            <Label htmlFor="campaign-budget">{t.dialog.budgetLabel}</Label>
            <Input
              id="campaign-budget"
              type="number"
              min="0"
              step="0.01"
              inputMode="decimal"
              value={budget}
              onChange={(event) => setBudget(event.target.value)}
              placeholder={t.dialog.budgetPlaceholder}
            />
            {fieldError("budget") && (
              <p className="text-xs text-destructive">{fieldError("budget")}</p>
            )}
          </div>
          <div className="grid gap-2">
            <Label htmlFor="campaign-spend">{t.dialog.spendLabel}</Label>
            <Input
              id="campaign-spend"
              type="number"
              min="0"
              step="0.01"
              inputMode="decimal"
              value={spend}
              onChange={(event) => setSpend(event.target.value)}
              placeholder={t.dialog.spendPlaceholder}
            />
            {fieldError("spend") && (
              <p className="text-xs text-destructive">{fieldError("spend")}</p>
            )}
          </div>
        </div>

        {/* Dates */}
        <div className="grid gap-4 sm:grid-cols-2">
          <div className="grid gap-2">
            <Label htmlFor="campaign-start-date">{t.dialog.startDateLabel}</Label>
            <Input
              id="campaign-start-date"
              type="date"
              value={startDate}
              onChange={(event) => setStartDate(event.target.value)}
            />
          </div>
          <div className="grid gap-2">
            <Label htmlFor="campaign-end-date">{t.dialog.endDateLabel}</Label>
            <Input
              id="campaign-end-date"
              type="date"
              value={endDate}
              onChange={(event) => setEndDate(event.target.value)}
            />
            {fieldError("endDate") && (
              <p className="text-xs text-destructive">{fieldError("endDate")}</p>
            )}
          </div>
        </div>

        {/* UTM generator */}
        <div className="rounded-lg border border-border bg-muted/30 p-4">
          <div className="mb-3 flex items-center gap-2">
            <Link2 className="h-4 w-4 text-muted-foreground" />
            <div>
              <p className="text-sm font-semibold">{t.dialog.utmLabel}</p>
              <p className="text-xs text-muted-foreground">{t.dialog.utmHint}</p>
            </div>
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <div className="grid gap-2">
              <Label htmlFor="campaign-utm-base-url">
                {t.dialog.utmBaseUrlLabel}
              </Label>
              <Input
                id="campaign-utm-base-url"
                type="url"
                inputMode="url"
                value={utmBaseUrl}
                onChange={(event) => setUtmBaseUrl(event.target.value)}
                placeholder={t.dialog.utmBaseUrlPlaceholder}
              />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="campaign-utm-medium">
                {t.dialog.utmMediumLabel}
              </Label>
              <Select
                value={utmMedium}
                onValueChange={(value) =>
                  setUtmMedium(value as MarketingUtmMedium)
                }
              >
                <SelectTrigger id="campaign-utm-medium" className="w-full">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {MARKETING_UTM_MEDIUMS.map((value) => (
                    <SelectItem key={value} value={value}>
                      {value}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="mt-4 grid gap-4 sm:grid-cols-2">
            <div className="grid gap-2">
              <Label htmlFor="campaign-utm-source">
                {t.dialog.utmSourceLabel}
              </Label>
              <Input
                id="campaign-utm-source"
                value={utmSource || "—"}
                readOnly
                disabled={!channel}
                className="bg-muted/40"
              />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="campaign-utm-campaign">
                {t.dialog.utmCampaignLabel}
              </Label>
              <Input
                id="campaign-utm-campaign"
                value={utmCampaign}
                onChange={(event) => {
                  setUtmTouched(true);
                  setUtmCampaign(event.target.value);
                }}
                placeholder={slugify(name) || "campaign"}
              />
              {fieldError("utmCampaign") && (
                <p className="text-xs text-destructive">
                  {fieldError("utmCampaign")}
                </p>
              )}
            </div>
          </div>

          <div className="mt-4 flex flex-col sm:flex-row sm:items-end justify-between gap-3">
            <div className="min-w-0 flex-1">
              <span className="mb-1.5 block text-xs text-muted-foreground">
                {t.dialog.utmPreviewLabel}
              </span>
              <p
                dir="ltr"
                className="truncate rounded-md border border-border bg-background px-3 py-2 font-mono text-xs text-muted-foreground break-all"
                title={utmUrl}
              >
                {utmUrl}
              </p>
            </div>
            <Button
              type="button"
              variant="outline"
              size="sm"
              className="shrink-0"
              onClick={handleCopyUtm}
            >
              {isCopied ? (
                <Check className="size-4 text-emerald-500" />
              ) : (
                <Link2 className="size-4" />
              )}
              {isCopied ? t.dialog.utmCopied : common.copyLink}
            </Button>
          </div>
        </div>
      </div>

        {serverError && (
          <p
            role="alert"
            className="rounded-md border border-destructive/30 bg-destructive/10 px-3 py-2 text-sm text-destructive"
          >
            {serverError}
          </p>
        )}

        <DialogFooter className="mt-4 pt-3 border-t">
          <Button
            type="button"
            variant="outline"
            onClick={() => onOpenChange(false)}
            disabled={isPending}
          >
            {common.cancel}
          </Button>
          <Button type="submit" disabled={isPending}>
            {isPending && <LoaderCircle className="size-4 animate-spin" />}
            {isEditing ? t.saveChanges : t.dialog.create}
          </Button>
        </DialogFooter>
      </form>
    </>
  );
}