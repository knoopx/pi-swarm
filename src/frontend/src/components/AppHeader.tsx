import { Bot, Wifi, WifiOff, Menu } from "lucide-react";
import { Button } from "./ui/button";
import { Slider } from "./ui/slider";
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
    <header className="h-14 border-b bg-card/50 backdrop-blur-sm flex items-center px-4 shrink-0">
      <Button
        variant="ghost"
        size="icon"
        className="mr-2 lg:hidden"
        onClick={onToggleSidebar}
      >
        <Menu className="h-4 w-4" />
      </Button>
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
        <Tooltip>
          <TooltipTrigger asChild>
            <div className="flex items-center gap-2 text-xs text-muted-foreground">
              <span>Concurrency:</span>
              <div className="flex items-center gap-2">
                <Slider
                  value={[maxConcurrency]}
                  onValueChange={(value) => onMaxConcurrencyChange(value[0])}
                  min={1}
                  max={10}
                  step={1}
                  className="w-16"
                />
                <span className="w-4 text-center font-mono">
                  {maxConcurrency}
                </span>
              </div>
            </div>
          </TooltipTrigger>
          <TooltipContent>Maximum concurrent agents</TooltipContent>
        </Tooltip>

        <div className="text-xs text-muted-foreground">
          {agentCount} agent{agentCount !== 1 ? "s" : ""}
          {runningCount > 0 && (
            <span className="text-base09 ml-1">· {runningCount} running</span>
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
  );
}
