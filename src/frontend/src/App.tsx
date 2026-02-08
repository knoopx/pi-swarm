import { useState, useEffect, useCallback, useMemo, useRef } from "react";
import {
  Bot,
  Send,
  Loader2,
  Play,
  Square,
  Trash2,
  GitMerge,
  Wand2,
  Sparkles,
  AlertCircle,
  CheckCircle2,
  Clock,
  PauseCircle,
  XCircle,
  Wifi,
  WifiOff,
  ListPlus,
  Coins,
  Zap,
  Command,
} from "lucide-react";
import { useAgentStore } from "./store";
import { Button } from "./components/ui/button";
import { Input } from "./components/ui/input";
import { CompletableTextarea } from "./components/CompletableTextarea";
import { Badge } from "./components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "./components/ui/tabs";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "./components/ui/tooltip";
import { ConversationLog } from "./components/ConversationLog";
import { ReviewMode, type ReviewComment } from "./components/ReviewMode";
import { ModelSelector } from "./components/ModelSelector";
import { CommandBar } from "./components/CommandBar";
import {
  extractTextFromConversation,
  type AccumulatedUsage,
} from "./lib/conversation-state";
import { isSpecAgent } from "./lib/store-utils";
import { generateAgentName, parseModelString } from "./lib/shared";
import type { Agent } from "./types";

// Status configuration with icons and colors
const statusConfig: Record<
  Agent["status"],
  {
    variant:
      | "default"
      | "secondary"
      | "destructive"
      | "outline"
      | "success"
      | "warning";
    label: string;
    icon: React.ReactNode;
    description: string;
  }
