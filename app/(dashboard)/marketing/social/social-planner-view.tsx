"use client";

import { useState, useTransition } from "react";
import { Calendar as CalendarIcon, ListFilter, Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  getSocialPosts,
  deleteSocialPost,
  getSocialPlannerStatus,
} from "@/lib/actions/marketing-social";
import { SocialPostDialog } from "./social-post-dialog";
import { SocialPaywallCard } from "./social-paywall-card";
import { SocialCalendarGrid } from "./social-calendar-grid";
import { SocialQueueList } from "./social-queue-list";
import type { MarketingSocialPost, MarketingSocialPostStatus } from "@/types/database";
import type { Dictionary, Locale } from "@/lib/i18n/get-dictionary";

interface SocialPlannerViewProps {
  initialPosts: MarketingSocialPost[];
  isSubscribed: boolean;
  canManage: boolean;
  platform: Dictionary["platform"];
  locale: Locale;
}

export function SocialPlannerView({
  initialPosts,
  isSubscribed: initialSubscribed,
  canManage,
  platform,
  locale,
}: SocialPlannerViewProps) {
  const [isSubscribed, setIsSubscribed] = useState(initialSubscribed);
  const [posts, setPosts] = useState<MarketingSocialPost[]>(initialPosts);
  const [viewMode, setViewMode] = useState<"calendar" | "queue">("calendar");
  const [statusFilter, setStatusFilter] = useState<"all" | MarketingSocialPostStatus>("all");
  const [currentDate, setCurrentDate] = useState(new Date());
  const [dialogOpen, setDialogOpen] = useState(false);
  const [selectedPost, setSelectedPost] = useState<MarketingSocialPost | null>(null);
  const [selectedDate, setSelectedDate] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  const refreshPosts = () => {
    startTransition(async () => {
      const [fetchedPosts, status] = await Promise.all([
        getSocialPosts(),
        getSocialPlannerStatus(),
      ]);
      setPosts(fetchedPosts);
      setIsSubscribed(status.isSubscribed);
    });
  };

  const handleOpenCreate = (dateStr?: string) => {
    setSelectedPost(null);
    setSelectedDate(dateStr || null);
    setDialogOpen(true);
  };

  const handleOpenEdit = (post: MarketingSocialPost) => {
    setSelectedPost(post);
    setSelectedDate(null);
    setDialogOpen(true);
  };

  const handleDelete = (id: string) => {
    if (!confirm("Are you sure you want to delete this social post?")) return;
    startTransition(async () => {
      const res = await deleteSocialPost(id);
      if (res.status === "success") {
        refreshPosts();
      }
    });
  };

  if (!isSubscribed) {
    return (
      <div className="space-y-6">
        <SocialPaywallCard onActivated={refreshPosts} canManage={canManage} />
      </div>
    );
  }

  const year = currentDate.getFullYear();
  const month = currentDate.getMonth();

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-xl font-bold tracking-tight">Social Media Planner</h2>
          <p className="text-xs text-muted-foreground mt-0.5">
            Plan, compose, and multi-publish across your social channels.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <div className="flex rounded-lg border bg-muted/30 p-0.5">
            <button
              type="button"
              onClick={() => setViewMode("calendar")}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-medium transition-all ${
                viewMode === "calendar" ? "bg-background shadow-xs text-foreground" : "text-muted-foreground hover:text-foreground"
              }`}
            >
              <CalendarIcon className="size-3.5" />
              <span>Calendar</span>
            </button>
            <button
              type="button"
              onClick={() => setViewMode("queue")}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-medium transition-all ${
                viewMode === "queue" ? "bg-background shadow-xs text-foreground" : "text-muted-foreground hover:text-foreground"
              }`}
            >
              <ListFilter className="size-3.5" />
              <span>Queue / List</span>
            </button>
          </div>

          {canManage && (
            <Button size="sm" onClick={() => handleOpenCreate()}>
              <Plus className="size-3.5 mr-1" />
              New Post
            </Button>
          )}
        </div>
      </div>

      {viewMode === "calendar" ? (
        <SocialCalendarGrid
          currentDate={currentDate}
          posts={posts}
          canManage={canManage}
          onPrevMonth={() => setCurrentDate(new Date(year, month - 1, 1))}
          onNextMonth={() => setCurrentDate(new Date(year, month + 1, 1))}
          onToday={() => setCurrentDate(new Date())}
          onOpenCreate={handleOpenCreate}
          onOpenEdit={handleOpenEdit}
        />
      ) : (
        <SocialQueueList
          posts={posts}
          statusFilter={statusFilter}
          canManage={canManage}
          onStatusFilterChange={setStatusFilter}
          onOpenCreate={() => handleOpenCreate()}
          onOpenEdit={handleOpenEdit}
          onDelete={handleDelete}
        />
      )}

      <SocialPostDialog
        open={dialogOpen}
        onOpenChange={setDialogOpen}
        post={selectedPost}
        initialScheduledDate={selectedDate}
        onSaved={refreshPosts}
      />
    </div>
  );
}

