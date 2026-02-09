import { useState } from "react";
import {
  Bot,
  Loader2,
  Play,
  Square,
  Trash2,
  GitMerge,
  Sparkles,
  Zap,
  Coins,
} from "lucide-react";
import { Button } from "./ui/button";
import { Badge } from "./ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "./ui/tabs";
import { Tooltip, TooltipContent, TooltipTrigger } from "./ui/tooltip";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "./ui/dialog";
import { ConversationLog } from "./ConversationLog";
import { ReviewMode, type ReviewComment } from "./ReviewMode";
import { ModelSelector } from "./ModelSelector";
import { CompletableTextarea } from "./CompletableTextarea";
import { statusConfig } from "../lib/status-config";
import { parseModelString } from "../lib/shared";
import type { AccumulatedUsage } from "../lib/conversation-state";
import type { Agent, ModelInfo, CompletionItem } from "../types";

interface FileCompletionItem {
  name: string;
  source: "file";
  path: string;
}

interface AgentWorkspaceProps {
  agent: Agent;
  isSpecAgent: boolean;
  diff: string | null;
  changedFilesCount: number;
  activeTab: string;
  completions: CompletionItem[];
  fileCompletions: FileCompletionItem[];
  models: ModelInfo[];
  onTabChange: (tab: string) => void;
  onStart: () => void;
  onStop: () => void;
  onResume: (instruction?: string) => void;
  onMerge: () => void;
  onAcceptSpec: () => void;
  onDelete: () => void;
  onInstruct: (instruction: string, options?: { queue?: boolean }) => void;
  onModelChange: (provider: string, modelId: string) => void;
}

export function AgentWorkspace({
  agent,
  isSpecAgent,
  diff,
  changedFilesCount,
  activeTab,
  completions,
  fileCompletions,
  models,
  onTabChange,
  onStart,
  onStop,
  onResume,
  onMerge,
  onAcceptSpec,
  onDelete,
  onInstruct,
  onModelChange,
}: AgentWorkspaceProps) {
  const [showDeleteDialog, setShowDeleteDialog] = useState(false);
  const showInstructInput =
    agent.status === "running" ||
    agent.status === "completed" ||
    agent.status === "stopped" ||
    agent.status === "waiting";

  return (
    <>
      {/* Agent Header */}
      <div className="h-16 lg:h-14 border-b bg-card/30 flex items-center justify-between px-4 shrink-0">
        <div className="flex items-center gap-3 min-w-0 flex-1">
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-2 mb-1">
              <h2 className="font-semibold truncate text-sm lg:text-base">
                {agent.name}
              </h2>
              <StatusBadge status={agent.status} />
              <UsageDisplay usage={agent.conversation.usage} />
            </div>
            <p className="text-xs text-muted-foreground truncate max-w-md hidden sm:block">
              {agent.instruction.slice(0, 100)}
              {agent.instruction.length > 100 ? "..." : ""}
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2 ml-2">
          <AgentActions
            agent={agent}
            isSpecAgent={isSpecAgent}
            onStart={onStart}
            onStop={onStop}
            onResume={() => onResume()}
            onMerge={onMerge}
            onAcceptSpec={onAcceptSpec}
            onDelete={() => setShowDeleteDialog(true)}
          />
        </div>
      </div>

      {/* Tabs */}
      <Tabs
        value={activeTab}
        onValueChange={onTabChange}
        className="flex-1 flex flex-col overflow-hidden"
      >
        <div className="px-4 pt-3">
          <TabsList className="w-fit">
            <TabsTrigger value="output" className="gap-2">
              Output
            </TabsTrigger>
            <TabsTrigger value="review" className="gap-2">
              Review
              {changedFilesCount > 0 && (
                <Badge variant="outline" className="px-1.5 py-0 text-xs">
                  {changedFilesCount}
                </Badge>
              )}
            </TabsTrigger>
          </TabsList>
        </div>

        <div className="flex-1 overflow-hidden p-4 pt-3">
          <TabsContent
            value="output"
            className="h-full m-0 data-[state=active]:flex data-[state=active]:flex-col"
          >
            <ConversationLog
              conversation={agent.conversation}
              status={agent.status}
              className="flex-1 rounded-lg border bg-muted/30"
            />
          </TabsContent>

          <TabsContent
            value="review"
            className="h-full m-0 data-[state=active]:flex data-[state=active]:flex-col"
          >
            <ReviewMode
              diff={diff || ""}
              onSubmitReview={(comments: ReviewComment[]) => {
                const reviewText = comments
                  .map(
                    (c) =>
                      `- ${c.file}:${c.lineNumber} [${c.type}]: ${c.comment}`,
                  )
                  .join("\n");
                onInstruct(
                  `Please address these code review comments:\n\n${reviewText}`,
                );
              }}
              className="flex-1 rounded-lg border overflow-hidden"
            />
          </TabsContent>
        </div>
      </Tabs>

      {/* Instruction Input */}
      {showInstructInput && (
        <div className="border-t p-4 bg-card/30 shrink-0 space-y-3">
          <InstructInput
            showSpinner={agent.status === "running"}
            onSubmit={(msg) => {
              if (agent.status === "stopped") {
                onResume(msg);
              } else {
                onInstruct(msg);
              }
            }}
            onQueue={
              agent.status === "running"
                ? (msg) => onInstruct(msg, { queue: true })
                : undefined
            }
            disabled={false}
            placeholder={
              agent.status === "stopped"
                ? "Send instruction to resume..."
                : agent.status === "running"
                  ? "Steer agent... (Enter to steer, Ctrl+Enter to queue)"
                  : "Send follow-up instruction..."
            }
            completions={completions}
            fileCompletions={fileCompletions}
            models={models}
            selectedModel={`${agent.provider}/${agent.model}`}
            onModelChange={(value) => {
              const parsed = parseModelString(value);
              if (parsed) {
                onModelChange(parsed.provider, parsed.modelId);
              }
            }}
            modelDisabled={agent.status === "running"}
          />
        </div>
      )}

      <Dialog open={showDeleteDialog} onOpenChange={setShowDeleteDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Delete Agent</DialogTitle>
            <DialogDescription>
              Are you sure you want to delete the agent "{agent.name}"? This
              action cannot be undone.
              {agent.status === "completed" && changedFilesCount > 0 && (
                <span className="block mt-2 text-destructive">
                  Warning: This agent has {changedFilesCount} modified file
                  {changedFilesCount !== 1 ? "s" : ""} that will be lost.
                </span>
              )}
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setShowDeleteDialog(false)}
            >
              Cancel
            </Button>
            <Button
              variant="destructive"
              onClick={() => {
                onDelete();
                setShowDeleteDialog(false);
              }}
            >
              Delete
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}

function StatusBadge({ status }: { status: Agent["status"] }) {
  const config = statusConfig[status];
  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <Badge variant={config.variant} className="gap-1.5">
          {config.icon}
          {config.label}
        </Badge>
      </TooltipTrigger>
      <TooltipContent>{config.description}</TooltipContent>
    </Tooltip>
  );
}

