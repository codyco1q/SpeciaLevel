"use client";

import { ChevronLeft, ChevronRight, Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import type { MarketingSocialPost } from "@/types/database";

const STATUS_BADGE_STYLES: Record<string, string> = {
  draft: "border-muted-foreground/30 bg-muted text-muted-foreground",
  scheduled: "border-blue-300 bg-blue-50 text-blue-700 dark:border-blue-900 dark:bg-blue-950 dark:text-blue-300",
  published: "border-emerald-300 bg-emerald-50 text-emerald-700 dark:border-emerald-900 dark:bg-emerald-950 dark:text-emerald-300",
  failed: "border-red-300 bg-red-50 text-red-700 dark:border-red-900 dark:bg-red-950 dark:text-red-300",
};

interface SocialCalendarGridProps {
  currentDate: Date;
  posts: MarketingSocialPost[];
  canManage: boolean;
  onPrevMonth: () => void;
  onNextMonth: () => void;
  onToday: () => void;
  onOpenCreate: (dateStr?: string) => void;
  onOpenEdit: (post: MarketingSocialPost) => void;
}

export function SocialCalendarGrid({
  currentDate,
  posts,
  canManage,
  onPrevMonth,
  onNextMonth,
  onToday,
  onOpenCreate,
  onOpenEdit,
}: SocialCalendarGridProps) {
  const year = currentDate.getFullYear();
  const month = currentDate.getMonth();
  const firstDay = new Date(year, month, 1).getDay();
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const monthName = currentDate.toLocaleString("default", { month: "long", year: "numeric" });

  const daysGrid: ({ day: number; dateStr: string; posts: MarketingSocialPost[] } | null)[] = [];
  for (let i = 0; i < firstDay; i++) daysGrid.push(null);
  for (let d = 1; d <= daysInMonth; d++) {
    const mStr = String(month + 1).padStart(2, "0");
    const dStr = String(d).padStart(2, "0");
    const dateStr = `${year}-${mStr}-${dStr}`;
    const dayPosts = posts.filter((p) => {
      const pDate = p.scheduled_for || p.published_at || p.created_at;
      return pDate ? pDate.startsWith(dateStr) : false;
    });
    daysGrid.push({ day: d, dateStr, posts: dayPosts });
  }

  return (
    <div className="rounded-xl border bg-card shadow-xs overflow-hidden">
      <div className="flex items-center justify-between p-4 border-b">
        <div className="flex items-center gap-3">
          <h3 className="font-semibold text-base capitalize">{monthName}</h3>
          <Button variant="outline" size="sm" className="h-7 text-xs px-2.5" onClick={onToday}>
            Today
          </Button>
        </div>
        <div className="flex items-center gap-1">
          <Button variant="ghost" size="icon" className="size-8" onClick={onPrevMonth}>
            <ChevronLeft className="size-4" />
          </Button>
          <Button variant="ghost" size="icon" className="size-8" onClick={onNextMonth}>
            <ChevronRight className="size-4" />
          </Button>
        </div>
      </div>

      <div className="grid grid-cols-7 border-b text-center text-xs font-semibold text-muted-foreground py-2 bg-muted/20">
        <div>Sun</div><div>Mon</div><div>Tue</div><div>Wed</div><div>Thu</div><div>Fri</div><div>Sat</div>
      </div>

      <div className="grid grid-cols-7 auto-rows-fr divide-x divide-y border-b">
        {daysGrid.map((cell, idx) => {
          if (!cell) return <div key={`empty-${idx}`} className="min-h-[100px] bg-muted/10 p-2" />;
          const isToday = new Date().toISOString().slice(0, 10) === cell.dateStr;

          return (
            <div
              key={cell.dateStr}
              className={`min-h-[110px] p-2 flex flex-col justify-between group hover:bg-muted/30 transition-colors cursor-pointer ${
                isToday ? "bg-primary/5" : ""
              }`}
              onClick={() => canManage && onOpenCreate(cell.dateStr)}
            >
              <div className="flex items-center justify-between">
                <span className={`text-xs font-medium size-6 flex items-center justify-center rounded-full ${
                  isToday ? "bg-primary text-primary-foreground font-bold" : "text-muted-foreground"
                }`}>
                  {cell.day}
                </span>
                <button
                  type="button"
                  className="opacity-0 group-hover:opacity-100 size-5 rounded text-muted-foreground hover:text-foreground flex items-center justify-center"
                  onClick={(e) => {
                    e.stopPropagation();
                    canManage && onOpenCreate(cell.dateStr);
                  }}
                >
                  <Plus className="size-3" />
                </button>
              </div>

              <div className="space-y-1 mt-1 flex-1 overflow-y-auto max-h-[80px]">
                {cell.posts.map((p) => (
                  <div
                    key={p.id}
                    onClick={(e) => {
                      e.stopPropagation();
                      onOpenEdit(p);
                    }}
                    className={`text-[11px] p-1.5 rounded border leading-tight truncate font-medium transition-transform hover:scale-102 ${
                      STATUS_BADGE_STYLES[p.status] || "bg-muted"
                    }`}
                  >
                    <div className="flex items-center gap-1 truncate">
                      <span className="capitalize font-bold text-[9px] uppercase tracking-wider">
                        {p.platforms.join(", ")}
                      </span>
                    </div>
                    <p className="truncate text-foreground/80 mt-0.5">{p.content}</p>
                  </div>
                ))}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
