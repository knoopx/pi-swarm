export interface Agent {
  id: string;
  name: string;
  status: "pending" | "running" | "completed" | "waiting" | "stopped" | "error";
  instruction: string;
  workspace: string;
  basePath: string;
  createdAt: string;
  updatedAt: string;
  output: string;
  modifiedFiles: string[];
  diffStat: string;
  model: string;
  provider: string;
}

export interface ModelInfo {
  provider: string;
  modelId: string;
  name: string;
}

export interface ApiResponse<T> {
  agents?: T[];
  agent?: T;
  error?: string;
  success?: boolean;
  diff?: string;
  message?: string;
}
