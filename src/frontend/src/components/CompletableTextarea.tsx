import * as React from "react";
import { useState, useRef, useCallback, useMemo } from "react";
import { Textarea } from "./ui/textarea";
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandItem,
  CommandList,
} from "./ui/command";
import { Popover, PopoverContent, PopoverTrigger } from "./ui/popover";
import { cn } from "src/lib/utils";
import { FileText, Terminal, BookOpen, File } from "lucide-react";

export interface CompletionItem {
  name: string;
  description?: string;
  source: "extension" | "prompt" | "skill" | "file";
  location?: string;
  path?: string;
}

type TriggerType = "/" | "@" | null;

interface CompletableTextareaProps extends Omit<
  React.ComponentProps<typeof Textarea>,
  "onChange"
> {
  value: string;
  onChange: (value: string) => void;
  completions: CompletionItem[];
  fileCompletions?: CompletionItem[];
  onSubmit?: () => void;
  onQueue?: () => void;
}

const CompletableTextarea = React.forwardRef<
  HTMLTextAreaElement,
  CompletableTextareaProps
>(
  (
    {
      value,
      onChange,
      completions,
      fileCompletions = [],
      onSubmit,
      onQueue,
      className,
      disabled,
      ...props
    },
    ref,
  ) => {
    const [showCompletions, setShowCompletions] = useState(false);
    const [selectedIndex, setSelectedIndex] = useState(0);
    const [searchQuery, setSearchQuery] = useState("");
    const [activeTrigger, setActiveTrigger] = useState<TriggerType>(null);
    const [triggerPosition, setTriggerPosition] = useState(0);
    const textareaRef = useRef<HTMLTextAreaElement | null>(null);

    // Combine refs
    const setRefs = useCallback(
      (element: HTMLTextAreaElement | null) => {
        textareaRef.current = element;
        if (typeof ref === "function") {
          ref(element);
        } else if (ref) {
          ref.current = element;
        }
      },
      [ref],
    );

    // Get active completions based on trigger type
    const activeCompletions = useMemo(() => {
      return activeTrigger === "@" ? fileCompletions : completions;
    }, [activeTrigger, completions, fileCompletions]);

    // Filter completions based on search query
    const filteredCompletions = useMemo(() => {
      if (!searchQuery) return activeCompletions;
      const query = searchQuery.toLowerCase();
      return activeCompletions.filter(
        (item) =>
          item.name.toLowerCase().includes(query) ||
          item.description?.toLowerCase().includes(query),
      );
    }, [activeCompletions, searchQuery]);

    // Check if we should show completions (when typing / at start of line or @ anywhere)
    const checkForTrigger = useCallback(
      (text: string, cursorPos: number) => {
        const textBeforeCursor = text.slice(0, cursorPos);

        // Check for @ trigger - can appear anywhere, find the last @ before cursor
        const lastAtIndex = textBeforeCursor.lastIndexOf("@");
        if (lastAtIndex !== -1) {
          // Check that there's no space between @ and cursor (still typing the file path)
          const textAfterAt = textBeforeCursor.slice(lastAtIndex + 1);
          if (!textAfterAt.includes(" ") && !textAfterAt.includes("\n")) {
            setActiveTrigger("@");
            setTriggerPosition(lastAtIndex);
            setSearchQuery(textAfterAt);
            setShowCompletions(true);
            setSelectedIndex(0);
            return true;
          }
        }

        // Check for / trigger - must be at start of line
        const lastNewline = textBeforeCursor.lastIndexOf("\n");
        const lineStart = lastNewline + 1;
        const currentLine = textBeforeCursor.slice(lineStart);

        if (currentLine.startsWith("/")) {
          const query = currentLine.slice(1);
          setActiveTrigger("/");
          setTriggerPosition(lineStart);
          setSearchQuery(query);
          setShowCompletions(true);
          setSelectedIndex(0);
          return true;
        }

        setShowCompletions(false);
        setSearchQuery("");
        setActiveTrigger(null);
        return false;
      },
      [completions.length, fileCompletions.length],
    );

    // Handle text change
    const handleChange = useCallback(
      (e: React.ChangeEvent<HTMLTextAreaElement>) => {
        const newValue = e.target.value;
        const cursorPos = e.target.selectionStart;
        onChange(newValue);
        checkForTrigger(newValue, cursorPos);
      },
      [onChange, checkForTrigger],
    );

    // Handle clicking on textarea
    const handleClick = useCallback(
      (e: React.MouseEvent<HTMLTextAreaElement>) => {
        const cursorPos = e.currentTarget.selectionStart;
        checkForTrigger(value, cursorPos);
      },
      [value, checkForTrigger],
    );

    // Insert completion
    const insertCompletion = useCallback(
      (item: CompletionItem) => {
        const textarea = textareaRef.current;
        if (!textarea || !activeTrigger) return;

        const cursorPos = textarea.selectionStart;
        const textAfterCursor = value.slice(cursorPos);

        // Replace from trigger position to cursor with the completion
        const beforeTrigger = value.slice(0, triggerPosition);
        const trigger = activeTrigger;
        const newValue = `${beforeTrigger}${trigger}${item.name} ${textAfterCursor}`;

        onChange(newValue);
        setShowCompletions(false);
        setSearchQuery("");
        setActiveTrigger(null);

        // Focus and set cursor position
        requestAnimationFrame(() => {
          if (textareaRef.current) {
            const newCursorPos = triggerPosition + item.name.length + 2; // +2 for trigger and " "
            textareaRef.current.focus();
            textareaRef.current.setSelectionRange(newCursorPos, newCursorPos);
          }
        });
      },
      [value, onChange, activeTrigger, triggerPosition],
    );

    // Handle keyboard navigation
    const handleKeyDown = useCallback(
      (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
        if (showCompletions && filteredCompletions.length > 0) {
          switch (e.key) {
            case "ArrowDown":
              e.preventDefault();
              setSelectedIndex((prev) =>
                Math.min(prev + 1, filteredCompletions.length - 1),
              );
              return;
            case "ArrowUp":
              e.preventDefault();
              setSelectedIndex((prev) => Math.max(prev - 1, 0));
              return;
            case "Tab":
            case "Enter":
              if (!e.metaKey && !e.ctrlKey) {
                e.preventDefault();
                insertCompletion(filteredCompletions[selectedIndex]);
                return;
              }
              break;
            case "Escape":
              e.preventDefault();
              setShowCompletions(false);
              return;
          }
        }

        // Shift+Enter = newline (default behavior, don't prevent)
        if (e.key === "Enter" && e.shiftKey) {
          return;
        }

        // Ctrl/Cmd+Enter = queue message (processed after current operation)
        if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) {
          e.preventDefault();
          onQueue?.();
          return;
        }

        // Enter = submit
        if (e.key === "Enter") {
          e.preventDefault();
          onSubmit?.();
        }
      },
      [
        showCompletions,
        filteredCompletions,
        selectedIndex,
        insertCompletion,
        onSubmit,
        onQueue,
      ],
    );

    const getIcon = (source: CompletionItem["source"]) => {
      switch (source) {
        case "extension":
          return <Terminal className="h-3.5 w-3.5" />;
        case "prompt":
          return <FileText className="h-3.5 w-3.5" />;
        case "skill":
          return <BookOpen className="h-3.5 w-3.5" />;
        case "file":
          return <File className="h-3.5 w-3.5" />;
      }
    };

    const getSourceLabel = (source: CompletionItem["source"]) => {
      switch (source) {
        case "extension":
          return "Command";
        case "prompt":
          return "Prompt";
        case "skill":
          return "Skill";
        case "file":
          return "File";
      }
    };

    // Extract flex classes for wrapper, keep rest for textarea
    const flexClasses =
      className
        ?.split(" ")
        .filter((c) => c.startsWith("flex-"))
        .join(" ") || "";
    const textareaClasses = className
      ?.split(" ")
      .filter((c) => !c.startsWith("flex-"))
      .join(" ");

    return (
      <Popover open={showCompletions} onOpenChange={setShowCompletions}>
        <PopoverTrigger asChild>
          <div className={cn("completable-textarea-wrapper", flexClasses)}>
            <Textarea
              ref={setRefs}
              value={value}
              onChange={handleChange}
              onClick={handleClick}
              onKeyDown={handleKeyDown}
              className={textareaClasses}
              disabled={disabled}
              {...props}
            />
          </div>
        </PopoverTrigger>
        {showCompletions && filteredCompletions.length > 0 && (
          <PopoverContent
            className="completable-textarea-popover"
            align="start"
            sideOffset={4}
          >
            <Command className="completable-textarea-command">
              <CommandList>
                <CommandEmpty>No completions found</CommandEmpty>
                <CommandGroup>
                  {filteredCompletions.map((item, index) => {
                    const isSelected = index === selectedIndex;
                    return (
                      <CommandItem
                        key={`${item.source}-${item.name}`}
                        data-index={index}
                        onSelect={() => insertCompletion(item)}
                        className={cn(
                          "completable-textarea-item",
                          isSelected && "completable-textarea-item-selected",
                        )}
                      >
                        <span
                          className={cn(
                            "completable-textarea-item-icon",
                            isSelected &&
                              "completable-textarea-item-content-selected",
                          )}
                        >
                          {getIcon(item.source)}
                        </span>
                        <span
                          className={cn(
                            "completable-textarea-item-name",
                            isSelected &&
                              "completable-textarea-item-content-selected",
                          )}
                        >
                          {activeTrigger}
                          {item.name}
                        </span>
                        {item.description && (
                          <span
                            className={cn(
                              "completable-textarea-item-description",
                              isSelected &&
                                "completable-textarea-item-content-selected",
                            )}
                          >
                            {item.description}
                          </span>
                        )}
                        <span
                          className={cn(
                            "completable-textarea-item-source",
                            isSelected &&
                              "completable-textarea-item-content-selected",
                          )}
                        >
                          {getSourceLabel(item.source)}
                        </span>
                      </CommandItem>
                    );
                  })}
                </CommandGroup>
              </CommandList>
            </Command>
          </PopoverContent>
        )}
      </Popover>
    );
  },
);

CompletableTextarea.displayName = "CompletableTextarea";

export { CompletableTextarea };
