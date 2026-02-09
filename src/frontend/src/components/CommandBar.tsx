import { useState, useCallback, useMemo } from "react";
import {
  CommandDialog,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
  CommandSeparator,
  CommandShortcut,
} from "./ui/command";
import {
  Play,
  Square,
  GitMerge,
  Trash2,
  Plus,
  FileCode,
  MessageSquare,
  Eye,
  EyeOff,
  RefreshCw,
  Zap,
  CheckCircle,
  XCircle,
  Sun,
  Moon,
  StopCircle,
  PlayCircle,
  RotateCcw,
  FolderSync,
  Layers,
  Filter,
} from "lucide-react";
import type { Agent } from "../types";
import type { LucideIcon } from "lucide-react";

function AgentGroup({
  heading,
  agents,
  icon: Icon,
  iconClassName,
  onSelect,
  showStatus,
}: {
  heading: string;
  agents: Agent[];
  icon: LucideIcon;
  iconClassName?: string;
  onSelect: (id: string) => void;
  showStatus?: boolean;
}) {
  if (agents.length === 0) return null;

  return (
    <CommandGroup heading={heading}>
      {agents.map((agent) => (
        <CommandItem key={agent.id} onSelect={() => onSelect(agent.id)}>
          <Icon className={`mr-2 h-4 w-4 ${iconClassName ?? ""}`} />
          <span className="truncate flex-1">{agent.name}</span>
          {showStatus && (
            <span className="text-xs text-muted-foreground capitalize">
              {agent.status}
            </span>
          )}
        </CommandItem>
      ))}
    </CommandGroup>
  );
}

interface CommandBarProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  agents: Agent[];
  selectedId: string | null;
  onSelectAgent: (id: string) => void;
  onCreateAgent: () => void;
  onStartAgent: (id: string) => void;
  onStopAgent: (id: string) => void;
  onResumeAgent: (id: string) => void;
  onMergeAgent: (id: string) => void;
  onDeleteAgent: (id: string) => void;
  onToggleReview?: () => void;
  showReview?: boolean;
  onRefreshFiles?: () => void;
}

type StatusFilter =
  | "all"
  | "running"
  | "waiting"
  | "pending"
  | "completed"
  | "stopped"
  | "error";

