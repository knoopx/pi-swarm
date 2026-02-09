import { useState, useEffect } from "react";
import {
  Play,
  Square,
  Trash2,
  GitMerge,
  Terminal,
  MessageSquare,
  ChevronDown,
  ChevronUp,
} from "lucide-react";
import { Card, CardContent, CardHeader } from "./ui/card";
import { Button } from "./ui/button";
import { Badge } from "./ui/badge";
import { Textarea } from "./ui/textarea";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "./ui/tabs";
import { StatusIndicator } from "./ui/status-indicator";
import { DiffViewer } from "./DiffViewer";
import { ConversationLog } from "./ConversationLog";
import { FilesList } from "./FilesList";
import type { Agent } from "../types";
import { statusConfig, getVariantClass } from "../lib/status-config";

interface AgentCardProps {
  agent: Agent;
  onStart: (id: string) => void;
  onStop: (id: string) => void;
  onResume: (id: string) => void;
  onDelete: (id: string) => void;
  onMerge: (id: string) => void;
  onInstruct: (id: string, instruction: string) => Promise<boolean>;
  onGetDiff: (id: string) => Promise<string | null>;
  expanded?: boolean;
  onToggleExpand?: () => void;
}

export function AgentCard({
  agent,
  onStart,
  onStop,
  onResume,
  onDelete,
  onMerge,
  onInstruct,
  onGetDiff,
  expanded = false,
  onToggleExpand,
}: AgentCardProps) {
  const [newInstruction, setNewInstruction] = useState("");
  const [diff, setDiff] = useState<string | null>(null);
  const [loadingDiff, setLoadingDiff] = useState(false);
  const [activeTab, setActiveTab] = useState("output");

  // Auto-load diff when switching to diff tab
  useEffect(() => {
    if (activeTab === "diff" && !diff && !loadingDiff) {
      setLoadingDiff(true);
      onGetDiff(agent.id).then((result) => {
        setDiff(result);
        setLoadingDiff(false);
      });
    }
  }, [activeTab, diff, loadingDiff, agent.id, onGetDiff]);

  // Reset diff when agent changes
  useEffect(() => {
    setDiff(null);
  }, [agent.modifiedFiles?.length]);

  const handleInstruct = async () => {
    if (newInstruction.trim()) {
      const success = await onInstruct(agent.id, newInstruction);
      if (success) {
        setNewInstruction("");
      }
    }
  };

  const config = statusConfig[agent.status];
  const modifiedFilesCount = agent.modifiedFiles?.length || 0;

  return (
    <Card
      className={`transition-all duration-200 hover:shadow-md border-l-4 ${
        expanded ? "col-span-full shadow-lg" : ""
      } ${getVariantClass("agent-card-border", config.variant)}`}
    >
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3 flex-1 min-w-0">
            <div
              className={`p-2 rounded-lg ${getVariantClass("agent-status-icon", config.variant)}`}
            >
              <StatusIndicator status={config.status} size="sm" />
            </div>
            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-2 mb-1">
                <span className="font-semibold truncate text-base">
                  {agent.name}
                </span>
                <Badge
                  variant={config.variant}
                  className="flex items-center gap-1.5 px-2 py-1"
                >
                  <StatusIndicator status={config.status} size="xs" />
                  {config.label}
                </Badge>
                {modifiedFilesCount > 0 && (
                  <Badge variant="outline" className="text-xs">
                    {modifiedFilesCount} files
                  </Badge>
                )}
              </div>
              <p className="text-sm text-muted-foreground truncate">
                {agent.instruction}
              </p>
            </div>
          </div>
          <div className="flex items-center gap-1 ml-2">
            {agent.status === "pending" && (
              <Button
                size="sm"
                variant="ghost"
                onClick={() => onStart(agent.id)}
                title="Start agent"
                className="agent-button-start"
              >
                <Play className="h-4 w-4" />
              </Button>
            )}
            {agent.status === "running" && (
              <Button
                size="sm"
                variant="ghost"
                onClick={() => onStop(agent.id)}
                title="Stop agent"
                className="agent-button-stop"
              >
                <Square className="h-4 w-4" />
              </Button>
            )}
            {agent.status === "stopped" && (
              <Button
                size="sm"
                variant="ghost"
                onClick={() => onResume(agent.id)}
                title="Resume agent"
                className="agent-button-resume"
              >
                <Play className="h-4 w-4" />
              </Button>
            )}
            {(agent.status === "completed" ||
              agent.status === "stopped" ||
              agent.status === "waiting") && (
              <Button
                size="sm"
                variant="default"
                onClick={() => onMerge(agent.id)}
                title="Merge changes"
                className="agent-button-merge"
              >
                <GitMerge className="h-4 w-4" />
              </Button>
            )}
            <Button
              size="sm"
              variant="ghost"
              onClick={() => onDelete(agent.id)}
              title="Delete agent"
              className="agent-button-delete"
            >
              <Trash2 className="h-4 w-4" />
            </Button>
            {onToggleExpand && (
              <Button
                size="sm"
                variant="ghost"
                onClick={onToggleExpand}
                title={expanded ? "Collapse" : "Expand"}
              >
                {expanded ? (
                  <ChevronUp className="h-4 w-4" />
                ) : (
                  <ChevronDown className="h-4 w-4" />
                )}
              </Button>
            )}
          </div>
        </div>
      </CardHeader>

      {expanded && (
        <CardContent className="pt-0">
          <Tabs
            value={activeTab}
            onValueChange={setActiveTab}
            className="w-full"
          >
            <TabsList className="grid w-full grid-cols-3 mb-4">
              <TabsTrigger value="output" className="text-sm font-medium">
                <MessageSquare className="h-4 w-4 mr-2" />
                Output
              </TabsTrigger>
              <TabsTrigger value="files" className="text-sm font-medium">
                <Terminal className="h-4 w-4 mr-2" />
                Files ({modifiedFilesCount})
              </TabsTrigger>
              <TabsTrigger value="diff" className="text-sm font-medium">
                <GitMerge className="h-4 w-4 mr-2" />
                Review
                {modifiedFilesCount > 0 && (
                  <Badge variant="outline" className="ml-2 text-xs px-1.5 py-0">
                    {modifiedFilesCount}
                  </Badge>
                )}
              </TabsTrigger>
            </TabsList>

            <TabsContent value="output" className="mt-0">
              <ConversationLog
                conversation={agent.conversation}
                status={agent.status}
                className="h-[450px] rounded-lg border bg-card/50 shadow-inner"
              />
            </TabsContent>

            <TabsContent value="files" className="mt-0">
              <FilesList
                files={agent.modifiedFiles || []}
                diffStat={agent.diffStat || ""}
                className="h-[450px] rounded-lg border bg-card/50 shadow-inner"
              />
            </TabsContent>

            <TabsContent value="diff" className="mt-0">
              {loadingDiff ? (
                <div className="h-[450px] rounded-lg border bg-card/50 shadow-inner flex items-center justify-center">
                  <div className="text-center">
                    <Badge variant="secondary" className="text-xs">
                      Loading
                    </Badge>
                    <p className="text-sm text-muted-foreground mt-2">
                      Loading diff...
                    </p>
                  </div>
                </div>
              ) : (
                <DiffViewer
                  diff={diff || ""}
                  className="h-[450px] rounded-lg border bg-card/50 shadow-inner"
                />
              )}
            </TabsContent>
          </Tabs>

          {(agent.status === "running" ||
            agent.status === "completed" ||
            agent.status === "stopped") && (
            <div className="mt-4 flex gap-3">
              <div className="flex-1 relative">
                <MessageSquare className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
                <Textarea
                  placeholder="Send new instruction..."
                  value={newInstruction}
                  onChange={(e) => setNewInstruction(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) {
                      handleInstruct();
                    }
                  }}
                  className="pl-10 min-h-[48px] resize-none text-sm border-2 focus:border-base07/50 transition-colors"
                  rows={1}
                />
              </div>
              <Button
                onClick={handleInstruct}
                disabled={!newInstruction.trim()}
                className="px-6 h-[48px] bg-base07 hover:bg-base07/90 transition-colors"
              >
                Send
              </Button>
            </div>
          )}
        </CardContent>
      )}
    </Card>
  );
}
