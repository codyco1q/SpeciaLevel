"use client"

import { useEffect, useState, useTransition } from "react"
import { LoaderCircle } from "lucide-react"
import { z } from "zod"

import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { Textarea } from "@/components/ui/textarea"
import {
  AI_MODEL_PROVIDERS,
  createAiPromptSchema,
  type AiModelProvider,
} from "@/lib/validations/ai"
import {
  createAiPrompt,
  updateAiPrompt,
  type AiPromptRow,
} from "@/lib/actions/ai"
import type { Dictionary } from "@/lib/i18n/get-dictionary"

interface PromptDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  prompt?: AiPromptRow | null
  onSaved: (prompt: AiPromptRow) => void
  platform: Dictionary["platform"]
}

/** Mirrors the automation-dialog fieldError helper for per-field Zod errors. */
function fieldError(
  fieldErrors: Record<string, string[]>,
  field: string
): React.ReactNode {
  if (!fieldErrors[field]) return null
  return (
    <p id={`ai-${field}-error`} className="text-[11px] text-destructive">
      {fieldErrors[field][0]}
    </p>
  )
}

function mapIssues(issues: z.ZodIssue[]): Record<string, string[]> {
  const errors: Record<string, string[]> = {}
  for (const issue of issues) {
    const key = issue.path[0]
    if (typeof key !== "string") continue
    if (!errors[key]) errors[key] = []
    errors[key].push(issue.message)
  }
  return errors
}

