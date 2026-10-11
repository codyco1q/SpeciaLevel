"use client"

import { useState, useTransition, useRef } from "react"
import {
  Brain,
  Check,
  Copy,
  Cpu,
  FileText,
  History,
  Image as ImageIcon,
  LoaderCircle,
  MoreHorizontal,
  Paperclip,
  Pencil,
  Play,
  Plus,
  Power,
  Sparkles,
  Trash2,
  Wand2,
  X,
} from "lucide-react"

import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { Textarea } from "@/components/ui/textarea"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { DeleteConfirmationDialog } from "@/components/ui/delete-confirmation-dialog"

import { cn } from "@/lib/utils"
import {
  deleteAiPrompt,
  executeAiTask,
  getAiPrompts,
  toggleAiPrompt,
  type AiPromptRow,
} from "@/lib/actions/ai"
import { AI_QUICK_TOOLS, type AiQuickTool } from "@/lib/validations/ai"
import type { Dictionary, Locale } from "@/lib/i18n/get-dictionary"
import type { AiModelProvider, AiMcpServer } from "@/types/database"
import { AI_PROVIDER_BADGE_CLASSES } from "./ai-meta"
import { PromptDialog } from "./prompt-dialog"
import { RunPromptDialog } from "./run-dialog"
import { HistoryDialog, HistoryContent } from "./history-dialog"
import { ProvidersMcpTab } from "./providers-mcp-tab"

type AiDict = Dictionary["platform"]["ai"]
type TabKey = "playground" | "quickTools" | "prompts" | "providers_mcp" | "history"

interface AiViewProps {
  initialPrompts: AiPromptRow[]
  initialProviders?: AiModelProvider[]
  initialMcpServers?: AiMcpServer[]
  canManage: boolean
  platform: Dictionary["platform"]
  locale: Locale
}

interface OutputMeta {
  modelUsed: string | null
  durationMs: number | null
}

interface AttachmentItem {
  name: string
  type: string
  data: string
}

function OutputBody({
  t,
  output,
  outputEmpty,
  copied,
  meta,
  onCopy,
  className,
}: {
  t: AiDict
  output: string
  outputEmpty: string
  copied: boolean
  meta: OutputMeta
  onCopy: () => void
  className?: string
}) {
  const { modelUsed, durationMs } = meta

  return (
    <div className={cn("rounded-lg border border-border bg-card p-4 shadow-sm", className)}>
      <div className="mb-2 flex items-center justify-between gap-3">
        <p className="text-sm font-medium">{t.playground.outputTitle}</p>
        {output && (
          <Button variant="ghost" size="sm" onClick={onCopy}>
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
            className="max-h-[420px] overflow-y-auto whitespace-pre-wrap rounded-md border border-border bg-muted/40 p-3 text-sm leading-relaxed font-sans"
          >
            {output}
          </pre>
          {(modelUsed || durationMs !== null) && (
            <p className="mt-2 flex flex-wrap gap-x-1 text-xs text-muted-foreground">
              {modelUsed && (
                <span>
                  {t.playground.modelLabel}{" "}
                  <span className="font-medium text-foreground">{modelUsed}</span>
                </span>
              )}
              {modelUsed && durationMs !== null && <span aria-hidden>·</span>}
              {durationMs !== null && (
                <span>
                  {t.playground.durationLabel} {(durationMs / 1000).toFixed(1)}s
                </span>
              )}
            </p>
          )}
        </>
      ) : (
        <p className="rounded-md border border-dashed border-border p-6 text-center text-sm text-muted-foreground">
          {outputEmpty}
        </p>
      )}
    </div>
  )
}