> = {
  pending: {
    variant: "secondary",
    label: "Pending",
    icon: <Clock className="h-3 w-3" />,
    description: "Waiting to start",
  },
  running: {
    variant: "warning",
    label: "Running",
    icon: <Loader2 className="h-3 w-3 animate-spin" />,
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

// Sort agents: running first, then by updated time
function sortAgents(agents: Agent[]): Agent[] {
  return [...agents].sort((a, b) => {
    // Running agents first
    if (a.status === "running" && b.status !== "running") return -1;
    if (b.status === "running" && a.status !== "running") return 1;
    // Then by updated time (most recent first)
    return new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime();
  });
}

export default function App() {
  const {
    cwd,
    agents,
    models,
    completions,
    fileCompletions,
    loading,
    connected,
    selectedId,
    diff,
    maxConcurrency,
    connect,
    setSelectedId,
    createAgent,
    startAgent,
    stopAgent,
    resumeAgent,
    instructAgent,
    setAgentModel,
    getDiff,
    mergeAgent,
    deleteAgent,
    setMaxConcurrency,
    fetchWorkspaceFiles,
  } = useAgentStore();

  const [instruction, setInstruction] = useState("");
  const [selectedModel, setSelectedModel] = useState<string>(() => {
    return localStorage.getItem("pi-swarm-model") || "";
  });
  const [creating, setCreating] = useState(false);
  const [refining, setRefining] = useState(false);
  const [activeTab, setActiveTab] = useState("output");
  const [commandBarOpen, setCommandBarOpen] = useState(false);
  const instructionInputRef = useRef<HTMLTextAreaElement>(null);

  // Global keyboard shortcuts
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Cmd/Ctrl + K - Open command bar
      if ((e.metaKey || e.ctrlKey) && e.key === "k") {
        e.preventDefault();
        setCommandBarOpen(true);
        return;
      }

      // Don't trigger shortcuts when typing in inputs
      const target = e.target as HTMLElement;
      if (
        target.tagName === "INPUT" ||
        target.tagName === "TEXTAREA" ||
        target.isContentEditable
      ) {
        return;
      }

      // N - New task (focus instruction input)
      if (e.key === "n" && !e.metaKey && !e.ctrlKey) {
        e.preventDefault();
        instructionInputRef.current?.focus();
        return;
      }

      // Escape - Close selected agent
      if (e.key === "Escape" && selectedId) {
        e.preventDefault();
        setSelectedId(null);
        return;
      }

      // R - Toggle review tab
      if (e.key === "r" && selectedId) {
        e.preventDefault();
        setActiveTab((prev) => (prev === "review" ? "output" : "review"));
        return;
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [selectedId, setSelectedId]);

  // Set default model when models load
  useEffect(() => {
    if (models.length > 0 && !selectedModel) {
      const preferred = models.find(
        (m) => m.modelId === "claude-sonnet-4-20250514",
      );
      const defaultModel = preferred
        ? `${preferred.provider}/${preferred.modelId}`
        : `${models[0].provider}/${models[0].modelId}`;
      setSelectedModel(defaultModel);
      localStorage.setItem("pi-swarm-model", defaultModel);
    }
  }, [models, selectedModel]);

  const handleModelChange = useCallback((model: string) => {
    setSelectedModel(model);
    localStorage.setItem("pi-swarm-model", model);
  }, []);

  useEffect(() => {
    connect();
  }, [connect]);

  // Fetch workspace files when connected
  useEffect(() => {
    if (connected) {
      fetchWorkspaceFiles();
    }
  }, [connected, fetchWorkspaceFiles]);

  const selectedAgent = agents.find((a) => a.id === selectedId);
  const isSelectedSpecAgent = selectedAgent
    ? isSpecAgent(selectedAgent)
    : false;
  const sortedAgents = sortAgents(agents);
  const runningCount = agents.filter((a) => a.status === "running").length;

  // Auto-refresh diff when modified files change
  useEffect(() => {
    if (!selectedAgent) return;

    getDiff(selectedAgent.id);
  }, [selectedAgent?.modifiedFiles, selectedAgent?.id, getDiff]);

  // Count changed files from diff
  const changedFilesCount = useMemo(() => {
    if (!diff) return 0;
    const matches = diff.match(/^\+\+\+ .+$/gm);
    if (!matches) return 0;
    return matches.filter((m) => !m.includes("/dev/null")).length;
  }, [diff]);

  const createNewAgent = useCallback(
    async (autoStart: boolean) => {
      if (!instruction.trim()) return;

      setCreating(true);
      const name = generateAgentName(instruction);
      const parsed = parseModelString(selectedModel);
      const provider = parsed?.provider;
      const modelId = parsed?.modelId;

      const agent = await createAgent(name, instruction, provider, modelId);
      if (agent) {
        if (autoStart) {
          await startAgent(agent.id);
        }
        setSelectedId(agent.id);
      }
      setInstruction("");
      setCreating(false);
    },
    [instruction, selectedModel, createAgent, startAgent, setSelectedId],
  );

  const handleCreate = useCallback(
    () => createNewAgent(true),
    [createNewAgent],
  );

  const handleQueue = useCallback(
    () => createNewAgent(false),
    [createNewAgent],
  );

  const handleRefine = useCallback(async () => {
    if (!instruction.trim()) return;

    setRefining(true);
    const parsed = parseModelString(selectedModel);
    const provider = parsed?.provider;
    const modelId = parsed?.modelId;
    const refinePrompt = `You are a task specification expert. Analyze the following task request and create a detailed, well-structured specification that a coding agent can follow.

Original task request:
${instruction}

Please improve this task by:
1. Clarifying any ambiguous requirements
2. Breaking down into clear steps if complex
3. Identifying potential edge cases
4. Specifying expected outcomes
5. Adding any missing technical details

Output ONLY the improved task specification, ready to be used as instructions for another agent. Be concise but thorough.`;

    const agent = await createAgent(
      "spec-" + Date.now().toString(36),
      refinePrompt,
      provider,
      modelId,
    );
    if (agent) {
      await startAgent(agent.id);
      setSelectedId(agent.id);
    }
    setInstruction("");
    setRefining(false);
  }, [instruction, selectedModel, createAgent, startAgent, setSelectedId]);

  const handleAcceptSpec = useCallback(async () => {
    if (!selectedAgent) return;

    let improvedSpec = extractTextFromConversation(selectedAgent.conversation);
    if (!improvedSpec) {
      improvedSpec = selectedAgent.instruction;
    }

    const name = generateAgentName(improvedSpec);
    const newAgent = await createAgent(name, improvedSpec);
    if (newAgent) {
      await deleteAgent(selectedAgent.id);
      setSelectedId(newAgent.id);
    }
  }, [selectedAgent, createAgent, deleteAgent, setSelectedId]);

  const handleSelectAgent = useCallback(
    async (id: string) => {
      setSelectedId(id);
      await getDiff(id);
    },
    [setSelectedId, getDiff],
  );

  const handleTabChange = useCallback(
    async (tab: string) => {
      setActiveTab(tab);
      if (tab === "review" && selectedId && !diff) {
        await getDiff(selectedId);
      }
    },
    [selectedId, diff, getDiff],
  );

  const handleMerge = useCallback(async () => {
    if (!selectedAgent) return;
    const success = await mergeAgent(selectedAgent.id);
    if (success) {
      await deleteAgent(selectedAgent.id);
      setSelectedId(null);
    }
  }, [selectedAgent, mergeAgent, deleteAgent, setSelectedId]);

  const handleDelete = useCallback(async () => {
    if (!selectedAgent) return;
    await deleteAgent(selectedAgent.id);
    setSelectedId(null);
  }, [selectedAgent, deleteAgent, setSelectedId]);

  const handleFocusInstruction = useCallback(() => {
    instructionInputRef.current?.focus();
  }, []);

  return (
    <TooltipProvider delayDuration={300}>
      {/* Command Bar */}
      <CommandBar
        open={commandBarOpen}
        onOpenChange={setCommandBarOpen}
        agents={agents}
        selectedId={selectedId}
        onSelectAgent={handleSelectAgent}
        onCreateAgent={handleFocusInstruction}
        onStartAgent={startAgent}
        onStopAgent={stopAgent}
        onResumeAgent={(id) => resumeAgent(id)}
        onMergeAgent={async (id) => {
          const success = await mergeAgent(id);
          if (success) {
            await deleteAgent(id);
            if (selectedId === id) setSelectedId(null);
          }
        }}
        onDeleteAgent={async (id) => {
          await deleteAgent(id);
          if (selectedId === id) setSelectedId(null);
        }}
        onToggleReview={() =>
          setActiveTab((prev) => (prev === "review" ? "output" : "review"))
        }
        showReview={activeTab === "review"}
      />

      <div className="h-screen flex flex-col bg-background">
        {/* Header */}
        <header className="h-14 border-b bg-card/50 backdrop-blur-sm flex items-center px-4 shrink-0">
          <div className="flex items-center gap-3">
            <div className="flex items-center justify-center w-8 h-8 rounded-lg bg-primary/10">
              <Bot className="h-5 w-5 text-primary" />
            </div>
            <div>
              <h1 className="font-semibold text-sm">Pi Swarm</h1>
              {cwd && (
                <p className="text-xs text-muted-foreground font-mono">{cwd}</p>
              )}
            </div>
          </div>

          <div className="ml-auto flex items-center gap-3">
            {/* Command Bar Button */}
            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setCommandBarOpen(true)}
                  className="h-7 gap-1.5 text-xs text-muted-foreground"
                >
                  <Command className="h-3 w-3" />
                  <span className="hidden sm:inline">Command</span>
                  <kbd className="pointer-events-none hidden sm:inline-flex h-5 select-none items-center gap-1 rounded border bg-muted px-1.5 font-mono text-[10px] font-medium opacity-100">
                    ⌘K
                  </kbd>
                </Button>
              </TooltipTrigger>
              <TooltipContent>Open command palette</TooltipContent>
            </Tooltip>
            <Tooltip>
              <TooltipTrigger asChild>
                <div className="flex items-center gap-2 text-xs text-muted-foreground">
                  <span>Concurrency:</span>
                  <Input
                    type="number"
                    min={1}
                    max={10}
                    value={maxConcurrency}
                    onChange={(e) => {
                      const value = parseInt(e.target.value, 10);
                      if (value >= 1 && value <= 10) {
                        setMaxConcurrency(value);
                      }
                    }}
                    className="w-14 h-7 text-xs text-center [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
                  />
                </div>
              </TooltipTrigger>
              <TooltipContent>Maximum concurrent agents</TooltipContent>
            </Tooltip>
            <div className="text-xs text-muted-foreground">
              {agents.length} agent{agents.length !== 1 ? "s" : ""}
              {runningCount > 0 && (
                <span className="text-base09 ml-1">
                  · {runningCount} running
                </span>
              )}
            </div>
            <Tooltip>
              <TooltipTrigger asChild>
                <div
                  className={`flex items-center gap-2 px-2 py-1 rounded-full text-xs ${
                    connected
                      ? "bg-success/30 text-success border border-success/50"
                      : "bg-destructive/30 text-destructive border border-destructive/50"
                  }`}
                >
                  {connected ? (
                    <Wifi className="h-3 w-3" />
                  ) : (
                    <WifiOff className="h-3 w-3" />
                  )}
                  <span>{connected ? "Connected" : "Disconnected"}</span>
                </div>
              </TooltipTrigger>
              <TooltipContent>
                {connected
                  ? "Real-time updates active"
                  : "Attempting to reconnect..."}
              </TooltipContent>
            </Tooltip>
          </div>
        </header>

        <div className="flex-1 flex overflow-hidden">
          {/* Sidebar */}
          <aside className="w-96 border-r bg-card/30 flex flex-col shrink-0">
            {/* New Task Form */}
            <div className="p-4 border-b space-y-3">
              <ModelSelector
                models={models}
                value={selectedModel}
                onChange={handleModelChange}
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
                onChange={setInstruction}
                onSubmit={handleCreate}
                completions={completions}
                fileCompletions={fileCompletions}
                className="min-h-[80px] resize-none text-sm"
                disabled={creating || refining}
              />
              <div className="flex gap-2">
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Button
                      onClick={handleRefine}
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
                      onClick={handleQueue}
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
                  onClick={handleCreate}
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

            {/* Agent List */}
            <div className="flex-1 overflow-auto">
              {loading ? (
                <div className="flex flex-col items-center justify-center h-32 gap-2">
                  <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
                  <span className="text-sm text-muted-foreground">
                    Loading agents...
                  </span>
                </div>
              ) : sortedAgents.length === 0 ? (
                <div className="flex flex-col items-center justify-center h-32 gap-2 p-4">
                  <Bot className="h-8 w-8 text-muted-foreground/30" />
                  <p className="text-sm text-muted-foreground text-center">
                    No agents yet. Create a task above to get started.
                  </p>
                </div>
              ) : (
                <div className="p-2 space-y-1">
                  {sortedAgents.map((agent) => (
                    <AgentListItem
                      key={agent.id}
                      agent={agent}
                      isSelected={selectedId === agent.id}
                      onSelect={() => handleSelectAgent(agent.id)}
                    />
                  ))}
                </div>
              )}
            </div>
          </aside>

          {/* Main Content */}
          <main className="flex-1 flex flex-col overflow-hidden bg-background">
            {selectedAgent ? (
              <>
                {/* Agent Header */}
                <div className="h-14 border-b bg-card/30 flex items-center justify-between px-4 shrink-0">
                  <div className="flex items-center gap-3 min-w-0">
                    <div className="min-w-0">
                      <div className="flex items-center gap-2">
                        <h2 className="font-semibold truncate">
                          {selectedAgent.name}
                        </h2>
                        <StatusBadge status={selectedAgent.status} />
                        <UsageDisplay
                          usage={selectedAgent.conversation.usage}
                        />
                      </div>
                      <p className="text-xs text-muted-foreground truncate max-w-md">
                        {selectedAgent.instruction.slice(0, 100)}
                        {selectedAgent.instruction.length > 100 ? "..." : ""}
                      </p>
                    </div>
                  </div>

                  <div className="flex items-center gap-2">
                    <AgentActions
                      agent={selectedAgent}
                      isSpecAgent={isSelectedSpecAgent}
                      onStart={() => startAgent(selectedAgent.id)}
                      onStop={() => stopAgent(selectedAgent.id)}
                      onResume={() => resumeAgent(selectedAgent.id)}
                      onMerge={handleMerge}
                      onAcceptSpec={handleAcceptSpec}
                      onDelete={handleDelete}
                    />
                  </div>
                </div>

                {/* Tabs */}
                <Tabs
                  value={activeTab}
                  onValueChange={handleTabChange}
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
                          <Badge
                            variant="secondary"
                            className="px-1.5 py-0 text-xs"
                          >
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
                        conversation={selectedAgent.conversation}
                        status={selectedAgent.status}
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
                          instructAgent(
                            selectedAgent.id,
                            `Please address these code review comments:\n\n${reviewText}`,
                          );
                        }}
                        className="flex-1 rounded-lg border overflow-hidden"
                      />
                    </TabsContent>
                  </div>
                </Tabs>

                {/* Instruction Input */}
                {(selectedAgent.status === "running" ||
                  selectedAgent.status === "completed" ||
                  selectedAgent.status === "stopped" ||
                  selectedAgent.status === "waiting") && (
                  <div className="border-t p-4 bg-card/30 shrink-0 space-y-3">
                    <InstructInput
                      showSpinner={selectedAgent.status === "running"}
                      onSubmit={(msg) => {
                        if (selectedAgent.status === "stopped") {
                          resumeAgent(selectedAgent.id, msg);
                        } else {
                          instructAgent(selectedAgent.id, msg);
                        }
                      }}
                      onQueue={
                        selectedAgent.status === "running"
                          ? (msg) =>
                              instructAgent(selectedAgent.id, msg, {
                                queue: true,
                              })
                          : undefined
                      }
                      disabled={false}
                      placeholder={
                        selectedAgent.status === "stopped"
                          ? "Send instruction to resume..."
                          : selectedAgent.status === "running"
                            ? "Steer agent... (Enter to steer, Ctrl+Enter to queue)"
                            : "Send follow-up instruction..."
                      }
                      completions={completions}
                      fileCompletions={fileCompletions}
                      models={models}
                      selectedModel={`${selectedAgent.provider}/${selectedAgent.model}`}
                      onModelChange={(value) => {
                        const parsed = parseModelString(value);
                        if (parsed) {
                          setAgentModel(
                            selectedAgent.id,
                            parsed.provider,
                            parsed.modelId,
                          );
                        }
                      }}
                      modelDisabled={selectedAgent.status === "running"}
                    />
                  </div>
                )}
              </>
            ) : (
              <EmptyState />
            )}
          </main>
        </div>
      </div>
    </TooltipProvider>
  );
}