export function PromptDialog({
  open,
  onOpenChange,
  prompt,
  onSaved,
  platform,
}: PromptDialogProps) {
  const t = platform.ai
  const isEditing = Boolean(prompt)

  const [name, setName] = useState("")
  const [description, setDescription] = useState("")
  const [modelProvider, setModelProvider] = useState<AiModelProvider>("openai")
  const [modelName, setModelName] = useState("")
  const [systemPrompt, setSystemPrompt] = useState("")
  const [userTemplate, setUserTemplate] = useState("")
  const [temperature, setTemperature] = useState("0.7")
  const [maxTokens, setMaxTokens] = useState("")
  const [fieldErrors, setFieldErrors] = useState<Record<string, string[]>>({})
  const [serverError, setServerError] = useState<string | null>(null)
  const [isPending, startTransition] = useTransition()

  const inputSchema = createAiPromptSchema(t.errors)

  // Reset form state when opening (deferred to avoid clearing while the
  // dialog's enter animation is still running).
  useEffect(() => {
    if (!open) return
    let cancelled = false
    void Promise.resolve().then(() => {
      if (cancelled) return
      setName(prompt?.name ?? "")
      setDescription(prompt?.description ?? "")
      setModelProvider((prompt?.modelProvider as AiModelProvider) ?? "openai")
      setModelName(prompt?.modelName ?? "")
      setSystemPrompt(prompt?.systemPrompt ?? "")
      setUserTemplate(prompt?.userTemplate ?? "")
      setTemperature(prompt ? String(prompt.temperature) : "0.7")
      setMaxTokens(prompt?.maxTokens != null ? String(prompt.maxTokens) : "")
      setFieldErrors({})
      setServerError(null)
    })
    return () => {
      cancelled = true
    }
  }, [open, prompt])

  function onSubmit() {
    setServerError(null)
    setFieldErrors({})

    const parsed = inputSchema.safeParse({
      name,
      description,
      modelProvider,
      modelName,
      systemPrompt,
      userTemplate,
      temperature: temperature.trim() === "" ? NaN : Number(temperature),
      maxTokens:
        maxTokens.trim() === ""
          ? null
          : Number.isNaN(Number(maxTokens))
            ? NaN
            : Number(maxTokens),
    })
    if (!parsed.success) {
      setFieldErrors(mapIssues(parsed.error.issues))
      return
    }

    startTransition(async () => {
      const result =
        isEditing && prompt
          ? await updateAiPrompt(prompt.id, parsed.data)
          : await createAiPrompt(parsed.data)

      if (result.status === "error") {
        setFieldErrors(result.fieldErrors)
        setServerError(result.error ?? t.errors.createFailed)
        return
      }
      onSaved(result.prompt)
      onOpenChange(false)
    })
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-xl">
        <DialogHeader>
          <DialogTitle>
            {isEditing ? t.prompts.dialog.editTitle : t.prompts.dialog.title}
          </DialogTitle>
          <DialogDescription>{t.prompts.dialog.description}</DialogDescription>
        </DialogHeader>

        <form
          onSubmit={(event) => {
            event.preventDefault()
            onSubmit()
          }}
          className="grid gap-4"
          noValidate
        >
          <div className="grid gap-1.5">
            <Label htmlFor="ai-prompt-name">{t.prompts.dialog.nameLabel}</Label>
            <Input
              id="ai-prompt-name"
              value={name}
              onChange={(event) => setName(event.target.value)}
              placeholder={t.prompts.dialog.namePlaceholder}
              aria-invalid={Boolean(fieldErrors.name)}
              aria-describedby={fieldErrors.name ? "ai-name-error" : undefined}
            />
            {fieldError(fieldErrors, "name")}
          </div>

          <div className="grid gap-1.5">
            <Label htmlFor="ai-prompt-description">
              {t.prompts.dialog.descriptionLabel}
            </Label>
            <Input
              id="ai-prompt-description"
              value={description}
              onChange={(event) => setDescription(event.target.value)}
              placeholder={t.prompts.dialog.descriptionPlaceholder}
            />
            {fieldError(fieldErrors, "description")}
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <div className="grid gap-1.5">
              <Label htmlFor="ai-prompt-provider">
                {t.prompts.dialog.modelProviderLabel}
              </Label>
              <Select
                value={modelProvider}
                onValueChange={(value) =>
                  setModelProvider(value as AiModelProvider)
                }
              >
                <SelectTrigger id="ai-prompt-provider" className="w-full">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {AI_MODEL_PROVIDERS.map((provider) => (
                    <SelectItem key={provider} value={provider}>
                      {t.prompts.providers[provider]}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {fieldError(fieldErrors, "modelProvider")}
            </div>

            <div className="grid gap-1.5">
              <Label htmlFor="ai-prompt-model-name">
                {t.prompts.dialog.modelNameLabel}
              </Label>
              <Input
                id="ai-prompt-model-name"
                value={modelName}
                onChange={(event) => setModelName(event.target.value)}
                placeholder={t.prompts.dialog.modelNamePlaceholder}
                aria-invalid={Boolean(fieldErrors.modelName)}
                aria-describedby={
                  fieldErrors.modelName ? "ai-modelName-error" : undefined
                }
              />
              {fieldError(fieldErrors, "modelName")}
            </div>
          </div>

          <div className="grid gap-1.5">
            <Label htmlFor="ai-prompt-system">
              {t.prompts.dialog.systemPromptLabel}
            </Label>
            <Textarea
              id="ai-prompt-system"
              value={systemPrompt}
              onChange={(event) => setSystemPrompt(event.target.value)}
              rows={3}
              placeholder={t.prompts.dialog.systemPromptPlaceholder}
            />
            {fieldError(fieldErrors, "systemPrompt")}
          </div>

          <div className="grid gap-1.5">
            <Label htmlFor="ai-prompt-template">
              {t.prompts.dialog.userTemplateLabel}
            </Label>
            <Textarea
              id="ai-prompt-template"
              value={userTemplate}
              onChange={(event) => setUserTemplate(event.target.value)}
              rows={3}
              placeholder={t.prompts.dialog.userTemplatePlaceholder}
              aria-invalid={Boolean(fieldErrors.userTemplate)}
              aria-describedby={
                fieldErrors.userTemplate ? "ai-userTemplate-error" : undefined
              }
            />
            <p className="text-[11px] text-muted-foreground">
              {t.prompts.subtitle}
            </p>
            {fieldError(fieldErrors, "userTemplate")}
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <div className="grid gap-1.5">
              <Label htmlFor="ai-prompt-temperature">
                {t.prompts.dialog.temperatureLabel}
              </Label>
              <Input
                id="ai-prompt-temperature"
                type="number"
                inputMode="decimal"
                min={0}
                max={2}
                step={0.1}
                value={temperature}
                onChange={(event) => setTemperature(event.target.value)}
                aria-invalid={Boolean(fieldErrors.temperature)}
              />
              {fieldError(fieldErrors, "temperature")}
            </div>

            <div className="grid gap-1.5">
              <Label htmlFor="ai-prompt-max-tokens">
                {t.prompts.dialog.maxTokensLabel}
              </Label>
              <Input
                id="ai-prompt-max-tokens"
                type="number"
                inputMode="numeric"
                min={1}
                step={1}
                value={maxTokens}
                onChange={(event) => setMaxTokens(event.target.value)}
                placeholder={t.prompts.dialog.maxTokensPlaceholder}
                aria-invalid={Boolean(fieldErrors.maxTokens)}
              />
              {fieldError(fieldErrors, "maxTokens")}
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

          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => onOpenChange(false)}
              disabled={isPending}
            >
              {platform.common.cancel}
            </Button>
            <Button type="submit" disabled={isPending}>
              {isPending && <LoaderCircle className="size-4 animate-spin" />}
              {isEditing
                ? t.prompts.dialog.saveChanges
                : t.prompts.dialog.create}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}