function PlaygroundPane({
  t,
  initialInput = "",
}: {
  t: AiDict
  initialInput?: string
}) {
  const [input, setInput] = useState(initialInput)
  const [output, setOutput] = useState("")
  const [error, setError] = useState<string | null>(null)
  const [running, setRunning] = useState(false)
  const [copied, setCopied] = useState(false)
  const [meta, setMeta] = useState<OutputMeta>({ modelUsed: null, durationMs: null })
  const [attachments, setAttachments] = useState<AttachmentItem[]>([])
  const fileInputRef = useRef<HTMLInputElement>(null)

  function handleFileUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const files = e.target.files
    if (!files || files.length === 0) return

    Array.from(files).forEach((file) => {
      const reader = new FileReader()
      reader.onload = () => {
        if (typeof reader.result === "string") {
          setAttachments((prev) => [
            ...prev,
            {
              name: file.name,
              type: file.type || "application/octet-stream",
              data: reader.result as string,
            },
          ])
        }
      }
      reader.readAsDataURL(file)
    })

    if (fileInputRef.current) {
      fileInputRef.current.value = ""
    }
  }

  function removeAttachment(index: number) {
    setAttachments((prev) => prev.filter((_, i) => i !== index))
  }

  function handleRun() {
    if (running || (!input.trim() && attachments.length === 0)) return
    setError(null)
    setCopied(false)
    setOutput("")
    setMeta({ modelUsed: null, durationMs: null })
    setRunning(true)

    executeAiTask({
      promptId: null,
      toolKey: null,
      inputData: {
        input: input.trim(),
        attachments: attachments.map((a) => ({
          name: a.name,
          type: a.type,
          data: a.data,
        })),
      },
    })
      .then((result) => {
        setRunning(false)
        if (result.status === "error") {
          setError(result.error)
          return
        }
        setOutput(result.execution.output)
        setMeta({
          modelUsed: result.execution.modelUsed,
          durationMs: result.execution.durationMs,
        })
      })
      .catch(() => {
        setRunning(false)
        setError(t.errors.execFailed)
      })
  }

  function handleKeyDown(e: React.KeyboardEvent<HTMLTextAreaElement>) {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault()
      handleRun()
    }
  }

  async function handleCopy() {
    if (!output) return
    try {
      await navigator.clipboard.writeText(output)
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    } catch {
      // Clipboard unavailable
    }
  }

  return (
    <div className="space-y-4">
      <div className="rounded-lg border border-border bg-card p-4 shadow-sm">
        <label
          htmlFor="ai-playground-input"
          className="mb-2 block text-sm font-medium"
        >
          {t.playground.label}
        </label>
        <Textarea
          id="ai-playground-input"
          value={input}
          onChange={(event) => setInput(event.target.value)}
          onKeyDown={handleKeyDown}
          placeholder={t.playground.placeholder}
          rows={5}
          className="resize-y font-sans"
        />

        {attachments.length > 0 && (
          <div className="mt-3 flex flex-wrap gap-2">
            {attachments.map((att, idx) => (
              <div
                key={idx}
                className="flex items-center gap-1.5 rounded-md border border-border bg-muted/60 px-2.5 py-1 text-xs"
              >
                {att.type.startsWith("image/") ? (
                  <ImageIcon className="size-3.5 text-primary shrink-0" />
                ) : (
                  <FileText className="size-3.5 text-muted-foreground shrink-0" />
                )}
                <span className="max-w-[140px] truncate font-medium">{att.name}</span>
                <button
                  type="button"
                  onClick={() => removeAttachment(idx)}
                  className="text-muted-foreground hover:text-foreground ml-1"
                >
                  <X className="size-3" />
                </button>
              </div>
            ))}
          </div>
        )}

        <div className="mt-3 flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <input
              type="file"
              ref={fileInputRef}
              onChange={handleFileUpload}
              className="hidden"
              multiple
              accept="image/*,.txt,.md,.json,.csv"
            />
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => fileInputRef.current?.click()}
              disabled={running}
              className="h-8 gap-1.5 text-xs"
            >
              <Paperclip className="size-3.5" />
              <span>Attach File / Image</span>
            </Button>
            <p className="hidden sm:inline-block text-xs text-muted-foreground">
              Press <kbd className="rounded bg-muted px-1.5 py-0.5 font-mono text-[10px]">Enter</kbd> to run, <kbd className="rounded bg-muted px-1.5 py-0.5 font-mono text-[10px]">Shift+Enter</kbd> for newline
            </p>
          </div>

          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => {
                setInput("")
                setOutput("")
                setError(null)
                setAttachments([])
              }}
              disabled={running}
            >
              {t.playground.clear}
            </Button>
            <Button
              size="sm"
              onClick={handleRun}
              disabled={running || (!input.trim() && attachments.length === 0)}
            >
              {running ? (
                <LoaderCircle className="size-4 animate-spin" />
              ) : (
                <Play className="size-4" />
              )}
              {running ? t.playground.running : t.playground.run}
            </Button>
          </div>
        </div>
      </div>

      {error && (
        <p
          role="alert"
          className="rounded-md border border-destructive/30 bg-destructive/10 px-3 py-2 text-sm text-destructive"
        >
          {error}
        </p>
      )}

      <OutputBody
        t={t}
        output={output}
        outputEmpty={t.playground.emptyOutput}
        copied={copied}
        meta={meta}
        onCopy={handleCopy}
      />
    </div>
  )
}

