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
    default: "border-l-base0A",
    secondary: "border-l-base04",
    destructive: "border-l-base08",
    outline: "border-l-base04",
    success: "border-l-base0B",
    warning: "border-l-base0C",
    fallback: "border-l-base03",
  },
  "agent-status-icon": {
    default: "bg-base02",
    secondary: "bg-base02",
    destructive: "bg-base02",
    outline: "bg-base02",
    success: "bg-base02",
    warning: "bg-base02",
    fallback: "bg-base02",
  },
  "sidebar-agent-icon": {
    default: "bg-base02",
    secondary: "bg-base02",
    destructive: "bg-base02",
    outline: "bg-base02",
    success: "bg-base02",
    warning: "bg-base02",
    fallback: "bg-base02",
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
