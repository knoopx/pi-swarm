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

        <AgentGroup
          heading="Running"
          agents={agentsByStatus.running}
          icon={RefreshCw}
          iconClassName="animate-spin"
          onSelect={(id) => runCallback(() => onSelectAgent(id))}
        />

        <AgentGroup
          heading="Waiting"
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

        {search && (
          <AgentGroup
            heading="Search Results"
            agents={filteredAgents}
            icon={FileCode}
            onSelect={(id) => runCallback(() => onSelectAgent(id))}
            showStatus
          />
        )}
      </CommandList>
    </CommandDialog>
  );
}
