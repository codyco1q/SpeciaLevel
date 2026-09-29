"use client";

import { useState, useEffect, useTransition } from "react";
import {
  Share2,
  Calendar,
  Plus,
  Trash2,
  AlertTriangle,
  Clock,
  Send,
  Save,
} from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { saveSocialPost } from "@/lib/actions/marketing-social";
import {
  MARKETING_SOCIAL_PLATFORMS,
  type SaveSocialPostInput,
  type MarketingSocialPlatform,
  type MarketingSocialPostStatus,
} from "@/lib/validations/marketing";
import type { MarketingSocialPost } from "@/types/database";

const PLATFORM_CONFIG: Record<
  MarketingSocialPlatform,
  { label: string; iconBg: string; textColor: string; maxLimit: number }
> = {
  facebook: {
    label: "Facebook",
    iconBg: "bg-blue-600/10 text-blue-600 border-blue-200 dark:border-blue-800",
    textColor: "text-blue-600",
    maxLimit: 5000,
  },
  instagram: {
    label: "Instagram",
    iconBg: "bg-pink-600/10 text-pink-600 border-pink-200 dark:border-pink-800",
    textColor: "text-pink-600",
    maxLimit: 2200,
  },
  twitter: {
    label: "X (Twitter)",
    iconBg: "bg-neutral-800/10 text-neutral-900 dark:text-neutral-100 border-neutral-300 dark:border-neutral-700",
    textColor: "text-neutral-800 dark:text-neutral-200",
    maxLimit: 280,
  },
  linkedin: {
    label: "LinkedIn",
    iconBg: "bg-sky-700/10 text-sky-700 border-sky-200 dark:border-sky-800",
    textColor: "text-sky-700",
    maxLimit: 3000,
  },
};

interface SocialPostDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  post: MarketingSocialPost | null;
  initialScheduledDate?: string | null;
  onSaved: () => void;
}

