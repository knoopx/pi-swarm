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
} from "lucide-react";
import type { Agent } from "../types";

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
}

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
}: CommandBarProps) {
  const [search, setSearch] = useState("");

  const selectedAgent = useMemo(
    () => agents.find((a) => a.id === selectedId),
    [agents, selectedId],
  );

  const runCallback = useCallback(
    (callback: () => void) => {
      callback();
      onOpenChange(false);
      setSearch("");
    },
    [onOpenChange],
  );

  // Filter agents by search
  const filteredAgents = useMemo(() => {
    if (!search) return agents.slice(0, 8);
    const lower = search.toLowerCase();
    return agents.filter(
      (a) =>
        a.name.toLowerCase().includes(lower) ||
        a.instruction.toLowerCase().includes(lower),
    );
  }, [agents, search]);

  // Group agents by status
  const agentsByStatus = useMemo(() => {
    return {
      running: agents.filter((a) => a.status === "running"),
      waiting: agents.filter((a) => a.status === "waiting"),
      pending: agents.filter((a) => a.status === "pending"),
      stopped: agents.filter((a) => a.status === "stopped"),
    };
  }, [agents]);

  return (
    <CommandDialog open={open} onOpenChange={onOpenChange}>
      <CommandInput
        placeholder="Type a command or search agents..."
        value={search}
        onValueChange={setSearch}
      />
      <CommandList>
        <CommandEmpty>No results found.</CommandEmpty>

        {/* Quick Actions */}
        <CommandGroup heading="Actions">
          <CommandItem onSelect={() => runCallback(onCreateAgent)}>
            <Plus className="mr-2 h-4 w-4" />
            <span>New Task</span>
            <CommandShortcut>N</CommandShortcut>
          </CommandItem>

          {selectedAgent && selectedAgent.status === "pending" && (
            <CommandItem
              onSelect={() => runCallback(() => onStartAgent(selectedAgent.id))}
            >
              <Play className="mr-2 h-4 w-4" />
              <span>Start Selected Agent</span>
            </CommandItem>
          )}

          {selectedAgent && selectedAgent.status === "stopped" && (
            <CommandItem
              onSelect={() =>
                runCallback(() => onResumeAgent(selectedAgent.id))
              }
            >
              <Play className="mr-2 h-4 w-4" />
              <span>Resume Selected Agent</span>
            </CommandItem>
          )}

          {selectedAgent && selectedAgent.status === "running" && (
            <CommandItem
              onSelect={() => runCallback(() => onStopAgent(selectedAgent.id))}
            >
              <Square className="mr-2 h-4 w-4" />
              <span>Stop Selected Agent</span>
            </CommandItem>
          )}

          {selectedAgent &&
            (selectedAgent.status === "completed" ||
              selectedAgent.status === "waiting" ||
              selectedAgent.status === "stopped") && (
              <CommandItem
                onSelect={() =>
                  runCallback(() => onMergeAgent(selectedAgent.id))
                }
              >
                <GitMerge className="mr-2 h-4 w-4" />
                <span>Merge Selected Agent</span>
              </CommandItem>
            )}

          {selectedAgent && selectedAgent.status !== "running" && (
            <CommandItem
              onSelect={() =>
                runCallback(() => onDeleteAgent(selectedAgent.id))
              }
            >
              <Trash2 className="mr-2 h-4 w-4" />
              <span>Delete Selected Agent</span>
            </CommandItem>
          )}

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
        </CommandGroup>

        <CommandSeparator />

        {/* Running Agents - Priority */}
        {agentsByStatus.running.length > 0 && (
          <CommandGroup heading="Running">
            {agentsByStatus.running.map((agent) => (
              <CommandItem
                key={agent.id}
                onSelect={() => runCallback(() => onSelectAgent(agent.id))}
              >
                <RefreshCw className="mr-2 h-4 w-4 animate-spin" />
                <span className="truncate flex-1">{agent.name}</span>
              </CommandItem>
            ))}
          </CommandGroup>
        )}

        {/* Awaiting Review */}
        {agentsByStatus.waiting.length > 0 && (
          <CommandGroup heading="Awaiting Review">
            {agentsByStatus.waiting.map((agent) => (
              <CommandItem
                key={agent.id}
                onSelect={() => runCallback(() => onSelectAgent(agent.id))}
              >
                <MessageSquare className="mr-2 h-4 w-4" />
                <span className="truncate flex-1">{agent.name}</span>
              </CommandItem>
            ))}
          </CommandGroup>
        )}

        {/* Pending */}
        {agentsByStatus.pending.length > 0 && (
          <CommandGroup heading="Pending">
            {agentsByStatus.pending.map((agent) => (
              <CommandItem
                key={agent.id}
                onSelect={() => runCallback(() => onSelectAgent(agent.id))}
              >
                <Zap className="mr-2 h-4 w-4" />
                <span className="truncate flex-1">{agent.name}</span>
              </CommandItem>
            ))}
          </CommandGroup>
        )}

        {/* Search Results */}
        {search && filteredAgents.length > 0 && (
          <CommandGroup heading="Search Results">
            {filteredAgents.map((agent) => (
              <CommandItem
                key={agent.id}
                onSelect={() => runCallback(() => onSelectAgent(agent.id))}
              >
                <FileCode className="mr-2 h-4 w-4" />
                <span className="truncate flex-1">{agent.name}</span>
                <span className="text-xs text-muted-foreground capitalize">
                  {agent.status}
                </span>
              </CommandItem>
            ))}
          </CommandGroup>
        )}
      </CommandList>
    </CommandDialog>
  );
}
