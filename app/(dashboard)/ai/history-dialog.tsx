"use client"

import { useState, useEffect } from "react"
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import { Copy, Check, RefreshCw } from "lucide-react"
import { cn } from "@/lib/utils"
import { getAiExecutions, type AiExecutionRow } from "@/lib/actions/ai"
import type { Dictionary, Locale } from "@/lib/i18n/get-dictionary"

const AI_STATUS_BADGE_CLASSES: Record<AiExecutionRow["status"], string> = {
  success:
    "border-emerald-500/30 bg-emerald-500/10 text-emerald-600 dark:text-emerald-400",
  failed: "border-destructive/30 bg-destructive/10 text-destructive",
  running:
    "border-amber-500/30 bg-amber-500/10 text-amber-600 dark:text-amber-400",
}

function formatAiDate(iso: string, locale: Locale): string {
  try {
    return new Intl.DateTimeFormat(locale === "ar" ? "ar-SA" : "en-US", {
      dateStyle: "short",
      timeStyle: "short",
    }).format(new Date(iso))
  } catch {
    return iso
  }
}

export interface HistoryContentProps {
  platform: Dictionary["platform"]
  locale: Locale
  onSelectPrompt?: (input: string) => void
}

export function HistoryContent({
  platform,
  locale,
  onSelectPrompt,
}: HistoryContentProps) {
  const t = platform.ai

  const [executions, setExecutions] = useState<AiExecutionRow[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [copiedId, setCopiedId] = useState<string | null>(null)

  const fetchExecutions = () => {
    setLoading(true)
    setError(null)
    getAiExecutions().then((result) => {
      setLoading(false)
      if (result.status === "error") {
        setError(result.error)
        setExecutions([])
        return
      }
      setExecutions(result.executions)
    })
  }

  useEffect(() => {
    fetchExecutions()
  }, [])

  function statusLabel(status: AiExecutionRow["status"]): string {
    if (status === "success") return t.history.success
    if (status === "failed") return t.history.failed
    return t.history.running
  }

  function toolLabel(row: AiExecutionRow): string {
    if (row.promptName) return row.promptName
    const tool = row.toolKey as keyof typeof t.quickTools.tools | null
    if (tool && tool in t.quickTools.tools) return t.quickTools.tools[tool]
    return t.history.playground
  }

  function handleCopy(id: string, text: string) {
    void navigator.clipboard.writeText(text)
    setCopiedId(id)
    setTimeout(() => setCopiedId(null), 2000)
  }

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <p className="text-xs text-muted-foreground">{t.history.description}</p>
        <Button
          variant="ghost"
          size="sm"
          onClick={fetchExecutions}
          disabled={loading}
          className="h-8 gap-1.5 text-xs text-muted-foreground"
        >
          <RefreshCw className={cn("size-3.5", loading && "animate-spin")} />
          <span>Refresh</span>
        </Button>
      </div>

      {loading && executions.length === 0 ? (
        <p className="py-10 text-center text-sm text-muted-foreground">
          {t.history.loading}
        </p>
      ) : error ? (
        <p
          role="alert"
          className="rounded-md border border-destructive/30 bg-destructive/10 px-3 py-2 text-sm text-destructive"
        >
          {error}
        </p>
      ) : executions.length === 0 ? (
        <p className="rounded-md border border-dashed border-border p-10 text-center text-sm text-muted-foreground">
          {t.history.noExecutionsYet}
        </p>
      ) : (
        <div className="max-h-[60vh] overflow-auto rounded-md border border-border">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-[90px]">{t.history.tableStatus}</TableHead>
                <TableHead className="min-w-[120px]">{t.history.tablePrompt}</TableHead>
                <TableHead className="min-w-[120px]">Model & Specs</TableHead>
                <TableHead className="min-w-[200px]">{t.history.tableOutput}</TableHead>
                <TableHead className="w-[140px]">{t.history.tableTime}</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {executions.map((row) => (
                <TableRow key={row.id}>
                  <TableCell>
                    <Badge
                      variant="outline"
                      className={cn(
                        "px-1.5 py-0 text-[10px] font-medium",
                        AI_STATUS_BADGE_CLASSES[row.status]
                      )}
                    >
                      {statusLabel(row.status)}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-xs font-medium">
                    <div>{toolLabel(row)}</div>
                    {row.inputData?.input ? (
                      <p className="mt-0.5 line-clamp-1 text-[11px] font-normal text-muted-foreground">
                        {String(row.inputData.input)}
                      </p>
                    ) : null}
                  </TableCell>
                  <TableCell className="whitespace-nowrap text-xs text-muted-foreground">
                    <div>{row.modelUsed || "—"}</div>
                    {row.durationMs !== null && (
                      <div className="text-[10px] text-muted-foreground/80">
                        {(row.durationMs / 1000).toFixed(2)}s
                      </div>
                    )}
                  </TableCell>
                  <TableCell className="max-w-[280px] align-top">
                    {row.status === "success" && row.outputText ? (
                      <div className="group relative">
                        <pre
                          dir="auto"
                          className="line-clamp-3 whitespace-pre-wrap font-sans text-xs text-muted-foreground"
                        >
                          {row.outputText}
                        </pre>
                        <div className="mt-1 flex items-center gap-1">
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => handleCopy(row.id, row.outputText!)}
                            className="h-6 gap-1 px-1.5 text-[11px] text-muted-foreground"
                          >
                            {copiedId === row.id ? (
                              <>
                                <Check className="size-3 text-emerald-500" />
                                <span className="text-emerald-500">Copied</span>
                              </>
                            ) : (
                              <>
                                <Copy className="size-3" />
                                <span>Copy</span>
                              </>
                            )}
                          </Button>
                          {onSelectPrompt && row.inputData?.input ? (
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() =>
                                onSelectPrompt(String(row.inputData!.input))
                              }
                              className="h-6 px-1.5 text-[11px] text-primary"
                            >
                              Use
                            </Button>
                          ) : null}
                        </div>
                      </div>
                    ) : row.status === "failed" ? (
                      <p className="line-clamp-2 text-xs text-destructive" dir="auto">
                        {row.errorMessage ?? "Execution failed"}
                      </p>
                    ) : (
                      <span className="text-xs text-muted-foreground">—</span>
                    )}
                  </TableCell>
                  <TableCell className="whitespace-nowrap text-xs text-muted-foreground">
                    {formatAiDate(row.executedAt, locale)}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}
    </div>
  )
}

export interface HistoryDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  platform: Dictionary["platform"]
  locale: Locale
  onSelectPrompt?: (input: string) => void
}

export function HistoryDialog({
  open,
  onOpenChange,
  platform,
  locale,
  onSelectPrompt,
}: HistoryDialogProps) {
  const t = platform.ai

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-4xl">
        <DialogHeader>
          <DialogTitle>{t.history.title}</DialogTitle>
          <DialogDescription>{t.history.description}</DialogDescription>
        </DialogHeader>

        {open && (
          <HistoryContent
            platform={platform}
            locale={locale}
            onSelectPrompt={(input) => {
              if (onSelectPrompt) onSelectPrompt(input)
              onOpenChange(false)
            }}
          />
        )}

        <div className="flex justify-end pt-2">
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            {t.history.close}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  )
}
