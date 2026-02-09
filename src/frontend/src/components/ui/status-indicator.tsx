import {
  Loader2,
  Circle,
  CheckCircle2,
  XCircle,
  PauseCircle,
  AlertCircle,
} from "lucide-react";
import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "../../lib/utils";

const statusIndicatorVariants = cva(
  "inline-flex items-center justify-center shrink-0",
  {
    variants: {
      status: {
        idle: "text-base04",
        running: "text-base0C",
        pending: "text-base09",
        success: "text-base0B",
        error: "text-base08",
        paused: "text-base09",
        stopped: "text-base04",
      },
      size: {
        xs: "[&>svg]:h-3 [&>svg]:w-3",
        sm: "[&>svg]:h-4 [&>svg]:w-4",
        default: "[&>svg]:h-5 [&>svg]:w-5",
        lg: "[&>svg]:h-6 [&>svg]:w-6",
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
  idle: Circle,
  running: Loader2,
  pending: Loader2,
  success: CheckCircle2,
  error: XCircle,
  paused: PauseCircle,
  stopped: AlertCircle,
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
      <Icon className={cn(isAnimated && "animate-spin")} />
    </span>
  );
}
