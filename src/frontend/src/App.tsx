import { useState, useEffect, useCallback, useMemo, useRef } from "react";
import { TooltipProvider } from "./components/ui/tooltip";
import { useAgentStore } from "./store";
import { AppHeader } from "./components/AppHeader";
import { Sidebar } from "./components/Sidebar";
import { AgentWorkspace, EmptyState } from "./components/AgentWorkspace";
import { CommandBar } from "./components/CommandBar";
import { Toaster } from "./components/Toaster";
import { useKeyboardShortcuts } from "./hooks/useKeyboardShortcuts";
import { useModelSelection } from "./hooks/useModelSelection";
import { extractTextFromConversation } from "./lib/conversation-state";
import { isSpecAgent } from "./lib/store-utils";
import { generateAgentName, parseModelString } from "./lib/shared";

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

  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [commandBarOpen, setCommandBarOpen] = useState(false);
  const [activeTab, setActiveTab] = useState("output");
  const [agentSearch, setAgentSearch] = useState("");
  const [instruction, setInstruction] = useState("");
  const [creating, setCreating] = useState(false);
  const [refining, setRefining] = useState(false);
  const instructionInputRef = useRef<HTMLTextAreaElement>(null);

  const { selectedModel, handleModelChange } = useModelSelection(models);

  useKeyboardShortcuts({
    selectedId,
    setSelectedId,
    setCommandBarOpen,
    setActiveTab,
    instructionInputRef,
  });

  useEffect(() => {
    connect();
  }, [connect]);

  useEffect(() => {
    if (connected) {
      fetchWorkspaceFiles();
    }
  }, [connected, fetchWorkspaceFiles]);

  const selectedAgent = agents.find((a) => a.id === selectedId);
  const isSelectedSpecAgent = selectedAgent
    ? isSpecAgent(selectedAgent)
    : false;
  const runningCount = agents.filter((a) => a.status === "running").length;

  useEffect(() => {
    if (!selectedAgent) return;
    getDiff(selectedAgent.id);
  }, [selectedAgent?.updatedAt, selectedAgent?.id, getDiff]);

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
      if (tab === "review" && selectedId) {
        await getDiff(selectedId);
      }
    },
    [selectedId, getDiff],
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
        onRefreshFiles={fetchWorkspaceFiles}
      />

      <div className="h-screen flex flex-col bg-background">
        <AppHeader
          cwd={cwd}
          connected={connected}
          agentCount={agents.length}
          runningCount={runningCount}
          maxConcurrency={maxConcurrency}
          onMaxConcurrencyChange={setMaxConcurrency}
          onOpenCommandBar={() => setCommandBarOpen(true)}
          onToggleSidebar={() => setSidebarOpen(!sidebarOpen)}
        />

        <div className="flex-1 flex overflow-hidden">
          {/* Mobile overlay */}
          {sidebarOpen && (
            <div
              className="fixed inset-0 bg-black/50 lg:hidden z-40"
              onClick={() => setSidebarOpen(false)}
            />
          )}

          <Sidebar
            agents={agents}
            models={models}
            completions={completions}
            fileCompletions={fileCompletions}
            loading={loading}
            selectedId={selectedId}
            selectedModel={selectedModel}
            instruction={instruction}
            creating={creating}
            refining={refining}
            agentSearch={agentSearch}
            instructionInputRef={instructionInputRef}
            onInstructionChange={setInstruction}
            onModelChange={handleModelChange}
            onSelectAgent={handleSelectAgent}
            onRefine={handleRefine}
            onQueue={handleQueue}
            onCreate={handleCreate}
            onAgentSearchChange={setAgentSearch}
            className={`${sidebarOpen ? "block" : "hidden"} lg:block`}
          />

          <main className="flex-1 flex flex-col overflow-hidden bg-background">
            {selectedAgent ? (
              <AgentWorkspace
                agent={selectedAgent}
                isSpecAgent={isSelectedSpecAgent}
                diff={diff}
                changedFilesCount={changedFilesCount}
                activeTab={activeTab}
                completions={completions}
                fileCompletions={fileCompletions}
                models={models}
                onTabChange={handleTabChange}
                onStart={() => startAgent(selectedAgent.id)}
                onStop={() => stopAgent(selectedAgent.id)}
                onResume={(instruction) =>
                  resumeAgent(selectedAgent.id, instruction)
                }
                onMerge={handleMerge}
                onAcceptSpec={handleAcceptSpec}
                onDelete={handleDelete}
                onInstruct={(instruction, options) =>
                  instructAgent(selectedAgent.id, instruction, options)
                }
                onModelChange={(provider, modelId) =>
                  setAgentModel(selectedAgent.id, provider, modelId)
                }
              />
            ) : (
              <EmptyState />
            )}
          </main>
        </div>
      </div>
      <Toaster />
    </TooltipProvider>
  );
}
