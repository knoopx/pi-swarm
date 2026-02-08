import { useEffect } from "react";

interface UseKeyboardShortcutsOptions {
  selectedId: string | null;
  setSelectedId: (id: string | null) => void;
  setCommandBarOpen: (open: boolean) => void;
  setActiveTab: (updater: (prev: string) => string) => void;
  instructionInputRef: React.RefObject<HTMLTextAreaElement | null>;
}

export function useKeyboardShortcuts({
  selectedId,
  setSelectedId,
  setCommandBarOpen,
  setActiveTab,
  instructionInputRef,
}: UseKeyboardShortcutsOptions) {
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Cmd/Ctrl + K - Open command bar
      if ((e.metaKey || e.ctrlKey) && e.key === "k") {
        e.preventDefault();
        setCommandBarOpen(true);
        return;
      }

      // Don't trigger shortcuts when typing in inputs
      const target = e.target as HTMLElement;
      if (
        target.tagName === "INPUT" ||
        target.tagName === "TEXTAREA" ||
        target.isContentEditable
      ) {
        return;
      }

      // N - New task (focus instruction input)
      if (e.key === "n" && !e.metaKey && !e.ctrlKey) {
        e.preventDefault();
        instructionInputRef.current?.focus();
        return;
      }

      // Escape - Close selected agent
      if (e.key === "Escape" && selectedId) {
        e.preventDefault();
        setSelectedId(null);
        return;
      }

      // R - Toggle review tab
      if (e.key === "r" && selectedId) {
        e.preventDefault();
        setActiveTab((prev) => (prev === "review" ? "output" : "review"));
        return;
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [
    selectedId,
    setSelectedId,
    setCommandBarOpen,
    setActiveTab,
    instructionInputRef,
  ]);
}