function AgentActions({
  agent,
  isSpecAgent,
  onStart,
  onStop,
  onResume,
  onMerge,
  onAcceptSpec,
  onDelete,
}: {
  agent: Agent;
  isSpecAgent: boolean;
  onStart: () => void;
  onStop: () => void;
  onResume: () => void;
  onMerge: () => void;
  onAcceptSpec: () => void;
  onDelete: () => void;
}) {
  return (
    <div className="flex items-center gap-1">
      {agent.status === "pending" && (
        <Tooltip>
          <TooltipTrigger asChild>
            <Button size="sm" variant="ghost" onClick={onStart}>
              <Play className="h-4 w-4" />
            </Button>
          </TooltipTrigger>
          <TooltipContent>Start agent</TooltipContent>
        </Tooltip>
      )}

      {agent.status === "running" && (
        <Tooltip>
          <TooltipTrigger asChild>
            <Button size="sm" variant="ghost" onClick={onStop}>
              <Square className="h-4 w-4" />
            </Button>
          </TooltipTrigger>
          <TooltipContent>Stop agent</TooltipContent>
        </Tooltip>
      )}

      {agent.status === "stopped" && (
        <Tooltip>
          <TooltipTrigger asChild>
            <Button size="sm" variant="ghost" onClick={onResume}>
              <Play className="h-4 w-4" />
            </Button>
          </TooltipTrigger>
          <TooltipContent>Resume agent</TooltipContent>
        </Tooltip>
      )}

      {(agent.status === "completed" ||
        agent.status === "waiting" ||
        agent.status === "stopped") &&
        (isSpecAgent ? (
          <Button size="sm" variant="default" onClick={onAcceptSpec}>
            <Sparkles className="h-4 w-4 mr-1.5" />
            Accept Spec
          </Button>
        ) : (
          <Tooltip>
            <TooltipTrigger asChild>
              <Button size="sm" variant="default" onClick={onMerge}>
                <GitMerge className="h-4 w-4 mr-1.5" />
                Merge
              </Button>
            </TooltipTrigger>
            <TooltipContent>Merge changes to main workspace</TooltipContent>
          </Tooltip>
        ))}

      <Tooltip>
        <TooltipTrigger asChild>
          <Button size="sm" variant="ghost" onClick={onDelete}>
            <Trash2 className="h-4 w-4" />
          </Button>
        </TooltipTrigger>
        <TooltipContent>Delete agent</TooltipContent>
      </Tooltip>
    </div>
  );
}

