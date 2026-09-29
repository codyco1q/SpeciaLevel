"use client";

import { useState, useTransition } from "react";
import {
  Mail,
  Plus,
  Pencil,
  Trash2,
  Send,
  Sparkles,
  Search,
  MoreHorizontal,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  getEmailTemplates,
  deleteEmailTemplate,
} from "@/lib/actions/marketing";
import { STARTER_EMAIL_TEMPLATES } from "@/lib/validations/marketing";
import { EmailEditorStudio } from "./email-editor-studio";
import { EmailTestSendDialog } from "./email-test-send-dialog";
import type { MarketingEmailTemplate } from "@/types/database";
import type { Dictionary, Locale } from "@/lib/i18n/get-dictionary";

interface EmailTemplatesViewProps {
  initialTemplates: MarketingEmailTemplate[];
  canManage: boolean;
  platform: Dictionary["platform"];
  locale: Locale;
}

export function EmailTemplatesView({
  initialTemplates,
  canManage,
  platform,
  locale,
}: EmailTemplatesViewProps) {
  const [templates, setTemplates] =
    useState<MarketingEmailTemplate[]>(initialTemplates);
  const [editingTemplate, setEditingTemplate] =
    useState<MarketingEmailTemplate | null>(null);
  const [isStudioOpen, setIsStudioOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [testDialogOpen, setTestDialogOpen] = useState(false);
  const [selectedForTest, setSelectedForTest] =
    useState<MarketingEmailTemplate | null>(null);
  const [isPending, startTransition] = useTransition();

  const refreshTemplates = () => {
    startTransition(async () => {
      const data = await getEmailTemplates();
      setTemplates(data);
    });
  };

  const handleCreateNew = () => {
    setEditingTemplate(null);
    setIsStudioOpen(true);
  };

  const handleUseStarter = (starter: (typeof STARTER_EMAIL_TEMPLATES)[0]) => {
    setEditingTemplate({
      id: "",
      organization_id: "",
      name: starter.name,
      subject: starter.subject,
      preview_text: starter.previewText,
      body_json: starter.bodyJson as any,
      body_html: "",
      created_by: null,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    });
    setIsStudioOpen(true);
  };

  const handleEdit = (tmpl: MarketingEmailTemplate) => {
    setEditingTemplate(tmpl);
    setIsStudioOpen(true);
  };

  const handleDelete = (id: string) => {
    if (!confirm("Are you sure you want to delete this email template?")) return;
    startTransition(async () => {
      const res = await deleteEmailTemplate(id);
      if (res.status === "success") {
        refreshTemplates();
      }
    });
  };

  const handleOpenTest = (tmpl: MarketingEmailTemplate) => {
    setSelectedForTest(tmpl);
    setTestDialogOpen(true);
  };

  if (isStudioOpen) {
    return (
      <EmailEditorStudio
        template={editingTemplate}
        onBack={() => setIsStudioOpen(false)}
        onSaved={() => {
          setIsStudioOpen(false);
          refreshTemplates();
        }}
      />
    );
  }

  const filtered = templates.filter(
    (t) =>
      t.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      t.subject.toLowerCase().includes(searchQuery.toLowerCase())
  );

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-xl font-bold tracking-tight">Email Template Studio</h2>
          <p className="text-xs text-muted-foreground mt-0.5">
            Design responsive, block-based email templates with merge tags.
          </p>
        </div>

        {canManage && (
          <Button size="sm" onClick={handleCreateNew}>
            <Plus className="size-3.5 mr-1" />
            New Email Template
          </Button>
        )}
      </div>

      {/* Starter Templates */}
      <div className="rounded-xl border border-primary/20 bg-primary/5 p-4 space-y-3">
        <div className="flex items-center gap-1.5 text-xs font-semibold text-primary uppercase tracking-wider">
          <Sparkles className="size-3.5" />
          <span>Starter Templates</span>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          {STARTER_EMAIL_TEMPLATES.map((starter, i) => (
            <div
              key={i}
              className="flex items-center justify-between p-3 rounded-lg border bg-card/80 backdrop-blur-xs hover:border-primary/50 transition-all"
            >
              <div className="min-w-0 pr-2">
                <h4 className="text-xs font-semibold text-foreground truncate">{starter.name}</h4>
                <p className="text-[11px] text-muted-foreground truncate mt-0.5">{starter.subject}</p>
              </div>
              {canManage && (
                <Button
                  variant="outline"
                  size="sm"
                  className="h-7 text-xs shrink-0"
                  onClick={() => handleUseStarter(starter)}
                >
                  Use Starter
                </Button>
              )}
            </div>
          ))}
        </div>
      </div>

      {/* Search & List */}
      <div className="space-y-4">
        <div className="relative max-w-sm">
          <Search className="size-3.5 absolute left-2.5 top-1/2 -translate-y-1/2 text-muted-foreground" />
          <Input
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search templates..."
            className="pl-8 text-xs h-8"
          />
        </div>

        {filtered.length === 0 ? (
          <div className="rounded-xl border border-dashed p-10 text-center text-muted-foreground">
            <Mail className="size-8 mx-auto mb-2 opacity-40" />
            <p className="text-sm font-medium">No templates found</p>
            <p className="text-xs mt-1">Create a new template or start from one of the starter templates.</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {filtered.map((tmpl) => (
              <div
                key={tmpl.id}
                className="rounded-xl border bg-card p-4 shadow-xs flex flex-col justify-between hover:border-primary/40 transition-colors"
              >
                <div>
                  <div className="flex items-center justify-between gap-2 mb-2">
                    <Badge variant="outline" className="text-[10px] uppercase font-semibold">
                      {tmpl.body_json?.length || 0} Blocks
                    </Badge>
                    <span className="text-[11px] text-muted-foreground">
                      {new Date(tmpl.updated_at).toLocaleDateString()}
                    </span>
                  </div>

                  <h3 className="text-sm font-bold text-foreground truncate">{tmpl.name}</h3>
                  <p className="text-xs text-muted-foreground truncate mt-1">Subject: {tmpl.subject}</p>
                </div>

                <div className="mt-4 pt-3 border-t flex items-center justify-between text-xs">
                  <span className="text-muted-foreground text-[11px] truncate">
                    {tmpl.creator?.full_name || tmpl.creator?.email || "Team member"}
                  </span>

                  <div className="flex items-center gap-1">
                    <Button variant="ghost" size="sm" className="h-7 text-xs px-2" onClick={() => handleOpenTest(tmpl)}>
                      <Send className="size-3 mr-1" /> Test
                    </Button>
                    {canManage && (
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button variant="ghost" size="icon" className="size-7">
                            <MoreHorizontal className="size-3.5" />
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                          <DropdownMenuItem onClick={() => handleEdit(tmpl)}>
                            <Pencil className="size-3.5 mr-2" /> Edit Template
                          </DropdownMenuItem>
                          <DropdownMenuItem onClick={() => handleDelete(tmpl.id)} className="text-destructive focus:text-destructive">
                            <Trash2 className="size-3.5 mr-2" /> Delete
                          </DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    )}
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      <EmailTestSendDialog
        open={testDialogOpen}
        onOpenChange={setTestDialogOpen}
        templateId={selectedForTest?.id}
        subject={selectedForTest?.subject}
        bodyHtml={selectedForTest?.body_html}
      />
    </div>
  );
}
