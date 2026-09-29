"use client";

import { useState, useTransition } from "react";
import {
  Sparkles,
  Calendar,
  Share2,
  CheckCircle2,
  Zap,
  ArrowRight,
  ShieldCheck,
  Globe2,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { activateSocialPlannerAddon } from "@/lib/actions/marketing";

interface SocialPaywallCardProps {
  onActivated: () => void;
  canManage: boolean;
}

export function SocialPaywallCard({
  onActivated,
  canManage,
}: SocialPaywallCardProps) {
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  const handleActivate = () => {
    setError(null);
    startTransition(async () => {
      const res = await activateSocialPlannerAddon();
      if (res.status === "success") {
        onActivated();
      } else {
        setError(res.error || "Failed to activate Social Planner add-on.");
      }
    });
  };

  return (
    <div className="relative overflow-hidden rounded-2xl border border-primary/20 bg-gradient-to-b from-primary/5 via-background to-background p-6 sm:p-10 shadow-sm">
      <div className="absolute top-0 right-0 -mt-12 -mr-12 h-64 w-64 rounded-full bg-primary/10 blur-3xl pointer-events-none" />

      <div className="max-w-3xl">
        <div className="inline-flex items-center gap-2 rounded-full border border-primary/30 bg-primary/10 px-3 py-1 text-xs font-semibold text-primary mb-4">
          <Sparkles className="size-3.5" />
          <span>Marketing Add-on</span>
          <span className="text-primary/40">&bull;</span>
          <span>$15 / month</span>
        </div>

        <h2 className="text-2xl sm:text-3xl font-bold tracking-tight text-foreground">
          Social Media Planner Studio
        </h2>
        <p className="mt-2 text-sm sm:text-base text-muted-foreground leading-relaxed">
          Unify your brand presence. Create, schedule, and manage content across
          Facebook, Instagram, X (Twitter), and LinkedIn from a single visual calendar.
        </p>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mt-8">
          <div className="flex items-start gap-3 rounded-xl border border-border/60 bg-card/60 p-4 backdrop-blur-xs">
            <div className="size-8 rounded-lg bg-blue-500/10 text-blue-600 flex items-center justify-center shrink-0">
              <Share2 className="size-4" />
            </div>
            <div>
              <h4 className="text-sm font-semibold text-foreground">Omnichannel Scheduling</h4>
              <p className="text-xs text-muted-foreground mt-0.5">
                Target Facebook, Instagram, Twitter, and LinkedIn with customizable media and formatting.
              </p>
            </div>
          </div>

          <div className="flex items-start gap-3 rounded-xl border border-border/60 bg-card/60 p-4 backdrop-blur-xs">
            <div className="size-8 rounded-lg bg-emerald-500/10 text-emerald-600 flex items-center justify-center shrink-0">
              <Calendar className="size-4" />
            </div>
            <div>
              <h4 className="text-sm font-semibold text-foreground">Visual Drag & Calendar</h4>
              <p className="text-xs text-muted-foreground mt-0.5">
                Interactive monthly and queue view. Monitor draft, scheduled, published, and failed states.
              </p>
            </div>
          </div>

          <div className="flex items-start gap-3 rounded-xl border border-border/60 bg-card/60 p-4 backdrop-blur-xs">
            <div className="size-8 rounded-lg bg-purple-500/10 text-purple-600 flex items-center justify-center shrink-0">
              <Zap className="size-4" />
            </div>
            <div>
              <h4 className="text-sm font-semibold text-foreground">Instant Publisher & Composer</h4>
              <p className="text-xs text-muted-foreground mt-0.5">
                Real-time character counters, platform limit alerts, and image attachments.
              </p>
            </div>
          </div>

          <div className="flex items-start gap-3 rounded-xl border border-border/60 bg-card/60 p-4 backdrop-blur-xs">
            <div className="size-8 rounded-lg bg-amber-500/10 text-amber-600 flex items-center justify-center shrink-0">
              <ShieldCheck className="size-4" />
            </div>
            <div>
              <h4 className="text-sm font-semibold text-foreground">Tenant Isolated & Secure</h4>
              <p className="text-xs text-muted-foreground mt-0.5">
                Multi-tenant RLS protection and granular role-based publishing controls.
              </p>
            </div>
          </div>
        </div>

        {error && (
          <div className="mt-4 rounded-lg bg-destructive/10 border border-destructive/20 p-3 text-xs text-destructive">
            {error}
          </div>
        )}

        <div className="mt-8 flex flex-col sm:flex-row items-start sm:items-center gap-4">
          <Button
            size="lg"
            onClick={handleActivate}
            disabled={isPending || !canManage}
            className="w-full sm:w-auto shadow-md font-medium"
          >
            {isPending ? (
              "Activating Add-on..."
            ) : (
              <>
                <span>Activate Social Planner ($15/mo)</span>
                <ArrowRight className="size-4 ml-1.5" />
              </>
            )}
          </Button>

          {!canManage && (
            <span className="text-xs text-muted-foreground">
              Only organization administrators can activate add-on subscriptions.
            </span>
          )}

          {canManage && (
            <span className="text-xs text-muted-foreground flex items-center gap-1.5">
              <CheckCircle2 className="size-3.5 text-emerald-500" />
              Cancel anytime. Instant activation.
            </span>
          )}
        </div>
      </div>
    </div>
  );
}
