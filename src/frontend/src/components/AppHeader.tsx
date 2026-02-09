import { Bot, Wifi, WifiOff, Menu, Activity, Zap } from "lucide-react";
import { Button } from "./ui/button";
import { Slider } from "./ui/slider";
import { Badge } from "./ui/badge";
import { Tooltip, TooltipContent, TooltipTrigger } from "./ui/tooltip";
import { StatusIndicator } from "./ui/status-indicator";
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
      <Button
        variant="ghost"
        size="icon"
        className="mr-3 lg:hidden"
        onClick={onToggleSidebar}
      >
        <Menu className="h-5 w-5" />
      </Button>

      <div className="app-header-logo">
        <Bot className="h-5 w-5" />
        {connected && <span className="app-header-logo-pulse" />}
      </div>

      <div className="flex flex-col ml-3">
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

      <div className="app-header-controls">
        <Tooltip>
          <TooltipTrigger asChild>
            <div className="hidden md:flex items-center gap-2 text-xs text-base04">
              <Zap className="h-3.5 w-3.5" />
              <Slider
                value={[maxConcurrency]}
                onValueChange={(value) => onMaxConcurrencyChange(value[0])}
                min={1}
                max={10}
                step={1}
                className="w-14"
              />
              <span className="font-mono text-base05 w-4">
                {maxConcurrency}
              </span>
            </div>
          </TooltipTrigger>
          <TooltipContent>Max concurrent agents</TooltipContent>
        </Tooltip>

        <Tooltip>
          <TooltipTrigger asChild>
            <span className="flex items-center gap-1.5 text-xs text-base04">
              <Activity className="h-3.5 w-3.5" />
              <span className="text-base05 font-medium">{agentCount}</span>
            </span>
          </TooltipTrigger>
          <TooltipContent>Total agents</TooltipContent>
        </Tooltip>

        {runningCount > 0 && (
          <Badge
            variant="running"
            className="flex items-center gap-1.5 text-xs px-2 py-0.5"
          >
            <StatusIndicator status="running" size="sm" />
            <span>{runningCount}</span>
          </Badge>
        )}

        <Tooltip>
          <TooltipTrigger asChild>
            <span
              className={cn(
                "flex items-center gap-1.5 text-xs",
                connected ? "text-base0B" : "text-base08",
              )}
            >
              {connected ? (
                <Wifi className="h-3.5 w-3.5" />
              ) : (
                <WifiOff className="h-3.5 w-3.5" />
              )}
            </span>
          </TooltipTrigger>
          <TooltipContent>
            {connected ? "Connected" : "Offline - reconnecting..."}
          </TooltipContent>
        </Tooltip>
      </div>
    </header>
  );
}
