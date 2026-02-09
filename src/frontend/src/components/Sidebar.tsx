import { Bot, Send, Wand2, ListPlus } from "lucide-react";
import { Button } from "./ui/button";
import { Badge } from "./ui/badge";
import { Tooltip, TooltipContent, TooltipTrigger } from "./ui/tooltip";
import { ScrollArea } from "./ui/scroll-area";
import { HoverCard, HoverCardContent, HoverCardTrigger } from "./ui/hover-card";
import { StatusIndicator } from "./ui/status-indicator";
import { CompletableTextarea } from "./CompletableTextarea";
import { ModelSelector } from "./ModelSelector";
import {
  statusConfig,
  sortAgents,
  getVariantClass,
} from "../lib/status-config";
import type { Agent, ModelInfo, CompletionItem } from "../types";

interface FileCompletionItem {
  name: string;
  source: "file";
  path: string;
}

interface SidebarProps {
  agents: Agent[];
  models: ModelInfo[];
  completions: CompletionItem[];
  fileCompletions: FileCompletionItem[];
  loading: boolean;
  selectedId: string | null;
  selectedModel: string;
  instruction: string;
  creating: boolean;
  refining: boolean;
  instructionInputRef: React.RefObject<HTMLTextAreaElement>;
  onInstructionChange: (value: string) => void;
  onModelChange: (model: string) => void;
  onSelectAgent: (id: string) => void;
  onRefine: () => void;
  onQueue: () => void;
  onCreate: () => void;
  className?: string;
}

export function Sidebar({
  agents,
  models,
  completions,
  fileCompletions,
  loading,
  selectedId,
  selectedModel,
  instruction,
  creating,
  refining,
  instructionInputRef,
  onInstructionChange,
  onModelChange,
  onSelectAgent,
  onRefine,
  onQueue,
  onCreate,
  className,
}: SidebarProps) {
  const sortedAgents = sortAgents(agents);

  return (
    <aside className={`sidebar ${className || ""}`}>
      {/* New Task Form */}
      <div className="sidebar-form">
        <ModelSelector
          models={models}
          value={selectedModel}
          onChange={onModelChange}
          disabled={creating || refining}
          className="w-full"
          placeholder={
            models.length === 0 ? "Loading models..." : "Select model..."
          }
        />
        <CompletableTextarea
          ref={instructionInputRef}
          placeholder="Describe your task... (Enter to start, ⌘K for commands)"
          value={instruction}
          onChange={onInstructionChange}
          onSubmit={onCreate}
          completions={completions}
          fileCompletions={fileCompletions}
          className="min-h-[80px] resize-none text-sm"
          disabled={creating || refining}
        />
        <div className="flex gap-2">
          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                onClick={onRefine}
                disabled={refining || creating || !instruction.trim()}
                variant="outline"
                size="sm"
                className="flex-1"
              >
                {refining ? (
                  <Badge variant="secondary" className="text-xs px-1.5 py-0.5">
                    ...
                  </Badge>
                ) : (
                  <Wand2 className="h-4 w-4" />
                )}
                <span className="ml-2">Refine</span>
              </Button>
            </TooltipTrigger>
            <TooltipContent>
              Let AI improve your task description
            </TooltipContent>
          </Tooltip>
          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                onClick={onQueue}
                disabled={creating || refining || !instruction.trim()}
                variant="outline"
                size="sm"
                className="flex-1"
              >
                {creating ? (
                  <Badge variant="secondary" className="text-xs px-1.5 py-0.5">
                    ...
                  </Badge>
                ) : (
                  <ListPlus className="h-4 w-4" />
                )}
                <span className="ml-2">Queue</span>
              </Button>
            </TooltipTrigger>
            <TooltipContent>Add task without starting</TooltipContent>
          </Tooltip>
          <Button
            onClick={onCreate}
            disabled={creating || refining || !instruction.trim()}
            size="sm"
            className="flex-1"
          >
            {creating ? (
              <Badge variant="secondary" className="text-xs px-1.5 py-0.5">
                ...
              </Badge>
            ) : (
              <Send className="h-4 w-4" />
            )}
            <span className="ml-2">Start</span>
          </Button>
        </div>
      </div>

      {/* Agent List */}
      <ScrollArea className="sidebar-agent-list">
        {loading ? (
          <div className="sidebar-loading">
            <Badge variant="secondary" className="text-xs">
              Loading
            </Badge>
            <span className="text-sm text-muted-foreground">
              Loading agents...
            </span>
          </div>
        ) : sortedAgents.length === 0 ? (
          <div className="sidebar-empty">
            <Bot className="h-8 w-8 text-muted-foreground/30" />
            <p className="text-sm text-muted-foreground text-center">
              No agents yet. Create a task above to get started.
            </p>
          </div>
        ) : (
          <div className="p-4 space-y-1 w-full max-w-full overflow-hidden">
            {sortedAgents.map((agent) => (
              <AgentListItem
                key={agent.id}
                agent={agent}
                isSelected={selectedId === agent.id}
                onSelect={() => onSelectAgent(agent.id)}
              />
            ))}
          </div>
        )}
      </ScrollArea>
    </aside>
  );
}

