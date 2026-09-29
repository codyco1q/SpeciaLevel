"use client";

import { useState, useTransition } from "react";
import {
  ArrowLeft,
  Smartphone,
  Monitor,
  Send,
  Save,
  Trash2,
  ArrowUp,
  ArrowDown,
  Sparkles,
  Mail,
  Code,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { EmailBlockPalette } from "./email-block-palette";
import { EmailPropertyInspector } from "./email-property-inspector";
import { EmailBlockItem } from "./email-block-item";
import { EmailTestSendDialog } from "./email-test-send-dialog";
import { saveEmailTemplate } from "@/lib/actions/marketing";
import {
  compileEmailBlocksToHtml,
  type SaveEmailTemplateInput as SaveInput,
} from "@/lib/validations/marketing";
import { WORKFLOW_TEMPLATE_VARIABLES } from "@/lib/validations/automations";
import type { MarketingEmailTemplate, EmailBlock } from "@/types/database";

interface EmailEditorStudioProps {
  template: MarketingEmailTemplate | null;
  onBack: () => void;
  onSaved: () => void;
}

export function EmailEditorStudio({
  template,
  onBack,
  onSaved,
}: EmailEditorStudioProps) {
  const [name, setName] = useState(template?.name || "New Campaign Template");
  const [subject, setSubject] = useState(
    template?.subject || "Exciting News from {{organization.name}}!"
  );
  const [previewText, setPreviewText] = useState(template?.preview_text || "");
  const [blocks, setBlocks] = useState<EmailBlock[]>(
    template?.body_json && template.body_json.length > 0
      ? template.body_json
      : [
          {
            id: "b-hdr",
            type: "header",
            content: { text: "Welcome to Our Platform!", level: 1 },
            style: { textAlign: "center", fontSize: 26, textColor: "#0f172a" },
          },
          {
            id: "b-txt",
            type: "text",
            content: {
              text: "Hi {{contact.name}},\n\nWe are excited to share an exclusive update with you.",
            },
            style: { fontSize: 15, textColor: "#334155" },
          },
          {
            id: "b-btn",
            type: "button",
            content: { buttonText: "View Your Portal", buttonUrl: "https://example.com" },
            style: { textAlign: "center", buttonColor: "#2563eb", buttonTextColor: "#ffffff" },
          },
        ]
  );
  const [selectedBlockId, setSelectedBlockId] = useState<string | null>(
    blocks[0]?.id || null
  );
  const [deviceMode, setDeviceMode] = useState<"desktop" | "mobile">("desktop");
  const [testDialogOpen, setTestDialogOpen] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  const handleAddBlock = (newBlock: EmailBlock) => {
    setBlocks([...blocks, newBlock]);
    setSelectedBlockId(newBlock.id);
  };

  const handleUpdateBlock = (updated: EmailBlock) => {
    setBlocks(blocks.map((b) => (b.id === updated.id ? updated : b)));
  };

  const handleDeleteBlock = (id: string) => {
    const next = blocks.filter((b) => b.id !== id);
    setBlocks(next);
    if (selectedBlockId === id) {
      setSelectedBlockId(next[0]?.id || null);
    }
  };

  const handleMoveUp = (index: number) => {
    if (index === 0) return;
    const newBlocks = [...blocks];
    const temp = newBlocks[index - 1];
    newBlocks[index - 1] = newBlocks[index];
    newBlocks[index] = temp;
    setBlocks(newBlocks);
  };

  const handleMoveDown = (index: number) => {
    if (index === blocks.length - 1) return;
    const newBlocks = [...blocks];
    const temp = newBlocks[index + 1];
    newBlocks[index + 1] = newBlocks[index];
    newBlocks[index] = temp;
    setBlocks(newBlocks);
  };

  const handleInsertVariable = (blockId: string, varKey: string) => {
    setBlocks(
      blocks.map((b) => {
        if (b.id !== blockId) return b;
        const curText = b.content.text || "";
        return {
          ...b,
          content: {
            ...b.content,
            text: `${curText}${curText ? " " : ""}${varKey}`,
          },
        };
      })
    );
  };

  const handleSave = () => {
    setError(null);
    if (!name.trim()) {
      setError("Template name is required.");
      return;
    }
    if (!subject.trim()) {
      setError("Email subject line is required.");
      return;
    }

    const compiledHtml = compileEmailBlocksToHtml(blocks as any);

    const payload: SaveInput = {
      id: template?.id,
      name: name.trim(),
      subject: subject.trim(),
      previewText: previewText.trim() || null,
      bodyJson: blocks as any,
      bodyHtml: compiledHtml,
    };

    startTransition(async () => {
      const res = await saveEmailTemplate(payload);
      if (res.status === "success") {
        onSaved();
      } else {
        setError(res.error || "Failed to save email template.");
      }
    });
  };

  const selectedBlock = blocks.find((b) => b.id === selectedBlockId) || null;

  return (
    <div className="flex flex-col h-[calc(100vh-8rem)] min-h-[600px] rounded-xl border bg-background overflow-hidden">
      {/* Studio Top Toolbar */}
      <div className="flex flex-col lg:flex-row items-start lg:items-center justify-between gap-3 p-3 border-b bg-card/80 backdrop-blur-xs">
        <div className="flex items-center gap-3 w-full lg:w-auto">
          <Button variant="ghost" size="icon" className="size-8" onClick={onBack}>
            <ArrowLeft className="size-4" />
          </Button>
          <div className="flex items-center gap-2 flex-1 min-w-0">
            <Input
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Template Name"
              className="h-8 text-sm font-semibold max-w-[200px]"
            />
            <Input
              value={subject}
              onChange={(e) => setSubject(e.target.value)}
              placeholder="Subject Line"
              className="h-8 text-xs max-w-[240px]"
            />
          </div>
        </div>

        <div className="flex items-center gap-2 self-end lg:self-auto">
          <div className="flex rounded-lg border bg-muted/40 p-0.5">
            <button
              type="button"
              onClick={() => setDeviceMode("desktop")}
              className={`p-1.5 rounded text-xs transition-all ${
                deviceMode === "desktop" ? "bg-background shadow-xs text-foreground font-semibold" : "text-muted-foreground"
              }`}
            >
              <Monitor className="size-3.5" />
            </button>
            <button
              type="button"
              onClick={() => setDeviceMode("mobile")}
              className={`p-1.5 rounded text-xs transition-all ${
                deviceMode === "mobile" ? "bg-background shadow-xs text-foreground font-semibold" : "text-muted-foreground"
              }`}
            >
              <Smartphone className="size-3.5" />
            </button>
          </div>

          <Button variant="outline" size="sm" className="h-8 text-xs" onClick={() => setTestDialogOpen(true)}>
            <Send className="size-3.5 mr-1" /> Test
          </Button>

          <Button size="sm" className="h-8 text-xs font-semibold" onClick={handleSave} disabled={isPending}>
            <Save className="size-3.5 mr-1" /> {isPending ? "Saving..." : "Save Template"}
          </Button>
        </div>
      </div>

      {error && <div className="bg-destructive/10 border-b border-destructive/20 px-4 py-2 text-xs text-destructive">{error}</div>}

      <div className="flex-1 flex overflow-hidden">
        <EmailBlockPalette onAddBlock={handleAddBlock} />

        <div className="flex-1 bg-muted/20 p-6 overflow-y-auto flex justify-center">
          <div
            className={`w-full transition-all duration-300 rounded-xl border bg-card shadow-sm p-4 space-y-3 ${
              deviceMode === "mobile" ? "max-w-[380px]" : "max-w-[620px]"
            }`}
          >
            <div className="pb-3 border-b text-xs text-muted-foreground flex items-center justify-between">
              <span className="font-semibold text-foreground truncate">Subject: {subject}</span>
              <span className="capitalize">{deviceMode} View</span>
            </div>

            {blocks.map((block, idx) => (
              <EmailBlockItem
                key={block.id}
                block={block}
                isSelected={block.id === selectedBlockId}
                onSelect={() => setSelectedBlockId(block.id)}
                onUpdate={handleUpdateBlock}
                onMoveUp={() => handleMoveUp(idx)}
                onMoveDown={() => handleMoveDown(idx)}
                onDelete={() => handleDeleteBlock(block.id)}
              />
            ))}
          </div>
        </div>

        <EmailPropertyInspector
          selectedBlock={selectedBlock}
          onUpdateBlock={handleUpdateBlock}
        />
      </div>

      <EmailTestSendDialog
        open={testDialogOpen}
        onOpenChange={setTestDialogOpen}
        templateId={template?.id}
        subject={subject}
        bodyHtml={compileEmailBlocksToHtml(blocks as any)}
      />
    </div>
  );
}