function InstructInput({
  onSubmit,
  onQueue,
  disabled,
  placeholder = "Send follow-up instruction...",
  completions = [],
  fileCompletions = [],
  models = [],
  selectedModel,
  onModelChange,
  modelDisabled,
  showSpinner,
}: {
  onSubmit: (msg: string) => void;
  onQueue?: (msg: string) => void;
  disabled?: boolean;
  placeholder?: string;
  completions?: CompletionItem[];
  fileCompletions?: FileCompletionItem[];
  models?: ModelInfo[];
  selectedModel?: string;
  onModelChange?: (value: string) => void;
  modelDisabled?: boolean;
  showSpinner?: boolean;
}) {
  const [value, setValue] = useState("");

  const handleSubmit = () => {
    if (value.trim()) {
      onSubmit(value);
      setValue("");
    }
  };

  const handleQueue = () => {
    if (value.trim() && onQueue) {
      onQueue(value);
      setValue("");
    }
  };

  return (
    <div className="flex gap-2 items-end">
      <Loader2
        className={`h-4 w-4 mb-3 ${showSpinner ? "animate-spin" : "invisible"}`}
      />
      {models.length > 0 && selectedModel && onModelChange && (
        <ModelSelector
          models={models}
          value={selectedModel}
          onChange={onModelChange}
          disabled={modelDisabled}
          className="h-[44px] w-[160px]"
        />
      )}
      <CompletableTextarea
        placeholder={placeholder}
        value={value}
        onChange={setValue}
        onSubmit={handleSubmit}
        onQueue={onQueue ? handleQueue : undefined}
        completions={completions}
        fileCompletions={fileCompletions}
        className="min-h-[44px] resize-none text-sm flex-1"
        rows={1}
        disabled={disabled}
      />
    </div>
  );
}

function UsageDisplay({ usage }: { usage: AccumulatedUsage }) {
  const formatNumber = (n: number) => {
    if (n >= 1000000) return `${(n / 1000000).toFixed(1)}M`;
    if (n >= 1000) return `${(n / 1000).toFixed(1)}k`;
    return n.toString();
  };

  const formatCost = (n: number) => {
    if (n < 0.01) return `$${n.toFixed(4)}`;
    if (n < 1) return `$${n.toFixed(3)}`;
    return `$${n.toFixed(2)}`;
  };

  return (
    <div className="flex items-center gap-3 text-xs text-muted-foreground min-w-[100px]">
      {usage.totalTokens === 0 ? (
        <span className="invisible">placeholder</span>
      ) : (
        <>
          <Tooltip>
            <TooltipTrigger asChild>
              <div className="flex items-center gap-1">
                <Zap className="h-3 w-3" />
                <span>{formatNumber(usage.totalTokens)}</span>
              </div>
            </TooltipTrigger>
            <TooltipContent>
              <div className="space-y-1">
                <div>Input: {formatNumber(usage.input)} tokens</div>
                <div>Output: {formatNumber(usage.output)} tokens</div>
                {usage.cacheRead > 0 && (
                  <div>Cache read: {formatNumber(usage.cacheRead)} tokens</div>
                )}
                {usage.cacheWrite > 0 && (
                  <div>
                    Cache write: {formatNumber(usage.cacheWrite)} tokens
                  </div>
                )}
              </div>
            </TooltipContent>
          </Tooltip>
          {usage.totalCost > 0 && (
            <Tooltip>
              <TooltipTrigger asChild>
                <div className="flex items-center gap-1">
                  <Coins className="h-3 w-3" />
                  <span>{formatCost(usage.totalCost)}</span>
                </div>
              </TooltipTrigger>
              <TooltipContent>Total cost for this session</TooltipContent>
            </Tooltip>
          )}
        </>
      )}
    </div>
  );
}

export function EmptyState() {
  return (
    <div className="flex-1 flex items-center justify-center p-8">
      <div className="text-center max-w-lg">
        <div className="flex items-center justify-center w-20 h-20 mx-auto mb-6 rounded-full bg-gradient-to-br from-primary/20 to-primary/5 border border-primary/10">
          <Bot className="h-10 w-10 text-primary" />
        </div>
        <h2 className="text-xl font-semibold mb-3">Welcome to Pi Swarm</h2>
        <p className="text-muted-foreground text-sm mb-6 leading-relaxed">
          Create a new task in the sidebar to spawn an AI coding agent. Each
          agent works in its own isolated workspace and can be reviewed before
          merging.
        </p>
        <div className="space-y-2 text-xs text-muted-foreground">
          <div className="flex items-center justify-center gap-4">
            <div className="flex items-center gap-2">
              <kbd className="px-1.5 py-0.5 rounded bg-muted border text-xs">
                Enter
              </kbd>
              <span>to start a task</span>
            </div>
            <div className="flex items-center gap-2">
              <kbd className="px-1.5 py-0.5 rounded bg-muted border text-xs">
                ⌘K
              </kbd>
              <span>for commands</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