function getLastOutputMessage(agent: Agent): string | null {
  const events = agent.conversation.events;
  // Find last text event from assistant
  for (let i = events.length - 1; i >= 0; i--) {
    const event = events[i];
    if (event.type === "text" && event.role === "assistant") {
      return event.content;
    }
  }
  // Check pending text as fallback
  if (agent.conversation.pendingText.trim()) {
    return agent.conversation.pendingText.trim();
  }
  return null;
}

function AgentListItem({
  agent,
  isSelected,
  onSelect,
}: {
  agent: Agent;
  isSelected: boolean;
  onSelect: () => void;
}) {
  const config = statusConfig[agent.status];
  const modifiedFilesCount = agent.modifiedFiles?.length || 0;
  const lastOutput = getLastOutputMessage(agent);

  return (
    <HoverCard>
      <HoverCardTrigger asChild>
        <button
          onClick={onSelect}
          className={`sidebar-agent-item group ${
            isSelected
              ? "sidebar-agent-item-selected"
              : "sidebar-agent-item-unselected"
          }`}
        >
          <div className="flex items-center gap-2 min-w-0 w-full overflow-hidden">
            <div
              className={`p-1.5 rounded-md transition-colors shrink-0 ${getVariantClass("sidebar-agent-icon", config.variant)}`}
            >
              <StatusIndicator status={config.status} size="sm" />
            </div>
            <div className="min-w-0 flex-1 overflow-hidden w-0">
              <div className="flex items-center gap-2">
                <p className="truncate text-sm font-semibold leading-tight flex-1 min-w-0">
                  {agent.instruction}
                </p>
                {modifiedFilesCount > 0 && (
                  <Badge
                    variant="outline"
                    className="text-xs px-1.5 py-0 shrink-0"
                  >
                    {modifiedFilesCount}
                  </Badge>
                )}
              </div>
              {lastOutput && (
                <p className="text-xs text-muted-foreground truncate">
                  {lastOutput}
                </p>
              )}
            </div>
          </div>
        </button>
      </HoverCardTrigger>
      <HoverCardContent className="w-80" side="right">
        <div className="space-y-3">
          <div>
            <h4 className="font-semibold text-sm">{agent.name}</h4>
            <p className="text-xs text-muted-foreground mt-1">
              {agent.instruction}
            </p>
          </div>
          <div className="grid grid-cols-2 gap-4 text-xs">
            <div>
              <span className="text-muted-foreground">Status:</span>
              <div className="flex items-center gap-1.5 mt-1">
                <StatusIndicator status={config.status} size="xs" />
                <span>{config.label}</span>
              </div>
            </div>
            <div>
              <span className="text-muted-foreground">Model:</span>
              <p className="mt-1 font-mono text-xs">
                {agent.provider}/{agent.model}
              </p>
            </div>
            {agent.conversation.usage.totalTokens > 0 && (
              <>
                <div>
                  <span className="text-muted-foreground">Tokens:</span>
                  <p className="mt-1">
                    {agent.conversation.usage.totalTokens.toLocaleString()}
                  </p>
                </div>
                <div>
                  <span className="text-muted-foreground">Cost:</span>
                  <p className="mt-1">
                    ${agent.conversation.usage.totalCost.toFixed(4)}
                  </p>
                </div>
              </>
            )}
            {modifiedFilesCount > 0 && (
              <div className="col-span-2">
                <span className="text-muted-foreground">Modified files:</span>
                <p className="mt-1 text-xs">
                  {agent.modifiedFiles?.slice(0, 3).join(", ")}
                  {agent.modifiedFiles &&
                    agent.modifiedFiles.length > 3 &&
                    "..."}
                </p>
              </div>
            )}
          </div>
        </div>
      </HoverCardContent>
    </HoverCard>
  );
}
