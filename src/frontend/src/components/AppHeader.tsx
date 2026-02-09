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
    <header className="app-header">
      <Button
        variant="ghost"
        size="icon"
        className="mr-4 lg:hidden hover:bg-muted/50 transition-colors"
        onClick={onToggleSidebar}
      >
        <Menu className="h-5 w-5" />
      </Button>
      <div className="flex items-center gap-4">
        <div className="app-header-logo">
          <Bot className="h-6 w-6 text-base07" />
        </div>
        <div>
          <h1 className="app-header-title">Pi Swarm</h1>
          {cwd && <p className="app-header-subtitle">{cwd}</p>}
        </div>
      </div>

      <div className="app-header-controls">
        <Tooltip>
          <TooltipTrigger asChild>
            <div className="app-header-concurrency">
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
          <div className="app-header-agents">
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
                <Badge variant="default" className="app-header-running-badge">
                  {runningCount} running
                </Badge>
              </>
            )}
          </div>
        </div>

        <Tooltip>
          <TooltipTrigger asChild>
            <div
              className={`app-header-status ${
                connected ? "app-header-connected" : "app-header-disconnected"
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