export function CommandBar({
  open,
  onOpenChange,
  agents,
  selectedId,
  onSelectAgent,
  onCreateAgent,
  onStartAgent,
  onStopAgent,
  onResumeAgent,
  onMergeAgent,
  onDeleteAgent,
  onToggleReview,
  showReview,
  onRefreshFiles,
}: CommandBarProps) {
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("all");

  const selectedAgent = useMemo(
    () => agents.find((a) => a.id === selectedId),
    [agents, selectedId],
  );

  const runCallback = useCallback(
    (callback: () => void) => {
      callback();
      onOpenChange(false);
      setSearch("");
      setStatusFilter("all");
    },
    [onOpenChange],
  );

  // Group agents by status
  const agentsByStatus = useMemo(() => {
    return {
      running: agents.filter((a) => a.status === "running"),
      waiting: agents.filter((a) => a.status === "waiting"),
      pending: agents.filter((a) => a.status === "pending"),
      completed: agents.filter((a) => a.status === "completed"),
      stopped: agents.filter((a) => a.status === "stopped"),
      error: agents.filter((a) => a.status === "error"),
    };
  }, [agents]);

  // Filter agents by search and status
  const filteredAgents = useMemo(() => {
    let result = agents;

    if (statusFilter !== "all") {
      result = result.filter((a) => a.status === statusFilter);
    }

    if (search) {
      const lower = search.toLowerCase();
      result = result.filter(
        (a) =>
          a.name.toLowerCase().includes(lower) ||
          a.instruction.toLowerCase().includes(lower),
      );
    }

    return result;
  }, [agents, search, statusFilter]);

  // Check if search matches any filter keywords
  const searchLower = search.toLowerCase();
  const isFilterSearch =
    searchLower.startsWith("@") ||
    ["running", "waiting", "pending", "completed", "stopped", "error"].some(
      (s) => searchLower === s,
    );

  // Bulk action counts
  const pendingCount = agentsByStatus.pending.length;
  const runningCount = agentsByStatus.running.length;
  const completedCount = agentsByStatus.completed.length;
  const stoppedCount = agentsByStatus.stopped.length;
  const waitingCount = agentsByStatus.waiting.length;
  const errorCount = agentsByStatus.error.length;

  // Theme toggle
  const toggleTheme = useCallback(() => {
    const html = document.documentElement;
    const isDark = html.classList.contains("dark");
    if (isDark) {
      html.classList.remove("dark");
      localStorage.setItem("theme", "light");
    } else {
      html.classList.add("dark");
      localStorage.setItem("theme", "dark");
    }
  }, []);

  const isDarkMode =
    typeof document !== "undefined" &&
    document.documentElement.classList.contains("dark");

  return (
    <CommandDialog open={open} onOpenChange={onOpenChange}>
      <CommandInput
        placeholder={
          statusFilter !== "all"
            ? `Filter: ${statusFilter} · Type to search...`
            : "Type a command or search agents..."
        }
        value={search}
        onValueChange={setSearch}
      />
      <CommandList>
        <CommandEmpty>No results found.</CommandEmpty>

        {/* Status Filter (when @ is typed or status filter is active) */}
        {(searchLower.startsWith("@") || statusFilter !== "all") && (
          <>
            <CommandGroup heading="Filter by Status">
              <CommandItem
                onSelect={() => {
                  setStatusFilter("all");
                  setSearch("");
                }}
              >
                <Layers className="mr-2 h-4 w-4" />
                <span>All Agents</span>
                <span className="ml-auto text-xs text-muted-foreground">
                  {agents.length}
                </span>
              </CommandItem>
              {runningCount > 0 && (
                <CommandItem
                  onSelect={() => {
                    setStatusFilter("running");
                    setSearch("");
                  }}
                >
                  <RefreshCw className="mr-2 h-4 w-4" />
                  <span>Running</span>
                  <span className="ml-auto text-xs text-muted-foreground">
                    {runningCount}
                  </span>
                </CommandItem>
              )}
              {waitingCount > 0 && (
                <CommandItem
                  onSelect={() => {
                    setStatusFilter("waiting");
                    setSearch("");
                  }}
                >
                  <MessageSquare className="mr-2 h-4 w-4" />
                  <span>Waiting</span>
                  <span className="ml-auto text-xs text-muted-foreground">
                    {waitingCount}
                  </span>
                </CommandItem>
              )}
              {pendingCount > 0 && (
                <CommandItem
                  onSelect={() => {
                    setStatusFilter("pending");
                    setSearch("");
                  }}
                >
                  <Zap className="mr-2 h-4 w-4" />
                  <span>Pending</span>
                  <span className="ml-auto text-xs text-muted-foreground">
                    {pendingCount}
                  </span>
                </CommandItem>
              )}
              {completedCount > 0 && (
                <CommandItem
                  onSelect={() => {
                    setStatusFilter("completed");
                    setSearch("");
                  }}
                >
                  <CheckCircle className="mr-2 h-4 w-4" />
                  <span>Completed</span>
                  <span className="ml-auto text-xs text-muted-foreground">
                    {completedCount}
                  </span>
                </CommandItem>
              )}
              {stoppedCount > 0 && (
                <CommandItem
                  onSelect={() => {
                    setStatusFilter("stopped");
                    setSearch("");
                  }}
                >
                  <StopCircle className="mr-2 h-4 w-4" />
                  <span>Stopped</span>
                  <span className="ml-auto text-xs text-muted-foreground">
                    {stoppedCount}
                  </span>
                </CommandItem>
              )}
              {errorCount > 0 && (
                <CommandItem
                  onSelect={() => {
                    setStatusFilter("error");
                    setSearch("");
                  }}
                >
                  <XCircle className="mr-2 h-4 w-4 text-destructive" />
                  <span>Error</span>
                  <span className="ml-auto text-xs text-muted-foreground">
                    {errorCount}
                  </span>
                </CommandItem>
              )}
            </CommandGroup>
            <CommandSeparator />
          </>
        )}

        {/* Filtered Agents (when status filter is active) */}
        {statusFilter !== "all" && (
          <AgentGroup
            heading={`${statusFilter.charAt(0).toUpperCase() + statusFilter.slice(1)} Agents`}
            agents={filteredAgents}
            icon={
              statusFilter === "running"
                ? RefreshCw
                : statusFilter === "waiting"
                  ? MessageSquare
                  : statusFilter === "pending"
                    ? Zap
                    : statusFilter === "completed"
                      ? CheckCircle
                      : statusFilter === "stopped"
                        ? StopCircle
                        : statusFilter === "error"
                          ? XCircle
                          : FileCode
            }
            iconClassName={statusFilter === "running" ? "" : ""}
            onSelect={(id) => runCallback(() => onSelectAgent(id))}
          />
        )}

        {/* Search Results */}
        {search && !isFilterSearch && statusFilter === "all" && (
          <AgentGroup
            heading="Search Results"
            agents={filteredAgents}
            icon={FileCode}
            onSelect={(id) => runCallback(() => onSelectAgent(id))}
            showStatus
          />
        )}

        {/* Quick Actions - always show unless filtering */}
        {!search && statusFilter === "all" && (
          <>
            <CommandGroup heading="Quick Actions">
              <CommandItem onSelect={() => runCallback(onCreateAgent)}>
                <Plus className="mr-2 h-4 w-4" />
                <span>New Task</span>
                <CommandShortcut>N</CommandShortcut>
              </CommandItem>

              <CommandItem
                onSelect={() => {
                  setStatusFilter("all");
                  setSearch("@");
                }}
              >
                <Filter className="mr-2 h-4 w-4" />
                <span>Filter Agents by Status</span>
                <CommandShortcut>@</CommandShortcut>
              </CommandItem>

              {onToggleReview && selectedId && (
                <CommandItem onSelect={() => runCallback(onToggleReview)}>
                  {showReview ? (
                    <EyeOff className="mr-2 h-4 w-4" />
                  ) : (
                    <Eye className="mr-2 h-4 w-4" />
                  )}
                  <span>{showReview ? "Show Output" : "Show Review"}</span>
                  <CommandShortcut>R</CommandShortcut>
                </CommandItem>
              )}

              {onRefreshFiles && (
                <CommandItem onSelect={() => runCallback(onRefreshFiles)}>
                  <FolderSync className="mr-2 h-4 w-4" />
                  <span>Refresh Workspace Files</span>
                </CommandItem>
              )}

              <CommandItem onSelect={() => runCallback(toggleTheme)}>
                {isDarkMode ? (
                  <Sun className="mr-2 h-4 w-4" />
                ) : (
                  <Moon className="mr-2 h-4 w-4" />
                )}
                <span>Toggle Theme</span>
              </CommandItem>
            </CommandGroup>

            <CommandSeparator />

            {/* Selected Agent Actions */}
            {selectedAgent && (
              <>
                <CommandGroup heading={`Selected: ${selectedAgent.name}`}>
                  {selectedAgent.status === "pending" && (
                    <CommandItem
                      onSelect={() =>
                        runCallback(() => onStartAgent(selectedAgent.id))
                      }
                    >
                      <Play className="mr-2 h-4 w-4" />
                      <span>Start Agent</span>
                    </CommandItem>
                  )}

                  {selectedAgent.status === "stopped" && (
                    <CommandItem
                      onSelect={() =>
                        runCallback(() => onResumeAgent(selectedAgent.id))
                      }
                    >
                      <Play className="mr-2 h-4 w-4" />
                      <span>Resume Agent</span>
                    </CommandItem>
                  )}

                  {selectedAgent.status === "running" && (
                    <CommandItem
                      onSelect={() =>
                        runCallback(() => onStopAgent(selectedAgent.id))
                      }
                    >
                      <Square className="mr-2 h-4 w-4" />
                      <span>Stop Agent</span>
                    </CommandItem>
                  )}

                  {(selectedAgent.status === "completed" ||
                    selectedAgent.status === "waiting" ||
                    selectedAgent.status === "stopped") && (
                    <CommandItem
                      onSelect={() =>
                        runCallback(() => onMergeAgent(selectedAgent.id))
                      }
                    >
                      <GitMerge className="mr-2 h-4 w-4" />
                      <span>Merge Changes</span>
                    </CommandItem>
                  )}

                  {selectedAgent.status !== "running" && (
                    <CommandItem
                      onSelect={() =>
                        runCallback(() => onDeleteAgent(selectedAgent.id))
                      }
                    >
                      <Trash2 className="mr-2 h-4 w-4" />
                      <span>Delete Agent</span>
                    </CommandItem>
                  )}
                </CommandGroup>

                <CommandSeparator />
              </>
            )}

            {/* Bulk Actions */}
            {(pendingCount > 1 ||
              runningCount > 1 ||
              completedCount > 0 ||
              stoppedCount > 0) && (
              <>
                <CommandGroup heading="Bulk Actions">
                  {pendingCount > 1 && (
                    <CommandItem
                      onSelect={() =>
                        runCallback(() => {
                          agentsByStatus.pending.forEach((a) =>
                            onStartAgent(a.id),
                          );
                        })
                      }
                    >
                      <PlayCircle className="mr-2 h-4 w-4" />
                      <span>Start All Pending</span>
                      <span className="ml-auto text-xs text-muted-foreground">
                        {pendingCount} agents
                      </span>
                    </CommandItem>
                  )}

                  {runningCount > 1 && (
                    <CommandItem
                      onSelect={() =>
                        runCallback(() => {
                          agentsByStatus.running.forEach((a) =>
                            onStopAgent(a.id),
                          );
                        })
                      }
                    >
                      <StopCircle className="mr-2 h-4 w-4" />
                      <span>Stop All Running</span>
                      <span className="ml-auto text-xs text-muted-foreground">
                        {runningCount} agents
                      </span>
                    </CommandItem>
                  )}

                  {completedCount > 0 && (
                    <CommandItem
                      onSelect={() =>
                        runCallback(() => {
                          agentsByStatus.completed.forEach((a) =>
                            onDeleteAgent(a.id),
                          );
                        })
                      }
                    >
                      <Trash2 className="mr-2 h-4 w-4" />
                      <span>Delete All Completed</span>
                      <span className="ml-auto text-xs text-muted-foreground">
                        {completedCount} agents
                      </span>
                    </CommandItem>
                  )}

                  {stoppedCount > 0 && (
                    <CommandItem
                      onSelect={() =>
                        runCallback(() => {
                          agentsByStatus.stopped.forEach((a) =>
                            onDeleteAgent(a.id),
                          );
                        })
                      }
                    >
                      <Trash2 className="mr-2 h-4 w-4" />
                      <span>Delete All Stopped</span>
                      <span className="ml-auto text-xs text-muted-foreground">
                        {stoppedCount} agents
                      </span>
                    </CommandItem>
                  )}

                  {waitingCount > 0 && (
                    <CommandItem
                      onSelect={() =>
                        runCallback(() => {
                          agentsByStatus.waiting.forEach((a) =>
                            onResumeAgent(a.id),
                          );
                        })
                      }
                    >
                      <RotateCcw className="mr-2 h-4 w-4" />
                      <span>Resume All Waiting</span>
                      <span className="ml-auto text-xs text-muted-foreground">
                        {waitingCount} agents
                      </span>
                    </CommandItem>
                  )}
                </CommandGroup>

                <CommandSeparator />
              </>
            )}

            {/* Agent Lists by Status */}
            <AgentGroup
              heading="Running"
              agents={agentsByStatus.running}
              icon={RefreshCw}
              iconClassName=""
              onSelect={(id) => runCallback(() => onSelectAgent(id))}
            />

            <AgentGroup
              heading="Waiting for Input"
              agents={agentsByStatus.waiting}
              icon={MessageSquare}
              onSelect={(id) => runCallback(() => onSelectAgent(id))}
            />

            <AgentGroup
              heading="Pending"
              agents={agentsByStatus.pending}
              icon={Zap}
              onSelect={(id) => runCallback(() => onSelectAgent(id))}
            />

            <AgentGroup
              heading="Completed"
              agents={agentsByStatus.completed}
              icon={CheckCircle}
              onSelect={(id) => runCallback(() => onSelectAgent(id))}
            />

            <AgentGroup
              heading="Stopped"
              agents={agentsByStatus.stopped}
              icon={StopCircle}
              onSelect={(id) => runCallback(() => onSelectAgent(id))}
            />

            <AgentGroup
              heading="Error"
              agents={agentsByStatus.error}
              icon={XCircle}
              iconClassName="text-destructive"
              onSelect={(id) => runCallback(() => onSelectAgent(id))}
            />
          </>
        )}
      </CommandList>
    </CommandDialog>
  );
}
