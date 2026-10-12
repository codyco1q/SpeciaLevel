"use client";

import * as React from "react";
import { cn } from "@/lib/utils";

export interface AvatarProps extends React.HTMLAttributes<HTMLDivElement> {
  className?: string;
}

export function Avatar({ className, ...props }: AvatarProps) {
  return (
    <div
      className={cn(
        "relative flex size-8 shrink-0 overflow-hidden rounded-full select-none",
        className
      )}
      {...props}
    />
  );
}

export interface AvatarImageProps
  extends React.ImgHTMLAttributes<HTMLImageElement> {
  className?: string;
  onLoadingStatusChange?: (status: "loading" | "loaded" | "error") => void;
}

export function AvatarImage({
  src,
  alt = "",
  className,
  onLoadingStatusChange,
  ...props
}: AvatarImageProps) {
  const [hasError, setHasError] = React.useState(false);

  React.useEffect(() => {
    setHasError(false);
  }, [src]);

  if (!src || hasError) {
    return null;
  }

  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img
      src={src}
      alt={alt}
      onError={() => {
        setHasError(true);
        onLoadingStatusChange?.("error");
      }}
      onLoad={() => onLoadingStatusChange?.("loaded")}
      className={cn("aspect-square size-full object-cover", className)}
      {...props}
    />
  );
}

export interface AvatarFallbackProps
  extends React.HTMLAttributes<HTMLDivElement> {
  className?: string;
}

export function AvatarFallback({
  className,
  children,
  ...props
}: AvatarFallbackProps) {
  return (
    <div
      className={cn(
        "flex size-full items-center justify-center rounded-full bg-muted text-xs font-semibold text-muted-foreground",
        className
      )}
      {...props}
    >
      {children}
    </div>
  );
}
