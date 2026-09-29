"use client";

import {
  Share2,
  MoreHorizontal,
  Pencil,
  Trash2,
  Clock,
  Plus,
  FileText,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import type { MarketingSocialPost, MarketingSocialPostStatus } from "@/types/database";

const STATUS_BADGE_STYLES: Record<MarketingSocialPostStatus, { label: string; class: string }> = {
  draft: { label: "Draft", class: "border-muted-foreground/30 bg-muted text-muted-foreground" },
  scheduled: { label: "Scheduled", class: "border-blue-300 bg-blue-50 text-blue-700 dark:border-blue-900 dark:bg-blue-950 dark:text-blue-300" },
  published: { label: "Published", class: "border-emerald-300 bg-emerald-50 text-emerald-700 dark:border-emerald-900 dark:bg-emerald-950 dark:text-emerald-300" },
  failed: { label: "Failed", class: "border-red-300 bg-red-50 text-red-700 dark:border-red-900 dark:bg-red-950 dark:text-red-300" },
};

interface SocialQueueListProps {
  posts: MarketingSocialPost[];
  statusFilter: "all" | MarketingSocialPostStatus;
  canManage: boolean;
  onStatusFilterChange: (st: "all" | MarketingSocialPostStatus) => void;
  onOpenCreate: () => void;
  onOpenEdit: (post: MarketingSocialPost) => void;
  onDelete: (id: string) => void;
}

export function SocialQueueList({
  posts,
  statusFilter,
  canManage,
  onStatusFilterChange,
  onOpenCreate,
  onOpenEdit,
  onDelete,
}: SocialQueueListProps) {
  const filtered = posts.filter(
    (p) => statusFilter === "all" || p.status === statusFilter
  );

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-1.5">
        {(["all", "draft", "scheduled", "published", "failed"] as const).map((st) => (
          <Button
            key={st}
            variant={statusFilter === st ? "secondary" : "ghost"}
            size="sm"
            className="capitalize text-xs h-7"
            onClick={() => onStatusFilterChange(st)}
          >
            {st}
          </Button>
        ))}
      </div>

      {filtered.length === 0 ? (
        <div className="rounded-xl border border-dashed p-10 text-center text-muted-foreground">
          <Share2 className="size-8 mx-auto mb-2 opacity-40" />
          <p className="text-sm font-medium">No social posts found</p>
          <p className="text-xs mt-1">Get started by composing your first scheduled post.</p>
          {canManage && (
            <Button size="sm" className="mt-4" onClick={onOpenCreate}>
              <Plus className="size-3.5 mr-1" /> Compose Post
            </Button>
          )}
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {filtered.map((post) => {
            const badge = STATUS_BADGE_STYLES[post.status];
            return (
              <div
                key={post.id}
                className="rounded-xl border bg-card p-4 shadow-xs flex flex-col justify-between hover:border-primary/40 transition-colors"
              >
                <div>
                  <div className="flex items-center justify-between gap-2 mb-3">
                    <div className="flex flex-wrap gap-1">
                      {post.platforms.map((pl) => (
                        <Badge key={pl} variant="outline" className="text-[10px] uppercase font-semibold">
                          {pl}
                        </Badge>
                      ))}
                    </div>
                    <Badge variant="outline" className={`text-[10px] ${badge.class}`}>
                      {badge.label}
                    </Badge>
                  </div>

                  <p className="text-xs text-foreground/90 whitespace-pre-wrap line-clamp-4 leading-relaxed">
                    {post.content}
                  </p>

                  {post.media_urls.length > 0 && (
                    <div className="mt-3 flex items-center gap-1.5 text-xs text-muted-foreground font-mono">
                      <FileText className="size-3" />
                      <span>{post.media_urls.length} media attachment(s)</span>
                    </div>
                  )}
                </div>

                <div className="mt-4 pt-3 border-t flex items-center justify-between text-xs text-muted-foreground">
                  <div className="flex items-center gap-1 truncate">
                    <Clock className="size-3 shrink-0" />
                    <span className="truncate">
                      {post.scheduled_for
                        ? `Sched: ${new Date(post.scheduled_for).toLocaleDateString()}`
                        : `Created: ${new Date(post.created_at).toLocaleDateString()}`}
                    </span>
                  </div>

                  {canManage && (
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button variant="ghost" size="icon" className="size-7">
                          <MoreHorizontal className="size-3.5" />
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end">
                        <DropdownMenuItem onClick={() => onOpenEdit(post)}>
                          <Pencil className="size-3.5 mr-2" /> Edit
                        </DropdownMenuItem>
                        <DropdownMenuItem
                          onClick={() => onDelete(post.id)}
                          className="text-destructive focus:text-destructive"
                        >
                          <Trash2 className="size-3.5 mr-2" /> Delete
                        </DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
