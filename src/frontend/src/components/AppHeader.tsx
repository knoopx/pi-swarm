import { Bot, Wifi, WifiOff, Menu, Activity } from "lucide-react";
import { Button } from "./ui/button";
import { Slider } from "./ui/slider";
import { Badge } from "./ui/badge";
import { Tooltip, TooltipContent, TooltipTrigger } from "./ui/tooltip";

interface AppHeaderProps {
  cwd: string | null;
  connected: boolean;
  agentCount: number;
  runningCount: number;
  maxConcurrency: number;
  onMaxConcurrencyChange: (value: number) => void;
  onToggleSidebar: () => void;
}

export function AppHeader({
  cwd,
  connected,
  agentCount,
  runningCount,
  maxConcurrency,
  onMaxConcurrencyChange,
  onToggleSidebar,
}: AppHeaderProps) {
  return (
    <header className="h-16 border-b bg-gradient-to-r from-card via-card/95 to-card/90 backdrop-blur-sm flex items-center px-6 shrink-0 shadow-sm">
      <Button
        variant="ghost"
        size="icon"
        className="mr-4 lg:hidden hover:bg-muted/50 transition-colors"
        onClick={onToggleSidebar}
      >
        <Menu className="h-5 w-5" />
      </Button>
      <div className="flex items-center gap-4">
        <div className="flex items-center justify-center w-10 h-10 rounded-xl bg-gradient-to-br from-primary/20 to-primary/10 border border-primary/20 shadow-sm">
          <Bot className="h-6 w-6 text-primary" />
        </div>
        <div>
          <h1 className="font-bold text-lg text-foreground">Pi Swarm</h1>
          {cwd && (
            <p className="text-sm text-muted-foreground font-mono truncate max-w-xs">
              {cwd}
            </p>
          )}
        </div>
      </div>

      <div className="ml-auto flex items-center gap-6">
        <Tooltip>
          <TooltipTrigger asChild>
            <div className="flex items-center gap-3 text-sm text-muted-foreground bg-muted/30 px-3 py-2 rounded-lg border">
              <Activity className="h-4 w-4" />
              <span>Concurrency:</span>
              <div className="flex items-center gap-3">
                <Slider
                  value={[maxConcurrency]}
                  onValueChange={(value) => onMaxConcurrencyChange(value[0])}
                  min={1}
                  max={10}
                  step={1}
                  className="w-20"
                />
                <Badge
                  variant="outline"
                  className="text-xs px-2 py-0.5 font-mono"
                >
                  {maxConcurrency}
                </Badge>
              </div>
            </div>
          </TooltipTrigger>
          <TooltipContent className="bg-popover border shadow-lg">
            Maximum concurrent agents
          </TooltipContent>
        </Tooltip>

        <div className="flex items-center gap-3 text-sm">
          <div className="flex items-center gap-2 bg-muted/30 px-3 py-2 rounded-lg border">
            <span className="text-muted-foreground">Agents:</span>
            <Badge
              variant="secondary"
              className="text-xs px-2 py-0.5 font-medium"
            >
              {agentCount}
            </Badge>
            {runningCount > 0 && (
              <>
                <span className="text-muted-foreground">·</span>
                <Badge
                  variant="default"
                  className="text-xs px-2 py-0.5 bg-success hover:bg-success/90 font-medium"
                >
                  {runningCount} running
                </Badge>
              </>
            )}
          </div>
        </div>

        <Tooltip>
          <TooltipTrigger asChild>
            <div
              className={`flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-medium transition-all shadow-sm ${
                connected
                  ? "bg-success/10 text-success border border-success/20 hover:bg-success/20"
                  : "bg-destructive/10 text-destructive border border-destructive/20 hover:bg-destructive/20"
              }`}
            >
              {connected ? (
                <Wifi className="h-4 w-4" />
              ) : (
                <WifiOff className="h-4 w-4" />
              )}
              <span>{connected ? "Connected" : "Disconnected"}</span>
            </div>
          </TooltipTrigger>
          <TooltipContent className="bg-popover border shadow-lg">
            {connected
              ? "Real-time updates active"
              : "Attempting to reconnect..."}
          </TooltipContent>
        </Tooltip>
      </div>
    </header>
  );
}