export function SocialPostDialog({
  open,
  onOpenChange,
  post,
  initialScheduledDate,
  onSaved,
}: SocialPostDialogProps) {
  const [content, setContent] = useState("");
  const [platforms, setPlatforms] = useState<MarketingSocialPlatform[]>(["twitter", "linkedin"]);
  const [mediaUrls, setMediaUrls] = useState<string[]>([]);
  const [newMediaInput, setNewMediaInput] = useState("");
  const [scheduledFor, setScheduledFor] = useState<string>("");
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  useEffect(() => {
    if (post) {
      setContent(post.content || "");
      setPlatforms(post.platforms.length ? post.platforms : ["twitter", "linkedin"]);
      setMediaUrls(post.media_urls || []);
      setScheduledFor(post.scheduled_for ? post.scheduled_for.slice(0, 16) : "");
    } else {
      setContent("");
      setPlatforms(["twitter", "linkedin"]);
      setMediaUrls([]);
      if (initialScheduledDate) {
        setScheduledFor(`${initialScheduledDate}T10:00`);
      } else {
        const tomorrow = new Date();
        tomorrow.setDate(tomorrow.getDate() + 1);
        tomorrow.setHours(10, 0, 0, 0);
        setScheduledFor(tomorrow.toISOString().slice(0, 16));
      }
    }
    setError(null);
  }, [post, initialScheduledDate, open]);

  const togglePlatform = (p: MarketingSocialPlatform) => {
    if (platforms.includes(p)) {
      if (platforms.length === 1) return;
      setPlatforms(platforms.filter((item) => item !== p));
    } else {
      setPlatforms([...platforms, p]);
    }
  };

  const handleAddMedia = () => {
    if (!newMediaInput.trim()) return;
    try {
      new URL(newMediaInput.trim());
      setMediaUrls([...mediaUrls, newMediaInput.trim()]);
      setNewMediaInput("");
    } catch {
      setError("Please enter a valid media URL.");
    }
  };

  const charCount = content.length;
  const isTwitterExceeded = platforms.includes("twitter") && charCount > 280;

  const handleSubmit = (targetStatus: MarketingSocialPostStatus) => {
    setError(null);
    if (!content.trim()) {
      setError("Post content cannot be empty.");
      return;
    }
    if (platforms.length === 0) {
      setError("Select at least one platform.");
      return;
    }

    let resolvedDate: string | null = null;
    if (targetStatus === "scheduled") {
      if (!scheduledFor) {
        setError("Please choose a schedule date and time.");
        return;
      }
      resolvedDate = new Date(scheduledFor).toISOString();
    } else if (targetStatus === "published") {
      resolvedDate = new Date().toISOString();
    }

    const payload: SaveSocialPostInput = {
      id: post?.id,
      content: content.trim(),
      mediaUrls,
      platforms,
      status: targetStatus,
      scheduledFor: resolvedDate,
    };

    startTransition(async () => {
      const res = await saveSocialPost(payload);
      if (res.status === "success") {
        onOpenChange(false);
        onSaved();
      } else {
        setError(res.error || "Failed to save post.");
      }
    });
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <div className="flex items-center gap-2">
            <div className="size-8 rounded-lg bg-primary/10 text-primary flex items-center justify-center">
              <Share2 className="size-4" />
            </div>
            <div>
              <DialogTitle className="text-base font-semibold">
                {post ? "Edit Social Post" : "Compose Social Post"}
              </DialogTitle>
              <p className="text-xs text-muted-foreground">Draft, schedule, and multi-publish across channels.</p>
            </div>
          </div>
        </DialogHeader>

        <div className="space-y-4 py-2">
          <div className="space-y-1.5">
            <Label className="text-xs font-medium text-muted-foreground">Platforms</Label>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
              {MARKETING_SOCIAL_PLATFORMS.map((p) => {
                const conf = PLATFORM_CONFIG[p];
                const isSelected = platforms.includes(p);
                return (
                  <button
                    key={p}
                    type="button"
                    onClick={() => togglePlatform(p)}
                    className={`flex items-center justify-between p-2 rounded-lg border text-xs font-medium ${
                      isSelected ? `${conf.iconBg} border-primary/40 font-semibold` : "border-border/60 bg-muted/20 text-muted-foreground"
                    }`}
                  >
                    <span>{conf.label}</span>
                    <span className={`size-2 rounded-full ${isSelected ? "bg-primary" : "bg-muted-foreground/30"}`} />
                  </button>
                );
              })}
            </div>
          </div>

          <div className="space-y-1.5">
            <div className="flex items-center justify-between">
              <Label className="text-xs font-medium text-muted-foreground">Content</Label>
              <span className={`text-xs tabular-nums font-mono ${isTwitterExceeded ? "text-destructive font-bold" : "text-muted-foreground"}`}>
                {charCount} {platforms.includes("twitter") ? "/ 280 (X)" : "chars"}
              </span>
            </div>
            <Textarea
              value={content}
              onChange={(e) => setContent(e.target.value)}
              placeholder="What's happening? Share updates, promotions, or insights..."
              className="min-h-[110px] text-sm resize-y"
            />
            {isTwitterExceeded && (
              <p className="text-xs text-amber-600 flex items-center gap-1">
                <AlertTriangle className="size-3.5" /> Exceeds 280 chars limit for X.
              </p>
            )}
          </div>

          <div className="space-y-1.5">
            <Label className="text-xs font-medium text-muted-foreground">Media URL</Label>
            <div className="flex gap-2">
              <Input
                value={newMediaInput}
                onChange={(e) => setNewMediaInput(e.target.value)}
                placeholder="https://... or media link"
                className="text-xs font-mono"
              />
              <Button type="button" variant="secondary" size="sm" onClick={handleAddMedia}>
                <Plus className="size-3.5 mr-1" /> Add
              </Button>
            </div>
            {mediaUrls.length > 0 && (
              <div className="flex flex-wrap gap-1.5 pt-1">
                {mediaUrls.map((url, i) => (
                  <div key={i} className="flex items-center gap-1 text-xs bg-muted px-2 py-0.5 rounded border">
                    <span className="truncate max-w-[160px] font-mono">{url}</span>
                    <button type="button" onClick={() => setMediaUrls(mediaUrls.filter((_, idx) => idx !== i))} className="text-destructive">
                      <Trash2 className="size-3" />
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>

          <div className="rounded-xl border bg-card/60 p-3 space-y-1.5">
            <div className="flex items-center gap-1.5 text-xs font-semibold">
              <Clock className="size-3.5 text-primary" />
              <span>Schedule Time</span>
            </div>
            <Input
              type="datetime-local"
              value={scheduledFor}
              onChange={(e) => setScheduledFor(e.target.value)}
              className="text-xs font-mono max-w-xs"
            />
          </div>

          {error && <div className="rounded-lg bg-destructive/10 border border-destructive/20 p-2.5 text-xs text-destructive">{error}</div>}
        </div>

        <DialogFooter className="flex flex-col sm:flex-row items-center justify-between gap-2 border-t pt-3">
          <Button type="button" variant="ghost" size="sm" onClick={() => onOpenChange(false)} disabled={isPending}>
            Cancel
          </Button>
          <div className="flex items-center gap-2">
            <Button type="button" variant="outline" size="sm" onClick={() => handleSubmit("draft")} disabled={isPending}>
              <Save className="size-3.5 mr-1" /> Draft
            </Button>
            <Button type="button" variant="secondary" size="sm" onClick={() => handleSubmit("scheduled")} disabled={isPending}>
              <Calendar className="size-3.5 mr-1" /> Schedule
            </Button>
            <Button type="button" size="sm" onClick={() => handleSubmit("published")} disabled={isPending}>
              <Send className="size-3.5 mr-1" /> Publish Now
            </Button>
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
