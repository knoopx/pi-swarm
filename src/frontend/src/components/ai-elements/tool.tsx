"use client";

import type { DynamicToolUIPart, ToolUIPart } from "ai";
import type { ComponentProps, ReactNode } from "react";

import { Badge } from "src/components/ui/badge";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "src/components/ui/collapsible";
import { cn } from "src/lib/utils";
import {
  CheckCircleIcon,
  ChevronDownIcon,
  CircleIcon,
  ClockIcon,
  WrenchIcon,
  XCircleIcon,
} from "lucide-react";
import { isValidElement, useMemo } from "react";
import AnsiToHtml from "ansi-to-html";

import { CodeBlock } from "./code-block";

// ANSI converter instance
const ansiConverter = new AnsiToHtml({
  fg: "currentColor",
  bg: "transparent",
  newline: true,
  escapeXML: true,
  colors: {
    0: "#1e1e1e",
    1: "#f44747",
    2: "#6a9955",
    3: "#dcdcaa",
    4: "#569cd6",
    5: "#c586c0",
    6: "#4ec9b0",
    7: "#d4d4d4",
    8: "#808080",
    9: "#f44747",
    10: "#6a9955",
    11: "#dcdcaa",
    12: "#569cd6",
    13: "#c586c0",
    14: "#4ec9b0",
    15: "#ffffff",
  },
});

