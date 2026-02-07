"use client";

import type { ComponentProps, HTMLAttributes } from "react";
import { Brain, ChevronDown } from "lucide-react";
import { memo, useState } from "react";
import { cn } from "src/lib/utils";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "src/components/ui/collapsible";
import { MessageResponse } from "./message";

export type ThinkingProps = HTMLAttributes<HTMLDivElement> & {
  defaultOpen?: boolean;
};

export const Thinking = ({
  className,
  defaultOpen = false,
  children,
  ...props
}: ThinkingProps) => {
  const [isOpen, setIsOpen] = useState(defaultOpen);

  return (
    <Collapsible
      open={isOpen}
      onOpenChange={setIsOpen}
      className={cn(
        "group/thinking w-full max-w-[95%] rounded-lg border border-dashed border-muted-foreground/30 bg-muted/20",
        className,
      )}
      {...props}
    >
      <CollapsibleTrigger className="flex w-full items-center gap-2 px-3 py-2 text-sm text-muted-foreground hover:text-foreground transition-colors">
        <Brain className="h-4 w-4 shrink-0" />
        <span className="font-medium">Reasoning</span>
        <ChevronDown
          className={cn(
            "ml-auto h-4 w-4 shrink-0 transition-transform duration-200",
            isOpen && "rotate-180",
          )}
        />
      </CollapsibleTrigger>
      <CollapsibleContent>
        <div className="px-3 pb-3">{children}</div>
      </CollapsibleContent>
    </Collapsible>
  );
};

export type ThinkingContentProps = ComponentProps<typeof MessageResponse>;

export const ThinkingContent = memo(
  ({ className, ...props }: ThinkingContentProps) => (
    <div
      className={cn(
        "rounded-md bg-muted/50 p-3 text-sm text-muted-foreground",
        "[&>*:first-child]:mt-0 [&>*:last-child]:mb-0",
        className,
      )}
    >
      <MessageResponse {...props} />
    </div>
  ),
  (prevProps, nextProps) => prevProps.children === nextProps.children,
);

ThinkingContent.displayName = "ThinkingContent";
