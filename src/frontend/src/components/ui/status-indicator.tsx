import { Loader2, Minus, Check, X, Pause, AlertTriangle } from "lucide-react";
import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "../../lib/utils";

const statusIndicatorVariants = cva(
  "inline-flex items-center justify-center shrink-0 rounded-sm",
  {
    variants: {
      status: {
        idle: "bg-base03 text-base00",
        running: "bg-base0A text-base00",
        pending: "bg-base09 text-base00",
        success: "bg-base0B text-base00",
        error: "bg-base08 text-base00",
        paused: "bg-base0A text-base00",
        stopped: "bg-base04 text-base00",
      },
      size: {
        xs: "h-4 w-4 [&>svg]:h-2.5 [&>svg]:w-2.5",
        sm: "h-5 w-5 [&>svg]:h-3 [&>svg]:w-3",
        default: "h-6 w-6 [&>svg]:h-3.5 [&>svg]:w-3.5",
        lg: "h-8 w-8 [&>svg]:h-5 [&>svg]:w-5",
      },
    },
    defaultVariants: {
      status: "idle",
      size: "default",
    },
  },
);

export type StatusType =
  | "idle"
  | "running"
  | "pending"
  | "success"
  | "error"
  | "paused"
  | "stopped";

export interface StatusIndicatorProps
  extends
    React.HTMLAttributes<HTMLSpanElement>,
    VariantProps<typeof statusIndicatorVariants> {
  status: StatusType;
}

const statusIcons: Record<StatusType, React.ElementType> = {
  idle: Minus,
  running: Loader2,
  pending: Loader2,
  success: Check,
  error: X,
  paused: Pause,
  stopped: AlertTriangle,
};

export function StatusIndicator({
  status,
  size,
  className,
  ...props
}: StatusIndicatorProps) {
  const Icon = statusIcons[status];
  const isAnimated = status === "running" || status === "pending";

  return (
    <span
      className={cn(statusIndicatorVariants({ status, size }), className)}
      {...props}
    >
      <Icon className={cn(isAnimated && "animate-spin")} strokeWidth={2.5} />
    </span>
  );
}
