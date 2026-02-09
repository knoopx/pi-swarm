import { useState, useMemo } from "react";
import { Check, ChevronsUpDown } from "lucide-react";
import { cn } from "../lib/utils";
import { Button } from "./ui/button";
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "./ui/command";
import { Popover, PopoverContent, PopoverTrigger } from "./ui/popover";
import type { ModelInfo } from "../types";

interface ModelSelectorProps {
  models: ModelInfo[];
  value: string;
  onChange: (value: string) => void;
  disabled?: boolean;
  className?: string;
  placeholder?: string;
}

export function ModelSelector({
  models,
  value,
  onChange,
  disabled = false,
  className,
  placeholder = "Select model...",
}: ModelSelectorProps) {
  const [open, setOpen] = useState(false);

  // Group models by provider
  const groupedModels = useMemo(() => {
    const groups: Record<string, ModelInfo[]> = {};
    for (const model of models) {
      if (!groups[model.provider]) {
        groups[model.provider] = [];
      }
      groups[model.provider].push(model);
    }
    return groups;
  }, [models]);

  const selectedModel = models.find(
    (m) => `${m.provider}/${m.modelId}` === value,
  );

  const displayValue = selectedModel ? selectedModel.modelId : placeholder;

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          variant="outline"
          role="combobox"
          aria-expanded={open}
          disabled={disabled}
          className={cn(
            "justify-between font-mono text-xs",
            !selectedModel && "text-muted-foreground",
            className,
          )}
        >
          <span className="truncate">{displayValue}</span>
          <ChevronsUpDown className="ml-2 h-3 w-3 shrink-0 opacity-50" />
        </Button>
      </PopoverTrigger>
      <PopoverContent
        className="w-[280px] p-0 bg-card border-border"
        align="start"
      >
        <Command>
          <CommandInput placeholder="Search models..." className="h-9" />
          <CommandList>
            <CommandEmpty>No model found.</CommandEmpty>
            {Object.entries(groupedModels).map(([provider, providerModels]) => (
              <CommandGroup key={provider} heading={provider}>
                {providerModels.map((model) => {
                  const modelValue = `${model.provider}/${model.modelId}`;
                  return (
                    <CommandItem
                      key={modelValue}
                      value={`${model.provider} ${model.modelId} ${model.name}`}
                      onSelect={() => {
                        onChange(modelValue);
                        setOpen(false);
                      }}
                    >
                      <Check
                        className={cn(
                          "mr-2 h-4 w-4",
                          value === modelValue ? "opacity-100" : "opacity-0",
                        )}
                      />
                      <span className="font-mono text-xs truncate">
                        {model.modelId}
                      </span>
                    </CommandItem>
                  );
                })}
              </CommandGroup>
            ))}
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  );
}
