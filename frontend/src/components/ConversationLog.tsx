import { useMemo } from "react";
import { Loader2 } from "lucide-react";
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
import type { ToolUIPart } from "ai";
import { parseOutput, extractToolResult } from "../lib/parsing";

interface ConversationLogProps {
  output: string;
  status: string;
  className?: string;
}

export function ConversationLog({
  output,
  status,
  className,
}: ConversationLogProps) {
  const events = useMemo(() => parseOutput(output), [output]);

  return (
    <Conversation className={className}>
      <ConversationContent className="gap-4">
        {events.map((event, i) => {
          if (event.type === "processing") {
            return (
              <div
                key={i}
                className="flex items-center justify-center gap-2 py-8 text-muted-foreground"
              >
                <Loader2 className="h-5 w-5 animate-spin" />
                <span>{event.content}</span>
              </div>
            );
          }

          if (event.type === "tool") {
            const resultText = extractToolResult(event.result);
            return (
              <Tool
                key={`${event.toolCallId}-${i}`}
                defaultOpen={event.state === "output-error"}
              >
                <ToolHeader
                  type={`tool-${event.toolName}` as ToolUIPart["type"]}
                  state={event.state}
                  title={event.toolName}
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

          if (event.type === "text") {
            return (
              <Message key={i} from={event.role}>
                <MessageContent>
                  <MessageResponse>{event.content}</MessageResponse>
                </MessageContent>
              </Message>
            );
          }

          return null;
        })}

        {status === "running" &&
          events.length > 0 &&
          events[events.length - 1].type !== "processing" && (
            <div className="flex items-center gap-2 text-muted-foreground text-sm">
              <Loader2 className="h-4 w-4 animate-spin" />
              <span>Working...</span>
            </div>
          )}
      </ConversationContent>
      <ConversationScrollButton />
    </Conversation>
  );
}