function QuickToolsPane({ t }: { t: AiDict }) {
  const [selectedTool, setSelectedTool] = useState<AiQuickTool>("summarize")
  const [input, setInput] = useState("")
  const [output, setOutput] = useState("")
  const [error, setError] = useState<string | null>(null)
  const [running, setRunning] = useState(false)
  const [copied, setCopied] = useState(false)
  const [meta, setMeta] = useState<OutputMeta>({ modelUsed: null, durationMs: null })

  function handleRun() {
    if (running || !input.trim()) return
    setError(null)
    setCopied(false)
    setOutput("")
    setMeta({ modelUsed: null, durationMs: null })
    setRunning(true)

    executeAiTask({
      promptId: null,
      toolKey: selectedTool,
      inputData: { input: input.trim() },
    })
      .then((result) => {
        setRunning(false)
        if (result.status === "error") {
          setError(result.error)
          return
        }
        setOutput(result.execution.output)
        setMeta({
          modelUsed: result.execution.modelUsed,
          durationMs: result.execution.durationMs,
        })
      })
      .catch(() => {
        setRunning(false)
        setError(t.errors.execFailed)
      })
  }

  function handleKeyDown(e: React.KeyboardEvent<HTMLTextAreaElement>) {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault()
      handleRun()
    }
  }

  async function handleCopy() {
    if (!output) return
    try {
      await navigator.clipboard.writeText(output)
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    } catch {
      // Clipboard unavailable
    }
  }

  return (
    <div className="space-y-4">
      <div className="grid gap-3 sm:grid-cols-2">
        {AI_QUICK_TOOLS.map((tool) => {
          const selected = selectedTool === tool
          return (
            <button
              key={tool}
              type="button"
              onClick={() => setSelectedTool(tool)}
              aria-pressed={selected}
              className={cn(
                "rounded-lg border p-4 text-start shadow-sm transition-colors",
                selected
                  ? "border-primary/40 bg-primary/5"
                  : "border-border bg-card hover:border-foreground/20"
              )}
            >
              <span className="flex items-center gap-2">
                <Wand2
                  className={cn(
                    "size-4",
                    selected ? "text-primary" : "text-muted-foreground"
                  )}
                />
                <span className="text-sm font-semibold">
                  {t.quickTools.tools[tool]}
                </span>
              </span>
              <span className="mt-1 block text-xs text-muted-foreground">
                {t.quickTools.toolHints[tool]}
              </span>
            </button>
          )
        })}
      </div>

      <div className="rounded-lg border border-border bg-card p-4 shadow-sm">
        <p className="mb-1 text-sm font-medium">
          {t.quickTools.tools[selectedTool]}
        </p>
        <p className="mb-2 text-xs text-muted-foreground">
          {t.quickTools.selectedHint}
        </p>
        <Textarea
          value={input}
          onChange={(event) => setInput(event.target.value)}
          onKeyDown={handleKeyDown}
          placeholder={t.quickTools.placeholder}
          rows={6}
          className="resize-y font-sans"
        />
        <div className="mt-3 flex items-center justify-between">
          <p className="text-xs text-muted-foreground">
            Press <kbd className="rounded bg-muted px-1.5 py-0.5 font-mono text-[10px]">Enter</kbd> to run
          </p>
          <Button
            size="sm"
            onClick={handleRun}
            disabled={running || !input.trim()}
          >
            {running ? (
              <LoaderCircle className="size-4 animate-spin" />
            ) : (
              <Play className="size-4" />
            )}
            {running ? t.quickTools.running : t.quickTools.run}
          </Button>
        </div>
      </div>

      {error && (
        <p
          role="alert"
          className="rounded-md border border-destructive/30 bg-destructive/10 px-3 py-2 text-sm text-destructive"
        >
          {error}
        </p>
      )}

      <OutputBody
        t={t}
        output={output}
        outputEmpty={t.quickTools.emptyOutput}
        copied={copied}
        meta={meta}
        onCopy={handleCopy}
      />
    </div>
  )
}

