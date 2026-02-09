import type { Agent } from "../types";
import type { StatusType } from "../components/ui/status-indicator";

export type StatusVariant =
  | "default"
  | "secondary"
  | "destructive"
  | "outline"
  | "success"
  | "warning";

export interface StatusConfig {
  variant: StatusVariant;
  label: string;
  status: StatusType;
  description: string;
}

export const statusConfig: Record<Agent["status"], StatusConfig> = {
  pending: {
    variant: "secondary",
    label: "Pending",
    status: "pending",
    description: "Waiting to start",
  },
  running: {
    variant: "warning",
    label: "Running",
    status: "running",
    description: "Agent is working",
  },
  completed: {
    variant: "success",
    label: "Completed",
    status: "success",
    description: "Task finished successfully",
  },
  waiting: {
    variant: "default",
    label: "Waiting",
    status: "paused",
    description: "Ready for your review",
  },
  stopped: {
    variant: "outline",
    label: "Stopped",
    status: "stopped",
    description: "Manually stopped",
  },
  error: {
    variant: "destructive",
    label: "Error",
    status: "error",
    description: "Something went wrong",
  },
};

const variantClassMap: Record<
  string,
  Record<StatusVariant | "fallback", string>
> = {
  "agent-card-border": {
    default: "border-l-base07",
    secondary: "border-l-base0B",
    destructive: "border-l-base08",
    outline: "border-l-base09",
    success: "border-l-base0B",
    warning: "border-l-base09",
    fallback: "border-l-base02",
  },
  "agent-status-icon": {
    default: "bg-base07/20 text-base07",
    secondary: "bg-base0B/20 text-base0B",
    destructive: "bg-base08/20 text-base08",
    outline: "bg-base09/20 text-base09",
    success: "bg-base0B/20 text-base0B",
    warning: "bg-base09/20 text-base09",
    fallback: "bg-base02/20 text-base04",
  },
  "sidebar-agent-icon": {
    default: "bg-base07/20 text-base07 group-hover:bg-base07/30",
    secondary: "bg-base0B/20 text-base0B group-hover:bg-base0B/30",
    destructive: "bg-base08/20 text-base08 group-hover:bg-base08/30",
    outline: "bg-base09/20 text-base09 group-hover:bg-base09/30",
    success: "bg-base0B/20 text-base0B group-hover:bg-base0B/30",
    warning: "bg-base09/20 text-base09 group-hover:bg-base09/30",
    fallback: "bg-base02/20 text-base04 group-hover:bg-base02/30",
  },
};

export function getVariantClass(
  prefix: "agent-card-border" | "agent-status-icon" | "sidebar-agent-icon",
  variant: StatusVariant | undefined,
): string {
  const classMap = variantClassMap[prefix];
  return classMap[variant ?? "fallback"] ?? classMap.fallback;
}

export function sortAgents(agents: Agent[]): Agent[] {
  return [...agents].sort((a, b) => {
    if (a.status === "running" && b.status !== "running") return -1;
    if (b.status === "running" && a.status !== "running") return 1;
    return new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime();
  });
}
