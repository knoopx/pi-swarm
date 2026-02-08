import * as React from "react";
import { useState, useRef, useCallback, useEffect, useMemo } from "react";
import { Textarea } from "./ui/textarea";
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandItem,
  CommandList,
} from "./ui/command";
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
  onInterrupt?: () => void;
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
      onInterrupt,
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
    const [popupStyle, setPopupStyle] = useState<React.CSSProperties>({});
    const containerRef = useRef<HTMLDivElement>(null);
    const textareaRef = useRef<HTMLTextAreaElement | null>(null);
    const popupRef = useRef<HTMLDivElement>(null);

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

        // Ctrl/Cmd+Enter = interrupt/steering
        if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) {
          e.preventDefault();
          onInterrupt?.();
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
      ],
    );

    // Close completions when clicking outside
    useEffect(() => {
      const handleClickOutside = (e: MouseEvent) => {
        if (
          containerRef.current &&
          !containerRef.current.contains(e.target as Node)
        ) {
          setShowCompletions(false);
        }
      };

      document.addEventListener("mousedown", handleClickOutside);
      return () =>
        document.removeEventListener("mousedown", handleClickOutside);
    }, []);

    // Calculate popup position based on available space
    useEffect(() => {
      if (showCompletions && containerRef.current) {
        const rect = containerRef.current.getBoundingClientRect();
        const popupHeight = 300; // max-h-[300px]
        const popupWidth = rect.width;
        const margin = 4;

        // Calculate vertical position
        const spaceAbove = rect.top;
        const spaceBelow = window.innerHeight - rect.bottom;
        const showBelow = spaceAbove < popupHeight && spaceBelow > spaceAbove;

        // Calculate horizontal position - keep within viewport
        let left = rect.left;
        if (left + popupWidth > window.innerWidth) {
          left = window.innerWidth - popupWidth - margin;
        }
        if (left < margin) {
          left = margin;
        }

        setPopupStyle({
          position: "fixed",
          left: `${left}px`,
          width: `${popupWidth}px`,
          ...(showBelow
            ? { top: `${rect.bottom + margin}px` }
            : { bottom: `${window.innerHeight - rect.top + margin}px` }),
        });
      }
    }, [showCompletions]);

    // Scroll selected item into view
    useEffect(() => {
      if (showCompletions && popupRef.current) {
        const selectedElement = popupRef.current.querySelector(
          `[data-index="${selectedIndex}"]`,
        );
        selectedElement?.scrollIntoView({ block: "nearest" });
      }
    }, [selectedIndex, showCompletions]);

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
      <div ref={containerRef} className={cn("relative", flexClasses)}>
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
        {showCompletions && filteredCompletions.length > 0 && (
          <div
            ref={popupRef}
            style={popupStyle}
            className="z-50 max-h-[300px] overflow-auto rounded-md border bg-popover p-1 shadow-md"
          >
            <Command className="bg-transparent">
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
                          "flex items-center gap-2 cursor-pointer",
                          isSelected && "bg-accent",
                        )}
                      >
                        <span
                          className={
                            isSelected
                              ? "text-accent-foreground"
                              : "text-base0D"
                          }
                        >
                          {getIcon(item.source)}
                        </span>
                        <span
                          className={cn(
                            "font-mono text-sm",
                            isSelected
                              ? "text-accent-foreground"
                              : "text-base05",
                          )}
                        >
                          {activeTrigger}
                          {item.name}
                        </span>
                        {item.description && (
                          <span
                            className={cn(
                              "text-xs truncate flex-1",
                              isSelected
                                ? "text-accent-foreground"
                                : "text-base04",
                            )}
                          >
                            {item.description}
                          </span>
                        )}
                        <span
                          className={cn(
                            "text-[10px] uppercase",
                            isSelected
                              ? "text-accent-foreground"
                              : "text-base03",
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
          </div>
        )}
      </div>
    );
  },
);

CompletableTextarea.displayName = "CompletableTextarea";

export { CompletableTextarea };
