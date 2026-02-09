import { Bot, Wifi, WifiOff, Menu, Zap } from "lucide-react";
import { Button } from "./ui/button";
import { Slider } from "./ui/slider";
import { Tooltip, TooltipContent, TooltipTrigger } from "./ui/tooltip";
import { cn } from "../lib/utils";

interface AppHeaderProps {
  cwd: string | null;
  connected: boolean;
  maxConcurrency: number;
  onMaxConcurrencyChange: (value: number) => void;
  onToggleSidebar: () => void;
}

export function AppHeader({
  cwd,
  connected,
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
                    className="w-20"
                  />
                  <span className="app-header-control-value">
                    {maxConcurrency}
                  </span>
                </div>
              </div>
            </div>
          </TooltipTrigger>
          <TooltipContent>Max concurrent agents</TooltipContent>
        </Tooltip>

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
