import * as React from "react";
import { cva, type VariantProps } from "class-variance-authority";

import { cn } from "src/lib/utils";

const badgeVariants = cva(
  "inline-flex items-center rounded-full border px-2.5 py-0.5 text-[11px] font-semibold transition-all duration-200 focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2",
  {
    variants: {
      variant: {
        default:
          "border-transparent bg-primary/90 text-primary-foreground shadow-sm",
        secondary: "border-base03 bg-base02/50 text-base05",
        destructive: "border-transparent bg-destructive/20 text-destructive",
        outline: "border-base03 text-base04 bg-transparent",
        success: "border-transparent bg-base0B/15 text-base0B",
        warning: "border-transparent bg-base09/15 text-base09",
        info: "border-transparent bg-base0C/15 text-base0C",
        running: "border-transparent bg-base0C/15 text-base0C animate-pulse",
        pending: "border-base03 bg-base02/30 text-base04",
        completed: "border-transparent bg-base0B/15 text-base0B",
        stopped: "border-transparent bg-base09/15 text-base09",
        error: "border-transparent bg-base08/15 text-base08",
      },
      size: {
        default: "px-2.5 py-0.5",
        sm: "px-2 py-px text-[10px]",
        lg: "px-3 py-1 text-xs",
      },
    },
    defaultVariants: {
      variant: "default",
      size: "default",
    },
  },
);

export interface BadgeProps
  extends
    React.HTMLAttributes<HTMLDivElement>,
    VariantProps<typeof badgeVariants> {}

function Badge({ className, variant, size, ...props }: BadgeProps) {
  return (
    <div
      className={cn(badgeVariants({ variant, size }), className)}
      {...props}
    />
  );
}

export { Badge, badgeVariants };
