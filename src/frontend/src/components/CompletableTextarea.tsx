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
import { FileText, Terminal, BookOpen } from "lucide-react";

export interface CompletionItem {
  name: string;
  description?: string;
  source: "extension" | "prompt" | "skill";
  location?: string;
  path?: string;
}

interface CompletableTextareaProps extends Omit<
  React.ComponentProps<typeof Textarea>,
  "onChange"
> {
  value: string;
  onChange: (value: string) => void;
  completions: CompletionItem[];
  onSubmit?: () => void;
}

const CompletableTextarea = React.forwardRef<
  HTMLTextAreaElement,
  CompletableTextareaProps
>(
  (
    { value, onChange, completions, onSubmit, className, disabled, ...props },
    ref,
  ) => {
    const [showCompletions, setShowCompletions] = useState(false);
    const [selectedIndex, setSelectedIndex] = useState(0);
    const [searchQuery, setSearchQuery] = useState("");
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

    // Filter completions based on search query
    const filteredCompletions = useMemo(() => {
      if (!searchQuery) return completions;
      const query = searchQuery.toLowerCase();
      return completions.filter(
        (item) =>
          item.name.toLowerCase().includes(query) ||
          item.description?.toLowerCase().includes(query),
      );
    }, [completions, searchQuery]);

    // Check if we should show completions (when typing / at start or after newline)
    const checkForSlashTrigger = useCallback(
      (text: string, cursorPos: number) => {
        // Find the start of the current line
        const textBeforeCursor = text.slice(0, cursorPos);
        const lastNewline = textBeforeCursor.lastIndexOf("\n");
        const lineStart = lastNewline + 1;
        const currentLine = textBeforeCursor.slice(lineStart);

        console.log("[CompletableTextarea] checkForSlashTrigger:", {
          text,
          cursorPos,
          currentLine,
          completionsCount: completions.length,
        });

        // Check if current line starts with /
        if (currentLine.startsWith("/")) {
          // Extract the query part (everything after /)
          const query = currentLine.slice(1);
          setSearchQuery(query);
          setShowCompletions(true);
          setSelectedIndex(0);
          return true;
        }

        setShowCompletions(false);
        setSearchQuery("");
        return false;
      },
      [completions.length],
    );

    // Handle text change
    const handleChange = useCallback(
      (e: React.ChangeEvent<HTMLTextAreaElement>) => {
        const newValue = e.target.value;
        const cursorPos = e.target.selectionStart;
        onChange(newValue);
        checkForSlashTrigger(newValue, cursorPos);
      },
      [onChange, checkForSlashTrigger],
    );

    // Handle clicking on textarea
    const handleClick = useCallback(
      (e: React.MouseEvent<HTMLTextAreaElement>) => {
        const cursorPos = e.currentTarget.selectionStart;
        checkForSlashTrigger(value, cursorPos);
      },
      [value, checkForSlashTrigger],
    );

    // Insert completion
    const insertCompletion = useCallback(
      (item: CompletionItem) => {
        const textarea = textareaRef.current;
        if (!textarea) return;

        const cursorPos = textarea.selectionStart;
        const textBeforeCursor = value.slice(0, cursorPos);
        const textAfterCursor = value.slice(cursorPos);

        // Find the start of the current line
        const lastNewline = textBeforeCursor.lastIndexOf("\n");
        const lineStart = lastNewline + 1;

        // Replace the current line's slash command with the completion
        const beforeLine = value.slice(0, lineStart);
        const newValue = `${beforeLine}/${item.name} ${textAfterCursor}`;

        onChange(newValue);
        setShowCompletions(false);
        setSearchQuery("");

        // Focus and set cursor position
        requestAnimationFrame(() => {
          if (textareaRef.current) {
            const newCursorPos = lineStart + item.name.length + 2; // +2 for "/" and " "
            textareaRef.current.focus();
            textareaRef.current.setSelectionRange(newCursorPos, newCursorPos);
          }
        });
      },
      [value, onChange],
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

        // Handle submit with Ctrl/Cmd+Enter
        if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) {
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
      }
    };

    return (
      <div ref={containerRef} className="relative">
        <Textarea
          ref={setRefs}
          value={value}
          onChange={handleChange}
          onClick={handleClick}
          onKeyDown={handleKeyDown}
          className={className}
          disabled={disabled}
          {...props}
        />
        {showCompletions && filteredCompletions.length > 0 && (
          <div
            ref={popupRef}
            className="absolute bottom-full left-0 right-0 mb-1 z-50 max-h-[300px] overflow-auto rounded-md border bg-popover p-1 shadow-md"
          >
            <Command className="bg-transparent">
              <CommandList>
                <CommandEmpty>No completions found</CommandEmpty>
                <CommandGroup>
                  {filteredCompletions.map((item, index) => (
                    <CommandItem
                      key={`${item.source}-${item.name}`}
                      data-index={index}
                      onSelect={() => insertCompletion(item)}
                      className={cn(
                        "flex items-center gap-2 cursor-pointer",
                        index === selectedIndex && "bg-accent",
                      )}
                    >
                      <span className="text-muted-foreground">
                        {getIcon(item.source)}
                      </span>
                      <span className="font-mono text-sm">/{item.name}</span>
                      {item.description && (
                        <span className="text-xs text-muted-foreground truncate flex-1">
                          {item.description}
                        </span>
                      )}
                      <span className="text-[10px] text-muted-foreground/60 uppercase">
                        {getSourceLabel(item.source)}
                      </span>
                    </CommandItem>
                  ))}
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
