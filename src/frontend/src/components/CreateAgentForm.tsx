import { useState } from "react";
import { Plus, Send } from "lucide-react";
import { Button } from "./ui/button";
import { Textarea } from "./ui/textarea";

interface CreateAgentFormProps {
  onCreate: (
    name: string,
    instruction: string,
    basePath?: string,
  ) => Promise<unknown>;
}

export function CreateAgentForm({ onCreate }: CreateAgentFormProps) {
  const [instruction, setInstruction] = useState("");
  const [creating, setCreating] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!instruction.trim()) return;

    setCreating(true);
    // Auto-generate name from first few words of instruction
    const name = instruction
      .trim()
      .toLowerCase()
      .replace(/[^a-z0-9\s]/g, "")
      .split(/\s+/)
      .slice(0, 3)
      .join("-")
      .substring(0, 20);

    await onCreate(name || "task", instruction);
    setInstruction("");
    setCreating(false);
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) {
      handleSubmit(e);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="flex gap-3 items-end">
      <div className="flex-1">
        <Textarea
          autoFocus
          placeholder="Describe the task for a new agent... (Ctrl+Enter to submit)"
          value={instruction}
          onChange={(e) => setInstruction(e.target.value)}
          onKeyDown={handleKeyDown}
          className="min-h-[80px] resize-none"
        />
      </div>
      <Button
        type="submit"
        disabled={creating || !instruction.trim()}
        size="lg"
        className="h-[80px] px-6"
      >
        {creating ? (
          <span className="animate-pulse">...</span>
        ) : (
          <>
            <Plus className="h-5 w-5 mr-2" />
            <Send className="h-4 w-4" />
          </>
        )}
      </Button>
    </form>
  );
}
