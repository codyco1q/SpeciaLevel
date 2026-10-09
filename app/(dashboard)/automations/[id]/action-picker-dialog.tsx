"use client";

import {
  MessageCircle,
  Bell,
  Mail,
  Tag,
  ArrowRightCircle,
  Webhook,
  Clock,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  WORKFLOW_ACTION_DEFINITIONS,
  type WorkflowActionType,
} from "@/lib/validations/automations";

interface ActionPickerDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSelectAction: (type: WorkflowActionType) => void;
  title?: string;
}

export function ActionPickerDialog({
  open,
  onOpenChange,
  onSelectAction,
  title = "Add Action Step",
}: ActionPickerDialogProps) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-xl">
        <DialogHeader>
          <DialogTitle className="text-base font-semibold">{title}</DialogTitle>
        </DialogHeader>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 py-2">
          {WORKFLOW_ACTION_DEFINITIONS.map((actionDef) => (
            <button
              key={actionDef.type}
              type="button"
              onClick={() => onSelectAction(actionDef.type)}
              className="p-3.5 rounded-xl border bg-card hover:bg-muted/50 hover:border-primary/60 text-left transition-all flex flex-col justify-between group"
            >
              <div>
                <div className="flex items-center justify-between">
                  <div className="size-8 rounded-lg bg-primary/10 text-primary flex items-center justify-center group-hover:scale-105 transition-transform">
                    {actionDef.type === "send_sms" && <MessageCircle className="size-4" />}
                    {actionDef.type === "send_notification" && <Bell className="size-4" />}
                    {actionDef.type === "send_email" && <Mail className="size-4" />}
                    {actionDef.type === "add_tag" && <Tag className="size-4" />}
                    {actionDef.type === "update_deal_stage" && <ArrowRightCircle className="size-4" />}
                    {actionDef.type === "webhook" && <Webhook className="size-4" />}
                    {actionDef.type === "delay" && <Clock className="size-4" />}
                  </div>
                  <Badge variant="outline" className="text-[10px]">
                    + Add
                  </Badge>
                </div>
                <h4 className="text-xs font-semibold text-foreground mt-2.5">
                  {actionDef.title}
                </h4>
                <p className="text-[11px] text-muted-foreground mt-1 line-clamp-2">
                  {actionDef.description}
                </p>
              </div>
            </button>
          ))}
        </div>
      </DialogContent>
    </Dialog>
  );
}