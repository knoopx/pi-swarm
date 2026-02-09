import { useState } from "react";
import {
  Bot,
  Play,
  Square,
  Trash2,
  GitMerge,
  Sparkles,
  Zap,
  Coins,
  MessageSquare,
  CheckCircle,
} from "lucide-react";

import { Button } from "./ui/button";
import { Badge } from "./ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "./ui/tabs";
import { StatusIndicator } from "./ui/status-indicator";
import { Tooltip, TooltipContent, TooltipTrigger } from "./ui/tooltip";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "./ui/alert-dialog";
import { ConversationLog } from "./ConversationLog";
import { ReviewMode, type ReviewComment } from "./ReviewMode";
import { ModelSelector } from "./ModelSelector";
import { CompletableTextarea } from "./CompletableTextarea";

import { parseModelString } from "../lib/shared";
import { statusConfig } from "../lib/status-config";
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
  const [reviewComments, setReviewComments] = useState<ReviewComment[]>([]);
  const showInstructInput =
    agent.status === "running" ||
    agent.status === "completed" ||
    agent.status === "stopped" ||
    agent.status === "waiting";

  return (
    <>
      {/* Agent Header */}
      <header className="workspace-header">
        <StatusIndicator
          status={statusConfig[agent.status].status}
          size="default"
        />
        <h2 className="workspace-title">{agent.name}</h2>
        {changedFilesCount > 0 && (
          <Badge variant="outline" className="workspace-badge-changed">
            {changedFilesCount} changed
          </Badge>
        )}
        <UsageDisplay usage={agent.conversation.usage} />
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
      </header>

      {/* Tabs */}
      <Tabs
        value={activeTab}
        onValueChange={onTabChange}
        className="workspace-tabs"
      >
        <div className="workspace-tabs-header">
          <TabsList className="workspace-tabs-list">
            <TabsTrigger value="output" className="workspace-tab-trigger">
              <MessageSquare className="h-4 w-4" />
              Output
            </TabsTrigger>
            <TabsTrigger value="review" className="workspace-tab-trigger">
              <GitMerge className="h-4 w-4" />
              Review
              {changedFilesCount > 0 && (
                <Badge variant="warning" className="workspace-tab-badge">
                  {changedFilesCount}
                </Badge>
              )}
            </TabsTrigger>
          </TabsList>
        </div>

        <div className="workspace-tabs-content">
          <TabsContent value="output" className="workspace-tab-panel">
            <ConversationLog
              conversation={agent.conversation}
              status={agent.status}
              className="workspace-conversation"
            />
          </TabsContent>

          <TabsContent value="review" className="workspace-tab-panel">
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
              onCommentsChange={setReviewComments}
              className="workspace-review"
            />
          </TabsContent>
        </div>
      </Tabs>

      {/* Instruction Input */}
      {showInstructInput && (
        <div className="workspace-instruct-bar">
          <InstructInput
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

      <AlertDialog open={showDeleteDialog} onOpenChange={setShowDeleteDialog}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Agent</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete the agent "{agent.name}"? This
              action cannot be undone.
              {agent.status === "completed" && changedFilesCount > 0 && (
                <span className="block mt-2 text-destructive">
                  Warning: This agent has {changedFilesCount} modified file
                  {changedFilesCount !== 1 ? "s" : ""} that will be lost.
                </span>
              )}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => {
                onDelete();
                setShowDeleteDialog(false);
              }}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
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
    <div className="workspace-instruct-container">
      {models.length > 0 && selectedModel && onModelChange && (
        <ModelSelector
          models={models}
          value={selectedModel}
          onChange={onModelChange}
          disabled={modelDisabled}
          className="workspace-instruct-model"
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
        className="workspace-instruct-textarea"
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
    <div className="usage-display">
      {usage.totalTokens === 0 ? (
        <span className="invisible">placeholder</span>
      ) : (
        <>
          <Tooltip>
            <TooltipTrigger asChild>
              <div className="usage-item">
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
                <div className="usage-item">
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
    <div className="empty-state">
      <div className="empty-state-container">
        <div className="empty-state-icon">
          <Bot />
        </div>
        <h2 className="empty-state-title">Welcome to Pi Swarm</h2>
        <p className="empty-state-description">
          Create a new task in the sidebar to spawn an AI coding agent. Each
          agent works in its own isolated workspace and can be reviewed before
          merging.
        </p>
        <div className="empty-state-features">
          <div className="empty-state-feature">
            <Play className="h-4 w-4 text-base0B" />
            <span>Start agents</span>
          </div>
          <div className="empty-state-feature">
            <GitMerge className="h-4 w-4 text-base07" />
            <span>Review changes</span>
          </div>
          <div className="empty-state-feature">
            <CheckCircle className="h-4 w-4 text-base0C" />
            <span>Merge safely</span>
          </div>
        </div>
      </div>
    </div>
  );
}
