import { Bot, Wifi, WifiOff, Command } from "lucide-react";
import { Button } from "./ui/button";
import { Input } from "./ui/input";
import { Tooltip, TooltipContent, TooltipTrigger } from "./ui/tooltip";

interface AppHeaderProps {
  cwd: string | null;
  connected: boolean;
  agentCount: number;
  runningCount: number;
  maxConcurrency: number;
  onMaxConcurrencyChange: (value: number) => void;
  onOpenCommandBar: () => void;
}

export function AppHeader({
  cwd,
  connected,
  agentCount,
  runningCount,
  maxConcurrency,
  onMaxConcurrencyChange,
  onOpenCommandBar,
}: AppHeaderProps) {
  return (
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
        <Tooltip>
          <TooltipTrigger asChild>
            <Button
              variant="outline"
              size="sm"
              onClick={onOpenCommandBar}
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
                    onMaxConcurrencyChange(value);
                  }
                }}
                className="w-14 h-7 text-xs text-center [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
              />
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
