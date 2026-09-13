"use client"

import { useEffect, useState } from "react"
import { Check, Copy, LoaderCircle, Play } from "lucide-react"

import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Textarea } from "@/components/ui/textarea"
import { executeAiTask, type AiPromptRow } from "@/lib/actions/ai"
import { renderTemplatePreview } from "./ai-meta"
import type { Dictionary } from "@/lib/i18n/get-dictionary"

interface RunPromptDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  prompt: AiPromptRow | null
  platform: Dictionary["platform"]
}

export function RunPromptDialog({
  open,
  onOpenChange,
  prompt,
  platform,
}: RunPromptDialogProps) {
  const t = platform.ai

  const [input, setInput] = useState("")
  const [output, setOutput] = useState("")
  const [error, setError] = useState<string | null>(null)
  const [running, setRunning] = useState(false)
  const [copied, setCopied] = useState(false)
  const [modelUsed, setModelUsed] = useState<string | null>(null)
  const [durationMs, setDurationMs] = useState<number | null>(null)

  // Reset form state when opening (deferred to avoid clearing while the
  // dialog's enter animation is still running).
  useEffect(() => {
    if (!open) return
    let cancelled = false
    void Promise.resolve().then(() => {
      if (cancelled) return
      setInput("")
      setOutput("")
      setError(null)
      setCopied(false)
      setModelUsed(null)
      setDurationMs(null)
    })
    return () => {
      cancelled = true
    }
  }, [open, prompt])

  function handleRun() {
    if (running || !prompt) return

    if (prompt.userTemplate.includes("{input}") && !input.trim()) {
      setError(t.errors.inputRequired)
      return
    }

    setError(null)
    setCopied(false)
    setOutput("")
    setModelUsed(null)
    setDurationMs(null)
    setRunning(true)

    executeAiTask({
      promptId: prompt.id,
      toolKey: null,
      inputData: { input },
    })
      .then((result) => {
        setRunning(false)
        if (result.status === "error") {
          setError(result.error)
          return
        }
        setOutput(result.execution.output)
        setModelUsed(result.execution.modelUsed)
        setDurationMs(result.execution.durationMs)
      })
      .catch(() => {
        setRunning(false)
        setError(t.errors.execFailed)
      })
  }

  async function handleCopy() {
    if (!output) return
    try {
      await navigator.clipboard.writeText(output)
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    } catch {
      // Clipboard unavailable — nothing actionable to surface.
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-xl">
        <DialogHeader>
          <DialogTitle>
            {prompt ? `${prompt.name} — ${t.prompts.run.title}` : t.prompts.run.title}
          </DialogTitle>
          <DialogDescription>{t.prompts.run.description}</DialogDescription>
        </DialogHeader>

        <div className="grid gap-4">
          {prompt && (
            <pre
              dir="ltr"
              className="max-w-full truncate rounded-md border border-border bg-muted/40 px-2 py-1 text-[11px] text-muted-foreground"
            >
              {renderTemplatePreview(prompt.userTemplate, input)}
            </pre>
          )}

          <div className="grid gap-1.5">
            <label
              htmlFor="ai-run-input"
              className="text-sm font-medium text-foreground"
            >
              {t.prompts.run.inputLabel}
            </label>
            <Textarea
              id="ai-run-input"
              value={input}
              onChange={(event) => setInput(event.target.value)}
              placeholder={t.prompts.run.inputPlaceholder}
              rows={5}
              className="resize-y"
            />
          </div>

          {error && (
            <p
              role="alert"
              className="rounded-md border border-destructive/30 bg-destructive/10 px-3 py-2 text-sm text-destructive"
            >
              {error}
            </p>
          )}

          <div className="grid gap-1.5">
            <div className="flex items-center justify-between gap-3">
              <p className="text-sm font-medium text-foreground">
                {t.prompts.run.outputTitle}
              </p>
              {output && (
                <Button variant="ghost" size="sm" onClick={handleCopy}>
                  {copied ? (
                    <Check className="size-3.5" />
                  ) : (
                    <Copy className="size-3.5" />
                  )}
                  {copied ? t.playground.copied : t.playground.copy}
                </Button>
              )}
            </div>
            {output ? (
              <>
                <pre
                  dir="auto"
                  className="max-h-[320px] overflow-y-auto whitespace-pre-wrap rounded-md border border-border bg-muted/40 p-3 text-sm leading-relaxed"
                >
                  {output}
                </pre>
                {(modelUsed || durationMs !== null) && (
                  <p className="text-xs text-muted-foreground">
                    {modelUsed && (
                      <span>
                        {t.playground.modelLabel}{" "}
                        <span className="font-medium text-foreground">
                          {modelUsed}
                        </span>
                      </span>
                    )}
                    {modelUsed && durationMs !== null && (
                      <span aria-hidden> · </span>
                    )}
                    {durationMs !== null && (
                      <span>
                        {t.playground.durationLabel}{" "}
                        {(durationMs / 1000).toFixed(1)}s
                      </span>
                    )}
                  </p>
                )}
              </>
            ) : (
              <p className="rounded-md border border-dashed border-border p-6 text-center text-sm text-muted-foreground">
                —
              </p>
            )}
          </div>
        </div>

        <DialogFooter>
          <Button
            type="button"
            variant="outline"
            onClick={() => onOpenChange(false)}
            disabled={running}
          >
            {platform.common.cancel}
          </Button>
          <Button type="button" onClick={handleRun} disabled={running || !prompt}>
            {running ? (
              <LoaderCircle className="size-4 animate-spin" />
            ) : (
              <Play className="size-4" />
            )}
            {running ? t.prompts.run.running : t.prompts.run.run}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}