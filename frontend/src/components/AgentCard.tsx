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
  Loader2,
} from "lucide-react";
import { Card, CardContent, CardHeader } from "./ui/card";
import { Button } from "./ui/button";
import { Badge } from "./ui/badge";
import { Textarea } from "./ui/textarea";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "./ui/tabs";
import { DiffViewer } from "./DiffViewer";
import { ConversationLog } from "./ConversationLog";
import { FilesList } from "./FilesList";
import type { Agent } from "../types";

interface AgentCardProps {
  agent: Agent;
  onStart: (id: string) => Promise<boolean>;
  onStop: (id: string) => Promise<boolean>;
  onDelete: (id: string) => Promise<boolean>;
  onMerge: (id: string) => Promise<boolean>;
  onInstruct: (id: string, instruction: string) => Promise<boolean>;
  onGetDiff: (id: string) => Promise<string | null>;
  expanded?: boolean;
  onToggleExpand?: () => void;
}

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
    icon?: React.ReactNode;
  }
> = {
  pending: { variant: "secondary" },
  running: {
    variant: "warning",
    icon: <Loader2 className="h-3 w-3 animate-spin" />,
  },
  completed: { variant: "success" },
  waiting: { variant: "default" },
  stopped: { variant: "outline" },
  error: { variant: "destructive" },
};

export function AgentCard({
  agent,
  onStart,
  onStop,
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

  return (
    <Card className={`transition-all ${expanded ? "col-span-full" : ""}`}>
      <CardHeader className="pb-2">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3 flex-1 min-w-0">
            <Terminal className="h-5 w-5 text-muted-foreground shrink-0" />
            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-2">
                <span className="font-semibold truncate">{agent.name}</span>
                <Badge
                  variant={config.variant}
                  className="flex items-center gap-1"
                >
                  {config.icon}
                  {agent.status}
                </Badge>
              </div>
              <p className="text-xs text-muted-foreground truncate mt-0.5">
                {agent.instruction}
              </p>
            </div>
          </div>
          <div className="flex items-center gap-1">
            {agent.status === "pending" && (
              <Button
                size="sm"
                variant="ghost"
                onClick={() => onStart(agent.id)}
              >
                <Play className="h-4 w-4" />
              </Button>
            )}
            {agent.status === "running" && (
              <Button
                size="sm"
                variant="ghost"
                onClick={() => onStop(agent.id)}
              >
                <Square className="h-4 w-4" />
              </Button>
            )}
            {(agent.status === "completed" || agent.status === "stopped") && (
              <Button
                size="sm"
                variant="ghost"
                onClick={() => onMerge(agent.id)}
              >
                <GitMerge className="h-4 w-4" />
              </Button>
            )}
            <Button
              size="sm"
              variant="ghost"
              onClick={() => onDelete(agent.id)}
            >
              <Trash2 className="h-4 w-4" />
            </Button>
            {onToggleExpand && (
              <Button size="sm" variant="ghost" onClick={onToggleExpand}>
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
        <CardContent className="pt-2">
          <Tabs
            value={activeTab}
            onValueChange={setActiveTab}
            className="w-full"
          >
            <TabsList className="grid w-full grid-cols-3 mb-2">
              <TabsTrigger value="output" className="text-xs">
                Output
              </TabsTrigger>
              <TabsTrigger value="files" className="text-xs">
                Files ({agent.modifiedFiles?.length || 0})
              </TabsTrigger>
              <TabsTrigger value="diff" className="text-xs">
                Review
                {(agent.modifiedFiles?.length || 0) > 0 && (
                  <Badge
                    variant="secondary"
                    className="ml-1.5 text-[10px] px-1.5 py-0"
                  >
                    {agent.modifiedFiles?.length || 0}
                  </Badge>
                )}
              </TabsTrigger>
            </TabsList>

            <TabsContent value="output" className="mt-0">
              <ConversationLog
                conversation={agent.conversation}
                status={agent.status}
                className="h-[400px] rounded-md border bg-black/50"
              />
            </TabsContent>

            <TabsContent value="files" className="mt-0">
              <FilesList
                files={agent.modifiedFiles || []}
                diffStat={agent.diffStat || ""}
                className="h-[400px] rounded-md border bg-muted/30"
              />
            </TabsContent>

            <TabsContent value="diff" className="mt-0">
              {loadingDiff ? (
                <div className="h-[400px] rounded-md border bg-muted/30 flex items-center justify-center">
                  <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
                </div>
              ) : (
                <DiffViewer
                  diff={diff || ""}
                  className="h-[400px] rounded-md border bg-black/50"
                />
              )}
            </TabsContent>
          </Tabs>

          {(agent.status === "running" ||
            agent.status === "completed" ||
            agent.status === "stopped") && (
            <div className="mt-3 flex gap-2">
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
                  className="pl-10 min-h-[44px] resize-none"
                  rows={1}
                />
              </div>
              <Button
                onClick={handleInstruct}
                disabled={!newInstruction.trim()}
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
