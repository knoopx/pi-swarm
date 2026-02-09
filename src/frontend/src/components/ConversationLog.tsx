import { useMemo, useState, useEffect } from "react";
import {
  Conversation,
  ConversationContent,
  ConversationScrollButton,
} from "./ai-elements/conversation";
import {
  Message,
  MessageContent,
  MessageResponse,
} from "./ai-elements/message";
import {
  Tool,
  ToolHeader,
  ToolContent,
  ToolInput,
  ToolOutput,
} from "./ai-elements/tool";
import { Thinking, ThinkingContent } from "./ai-elements/thinking";
import type { ToolUIPart } from "ai";
import type { ConversationState } from "../lib/conversation-state";
import type { ToolEvent, ConversationEvent } from "../lib/events";
import { getDisplayEvents } from "../lib/conversation-state";
import { extractToolResult } from "../lib/shared";

// Auto-closing tool wrapper - closes automatically on successful completion
interface AutoClosingToolProps {
  event: ToolEvent;
  resultText: string;
}

function AutoClosingTool({ event, resultText }: AutoClosingToolProps) {
  const isRunning =
    event.state === "input-available" || event.state === "input-streaming";
  const hasError = event.state === "output-error";
  const isCompleted = event.state === "output-available";

  // Track if user has manually interacted with the collapsible
  const [userOverride, setUserOverride] = useState<boolean | null>(null);

  // Reset user override when tool starts running again
  useEffect(() => {
    if (isRunning) {
      setUserOverride(null);
    }
  }, [isRunning]);

  // Compute open state: user override takes precedence, otherwise auto behavior
  const isOpen =
    userOverride !== null
      ? userOverride
      : hasError || isRunning
        ? true
        : isCompleted
          ? false
          : false;

  return (
    <Tool open={isOpen} onOpenChange={setUserOverride}>
      <ToolHeader
        type={`tool-${event.toolName}` as ToolUIPart["type"]}
        state={event.state}
        title={event.toolName}
        input={event.args}
      />
      <ToolContent>
        <ToolInput input={event.args} />
        {(resultText || event.isError) && (
          <ToolOutput
            output={resultText}
            errorText={event.isError ? resultText : undefined}
          />
        )}
      </ToolContent>
    </Tool>
  );
}

interface ConversationLogProps {
  conversation: ConversationState;
  status: string;
  className?: string;
}

export function ConversationLog({
  conversation,
  status,
  className,
}: ConversationLogProps) {
  // Get events including pending streaming content
  const events = useMemo(() => getDisplayEvents(conversation), [conversation]);

  const isEmpty = events.length === 0;

  return (
    <Conversation className={className}>
      <ConversationContent className="gap-4">
        {isEmpty && status === "running" && (
          <div className="flex items-center justify-center gap-2 py-8 text-muted-foreground">
            <span>Starting...</span>
          </div>
        )}

        {events.map((event: ConversationEvent, i: number) => {
          if (event.type === "processing") {
            return (
              <div
                key={i}
                className="flex items-center justify-center gap-2 py-8 text-muted-foreground"
              >
                <span>{event.content}</span>
              </div>
            );
          }

          if (event.type === "tool") {
            const resultText = extractToolResult(event.result);
            return (
              <AutoClosingTool
                key={`${event.toolCallId}-${i}`}
                event={event}
                resultText={resultText}
              />
            );
          }

          if (event.type === "thinking") {
            return (
              <Thinking key={i} defaultOpen={false}>
                <ThinkingContent>{event.content}</ThinkingContent>
              </Thinking>
            );
          }

          if (event.type === "text") {
            return (
              <Message key={i} from={event.role}>
                <MessageContent>
                  <MessageResponse>{event.content}</MessageResponse>
                </MessageContent>
              </Message>
            );
          }

          if (event.type === "system") {
            const icon =
              event.variant === "error" ? (
                <XCircle className="h-4 w-4" />
              ) : event.variant === "warning" ? (
                <AlertTriangle className="h-4 w-4" />
              ) : (
                <Info className="h-4 w-4" />
              );
            const colorClass =
              event.variant === "error"
                ? "text-destructive border-destructive/30 bg-destructive/10"
                : event.variant === "warning"
                  ? "text-base09 border-base09/30 bg-base09/10"
                  : "text-muted-foreground border-border bg-muted/30";
            return (
              <div
                key={i}
                className={`flex items-center gap-2 px-3 py-2 rounded-md border text-sm ${colorClass}`}
              >
                {icon}
                <span>{event.content}</span>
              </div>
            );
          }

          return null;
        })}
      </ConversationContent>
      <ConversationScrollButton />
    </Conversation>
  );
}
