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
  <div className={cn("thinking", className)} {...props}>
    <Brain className="thinking-icon" />
    <div className="thinking-content">{children}</div>
  </div>
);

export type ThinkingContentProps = ComponentProps<typeof MessageResponse>;

export const ThinkingContent = memo(
  ({ className, ...props }: ThinkingContentProps) => (
    <div className={cn("thinking-content-inner", className)}>
      <MessageResponse {...props} />
    </div>
  ),
  (prevProps, nextProps) => prevProps.children === nextProps.children,
);

ThinkingContent.displayName = "ThinkingContent";
