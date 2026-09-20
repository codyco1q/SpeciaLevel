"use client";

import { useEffect, useState, useTransition } from "react";
import { Check, Copy, ExternalLink, LoaderCircle, RefreshCw, Share2 } from "lucide-react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { regenerateShareToken, type InvoiceRow } from "@/lib/actions/invoicing";
import type { Dictionary, Locale } from "@/lib/i18n/get-dictionary";

interface ShareInvoiceDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  invoice: InvoiceRow;
  platform: Dictionary["platform"];
  locale: Locale;
  onTokenRegenerated?: (newToken: string) => void;
}

export function ShareInvoiceDialog({
  open,
  onOpenChange,
  invoice,
  platform,
  onTokenRegenerated,
}: ShareInvoiceDialogProps) {
  const t = platform.invoicing;
  const common = platform.common;
  const shareCopy = t.share;

  const [currentToken, setCurrentToken] = useState(invoice.shareToken);
  const [origin, setOrigin] = useState("");
  const [copied, setCopied] = useState(false);
  const [isPending, startTransition] = useTransition();
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (typeof window !== "undefined") {
      setOrigin(window.location.origin);
    }
  }, []);

  useEffect(() => {
    setCurrentToken(invoice.shareToken);
  }, [invoice.shareToken]);

  const publicUrl = currentToken && origin ? `${origin}/pay/${currentToken}` : "";

  async function handleCopy() {
    if (!publicUrl) return;
    try {
      await navigator.clipboard.writeText(publicUrl);
      setCopied(true);
      setMessage(shareCopy?.linkCopied ?? "Payment link copied to clipboard.");
      setTimeout(() => setCopied(false), 2500);
    } catch {
      setError("Failed to copy link to clipboard.");
    }
  }

  function handleRegenerate() {
    setError(null);
    setMessage(null);
    startTransition(async () => {
      const result = await regenerateShareToken(invoice.id);
      if (result.status === "error") {
        setError(result.error);
        return;
      }
      setCurrentToken(result.shareToken);
      onTokenRegenerated?.(result.shareToken);
      setMessage(shareCopy?.regenerateSuccess ?? "New payment link generated.");
    });
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <div className="mb-2 flex size-10 items-center justify-center rounded-full bg-primary/10 text-primary">
            <Share2 className="size-5" />
          </div>
          <DialogTitle>
            {shareCopy?.dialogTitle ?? "Share Payment Link"}
          </DialogTitle>
          <DialogDescription>
            {shareCopy?.dialogDescription ??
              "Anyone with this link can view the invoice and payment instructions without signing in."}
          </DialogDescription>
        </DialogHeader>

        {message && (
          <div
            role="status"
            className="rounded-lg border border-primary/20 bg-primary/10 p-3 text-sm text-primary"
          >
            {message}
          </div>
        )}

        {error && (
          <div
            role="alert"
            className="rounded-lg border border-destructive/20 bg-destructive/10 p-3 text-sm text-destructive"
          >
            {error}
          </div>
        )}

        <div className="space-y-4 py-2">
          <div className="space-y-1.5">
            <Label htmlFor="share-link">
              {shareCopy?.publicLink ?? "Public Payment URL"}
            </Label>
            <div className="flex items-center gap-2">
              <Input
                id="share-link"
                readOnly
                value={publicUrl}
                className="font-mono text-xs select-all"
                onClick={(e) => e.currentTarget.select()}
              />
              <Button
                type="button"
                variant={copied ? "default" : "outline"}
                size="sm"
                onClick={handleCopy}
                disabled={!publicUrl}
                className="gap-1.5 shrink-0"
              >
                {copied ? (
                  <>
                    <Check className="size-3.5 text-primary-foreground" />
                    {shareCopy?.copied ?? "Copied"}
                  </>
                ) : (
                  <>
                    <Copy className="size-3.5" />
                    {shareCopy?.copyLink ?? "Copy"}
                  </>
                )}
              </Button>
            </div>
          </div>

          <div className="flex flex-wrap items-center justify-between gap-2 border-t border-border pt-4">
            {publicUrl && (
              <Button
                type="button"
                variant="ghost"
                size="sm"
                asChild
                className="gap-1.5 text-xs text-muted-foreground hover:text-foreground"
              >
                <Link href={publicUrl} target="_blank" rel="noreferrer">
                  <ExternalLink className="size-3.5" />
                  {shareCopy?.openPublicView ?? "Preview Public View"}
                </Link>
              </Button>
            )}

            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={handleRegenerate}
              disabled={isPending}
              className="ms-auto gap-1.5 text-xs"
              title={shareCopy?.regenerateTokenHint}
            >
              {isPending ? (
                <LoaderCircle className="size-3.5 animate-spin" />
              ) : (
                <RefreshCw className="size-3.5" />
              )}
              {shareCopy?.regenerateToken ?? "Regenerate Link"}
            </Button>
          </div>
        </div>

        <DialogFooter>
          <Button
            type="button"
            variant="outline"
            onClick={() => onOpenChange(false)}
          >
            {t.detail.close}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
