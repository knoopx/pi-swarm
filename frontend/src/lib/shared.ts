// Shared utilities used across frontend and parsing modules

/**
 * Extract text content from a tool result
 */
export function extractToolResult(result: unknown): string {
  if (!result) return "";

  // Handle AgentToolResult format: { content: TextContent[], details: unknown }
  if (typeof result === "object" && result !== null && "content" in result) {
    const content = (result as { content: unknown }).content;
    if (Array.isArray(content)) {
      return content
        .filter(
          (c): c is { type: "text"; text: string } =>
            typeof c === "object" && c !== null && c.type === "text",
        )
        .map((c) => c.text)
        .join("\n");
    }
    if (typeof content === "string") {
      return content;
    }
  }

  // Fallback: stringify the result
  if (typeof result === "string") return result;
  return JSON.stringify(result, null, 2);
}

/**
 * Generate an agent name from an instruction string
 */
export function generateAgentName(instruction: string): string {
  return (
    instruction
      .trim()
      .toLowerCase()
      .replace(/[^a-z0-9\s]/g, "")
      .split(/\s+/)
      .slice(0, 3)
      .join("-")
      .substring(0, 20) || "task"
  );
}

/**
 * Parse a model string (provider/modelId) into its components
 */
export function parseModelString(
  modelString: string,
): { provider: string; modelId: string } | null {
  const parts = modelString.split("/");
  if (parts.length < 2) return null;
  return {
    provider: parts[0],
    modelId: parts.slice(1).join("/"),
  };
}

/**
 * Format a provider and modelId into a model string
 */
export function formatModelString(provider: string, modelId: string): string {
  return `${provider}/${modelId}`;
}
