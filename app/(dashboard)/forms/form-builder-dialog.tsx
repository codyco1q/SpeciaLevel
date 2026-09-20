"use client";

import { useEffect, useState, useTransition } from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Plus,
  Trash2,
  ArrowUp,
  ArrowDown,
  Copy,
  Check,
  ExternalLink,
  Code,
  Globe,
  LoaderCircle,
  Sparkles,
} from "lucide-react";
import { createForm, updateForm } from "@/lib/actions/forms";
import type {
  FormRow,
  FormField,
  FormFieldType,
  DealStage,
} from "@/lib/validations/forms";
import type { Dictionary, Locale } from "@/lib/i18n/get-dictionary";

interface FormBuilderDialogProps {
  form: FormRow | null;
  open: boolean;
  initialTab?: "fields" | "settings" | "share";
  onOpenChange: (open: boolean) => void;
  onSaved?: (form: FormRow) => void;
  dictionary: Dictionary["platform"]["forms"];
  locale: Locale;
}

function generateSlug(text: string): string {
  return text
    .toLowerCase()
    .trim()
    .replace(/[^\w\s-]/g, "")
    .replace(/[\s_-]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

const DEFAULT_FIELDS: FormField[] = [
  {
    id: "f_name",
    label: "Full Name",
    type: "text",
    required: true,
    placeholder: "John Doe",
  },
  {
    id: "f_email",
    label: "Email Address",
    type: "email",
    required: true,
    placeholder: "john@example.com",
  },
  {
    id: "f_phone",
    label: "Phone Number",
    type: "phone",
    required: false,
    placeholder: "+1 (555) 000-0000",
  },
  {
    id: "f_message",
    label: "Message / Project Details",
    type: "textarea",
    required: false,
    placeholder: "How can we help you?",
  },
];

export function FormBuilderDialog({
  form,
  open,
  initialTab,
  onOpenChange,
  onSaved,
  dictionary,
  locale,
}: FormBuilderDialogProps) {
  const isEdit = !!form;
  const t = dictionary.builder;

  const [activeTab, setActiveTab] = useState<string>("fields");
  const [title, setTitle] = useState<string>("");
  const [slug, setSlug] = useState<string>("");
  const [slugModified, setSlugModified] = useState<boolean>(false);
  const [description, setDescription] = useState<string>("");
  const [isPublished, setIsPublished] = useState<boolean>(true);
  const [fields, setFields] = useState<FormField[]>(DEFAULT_FIELDS);

  // Settings
  const [submitButtonText, setSubmitButtonText] = useState<string>("");
  const [successMessage, setSuccessMessage] = useState<string>("");
  const [redirectUrl, setRedirectUrl] = useState<string>("");
  const [autoCreateDeal, setAutoCreateDeal] = useState<boolean>(false);
  const [defaultDealStage, setDefaultDealStage] = useState<DealStage>("lead");
  const [defaultDealValue, setDefaultDealValue] = useState<string>("0");

  // Status & Error
  const [isPending, startTransition] = useTransition();
  const [serverError, setServerError] = useState<string | null>(null);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string[]>>({});
  const [copiedLink, setCopiedLink] = useState<boolean>(false);
  const [copiedIframe, setCopiedIframe] = useState<boolean>(false);
  const [copiedScript, setCopiedScript] = useState<boolean>(false);

  const [origin, setOrigin] = useState<string>("");

  useEffect(() => {
    if (typeof window !== "undefined") {
      setOrigin(window.location.origin);
    }
  }, []);

  useEffect(() => {
    if (open) {
      setActiveTab(initialTab ?? "fields");
      if (form) {
        setTitle(form.title);
        setSlug(form.slug);
        setSlugModified(true);
        setDescription(form.description ?? "");
        setIsPublished(form.isPublished);
        setFields(form.fields?.length ? form.fields : DEFAULT_FIELDS);
        setSubmitButtonText(form.settings.submitButtonText ?? "");
        setSuccessMessage(form.settings.successMessage ?? "");
        setRedirectUrl(form.settings.redirectUrl ?? "");
        setAutoCreateDeal(form.settings.autoCreateDeal ?? false);
        setDefaultDealStage(form.settings.defaultDealStage ?? "lead");
        setDefaultDealValue(String(form.settings.defaultDealValue ?? 0));
      } else {
        setTitle("");
        setSlug("");
        setSlugModified(false);
        setDescription("");
        setIsPublished(true);
        setFields(DEFAULT_FIELDS);
        setSubmitButtonText("");
        setSuccessMessage("");
        setRedirectUrl("");
        setAutoCreateDeal(false);
        setDefaultDealStage("lead");
        setDefaultDealValue("0");
      }
      setServerError(null);
      setFieldErrors({});
    }
  }, [open, form, initialTab]);

  const handleTitleChange = (val: string) => {
    setTitle(val);
    if (!slugModified && !isEdit) {
      setSlug(generateSlug(val));
    }
  };

  const handleAddField = () => {
    const newField: FormField = {
      id: `f_${Date.now()}`,
      label: `Field ${fields.length + 1}`,
      type: "text",
      required: false,
      placeholder: "",
    };
    setFields([...fields, newField]);
  };

  const handleUpdateField = (index: number, patch: Partial<FormField>) => {
    const updated = [...fields];
    updated[index] = { ...updated[index], ...patch };
    setFields(updated);
  };

  const handleRemoveField = (index: number) => {
    setFields(fields.filter((_, i) => i !== index));
  };

  const handleMoveField = (index: number, direction: "up" | "down") => {
    const targetIndex = direction === "up" ? index - 1 : index + 1;
    if (targetIndex < 0 || targetIndex >= fields.length) return;
    const updated = [...fields];
    const temp = updated[index];
    updated[index] = updated[targetIndex];
    updated[targetIndex] = temp;
    setFields(updated);
  };


  const handleCopy = (text: string, type: "link" | "iframe" | "script") => {
    navigator.clipboard.writeText(text);
    if (type === "link") {
      setCopiedLink(true);
      setTimeout(() => setCopiedLink(false), 2000);
    } else if (type === "iframe") {
      setCopiedIframe(true);
      setTimeout(() => setCopiedIframe(false), 2000);
    } else {
      setCopiedScript(true);
      setTimeout(() => setCopiedScript(false), 2000);
    }
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setServerError(null);
    setFieldErrors({});

    const payload = {
      title,
      slug,
      description: description || undefined,
      isPublished,
      fields,
      settings: {
        submitButtonText: submitButtonText || undefined,
        successMessage: successMessage || undefined,
        redirectUrl: redirectUrl || undefined,
        autoCreateDeal,
        defaultDealStage,
        defaultDealValue: Number(defaultDealValue) || 0,
      },
    };

    startTransition(async () => {
      const res = isEdit
        ? await updateForm(form.id, payload, locale)
        : await createForm(payload, locale);

      if (res.status === "error") {
        setServerError(res.error ?? "Operation failed");
        if (res.fieldErrors) {
          setFieldErrors(res.fieldErrors);
        }
      } else {
        if (res.data) {
          onSaved?.(res.data);
        }
        onOpenChange(false);
      }
    });
  };

  const publicUrl = `${origin}/f/${slug || form?.slug || ""}`;
  const iframeSnippet = `<iframe src="${publicUrl}" width="100%" height="650" frameborder="0" style="border:0;border-radius:12px;overflow:hidden;width:100%;max-width:640px;box-shadow:0 4px 20px rgba(0,0,0,0.08);" allowtransparency="true"></iframe>`;
  const scriptSnippet = `<div id="inbound-lead-form"></div>\n<script src="${origin}/f/embed.js" data-form-slug="${slug || form?.slug || ""}"></script>`;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90vh] max-w-3xl overflow-hidden flex flex-col p-0">
        <DialogHeader className="p-6 pb-4 border-b border-border">
          <DialogTitle className="text-xl font-bold flex items-center gap-2">
            <Sparkles className="size-5 text-primary" />
            {isEdit ? t.editTitle : t.createTitle}
          </DialogTitle>
          <DialogDescription className="text-xs text-muted-foreground">
            {isEdit ? t.editDescription : t.createDescription}
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="flex-1 overflow-hidden flex flex-col">
          <Tabs
            value={activeTab}
            onValueChange={setActiveTab}
            className="flex-1 flex flex-col overflow-hidden"
          >
            <div className="px-6 border-b border-border bg-muted/20">
              <TabsList className="h-10">
                <TabsTrigger value="fields" className="text-xs">
                  {t.tabs.fields}
                </TabsTrigger>
                <TabsTrigger value="settings" className="text-xs">
                  {t.tabs.settings}
                </TabsTrigger>
                {isEdit && (
                  <TabsTrigger value="share" className="text-xs">
                    {t.tabs.share}
                  </TabsTrigger>
                )}
              </TabsList>
            </div>

            <div className="flex-1 overflow-y-auto p-6 space-y-6">
              {serverError && (
                <div className="rounded-lg bg-destructive/10 border border-destructive/20 p-3 text-xs text-destructive font-medium">
                  {serverError}
                </div>
              )}

              {/* ── FIELDS TAB ── */}
              <TabsContent value="fields" className="space-y-6 mt-0">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="form-title" className="text-xs font-medium">
                      {t.fieldsTab.titleLabel} *
                    </Label>
                    <Input
                      id="form-title"
                      value={title}
                      onChange={(e) => handleTitleChange(e.target.value)}
                      placeholder={t.fieldsTab.titlePlaceholder}
                      required
                    />
                    {fieldErrors.title && (
                      <p className="text-[11px] text-destructive">
                        {fieldErrors.title[0]}
                      </p>
                    )}
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="form-slug" className="text-xs font-medium">
                      {t.fieldsTab.slugLabel} *
                    </Label>
                    <Input
                      id="form-slug"
                      value={slug}
                      onChange={(e) => {
                        setSlugModified(true);
                        setSlug(generateSlug(e.target.value));
                      }}
                      placeholder={t.fieldsTab.slugPlaceholder}
                      required
                    />
                    <p className="text-[11px] text-muted-foreground font-mono">
                      {t.fieldsTab.slugHint.replace("{slug}", slug || "...")}
                    </p>
                    {fieldErrors.slug && (
                      <p className="text-[11px] text-destructive">
                        {fieldErrors.slug[0]}
                      </p>
                    )}
                  </div>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="form-desc" className="text-xs font-medium">
                    {t.fieldsTab.descriptionLabel}
                  </Label>
                  <Textarea
                    id="form-desc"
                    value={description}
                    onChange={(e) => setDescription(e.target.value)}
                    placeholder={t.fieldsTab.descriptionPlaceholder}
                    rows={2}
                  />
                </div>

                <div className="flex items-center justify-between rounded-lg border border-border p-3.5 bg-muted/10">
                  <div>
                    <Label htmlFor="form-published" className="text-xs font-semibold cursor-pointer">
                      {t.fieldsTab.publishedLabel}
                    </Label>
                  </div>
                  <Switch
                    id="form-published"
                    checked={isPublished}
                    onCheckedChange={setIsPublished}
                  />
                </div>

                {/* Form Fields Section */}
                <div className="space-y-4 pt-2">
                  <div className="flex items-center justify-between">
                    <h3 className="text-sm font-bold tracking-tight">
                      {t.fieldsTab.fieldsListTitle} ({fields.length})
                    </h3>
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={handleAddField}
                    >
                      <Plus className="size-3.5" />
                      {t.fieldsTab.addField}
                    </Button>
                  </div>

                  {fieldErrors.fields && (
                    <p className="text-xs text-destructive font-medium">
                      {fieldErrors.fields[0]}
                    </p>
                  )}

                  <div className="space-y-3">

                    {fields.map((field, idx) => (
                      <div
                        key={field.id}
                        className="rounded-lg border border-border bg-card p-3.5 space-y-3 shadow-sm transition hover:border-border/80"
                      >
                        <div className="flex items-center justify-between gap-2">
                          <span className="text-xs font-semibold text-muted-foreground font-mono">
                            #{idx + 1}
                          </span>
                          <div className="flex items-center gap-1">
                            <Button
                              type="button"
                              variant="ghost"
                              size="icon"
                              className="size-7"
                              disabled={idx === 0}
                              onClick={() => handleMoveField(idx, "up")}
                            >
                              <ArrowUp className="size-3.5" />
                            </Button>
                            <Button
                              type="button"
                              variant="ghost"
                              size="icon"
                              className="size-7"
                              disabled={idx === fields.length - 1}
                              onClick={() => handleMoveField(idx, "down")}
                            >
                              <ArrowDown className="size-3.5" />
                            </Button>
                            <Button
                              type="button"
                              variant="ghost"
                              size="icon"
                              className="size-7 text-destructive hover:text-destructive"
                              disabled={fields.length <= 1}
                              onClick={() => handleRemoveField(idx)}
                            >
                              <Trash2 className="size-3.5" />
                            </Button>
                          </div>
                        </div>

                        <div className="grid grid-cols-1 sm:grid-cols-12 gap-3">
                          <div className="sm:col-span-5 space-y-1">
                            <Label className="text-[11px] text-muted-foreground font-medium">
                              {t.fieldsTab.fieldLabel}
                            </Label>
                            <Input
                              value={field.label}
                              onChange={(e) =>
                                handleUpdateField(idx, { label: e.target.value })
                              }
                              placeholder="Label"
                              required
                              className="h-8 text-xs"
                            />
                          </div>

                          <div className="sm:col-span-4 space-y-1">
                            <Label className="text-[11px] text-muted-foreground font-medium">
                              {t.fieldsTab.fieldType}
                            </Label>
                            <Select
                              value={field.type}
                              onValueChange={(val: FormFieldType) =>
                                handleUpdateField(idx, { type: val })
                              }
                            >
                              <SelectTrigger className="h-8 text-xs">
                                <SelectValue />
                              </SelectTrigger>
                              <SelectContent>
                                <SelectItem value="text">
                                  {t.fieldsTab.types.text}
                                </SelectItem>
                                <SelectItem value="email">
                                  {t.fieldsTab.types.email}
                                </SelectItem>
                                <SelectItem value="phone">
                                  {t.fieldsTab.types.phone}
                                </SelectItem>
                                <SelectItem value="textarea">
                                  {t.fieldsTab.types.textarea}
                                </SelectItem>
                                <SelectItem value="select">
                                  {t.fieldsTab.types.select}
                                </SelectItem>
                                <SelectItem value="number">
                                  {t.fieldsTab.types.number}
                                </SelectItem>
                              </SelectContent>
                            </Select>
                          </div>

                          <div className="sm:col-span-3 flex items-end pb-1.5">
                            <label className="flex items-center gap-2 text-xs font-medium cursor-pointer">
                              <input
                                type="checkbox"
                                checked={field.required}
                                onChange={(e) =>
                                  handleUpdateField(idx, {
                                    required: e.target.checked,
                                  })
                                }
                                className="size-4 rounded border-border text-primary focus:ring-primary"
                              />
                              <span>{t.fieldsTab.fieldRequired}</span>
                            </label>
                          </div>
                        </div>

                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                          <div className="space-y-1">
                            <Label className="text-[11px] text-muted-foreground">
                              {t.fieldsTab.fieldPlaceholder}
                            </Label>
                            <Input
                              value={field.placeholder ?? ""}
                              onChange={(e) =>
                                handleUpdateField(idx, {
                                  placeholder: e.target.value,
                                })
                              }
                              placeholder="Optional placeholder..."
                              className="h-8 text-xs"
                            />
                          </div>

                          {field.type === "select" && (
                            <div className="space-y-1">
                              <Label className="text-[11px] text-muted-foreground">
                                {t.fieldsTab.fieldOptions}
                              </Label>
                              <Input
                                value={field.options?.join(", ") ?? ""}
                                onChange={(e) =>
                                  handleUpdateField(idx, {
                                    options: e.target.value
                                      .split(",")
                                      .map((s) => s.trim())
                                      .filter(Boolean),
                                  })
                                }
                                placeholder={t.fieldsTab.fieldOptionsPlaceholder}
                                className="h-8 text-xs"
                              />
                            </div>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              </TabsContent>

              {/* ── SETTINGS TAB ── */}
              <TabsContent value="settings" className="space-y-6 mt-0">
                <div className="space-y-4">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label htmlFor="submit-btn-text" className="text-xs font-medium">
                        {t.settingsTab.submitButtonTextLabel}
                      </Label>
                      <Input
                        id="submit-btn-text"
                        value={submitButtonText}
                        onChange={(e) => setSubmitButtonText(e.target.value)}
                        placeholder={t.settingsTab.submitButtonTextPlaceholder}
                      />
                    </div>

                    <div className="space-y-2">
                      <Label htmlFor="redirect-url" className="text-xs font-medium">
                        {t.settingsTab.redirectUrlLabel}
                      </Label>
                      <Input
                        id="redirect-url"
                        value={redirectUrl}
                        onChange={(e) => setRedirectUrl(e.target.value)}
                        placeholder={t.settingsTab.redirectUrlPlaceholder}
                        type="url"
                      />
                    </div>
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="success-message" className="text-xs font-medium">
                      {t.settingsTab.successMessageLabel}
                    </Label>
                    <Textarea
                      id="success-message"
                      value={successMessage}
                      onChange={(e) => setSuccessMessage(e.target.value)}
                      placeholder={t.settingsTab.successMessagePlaceholder}
                      rows={2}
                    />
                  </div>

                  {/* CRM Integration Card */}
                  <div className="rounded-xl border border-primary/20 bg-primary/5 p-4 space-y-4">
                    <div>
                      <h4 className="text-sm font-bold text-foreground">
                        {t.settingsTab.crmSectionTitle}
                      </h4>
                      <p className="text-xs text-muted-foreground mt-0.5">
                        {t.settingsTab.crmSectionDescription}
                      </p>
                    </div>

                    <div className="flex items-center justify-between rounded-lg border border-border bg-card p-3">
                      <Label htmlFor="auto-create-deal" className="text-xs font-semibold cursor-pointer">
                        {t.settingsTab.autoCreateDealLabel}
                      </Label>
                      <Switch
                        id="auto-create-deal"
                        checked={autoCreateDeal}
                        onCheckedChange={setAutoCreateDeal}
                      />
                    </div>

                    {autoCreateDeal && (
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-2">
                        <div className="space-y-1.5">
                          <Label className="text-xs font-medium">
                            {t.settingsTab.dealStageLabel}
                          </Label>
                          <Select
                            value={defaultDealStage}
                            onValueChange={(val: DealStage) =>
                              setDefaultDealStage(val)
                            }
                          >
                            <SelectTrigger className="h-9 text-xs bg-card">
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="lead">Lead</SelectItem>
                              <SelectItem value="contacted">Contacted</SelectItem>
                              <SelectItem value="proposal">Proposal</SelectItem>
                              <SelectItem value="won">Won</SelectItem>
                              <SelectItem value="lost">Lost</SelectItem>
                            </SelectContent>
                          </Select>
                        </div>

                        <div className="space-y-1.5">
                          <Label className="text-xs font-medium">
                            {t.settingsTab.dealValueLabel}
                          </Label>
                          <Input
                            type="number"
                            min="0"
                            step="any"
                            value={defaultDealValue}
                            onChange={(e) => setDefaultDealValue(e.target.value)}
                            className="h-9 text-xs bg-card"
                          />
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              </TabsContent>

              {/* ── SHARE & EMBED TAB ── */}
              {isEdit && (
                <TabsContent value="share" className="space-y-6 mt-0">
                  {/* Direct Link */}
                  <div className="rounded-xl border border-border bg-card p-4 space-y-3">
                    <div className="flex items-center gap-2">
                      <Globe className="size-4 text-primary" />
                      <h4 className="text-sm font-bold">
                        {t.shareTab.publicLinkLabel}
                      </h4>
                    </div>
                    <p className="text-xs text-muted-foreground">
                      {t.shareTab.publicLinkHint}
                    </p>
                    <div className="flex items-center gap-2">
                      <Input
                        readOnly
                        value={publicUrl}
                        className="font-mono text-xs bg-muted/40"
                      />
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        onClick={() => handleCopy(publicUrl, "link")}
                      >
                        {copiedLink ? (
                          <Check className="size-3.5 text-emerald-500" />
                        ) : (
                          <Copy className="size-3.5" />
                        )}
                        {copiedLink ? t.shareTab.copied : t.shareTab.copyLink}
                      </Button>
                      <Button asChild variant="ghost" size="icon" className="size-8">
                        <a href={publicUrl} target="_blank" rel="noopener noreferrer">
                          <ExternalLink className="size-3.5" />
                        </a>
                      </Button>
                    </div>
                  </div>

                  {/* Responsive iframe Embed */}
                  <div className="rounded-xl border border-border bg-card p-4 space-y-3">
                    <div className="flex items-center gap-2">
                      <Code className="size-4 text-primary" />
                      <h4 className="text-sm font-bold">
                        {t.shareTab.iframeEmbedLabel}
                      </h4>
                    </div>
                    <p className="text-xs text-muted-foreground">
                      {t.shareTab.iframeEmbedHint}
                    </p>
                    <Textarea
                      readOnly
                      value={iframeSnippet}
                      rows={3}
                      className="font-mono text-xs bg-muted/40"
                    />
                    <div className="flex justify-end">
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        onClick={() => handleCopy(iframeSnippet, "iframe")}
                      >
                        {copiedIframe ? (
                          <Check className="size-3.5 text-emerald-500" />
                        ) : (
                          <Copy className="size-3.5" />
                        )}
                        {copiedIframe ? t.shareTab.copied : t.shareTab.copyIframe}
                      </Button>
                    </div>
                  </div>

                  {/* Inline Script Embed */}
                  <div className="rounded-xl border border-border bg-card p-4 space-y-3">
                    <div className="flex items-center gap-2">
                      <Code className="size-4 text-primary" />
                      <h4 className="text-sm font-bold">
                        {t.shareTab.scriptEmbedLabel}
                      </h4>
                    </div>
                    <p className="text-xs text-muted-foreground">
                      {t.shareTab.scriptEmbedHint}
                    </p>
                    <Textarea
                      readOnly
                      value={scriptSnippet}
                      rows={3}
                      className="font-mono text-xs bg-muted/40"
                    />
                    <div className="flex justify-end">
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        onClick={() => handleCopy(scriptSnippet, "script")}
                      >
                        {copiedScript ? (
                          <Check className="size-3.5 text-emerald-500" />
                        ) : (
                          <Copy className="size-3.5" />
                        )}
                        {copiedScript ? t.shareTab.copied : t.shareTab.copyScript}
                      </Button>
                    </div>
                  </div>
                </TabsContent>
              )}
            </div>
          </Tabs>

          <DialogFooter className="p-4 px-6 border-t border-border bg-muted/10 flex items-center justify-end gap-2">
            <Button
              type="button"
              variant="outline"
              onClick={() => onOpenChange(false)}
            >
              {t.cancel}
            </Button>
            <Button type="submit" disabled={isPending}>
              {isPending && <LoaderCircle className="size-4 animate-spin" />}
              {isEdit ? t.submitUpdate : t.submitCreate}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