// Check if string contains ANSI escape codes
const containsAnsi = (str: string): boolean => /\x1b\[[0-9;]*m/.test(str);

export type ToolProps = ComponentProps<typeof Collapsible>;

export const Tool = ({ className, ...props }: ToolProps) => (
  <Collapsible
    className={cn("group not-prose mb-4 w-full rounded-md border", className)}
    {...props}
  />
);

export type ToolPart = ToolUIPart | DynamicToolUIPart;

export type ToolHeaderProps = {
  title?: string;
  className?: string;
  input?: ToolPart["input"];
} & (
  | { type: ToolUIPart["type"]; state: ToolUIPart["state"]; toolName?: never }
  | {
      type: DynamicToolUIPart["type"];
      state: DynamicToolUIPart["state"];
      toolName: string;
    }
);

const statusLabels: Record<ToolPart["state"], string> = {
  "approval-requested": "Awaiting Approval",
  "approval-responded": "Responded",
  "input-available": "Running",
  "input-streaming": "Pending",
  "output-available": "Completed",
  "output-denied": "Denied",
  "output-error": "Error",
};

const statusIcons: Record<ToolPart["state"], ReactNode> = {
  "approval-requested": <ClockIcon className="size-4 text-base09" />,
  "approval-responded": <CheckCircleIcon className="size-4 text-base0C" />,
  "input-available": <ClockIcon className="size-4 animate-pulse" />,
  "input-streaming": <CircleIcon className="size-4" />,
  "output-available": <CheckCircleIcon className="size-4 text-base0B" />,
  "output-denied": <XCircleIcon className="size-4 text-base09" />,
  "output-error": <XCircleIcon className="size-4 text-base08" />,
};

export const getStatusBadge = (status: ToolPart["state"]) => (
  <Badge className="gap-1.5 rounded-full text-xs" variant="secondary">
    {statusIcons[status]}
    {statusLabels[status]}
  </Badge>
);

const getFirstParamPreview = (input: ToolPart["input"]): string | null => {
  if (!input || typeof input !== "object") return null;
  const entries = Object.entries(input as Record<string, unknown>);
  if (entries.length === 0) return null;
  const [, value] = entries[0];
  if (typeof value === "string") {
    return value.length > 120 ? `${value.slice(0, 120)}…` : value;
  }
  return null;
};

export const ToolHeader = ({
  className,
  title,
  type,
  state,
  toolName,
  input,
  ...props
}: ToolHeaderProps) => {
  const derivedName =
    type === "dynamic-tool" ? toolName : type.split("-").slice(1).join("-");

  const firstParamPreview = useMemo(() => getFirstParamPreview(input), [input]);

  return (
    <CollapsibleTrigger
      className={cn(
        "flex w-full items-center justify-between gap-4 p-3",
        className,
      )}
      {...props}
    >
      <div className="flex min-w-0 flex-1 items-center gap-2">
        <WrenchIcon className="size-4 shrink-0 text-muted-foreground" />
        <span className="shrink-0 font-medium text-sm">
          {title ?? derivedName}
        </span>
        {firstParamPreview && (
          <span className="truncate text-muted-foreground text-xs">
            {firstParamPreview}
          </span>
        )}
      </div>
      <div className="flex shrink-0 items-center gap-2">
        {getStatusBadge(state)}
        <ChevronDownIcon className="size-4 text-muted-foreground transition-transform group-data-[state=open]:rotate-180" />
      </div>
    </CollapsibleTrigger>
  );
};

export type ToolContentProps = ComponentProps<typeof CollapsibleContent>;

export const ToolContent = ({ className, ...props }: ToolContentProps) => (
  <CollapsibleContent
    className={cn(
      "data-[state=closed]:fade-out-0 data-[state=closed]:slide-out-to-top-2 data-[state=open]:slide-in-from-top-2 space-y-4 p-4 text-popover-foreground outline-none data-[state=closed]:animate-out data-[state=open]:animate-in",
      className,
    )}
    {...props}
  />
);

export type ToolInputProps = ComponentProps<"div"> & {
  input: ToolPart["input"];
};

export const ToolInput = ({ className, input, ...props }: ToolInputProps) => {
  const formattedInput = useMemo(() => {
    try {
      return JSON.stringify(input, null, 2);
    } catch {
      return String(input);
    }
  }, [input]);

  return (
    <div className={cn("space-y-2 overflow-hidden", className)} {...props}>
      <h4 className="font-medium text-muted-foreground text-xs uppercase tracking-wide">
        Parameters
      </h4>
      <div className="rounded-md bg-muted/50 overflow-hidden">
        <CodeBlock code={formattedInput} language="json" />
      </div>
    </div>
  );
};

export type ToolOutputProps = ComponentProps<"div"> & {
  output: ToolPart["output"];
  errorText: ToolPart["errorText"];
};

// Detect if a string looks like JSON
function looksLikeJson(str: string): boolean {
  const trimmed = str.trim();
  return (
    (trimmed.startsWith("{") && trimmed.endsWith("}")) ||
    (trimmed.startsWith("[") && trimmed.endsWith("]"))
  );
}

// Detect if a string looks like code (has multiple lines with indentation or common code patterns)
function looksLikeCode(str: string): boolean {
  const lines = str.split("\n");
  if (lines.length < 3) return false;
  // Check for common code patterns: indentation, braces, function keywords
  const codePatterns =
    /^(\s{2,}|\t)|(function|const|let|var|import|export|class|def|fn|pub|async|await|return|if|else|for|while)\b|[{}();]$/m;
  return codePatterns.test(str);
}

// Try to detect language from content - returns BundledLanguage compatible types
function detectLanguage(
  str: string,
): "json" | "typescript" | "python" | "rust" | "shellscript" {
  if (looksLikeJson(str)) return "json";
  if (
    str.includes("import ") ||
    str.includes("export ") ||
    str.includes("const ") ||
    str.includes("function ")
  )
    return "typescript";
  if (str.includes("def ") && str.includes(":")) return "python";
  if (str.includes("fn ") || str.includes("let mut")) return "rust";
  return "shellscript"; // fallback to shellscript for plain text-like content
}

// Component to render ANSI-colored output
const AnsiOutput = ({ content }: { content: string }) => {
  const html = useMemo(() => ansiConverter.toHtml(content), [content]);
  return (
    <pre
      className="whitespace-pre-wrap break-words p-3 text-sm font-mono"
      dangerouslySetInnerHTML={{ __html: html }}
    />
  );
};

export const ToolOutput = ({
  className,
  output,
  errorText,
  ...props
}: ToolOutputProps) => {
  const renderedOutput = useMemo(() => {
    if (!output) return null;

    // Handle React elements
    if (isValidElement(output)) {
      return <div>{output}</div>;
    }

    // Handle objects (non-React elements)
    if (typeof output === "object") {
      try {
        const formatted = JSON.stringify(output, null, 2);
        return <CodeBlock code={formatted} language="json" />;
      } catch {
        return <pre className="p-3 text-sm font-mono">{String(output)}</pre>;
      }
    }

    // Handle strings
    if (typeof output === "string") {
      // Check for ANSI escape codes first
      if (containsAnsi(output)) {
        return <AnsiOutput content={output} />;
      }

      // Check if it's JSON
      if (looksLikeJson(output)) {
        try {
          const formatted = JSON.stringify(JSON.parse(output), null, 2);
          return <CodeBlock code={formatted} language="json" />;
        } catch {
          return <CodeBlock code={output} language="json" />;
        }
      }

      // Check if it looks like code
      if (looksLikeCode(output)) {
        return <CodeBlock code={output} language={detectLanguage(output)} />;
      }

      // Plain text
      return (
        <pre className="whitespace-pre-wrap break-words p-3 text-sm font-mono">
          {output}
        </pre>
      );
    }

    return <div>{String(output)}</div>;
  }, [output]);

  if (!(output || errorText)) {
    return null;
  }

  return (
    <div className={cn("space-y-2", className)} {...props}>
      <h4 className="font-medium text-muted-foreground text-xs uppercase tracking-wide">
        {errorText ? "Error" : "Result"}
      </h4>
      <div
        className={cn(
          "overflow-x-auto rounded-md text-xs [&_table]:w-full",
          errorText
            ? "bg-destructive/10 text-destructive"
            : "bg-muted/50 text-foreground",
        )}
      >
        {errorText ? (
          <div className="p-3 font-mono whitespace-pre-wrap break-words">
            {errorText}
          </div>
        ) : (
          renderedOutput
        )}
      </div>
    </div>
  );
};
