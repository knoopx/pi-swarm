import { Bot, Loader2, Send, Wand2, ListPlus, Search } from "lucide-react";
import { Button } from "./ui/button";
import { Badge } from "./ui/badge";
import { Tooltip, TooltipContent, TooltipTrigger } from "./ui/tooltip";
import { CompletableTextarea } from "./CompletableTextarea";
import { ModelSelector } from "./ModelSelector";
import { statusConfig, sortAgents } from "../lib/status-config";
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
  agentSearch: string;
  instructionInputRef: React.RefObject<HTMLTextAreaElement>;
  onInstructionChange: (value: string) => void;
  onModelChange: (model: string) => void;
  onSelectAgent: (id: string) => void;
  onRefine: () => void;
  onQueue: () => void;
  onCreate: () => void;
  onAgentSearchChange: (search: string) => void;
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
  agentSearch,
  instructionInputRef,
  onInstructionChange,
  onModelChange,
  onSelectAgent,
  onRefine,
  onQueue,
  onCreate,
  onAgentSearchChange,
  className,
}: SidebarProps) {
  const sortedAgents = sortAgents(agents);
  const filteredAgents = sortedAgents.filter(
    (agent) =>
      agent.name.toLowerCase().includes(agentSearch.toLowerCase()) ||
      agent.instruction.toLowerCase().includes(agentSearch.toLowerCase()),
  );

  return (
    <aside
      className={`w-80 lg:w-96 border-r bg-card/30 flex flex-col shrink-0 ${className || ""}`}
    >
      {/* New Task Form */}
      <div className="p-4 border-b space-y-3">
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
                  <Loader2 className="h-4 w-4 animate-spin" />
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
                  <Loader2 className="h-4 w-4 animate-spin" />
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
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <Send className="h-4 w-4" />
            )}
            <span className="ml-2">Start</span>
          </Button>
        </div>
      </div>

      {/* Search Agents */}
      {agents.length > 0 && (
        <div className="p-4 border-b">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <input
              type="text"
              placeholder="Search agents..."
              value={agentSearch}
              onChange={(e) => onAgentSearchChange(e.target.value)}
              className="w-full pl-9 pr-3 py-2 text-sm bg-background border border-input rounded-md focus:outline-none focus:ring-2 focus:ring-ring focus:border-transparent"
            />
          </div>
        </div>
      )}

      {/* Agent List */}
      <div className="flex-1 overflow-auto">
        {loading ? (
          <div className="flex flex-col items-center justify-center h-32 gap-2">
            <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
            <span className="text-sm text-muted-foreground">
              Loading agents...
            </span>
          </div>
        ) : filteredAgents.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-32 gap-2 p-4">
            <Bot className="h-8 w-8 text-muted-foreground/30" />
            <p className="text-sm text-muted-foreground text-center">
              {agentSearch
                ? "No agents match your search."
                : "No agents yet. Create a task above to get started."}
            </p>
          </div>
        ) : (
          <div className="p-2 space-y-1">
            {filteredAgents.map((agent) => (
              <AgentListItem
                key={agent.id}
                agent={agent}
                isSelected={selectedId === agent.id}
                onSelect={() => onSelectAgent(agent.id)}
              />
            ))}
          </div>
        )}
      </div>
    </aside>
  );
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

  return (
    <button
      onClick={onSelect}
      className={`w-full text-left p-3 rounded-lg transition-all hover:shadow-sm ${
        isSelected
          ? "bg-primary/10 border border-primary/30 shadow-sm ring-1 ring-primary/20"
          : "hover:bg-muted/50 border border-transparent"
      }`}
    >
      <div className="flex items-start justify-between gap-2 mb-1">
        <span className="font-medium text-sm truncate flex-1 leading-tight">
          {agent.name}
        </span>
        <Badge variant={config.variant} className="gap-1.5 text-xs shrink-0">
          {config.icon}
          <span className="hidden sm:inline">{config.label}</span>
        </Badge>
      </div>
      <p className="text-xs text-muted-foreground line-clamp-2 leading-relaxed">
        {agent.instruction}
      </p>
    </button>
  );
}
