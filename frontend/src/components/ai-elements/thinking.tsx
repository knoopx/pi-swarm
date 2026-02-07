"use client";

import type { ComponentProps, HTMLAttributes } from "react";
import { Brain } from "lucide-react";
import { memo } from "react";
import { cn } from "src/lib/utils";
import { MessageResponse } from "./message";

export type ThinkingProps = HTMLAttributes<HTMLDivElement> & {
  defaultOpen?: boolean;
};

export const Thinking = ({ className, children, ...props }: ThinkingProps) => (
  <div
    className={cn(
      "flex w-full max-w-[95%] gap-2 text-sm text-muted-foreground italic",
      className,
    )}
    {...props}
  >
    <Brain className="h-4 w-4 shrink-0 mt-0.5" />
    <div className="flex-1">{children}</div>
  </div>
);

export type ThinkingContentProps = ComponentProps<typeof MessageResponse>;

export const ThinkingContent = memo(
  ({ className, ...props }: ThinkingContentProps) => (
    <div
      className={cn("[&>*:first-child]:mt-0 [&>*:last-child]:mb-0", className)}
    >
      <MessageResponse {...props} />
    </div>
  ),
  (prevProps, nextProps) => prevProps.children === nextProps.children,
);

ThinkingContent.displayName = "ThinkingContent";