// Sub-components

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
      className={`w-full text-left p-3 rounded-lg transition-all ${
        isSelected
          ? "bg-primary/10 border border-primary/30 shadow-sm"
          : "hover:bg-muted/50 border border-transparent"
      }`}
    >
      <div className="flex items-start justify-between gap-2 mb-1">
        <span className="font-medium text-sm truncate flex-1">
          {agent.name}
        </span>
        <Badge variant={config.variant} className="gap-1 text-xs shrink-0">
          {config.icon}
          <span className="hidden sm:inline">{config.label}</span>
        </Badge>
      </div>
      <p className="text-xs text-muted-foreground line-clamp-2">
        {agent.instruction}
      </p>
    </button>
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
  completions?: {
    name: string;
    description?: string;
    source: "extension" | "prompt" | "skill";
    location?: string;
    path?: string;
  }[];
  fileCompletions?: {
    name: string;
    source: "file";
    path: string;
  }[];
  models?: { provider: string; modelId: string; name: string }[];
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
      {showSpinner && <Loader2 className="h-4 w-4 animate-spin mb-3" />}
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

function EmptyState() {
  return (
    <div className="flex-1 flex items-center justify-center">
      <div className="text-center max-w-md px-4">
        <div className="flex items-center justify-center w-16 h-16 mx-auto mb-4 rounded-full bg-muted">
          <Bot className="h-8 w-8 text-muted-foreground" />
        </div>
        <h2 className="text-lg font-semibold mb-2">Welcome to Pi Swarm</h2>
        <p className="text-muted-foreground text-sm mb-4">
          Create a new task in the sidebar to spawn an AI coding agent. Each
          agent works in its own isolated workspace and can be reviewed before
          merging.
        </p>
        <div className="text-xs text-muted-foreground space-y-1">
          <p>
            <kbd className="px-1.5 py-0.5 rounded bg-muted border text-xs">
              Enter
            </kbd>{" "}
            to start a task
          </p>
        </div>
      </div>
    </div>
  );
}
