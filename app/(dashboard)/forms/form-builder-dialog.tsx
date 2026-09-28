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
import { Badge } from "@/components/ui/badge";
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
  Layers,
  Code2,
} from "lucide-react";
import { FormPreviewPane } from "./form-preview-pane";
import { createForm, updateForm } from "@/lib/actions/forms";
import type {
  FormRow,
  FormField,
  FormFieldType,
  DealStage,
} from "@/lib/validations/forms";
import type { Dictionary, Locale } from "@/lib/i18n/get-dictionary";
import { cn } from "@/lib/utils";

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

  // Field addition handled by addFieldOfType below

  const addFieldOfType = (type: FormFieldType = "text") => {
    const id = `f_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`;
    let defaultLabel = "New Field";
    let defaultPlaceholder = "";
    let defaultOptions: string[] | undefined = undefined;
    let defaultCustomHtml: string | undefined = undefined;

    switch (type) {
      case "text":
        defaultLabel = "Short Text";
        defaultPlaceholder = "Enter text...";
        break;
      case "email":
        defaultLabel = "Email Address";
        defaultPlaceholder = "user@example.com";
        break;
      case "phone":
        defaultLabel = "Phone Number";
        defaultPlaceholder = "+1 (555) 000-0000";
        break;
      case "textarea":
        defaultLabel = "Detailed Message";
        defaultPlaceholder = "Write your message here...";
        break;
      case "select":
        defaultLabel = "Select Option";
        defaultOptions = ["Option 1", "Option 2", "Option 3"];
        break;
      case "multiselect":
        defaultLabel = "Select Services / Interests";
        defaultOptions = ["Design", "Development", "Marketing", "Consulting"];
        break;
      case "number":
        defaultLabel = "Quantity / Budget";
        defaultPlaceholder = "100";
        break;
      case "custom_html":
        defaultLabel = "Custom Section";
        defaultCustomHtml = `<div class="p-3 bg-muted/40 rounded-lg border text-sm">\n  <p class="font-medium text-foreground">💡 Important Notice</p>\n  <p class="text-xs text-muted-foreground mt-0.5">Please review before submitting.</p>\n</div>`;
        break;
    }

    setFields((prev) => [
      ...prev,
      {
        id,
        label: defaultLabel,
        type,
        required: false,
        placeholder: defaultPlaceholder,
        options: defaultOptions,
        customHtml: defaultCustomHtml,
      },
    ]);
  };

  const handleAddField = () => addFieldOfType("text");

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
      <DialogContent className="sm:max-w-none w-[94vw] max-w-6xl h-[88vh] max-h-[920px] p-0 flex flex-col gap-0 overflow-hidden bg-background">
        <DialogHeader className="p-4 px-6 border-b border-border bg-card/60 flex flex-row items-center justify-between space-y-0 shrink-0">
          <div className="space-y-1">
            <div className="flex items-center gap-2.5">
              <DialogTitle className="text-lg font-bold flex items-center gap-2">
                <Sparkles className="size-4 text-primary" />
                {isEdit ? t.editTitle : t.createTitle}
              </DialogTitle>
              <Badge
                variant={isPublished ? "default" : "secondary"}
                className="text-[11px] font-semibold uppercase"
              >
                {isPublished ? "Published" : "Draft"}
              </Badge>
            </div>
            <DialogDescription className="text-xs text-muted-foreground">
              {isEdit ? t.editDescription : t.createDescription}
            </DialogDescription>
          </div>

          {slug && (
            <div className="hidden sm:flex items-center gap-2 text-xs font-mono bg-muted/60 px-3 py-1.5 rounded-md border text-muted-foreground">
              <Globe className="size-3.5 text-primary shrink-0" />
              <span>/f/{slug}</span>
            </div>
          )}
        </DialogHeader>

        <form onSubmit={handleSubmit} className="flex-1 overflow-hidden flex flex-col">
          <div className="flex-1 flex flex-col lg:flex-row min-h-0 overflow-hidden">
            {/* Left Column: Form Builder Controls */}
            <div className="w-full lg:w-1/2 flex flex-col min-h-0 overflow-y-auto border-r border-border p-6 space-y-6">
              <Tabs
                value={activeTab}
                onValueChange={setActiveTab}
                className="w-full flex flex-col min-h-0"
              >
                <TabsList className="grid grid-cols-3 w-full shrink-0 mb-4">
                  <TabsTrigger value="fields" className="text-xs">
                    {t.tabs.fields}
                  </TabsTrigger>
                  <TabsTrigger value="settings" className="text-xs">
                    {t.tabs.settings}
                  </TabsTrigger>
                  <TabsTrigger
                    value="share"
                    disabled={!isEdit && !slug}
                    className="text-xs"
                  >
                    {t.tabs.share}
                  </TabsTrigger>
                </TabsList>

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
                  {/* Quick Add Palette */}
                  <div className="space-y-2">
                    <Label className="text-xs font-semibold text-muted-foreground uppercase tracking-wider flex items-center gap-1.5">
                      <Sparkles className="size-3.5 text-primary" />
                      <span>{t.fieldsTab.quickAdd || "Quick Add Field"}</span>
                    </Label>
                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        onClick={() => addFieldOfType("text")}
                        className="text-xs justify-start gap-1.5 h-8 font-normal"
                      >
                        <Plus className="size-3" /> {t.fieldsTab.types.text}
                      </Button>
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        onClick={() => addFieldOfType("email")}
                        className="text-xs justify-start gap-1.5 h-8 font-normal"
                      >
                        <Plus className="size-3" /> {t.fieldsTab.types.email}
                      </Button>
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        onClick={() => addFieldOfType("phone")}
                        className="text-xs justify-start gap-1.5 h-8 font-normal"
                      >
                        <Plus className="size-3" /> {t.fieldsTab.types.phone}
                      </Button>
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        onClick={() => addFieldOfType("textarea")}
                        className="text-xs justify-start gap-1.5 h-8 font-normal"
                      >
                        <Plus className="size-3" /> {t.fieldsTab.types.textarea}
                      </Button>
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        onClick={() => addFieldOfType("select")}
                        className="text-xs justify-start gap-1.5 h-8 font-normal"
                      >
                        <Plus className="size-3" /> {t.fieldsTab.types.select}
                      </Button>
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        onClick={() => addFieldOfType("multiselect")}
                        className="text-xs justify-start gap-1.5 h-8 font-normal"
                      >
                        <Plus className="size-3" /> {t.fieldsTab.types.multiselect}
                      </Button>
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        onClick={() => addFieldOfType("number")}
                        className="text-xs justify-start gap-1.5 h-8 font-normal"
                      >
                        <Plus className="size-3" /> {t.fieldsTab.types.number}
                      </Button>
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        onClick={() => addFieldOfType("custom_html")}
                        className="text-xs justify-start gap-1.5 h-8 font-normal"
                      >
                        <Code2 className="size-3 text-primary" />{" "}
                        {t.fieldsTab.types.custom_html}
                      </Button>
                    </div>
                  </div>

                  <div className="flex items-center justify-between">
                    <h3 className="text-sm font-bold tracking-tight flex items-center gap-1.5">
                      <Layers className="size-4 text-primary" />
                      <span>{t.fieldsTab.fieldsListTitle} ({fields.length})</span>
                    </h3>
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={handleAddField}
                    >
                      <Plus className="size-3.5 me-1" />
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
                                <SelectItem value="multiselect">
                                  {t.fieldsTab.types.multiselect}
                                </SelectItem>
                                <SelectItem value="number">
                                  {t.fieldsTab.types.number}
                                </SelectItem>
                                <SelectItem value="custom_html">
                                  {t.fieldsTab.types.custom_html}
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

                        {field.type === "custom_html" ? (
                          <div className="space-y-1.5">
                            <Label className="text-[11px] text-muted-foreground font-medium flex items-center justify-between">
                              <span>
                                {t.fieldsTab.customHtmlLabel ||
                                  "Custom HTML / Code Snippet"}
                              </span>
                              <span className="text-[10px] text-primary">
                                HTML & CSS
                              </span>
                            </Label>
                            <Textarea
                              value={field.customHtml || ""}
                              onChange={(e) =>
                                handleUpdateField(idx, {
                                  customHtml: e.target.value,
                                })
                              }
                              rows={3}
                              placeholder={
                                t.fieldsTab.customHtmlPlaceholder ||
                                '<div class="p-3 bg-muted rounded-lg text-sm">\n  <p>Custom disclaimer or styling banner</p>\n</div>'
                              }
                              className="font-mono text-xs"
                            />
                            <p className="text-[10px] text-muted-foreground">
                              {t.fieldsTab.customHtmlHint ||
                                "Rendered cleanly in the form layout."}
                            </p>
                          </div>
                        ) : null}

                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                        {field.type !== "custom_html" && (
                          <>
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

                          {(field.type === "select" ||
                            field.type === "multiselect") && (
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
                                placeholder={
                                  t.fieldsTab.fieldOptionsPlaceholder
                                }
                                className="h-8 text-xs"
                              />
                              <p className="text-[10px] text-muted-foreground">
                                {t.fieldsTab.optionsHint ||
                                  "Enter options separated by commas."}
                              </p>
                            </div>
                          )}
                        </>
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
              </Tabs>
            </div>

            {/* Right Column: Live Interactive Preview */}
            <FormPreviewPane
              title={title}
              slug={slug}
              description={description}
              fields={fields}
              submitButtonText={submitButtonText}
              dictionary={dictionary}
            />
          </div>

          <DialogFooter className="p-4 px-6 border-t border-border bg-muted/10 flex flex-col sm:flex-row items-center justify-between gap-3 shrink-0">
            <div>
              {serverError && (
                <p className="text-xs font-medium text-destructive">
                  {serverError}
                </p>
              )}
            </div>

            <div className="flex items-center gap-2">
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
            </div>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

