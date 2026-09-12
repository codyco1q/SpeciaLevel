"use client";

import { useEffect, useState, useTransition } from "react";
import { Controller, useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { LoaderCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  channelInputSchema,
  type ChannelFormValues,
} from "@/lib/validations/chat";
import { createChannel, type ChatChannelRow } from "@/lib/actions/chat";
import type { Dictionary } from "@/lib/i18n/get-dictionary";

interface ChannelDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** Called with the persisted channel after a successful create. */
  onCreated: (channel: ChatChannelRow) => void;
  /** Localized copy for the current render. */
  platform: Dictionary["platform"];
}

/**
 * Create channel dialog backed by react-hook-form + the shared Zod schema.
 * Submits to the `createChannel` server action, which re-validates
 * everything server-side and revalidates /chat.
 */
export function ChannelDialog({
  open,
  onOpenChange,
  onCreated,
  platform,
}: ChannelDialogProps) {
  const t = platform.chat;
  const [isPending, startTransition] = useTransition();
  const [serverError, setServerError] = useState<string | null>(null);

  const {
    register,
    handleSubmit,
    reset,
    control,
    setError,
    formState: { errors },
  } = useForm<ChannelFormValues>({
    resolver: zodResolver(channelInputSchema),
    defaultValues: { name: "", description: "", isPrivate: false },
  });

  // Re-seed a pristine form every time the dialog opens.
  useEffect(() => {
    if (!open) return;
    reset({ name: "", description: "", isPrivate: false });
  }, [open, reset]);

  const handleOpenChange = (next: boolean) => {
    if (!next) setServerError(null);
    onOpenChange(next);
  };

  const onSubmit = handleSubmit((values) => {
    setServerError(null);

    startTransition(async () => {
      const result = await createChannel(values);

      if (result.status === "error") {
        if (result.fieldErrors) {
          for (const [key, messages] of Object.entries(result.fieldErrors)) {
            if (messages?.[0]) {
              setError(key as keyof ChannelFormValues, {
                message: messages[0],
              });
            }
          }
        }
        setServerError(result.error ?? t.errors.createFailed);
        return;
      }

      onCreated(result.channel);
      onOpenChange(false);
    });
  });

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{t.createChannelTitle}</DialogTitle>
          <DialogDescription>{t.createChannelDescription}</DialogDescription>
        </DialogHeader>

        <form onSubmit={onSubmit} className="grid gap-4">
          <div className="grid gap-2">
            <Label htmlFor="channel-name">{t.channelName}</Label>
            <Input
              id="channel-name"
              placeholder={t.channelNamePlaceholder}
              {...register("name")}
              aria-invalid={Boolean(errors.name)}
            />
            {errors.name && (
              <p role="alert" className="text-sm text-destructive">
                {errors.name.message}
              </p>
            )}
          </div>

          <div className="grid gap-2">
            <Label htmlFor="channel-description">
              {t.descriptionField}{" "}
              <span className="text-muted-foreground">
                ({t.descriptionOptional})
              </span>
            </Label>
            <Textarea
              id="channel-description"
              placeholder={t.descriptionPlaceholder}
              rows={2}
              {...register("description")}
              aria-invalid={Boolean(errors.description)}
            />
            {errors.description && (
              <p role="alert" className="text-sm text-destructive">
                {errors.description.message}
              </p>
            )}
          </div>

          <div className="flex items-center gap-2">
            <Controller
              name="isPrivate"
              control={control}
              render={({ field }) => (
                <Checkbox
                  id="channel-private"
                  checked={field.value}
                  onCheckedChange={(checked) => field.onChange(checked === true)}
                />
              )}
            />
            <Label htmlFor="channel-private" className="text-sm font-normal">
              {t.privateChannel}
            </Label>
          </div>

          {serverError && (
            <p
              role="alert"
              className="rounded-md border border-destructive/30 bg-destructive/10 px-3 py-2 text-sm text-destructive"
            >
              {serverError}
            </p>
          )}

          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => onOpenChange(false)}
              disabled={isPending}
            >
              {platform.common.cancel}
            </Button>
            <Button type="submit" disabled={isPending}>
              {isPending && <LoaderCircle className="h-4 w-4 animate-spin" />}
              {t.createChannel}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}