export function AiView({
  initialPrompts,
  initialProviders = [],
  initialMcpServers = [],
  canManage,
  platform,
  locale,
}: AiViewProps) {
  const t = platform.ai

  const [tab, setTab] = useState<TabKey>("playground")
  const [prompts, setPrompts] = useState<AiPromptRow[]>(initialPrompts)
  const [playgroundInput, setPlaygroundInput] = useState("")

  const [dialogOpen, setDialogOpen] = useState(false)
  const [editing, setEditing] = useState<AiPromptRow | null>(null)
  const [runTarget, setRunTarget] = useState<AiPromptRow | null>(null)
  const [historyOpen, setHistoryOpen] = useState(false)
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null)
  const [actionError, setActionError] = useState<string | null>(null)
  const [isPending, startTransition] = useTransition()

  async function refreshAll() {
    const list = await getAiPrompts()
    if (list) setPrompts(list)
  }

  function openCreate() {
    setActionError(null)
    setEditing(null)
    setDialogOpen(true)
  }

  function openEdit(row: AiPromptRow) {
    setActionError(null)
    setEditing(row)
    setDialogOpen(true)
  }

  function handleSaved() {
    setDialogOpen(false)
    setEditing(null)
    setActionError(null)
    void refreshAll()
  }

  function handleToggle(row: AiPromptRow) {
    setActionError(null)
    startTransition(async () => {
      const result = await toggleAiPrompt(row.id, !row.isActive)
      if (result.status === "error") {
        setActionError(result.error)
        return
      }
      setPrompts((current) =>
        current.map((item) =>
          item.id === row.id
            ? { ...item, isActive: result.prompt.isActive }
            : item
        )
      )
    })
  }

  function handleDelete(id: string) {
    setActionError(null)
    startTransition(async () => {
      const result = await deleteAiPrompt(id)
      if (result.status === "error") {
        setActionError(result.error)
        return
      }
      void refreshAll()
    })
  }

  function handleSelectFromHistory(input: string) {
    setPlaygroundInput(input)
    setTab("playground")
  }

  return (
    <div>
      <div className="mb-6 flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">{t.title}</h1>
          <p className="mt-1 text-sm text-muted-foreground">{t.subtitle}</p>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" onClick={() => setHistoryOpen(true)}>
            <History className="size-4" />
            {t.history.view}
          </Button>
          {canManage && (
            <Button onClick={openCreate}>
              <Plus className="size-4" />
              {t.prompts.createPrompt}
            </Button>
          )}
        </div>
      </div>

      <Tabs value={tab} onValueChange={(value) => setTab(value as TabKey)}>
        <TabsList className="mb-6 inline-flex h-auto w-auto flex-wrap items-center gap-1.5 sm:gap-2 rounded-xl bg-muted/60 p-1.5 border border-border/60">
          <TabsTrigger
            value="playground"
            className="gap-2 px-3.5 py-2 text-xs sm:text-sm font-medium rounded-lg shrink-0 data-[state=active]:bg-background data-[state=active]:text-foreground data-[state=active]:shadow-sm"
          >
            <Sparkles className="size-4 shrink-0" />
            <span>{t.tabs.playground}</span>
          </TabsTrigger>
          <TabsTrigger
            value="quickTools"
            className="gap-2 px-3.5 py-2 text-xs sm:text-sm font-medium rounded-lg shrink-0 data-[state=active]:bg-background data-[state=active]:text-foreground data-[state=active]:shadow-sm"
          >
            <Wand2 className="size-4 shrink-0" />
            <span>{t.tabs.quickTools}</span>
          </TabsTrigger>
          <TabsTrigger
            value="prompts"
            className="gap-2 px-3.5 py-2 text-xs sm:text-sm font-medium rounded-lg shrink-0 data-[state=active]:bg-background data-[state=active]:text-foreground data-[state=active]:shadow-sm"
          >
            <Brain className="size-4 shrink-0" />
            <span>{t.tabs.customPrompts}</span>
          </TabsTrigger>
          <TabsTrigger
            value="providers_mcp"
            className="gap-2 px-3.5 py-2 text-xs sm:text-sm font-medium rounded-lg shrink-0 data-[state=active]:bg-background data-[state=active]:text-foreground data-[state=active]:shadow-sm"
          >
            <Cpu className="size-4 shrink-0" />
            <span>{(t.tabs as Record<string, string>).providersMcp ?? "Model Providers & MCP"}</span>
          </TabsTrigger>
          <TabsTrigger
            value="history"
            className="gap-2 px-3.5 py-2 text-xs sm:text-sm font-medium rounded-lg shrink-0 data-[state=active]:bg-background data-[state=active]:text-foreground data-[state=active]:shadow-sm"
          >
            <History className="size-4 shrink-0" />
            <span>{t.history.title}</span>
          </TabsTrigger>
        </TabsList>

        <TabsContent value="playground">
          <PlaygroundPane t={t} initialInput={playgroundInput} key={playgroundInput} />
        </TabsContent>

        <TabsContent value="quickTools">
          <QuickToolsPane t={t} />
        </TabsContent>

        <TabsContent value="prompts">
          {actionError && (
            <p
              role="alert"
              className="mb-4 rounded-md border border-destructive/30 bg-destructive/10 px-3 py-2 text-sm text-destructive"
            >
              {actionError}
            </p>
          )}

          {prompts.length === 0 ? (
            <div className="rounded-lg border border-dashed border-border p-10 text-center">
              <Brain className="mx-auto mb-3 h-8 w-8 text-muted-foreground/60" />
              <p className="text-sm font-medium text-muted-foreground">
                {t.prompts.noPromptsYet}
              </p>
              <p className="mt-1 text-sm text-muted-foreground">
                {canManage
                  ? t.prompts.noPromptsHintManage
                  : t.prompts.noPromptsHintView}
              </p>
            </div>
          ) : (
            <div className="grid gap-4">
              {prompts.map((prompt) => (
                <div
                  key={prompt.id}
                  className="rounded-lg border border-border bg-card p-4 shadow-sm transition-colors hover:border-foreground/20"
                >
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-center gap-2">
                        <h3 className="text-sm font-semibold leading-snug">
                          {prompt.name}
                        </h3>
                        <Badge
                          variant="outline"
                          className={cn(
                            "px-1.5 py-0 text-[10px] font-medium",
                            AI_PROVIDER_BADGE_CLASSES[prompt.modelProvider] ??
                              AI_PROVIDER_BADGE_CLASSES.custom
                          )}
                        >
                          {prompt.modelName || prompt.modelProvider}
                        </Badge>
                        {!prompt.isActive && (
                          <Badge
                            variant="outline"
                            className="px-1.5 py-0 text-[10px] font-medium text-muted-foreground"
                          >
                            {t.prompts.inactive}
                          </Badge>
                        )}
                      </div>

                      {prompt.description && (
                        <p className="mt-1 line-clamp-2 text-xs text-muted-foreground">
                          {prompt.description}
                        </p>
                      )}

                      <pre
                        dir="ltr"
                        className="mt-2 max-w-full truncate rounded-md border border-border bg-muted/40 px-2 py-1 text-[11px] text-muted-foreground"
                      >
                        {prompt.userTemplate}
                      </pre>

                      {prompt.createdBy && (
                        <p className="mt-2 text-[11px] text-muted-foreground">
                          {t.prompts.createdByLabel}:{" "}
                          {prompt.createdBy.fullName || prompt.createdBy.email}
                        </p>
                      )}
                    </div>

                    <div className="flex shrink-0 items-center gap-1.5">
                      <Button
                        size="sm"
                        onClick={() => setRunTarget(prompt)}
                        disabled={!prompt.isActive || isPending}
                      >
                        <Play className="size-3.5" />
                        {t.prompts.runPrompt}
                      </Button>
                      {canManage && (
                        <>
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => handleToggle(prompt)}
                            disabled={isPending}
                            aria-label={platform.common.actions}
                          >
                            <Power
                              className={cn(
                                "size-4",
                                prompt.isActive
                                  ? "text-primary"
                                  : "text-muted-foreground"
                              )}
                            />
                          </Button>
                          <DropdownMenu>
                            <DropdownMenuTrigger asChild>
                              <Button
                                variant="ghost"
                                size="icon"
                                aria-label={platform.common.actions}
                              >
                                <MoreHorizontal className="size-4" />
                              </Button>
                            </DropdownMenuTrigger>
                            <DropdownMenuContent align="end">
                              <DropdownMenuItem
                                onClick={() => openEdit(prompt)}
                              >
                                <Pencil className="size-4" />
                                {platform.common.edit}
                              </DropdownMenuItem>
                              <DropdownMenuItem
                                variant="destructive"
                                onClick={() => setConfirmDeleteId(prompt.id)}
                              >
                                <Trash2 className="size-4" />
                                {platform.common.delete}
                              </DropdownMenuItem>
                            </DropdownMenuContent>
                          </DropdownMenu>
                        </>
                      )}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </TabsContent>

        <TabsContent value="providers_mcp">
          <ProvidersMcpTab
            initialProviders={initialProviders}
            initialMcpServers={initialMcpServers}
            canManage={canManage}
            platform={platform}
            locale={locale}
          />
        </TabsContent>

        <TabsContent value="history">
          <div className="rounded-lg border border-border bg-card p-4 shadow-sm">
            <HistoryContent
              platform={platform}
              locale={locale}
              onSelectPrompt={handleSelectFromHistory}
            />
          </div>
        </TabsContent>
      </Tabs>

      <PromptDialog
        open={dialogOpen}
        onOpenChange={setDialogOpen}
        prompt={editing}
        onSaved={handleSaved}
        platform={platform}
      />

      <RunPromptDialog
        open={runTarget !== null}
        onOpenChange={(open) => {
          if (!open) setRunTarget(null)
        }}
        prompt={runTarget}
        platform={platform}
      />

      <HistoryDialog
        open={historyOpen}
        onOpenChange={setHistoryOpen}
        platform={platform}
        locale={locale}
        onSelectPrompt={handleSelectFromHistory}
      />

      <DeleteConfirmationDialog
        open={!!confirmDeleteId}
        onOpenChange={(open) => {
          if (!open) setConfirmDeleteId(null);
        }}
        title={platform.common.confirmDelete}
        description={t.errors.deleteConfirmBody}
        onConfirm={() => {
          if (confirmDeleteId) handleDelete(confirmDeleteId);
        }}
        isDeleting={isPending}
      />
    </div>
  )
}
