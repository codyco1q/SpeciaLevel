"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Check, Eye, Monitor, Send, Smartphone, Package } from "lucide-react";
import { Monogram } from "@/components/brand";
import type { FormField } from "@/lib/validations/forms";
import type { Dictionary } from "@/lib/i18n/get-dictionary";
import { cn } from "@/lib/utils";

interface FormPreviewPaneProps {
  title: string;
  slug?: string;
  description: string;
  fields: FormField[];
  submitButtonText?: string;
  dictionary: Dictionary["platform"]["forms"];
}

export function FormPreviewPane({
  title,
  slug,
  description,
  fields,
  submitButtonText,
  dictionary,
}: FormPreviewPaneProps) {
  const t = dictionary.builder;
  const [device, setDevice] = useState<"desktop" | "mobile">("desktop");
  const [previewData, setPreviewData] = useState<Record<string, any>>({});

  const handleMultiSelectToggle = (fieldId: string, option: string) => {
    setPreviewData((prev) => {
      const currentList: string[] = Array.isArray(prev[fieldId])
        ? [...prev[fieldId]]
        : [];
      const idx = currentList.indexOf(option);
      if (idx > -1) {
        currentList.splice(idx, 1);
      } else {
        currentList.push(option);
      }
      return { ...prev, [fieldId]: currentList };
    });
  };

  return (
    <div className="hidden lg:flex lg:w-1/2 flex-col min-h-0 bg-muted/20 overflow-y-auto p-6 space-y-4">
      {/* Preview Toolbar */}
      <div className="flex items-center justify-between shrink-0 border-b border-border/60 pb-3">
        <div className="space-y-0.5">
          <div className="flex items-center gap-2">
            <Eye className="size-4 text-primary" />
            <h3 className="text-sm font-bold text-foreground">
              {t.preview?.title || "Live Interactive Preview"}
            </h3>
          </div>
          <p className="text-[11px] text-muted-foreground">
            {t.preview?.subtitle || "Real-time client view as visitors see it on /f/{slug}"}
          </p>
        </div>

        <div className="flex items-center gap-1 bg-background/80 p-1 rounded-lg border border-border">
          <Button
            type="button"
            variant={device === "desktop" ? "secondary" : "ghost"}
            size="sm"
            onClick={() => setDevice("desktop")}
            className="h-7 px-2.5 text-xs gap-1.5"
          >
            <Monitor className="size-3.5" />
            <span>{t.preview?.deviceDesktop || "Desktop"}</span>
          </Button>
          <Button
            type="button"
            variant={device === "mobile" ? "secondary" : "ghost"}
            size="sm"
            onClick={() => setDevice("mobile")}
            className="h-7 px-2.5 text-xs gap-1.5"
          >
            <Smartphone className="size-3.5" />
            <span>{t.preview?.deviceMobile || "Mobile"}</span>
          </Button>
        </div>
      </div>

      {/* Preview Frame */}
      <div className="flex-1 flex items-center justify-center p-2 min-h-0">
        <div
          className={cn(
            "w-full transition-all duration-300 rounded-2xl border border-border bg-card shadow-lg p-6 space-y-5 text-foreground",
            device === "mobile"
              ? "max-w-[360px] shadow-2xl ring-1 ring-border/50"
              : "max-w-xl"
          )}
        >
          {/* Brand Header */}
          <div className="flex items-center gap-2 border-b border-border/60 pb-3">
            <Monogram className="size-6 text-[10px]" />
            <span className="font-bold text-xs tracking-tight">
              SpeciaLevel Form
            </span>
          </div>

          {/* Form Header */}
          <div className="space-y-1">
            <h2 className="text-lg sm:text-xl font-bold tracking-tight">
              {title || "Untitled Lead Form"}
            </h2>
            {description && (
              <p className="text-xs text-muted-foreground whitespace-pre-wrap leading-relaxed">
                {description}
              </p>
            )}
          </div>

          {/* Fields List */}
          {fields.length === 0 ? (
            <div className="py-8 text-center text-xs text-muted-foreground border border-dashed rounded-lg">
              {t.preview?.noFieldsYet ||
                "Add form fields on the left to see the interactive preview."}
            </div>
          ) : (
            <div className="space-y-3.5">
              {fields.map((field) => {
                if (field.type === "custom_html") {
                  return (
                    <div
                      key={field.id}
                      className="rounded-xl overflow-hidden border border-border/70 bg-muted/20 p-3 text-xs [&_a]:text-primary [&_a]:underline"
                      dangerouslySetInnerHTML={{
                        __html:
                          field.customHtml ||
                          field.placeholder ||
                          "<div class='p-2 text-muted-foreground'>Custom HTML snippet</div>",
                      }}
                    />
                  );
                }

                return (
                  <div key={field.id} className="space-y-1.5">
                    <Label className="text-xs font-semibold flex items-center justify-between">
                      <span>{field.label}</span>
                      {field.required && (
                        <span className="text-[11px] text-destructive">*</span>
                      )}
                    </Label>

                    {field.type === "textarea" ? (
                      <Textarea
                        rows={2}
                        placeholder={field.placeholder || ""}
                        value={previewData[field.id] || ""}
                        onChange={(e) =>
                          setPreviewData((prev) => ({
                            ...prev,
                            [field.id]: e.target.value,
                          }))
                        }
                        className="text-xs"
                      />
                    ) : field.type === "select" ? (
                      <Select
                        value={previewData[field.id] || ""}
                        onValueChange={(val) =>
                          setPreviewData((prev) => ({
                            ...prev,
                            [field.id]: val,
                          }))
                        }
                      >
                        <SelectTrigger className="h-9 text-xs">
                          <SelectValue
                            placeholder={
                              field.placeholder || "Select option..."
                            }
                          />
                        </SelectTrigger>
                        <SelectContent>
                          {(field.options || []).map((opt) => (
                            <SelectItem key={opt} value={opt}>
                              {opt}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    ) : field.type === "multiselect" ? (
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-1.5 pt-0.5">
                        {(field.options || []).map((opt) => {
                          const selected = Array.isArray(previewData[field.id])
                            ? previewData[field.id].includes(opt)
                            : false;
                          return (
                            <button
                              key={opt}
                              type="button"
                              onClick={() =>
                                handleMultiSelectToggle(field.id, opt)
                              }
                              className={cn(
                                "flex items-center gap-2 p-2 px-2.5 rounded-md border text-xs text-start transition-all cursor-pointer select-none",
                                selected
                                  ? "border-primary bg-primary/10 text-primary font-semibold"
                                  : "border-border bg-card/60 text-muted-foreground hover:border-primary/40 hover:bg-muted/40"
                              )}
                            >
                              <div
                                className={cn(
                                  "size-3.5 rounded border flex items-center justify-center transition-colors shrink-0",
                                  selected
                                    ? "border-primary bg-primary text-primary-foreground"
                                    : "border-muted-foreground/40 bg-background"
                                )}
                              >
                                {selected && (
                                  <Check className="size-2.5 stroke-[3]" />
                                )}
                              </div>
                              <span className="truncate">{opt}</span>
                            </button>
                          );
                        })}
                      </div>
                    ) : field.type === "product_select" ? (
                      <div className="space-y-2 pt-0.5">
                        {(!field.products || field.products.length === 0) ? (
                          <div className="rounded-lg border border-dashed border-border p-3 text-center text-xs text-muted-foreground">
                            No products added to this selection yet.
                          </div>
                        ) : (
                          <div className="grid grid-cols-1 gap-2">
                            {field.products.map((prod) => {
                              const isSelected = field.allowMultiple
                                ? Array.isArray(previewData[field.id]) &&
                                  previewData[field.id].includes(prod.id)
                                : previewData[field.id] === prod.id;

                              const handleToggle = () => {
                                if (field.allowMultiple) {
                                  const current: string[] = Array.isArray(
                                    previewData[field.id]
                                  )
                                    ? [...previewData[field.id]]
                                    : [];
                                  const idx = current.indexOf(prod.id);
                                  if (idx > -1) current.splice(idx, 1);
                                  else current.push(prod.id);
                                  setPreviewData((prev) => ({
                                    ...prev,
                                    [field.id]: current,
                                  }));
                                } else {
                                  setPreviewData((prev) => ({
                                    ...prev,
                                    [field.id]:
                                      prev[field.id] === prod.id ? undefined : prod.id,
                                  }));
                                }
                              };

                              return (
                                <button
                                  key={prod.id}
                                  type="button"
                                  onClick={handleToggle}
                                  className={cn(
                                    "flex items-start gap-2.5 p-2.5 rounded-lg border text-xs text-start transition-all cursor-pointer select-none",
                                    isSelected
                                      ? "border-primary bg-primary/10 text-foreground font-medium shadow-xs"
                                      : "border-border bg-card/60 text-muted-foreground hover:border-primary/40 hover:bg-muted/40"
                                  )}
                                >
                                  <div
                                    className={cn(
                                      "size-4 mt-0.5 flex items-center justify-center transition-colors shrink-0",
                                      field.allowMultiple ? "rounded" : "rounded-full",
                                      isSelected
                                        ? "border-primary bg-primary text-primary-foreground"
                                        : "border border-muted-foreground/40 bg-background"
                                    )}
                                  >
                                    {isSelected &&
                                      (field.allowMultiple ? (
                                        <Check className="size-2.5 stroke-[3]" />
                                      ) : (
                                        <div className="size-1.5 rounded-full bg-primary-foreground" />
                                      ))}
                                  </div>

                                  {prod.imageUrl ? (
                                    <img
                                      src={prod.imageUrl}
                                      alt={prod.title}
                                      className="size-10 rounded-md object-cover border border-border shrink-0 bg-muted/20"
                                    />
                                  ) : (
                                    <div className="size-10 rounded-md border border-dashed border-border bg-muted/20 flex items-center justify-center shrink-0 text-muted-foreground/60">
                                      <Package className="size-4" />
                                    </div>
                                  )}

                                  <div className="flex-1 min-w-0">
                                    <div className="flex items-center justify-between gap-2">
                                      <span className="font-semibold text-foreground truncate">
                                        {prod.title}
                                      </span>
                                      <span className="font-mono font-semibold text-primary shrink-0">
                                        ${Number(prod.unitPrice).toFixed(2)}
                                      </span>
                                    </div>
                                    {prod.description && (
                                      <p className="text-[11px] text-muted-foreground line-clamp-1 mt-0.5">
                                        {prod.description}
                                      </p>
                                    )}
                                  </div>
                                </button>
                              );
                            })}
                          </div>
                        )}
                      </div>
                    ) : (
                      <Input
                        type={
                          field.type === "email"
                            ? "email"
                            : field.type === "phone"
                            ? "tel"
                            : field.type === "number"
                            ? "number"
                            : "text"
                        }
                        placeholder={field.placeholder || ""}
                        value={previewData[field.id] || ""}
                        onChange={(e) =>
                          setPreviewData((prev) => ({
                            ...prev,
                            [field.id]: e.target.value,
                          }))
                        }
                        className="h-9 text-xs"
                      />
                    )}

                    {field.helpText && (
                      <p className="text-[10px] text-muted-foreground">
                        {field.helpText}
                      </p>
                    )}
                  </div>
                );
              })}
            </div>
          )}

          {/* Submit Button Preview */}
          <div className="pt-2">
            <Button
              type="button"
              className="w-full h-10 text-xs font-semibold gap-2"
            >
              <span>{submitButtonText || "Submit"}</span>
              <Send className="size-3.5 rtl:rotate-180" />
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}
