import { Bot, Wifi, WifiOff, Menu, Activity, Zap, Circle } from "lucide-react";
import { Button } from "./ui/button";
import { Slider } from "./ui/slider";
import { Badge } from "./ui/badge";
import { Tooltip, TooltipContent, TooltipTrigger } from "./ui/tooltip";
import { Separator } from "./ui/separator";
import { cn } from "../lib/utils";

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
      {/* Mobile menu button */}
      <Button
        variant="ghost"
        size="icon"
        className="mr-3 lg:hidden"
        onClick={onToggleSidebar}
      >
        <Menu className="h-5 w-5" />
      </Button>

      {/* Logo and title */}
      <div className="flex items-center gap-3">
        <div className="app-header-logo">
          <Bot className="h-5 w-5" />
          {connected && <span className="app-header-logo-pulse" />}
        </div>
        <div className="flex flex-col">
          <h1 className="app-header-title">Pi Swarm</h1>
          {cwd && (
            <Tooltip>
              <TooltipTrigger asChild>
                <p className="app-header-subtitle">{cwd}</p>
              </TooltipTrigger>
              <TooltipContent side="bottom" align="start">
                {cwd}
              </TooltipContent>
            </Tooltip>
          )}
        </div>
      </div>

      {/* Controls section */}
      <div className="app-header-controls">
        {/* Concurrency control */}
        <Tooltip>
          <TooltipTrigger asChild>
            <div className="app-header-control-group">
              <div className="app-header-control-icon">
                <Zap className="h-3.5 w-3.5" />
              </div>
              <div className="app-header-control-content">
                <span className="app-header-control-label">Concurrency</span>
                <div className="flex items-center gap-2">
                  <Slider
                    value={[maxConcurrency]}
                    onValueChange={(value) => onMaxConcurrencyChange(value[0])}
                    min={1}
                    max={10}
                    step={1}
                    className="w-16"
                  />
                  <span className="app-header-control-value">
                    {maxConcurrency}
                  </span>
                </div>
              </div>
            </div>
          </TooltipTrigger>
          <TooltipContent>
            <p className="font-medium">Max Concurrent Agents</p>
            <p className="text-xs text-muted-foreground">
              Number of agents that can run simultaneously
            </p>
          </TooltipContent>
        </Tooltip>

        <Separator orientation="vertical" className="h-8 hidden sm:block" />

        {/* Agent stats */}
        <div className="app-header-stats">
          <Tooltip>
            <TooltipTrigger asChild>
              <div className="app-header-stat">
                <Activity className="h-3.5 w-3.5 text-base04" />
                <span className="app-header-stat-value">{agentCount}</span>
                <span className="app-header-stat-label hidden sm:inline">
                  agents
                </span>
              </div>
            </TooltipTrigger>
            <TooltipContent>Total agents in workspace</TooltipContent>
          </Tooltip>

          {runningCount > 0 && (
            <Badge variant="running" className="app-header-running-badge">
              <Circle className="h-1.5 w-1.5 fill-current animate-pulse" />
              <span>{runningCount}</span>
              <span className="hidden sm:inline">running</span>
            </Badge>
          )}
        </div>

        <Separator orientation="vertical" className="h-8 hidden sm:block" />

        {/* Connection status */}
        <Tooltip>
          <TooltipTrigger asChild>
            <button
              className={cn(
                "app-header-connection",
                connected
                  ? "app-header-connection-online"
                  : "app-header-connection-offline",
              )}
            >
              <span className="app-header-connection-indicator">
                {connected ? (
                  <Wifi className="h-3.5 w-3.5" />
                ) : (
                  <WifiOff className="h-3.5 w-3.5" />
                )}
              </span>
              <span className="hidden sm:inline">
                {connected ? "Connected" : "Offline"}
              </span>
            </button>
          </TooltipTrigger>
          <TooltipContent>
            <p className="font-medium">
              {connected ? "Connection Active" : "Connection Lost"}
            </p>
            <p className="text-xs text-muted-foreground">
              {connected
                ? "Real-time updates are enabled"
                : "Attempting to reconnect..."}
            </p>
          </TooltipContent>
        </Tooltip>
      </div>
    </header>
  );
}
