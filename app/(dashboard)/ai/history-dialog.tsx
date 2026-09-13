"use client"

import { useEffect, useState } from "react"

import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import { cn } from "@/lib/utils"
import { getAiExecutions, type AiExecutionRow } from "@/lib/actions/ai"
import type { Dictionary, Locale } from "@/lib/i18n/get-dictionary"
import { AI_STATUS_BADGE_CLASSES, formatAiDate } from "./ai-meta"

interface HistoryDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  platform: Dictionary["platform"]
  locale: Locale
}

export function HistoryDialog({
  open,
  onOpenChange,
  platform,
  locale,
}: HistoryDialogProps) {
  const t = platform.ai

  const [executions, setExecutions] = useState<AiExecutionRow[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  // Load executions each time the drawer opens.
  useEffect(() => {
    if (!open) return
    let cancelled = false
    void Promise.resolve().then(() => {
      if (cancelled) return
      setLoading(true)
      setError(null)
    })
    getAiExecutions().then((result) => {
      if (cancelled) return
      setLoading(false)
      if (result.status === "error") {
        setError(result.error)
        setExecutions([])
        return
      }
      setExecutions(result.executions)
    })
    return () => {
      cancelled = true
    }
  }, [open])

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

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-3xl">
        <DialogHeader>
          <DialogTitle>{t.history.title}</DialogTitle>
          <DialogDescription>{t.history.description}</DialogDescription>
        </DialogHeader>

        {loading ? (
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
                  <TableHead className="w-[100px]">
                    {t.history.tableStatus}
                  </TableHead>
                  <TableHead>{t.history.tablePrompt}</TableHead>
                  <TableHead>{t.history.tableOutput}</TableHead>
                  <TableHead>{t.history.tableError}</TableHead>
                  <TableHead className="w-[150px]">
                    {t.history.tableTime}
                  </TableHead>
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
                    <TableCell className="min-w-[140px] whitespace-nowrap text-xs">
                      {toolLabel(row)}
                    </TableCell>
                    <TableCell className="max-w-[240px] align-top">
                      {row.status === "success" && row.outputText ? (
                        <pre
                          dir="auto"
                          className="line-clamp-3 whitespace-pre-wrap text-xs text-muted-foreground"
                        >
                          {row.outputText}
                        </pre>
                      ) : (
                        <span className="text-xs text-muted-foreground">—</span>
                      )}
                    </TableCell>
                    <TableCell className="max-w-[180px] align-top">
                      <p className="truncate text-xs text-destructive" dir="auto">
                        {row.errorMessage ?? "—"}
                      </p>
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

        <div className="flex justify-end">
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            {t.history.close}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  )
}