"use client";

import { useState, useTransition } from "react";
import { Mail, Send, CheckCircle2 } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { sendTestEmail } from "@/lib/actions/marketing-emails";

interface EmailTestSendDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  templateId?: string;
  subject?: string;
  bodyHtml?: string;
}

export function EmailTestSendDialog({
  open,
  onOpenChange,
  templateId,
  subject,
  bodyHtml,
}: EmailTestSendDialogProps) {
  const [toEmail, setToEmail] = useState("");
  const [sentSuccess, setSentSuccess] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  const handleSend = () => {
    setError(null);
    setSentSuccess(false);

    if (!toEmail.trim() || !toEmail.includes("@")) {
      setError("Please enter a valid email address.");
      return;
    }

    startTransition(async () => {
      const res = await sendTestEmail({
        templateId,
        toEmail: toEmail.trim(),
        subject,
        bodyHtml,
      });

      if (res.status === "success") {
        setSentSuccess(true);
        setTimeout(() => {
          onOpenChange(false);
          setSentSuccess(false);
        }, 2000);
      } else {
        setError(res.error || "Failed to send test email.");
      }
    });
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <div className="flex items-center gap-2.5">
            <div className="size-8 rounded-lg bg-blue-500/10 text-blue-600 flex items-center justify-center">
              <Mail className="size-4" />
            </div>
            <div>
              <DialogTitle className="text-base font-semibold">Send Test Email</DialogTitle>
              <p className="text-xs text-muted-foreground mt-0.5">
                Preview your rendered template design in an actual inbox.
              </p>
            </div>
          </div>
        </DialogHeader>

        <div className="space-y-4 py-2">
          {sentSuccess ? (
            <div className="rounded-xl bg-emerald-500/10 border border-emerald-500/20 p-4 text-center space-y-1">
              <CheckCircle2 className="size-6 text-emerald-500 mx-auto" />
              <p className="text-sm font-semibold text-emerald-700 dark:text-emerald-300">
                Test Email Dispatched!
              </p>
              <p className="text-xs text-muted-foreground">
                Delivered preview to {toEmail}. Check your inbox.
              </p>
            </div>
          ) : (
            <div className="space-y-1.5">
              <Label className="text-xs font-medium">Destination Email Address</Label>
              <Input
                type="email"
                value={toEmail}
                onChange={(e) => setToEmail(e.target.value)}
                placeholder="you@company.com"
                className="text-sm"
              />
            </div>
          )}

          {error && (
            <div className="rounded-lg bg-destructive/10 border border-destructive/20 p-2.5 text-xs text-destructive">
              {error}
            </div>
          )}
        </div>

        <DialogFooter className="flex items-center justify-between border-t pt-3">
          <Button variant="ghost" size="sm" onClick={() => onOpenChange(false)} disabled={isPending}>
            Cancel
          </Button>
          <Button size="sm" onClick={handleSend} disabled={isPending || sentSuccess}>
            <Send className="size-3.5 mr-1.5" />
            {isPending ? "Sending..." : "Send Test"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
