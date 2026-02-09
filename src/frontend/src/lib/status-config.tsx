import {
  Activity,
  CheckCircle2,
  Clock,
  PauseCircle,
  XCircle,
  AlertCircle,
} from "lucide-react";
import type { Agent } from "../types";

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
  icon: React.ReactNode;
  description: string;
}

export const statusConfig: Record<Agent["status"], StatusConfig> = {
  pending: {
    variant: "secondary",
    label: "Pending",
    icon: <Clock className="h-3 w-3" />,
    description: "Waiting to start",
  },
  running: {
    variant: "warning",
    label: "Running",
    icon: <Activity className="h-3 w-3" />,
    description: "Agent is working",
  },
  completed: {
    variant: "success",
    label: "Completed",
    icon: <CheckCircle2 className="h-3 w-3" />,
    description: "Task finished successfully",
  },
  waiting: {
    variant: "default",
    label: "Waiting",
    icon: <AlertCircle className="h-3 w-3" />,
    description: "Ready for your review",
  },
  stopped: {
    variant: "outline",
    label: "Stopped",
    icon: <PauseCircle className="h-3 w-3" />,
    description: "Manually stopped",
  },
  error: {
    variant: "destructive",
    label: "Error",
    icon: <XCircle className="h-3 w-3" />,
    description: "Something went wrong",
  },
};

export function sortAgents(agents: Agent[]): Agent[] {
  return [...agents].sort((a, b) => {
    if (a.status === "running" && b.status !== "running") return -1;
    if (b.status === "running" && a.status !== "running") return 1;
    return new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime();
  });
}
