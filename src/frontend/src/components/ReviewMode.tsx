import { useState, useMemo } from "react";
import {
  MessageSquare,
  Send,
  X,
  Plus,
  ChevronDown,
  ChevronRight,
} from "lucide-react";
import { Button } from "./ui/button";
import { Textarea } from "./ui/textarea";
import { ScrollArea } from "./ui/scroll-area";
import { Badge } from "./ui/badge";

interface ReviewModeProps {
  diff: string;
  onSubmitReview: (comments: ReviewComment[]) => void;
  className?: string;
}

export interface ReviewComment {
  id: string;
  file: string;
  lineNumber: number;
  lineContent: string;
  comment: string;
  type: "issue" | "suggestion" | "question";
}

interface DiffFile {
  path: string;
  hunks: DiffHunk[];
}

interface DiffHunk {
  header: string;
  startLine: number;
  lines: DiffLine[];
}

interface DiffLine {
  type: "add" | "remove" | "context" | "header";
  content: string;
  lineNumber: number | null;
}

function parseDiff(diff: string): DiffFile[] {
  const files: DiffFile[] = [];
  if (!diff) return files;

  const lines = diff.split("\n");
  let currentFile: DiffFile | null = null;
  let currentHunk: DiffHunk | null = null;
  let lineNumber = 0;

  for (const line of lines) {
    // New file
    if (line.startsWith("diff --git") || line.startsWith("===")) {
      if (currentFile) files.push(currentFile);
      currentFile = { path: "", hunks: [] };
      currentHunk = null;
      continue;
    }

    // File path
    if (line.startsWith("+++ ") && currentFile) {
      currentFile.path = line.slice(4).replace(/^[ab]\//, "");
      continue;
    }

    // Hunk header
    if (line.startsWith("@@") && currentFile) {
      const match = line.match(/@@ -\d+(?:,\d+)? \+(\d+)/);
      lineNumber = match ? parseInt(match[1]) - 1 : 0;
      currentHunk = { header: line, startLine: lineNumber + 1, lines: [] };
      currentFile.hunks.push(currentHunk);
      continue;
    }

    // Diff lines
    if (currentHunk) {
      if (line.startsWith("+")) {
        lineNumber++;
        currentHunk.lines.push({
          type: "add",
          content: line.slice(1),
          lineNumber,
        });
      } else if (line.startsWith("-")) {
        currentHunk.lines.push({
          type: "remove",
          content: line.slice(1),
          lineNumber: null,
        });
      } else if (line.startsWith(" ") || line === "") {
        lineNumber++;
        currentHunk.lines.push({
          type: "context",
          content: line.slice(1) || "",
          lineNumber,
        });
      }
    }
  }

  if (currentFile && currentFile.path) files.push(currentFile);
  return files;
}

const typeColors = {
  issue: "bg-base08/20 text-base08 border-base08/30",
  suggestion: "bg-base0C/20 text-base0C border-base0C/30",
  question: "bg-base09/20 text-base09 border-base09/30",
};

export function ReviewMode({
  diff,
  onSubmitReview,
  className,
}: ReviewModeProps) {
  const [comments, setComments] = useState<ReviewComment[]>([]);
  const [activeComment, setActiveComment] = useState<{
    file: string;
    lineNumber: number;
    lineContent: string;
  } | null>(null);
  const [commentText, setCommentText] = useState("");
  const [commentType, setCommentType] =
    useState<ReviewComment["type"]>("issue");
  const [expandedFiles, setExpandedFiles] = useState<Set<string>>(new Set());

  const files = useMemo(() => parseDiff(diff), [diff]);

  // Auto-expand all files initially
  useMemo(() => {
    if (files.length > 0 && expandedFiles.size === 0) {
      setExpandedFiles(new Set(files.map((f) => f.path)));
    }
  }, [files]);

  const toggleFile = (path: string) => {
    const next = new Set(expandedFiles);
    if (next.has(path)) {
      next.delete(path);
    } else {
      next.add(path);
    }
    setExpandedFiles(next);
  };

  const addComment = () => {
    if (!activeComment || !commentText.trim()) return;

    const newComment: ReviewComment = {
      id: crypto.randomUUID(),
      file: activeComment.file,
      lineNumber: activeComment.lineNumber,
      lineContent: activeComment.lineContent,
      comment: commentText,
      type: commentType,
    };

    setComments([...comments, newComment]);
    setActiveComment(null);
    setCommentText("");
  };

  const removeComment = (id: string) => {
    setComments(comments.filter((c) => c.id !== id));
  };

  const handleSubmit = () => {
    if (comments.length === 0) return;
    onSubmitReview(comments);
    setComments([]);
  };

  const getLineComments = (file: string, lineNumber: number | null) => {
    if (lineNumber === null) return [];
    return comments.filter(
      (c) => c.file === file && c.lineNumber === lineNumber,
    );
  };

  if (!diff) {
    return (
      <div className={`flex items-center justify-center ${className}`}>
        <p className="text-muted-foreground">No changes to review</p>
      </div>
    );
  }

  return (
    <div className={`flex ${className}`}>
      {/* Diff View */}
      <div className="flex-1 flex flex-col overflow-hidden border-r">
        <div className="p-2 border-b bg-muted/30 flex items-center justify-between">
          <span className="text-sm font-medium">
            {files.length} files changed
          </span>
          <span className="text-xs text-muted-foreground">
            Click + to add comment
          </span>
        </div>
        <ScrollArea className="flex-1">
          <div className="p-2">
            {files.map((file) => (
              <div
                key={file.path}
                className="mb-4 rounded-lg border overflow-hidden"
              >
                {/* File Header */}
                <button
                  onClick={() => toggleFile(file.path)}
                  className="w-full flex items-center gap-2 px-3 py-2 bg-muted/50 hover:bg-muted/70 text-left"
                >
                  {expandedFiles.has(file.path) ? (
                    <ChevronDown className="h-4 w-4" />
                  ) : (
                    <ChevronRight className="h-4 w-4" />
                  )}
                  <span className="font-mono text-sm flex-1 truncate">
                    {file.path}
                  </span>
                  {comments.filter((c) => c.file === file.path).length > 0 && (
                    <Badge variant="secondary" className="text-xs">
                      {comments.filter((c) => c.file === file.path).length}{" "}
                      comments
                    </Badge>
                  )}
                </button>

                {/* File Content */}
                {expandedFiles.has(file.path) && (
                  <div className="text-xs font-mono">
                    {file.hunks.map((hunk, hi) => (
                      <div key={hi}>
                        <div className="px-3 py-1 bg-base0C/10 text-base0C text-xs">
                          {hunk.header}
                        </div>
                        {hunk.lines.map((line, li) => {
                          const lineComments = getLineComments(
                            file.path,
                            line.lineNumber,
                          );
                          const isActive =
                            activeComment?.file === file.path &&
                            activeComment?.lineNumber === line.lineNumber;

                          return (
                            <div key={li}>
                              <div
                                className={`group flex items-stretch hover:bg-muted/30 ${
                                  line.type === "add"
                                    ? "bg-base0B/10"
                                    : line.type === "remove"
                                      ? "bg-base08/10"
                                      : ""
                                } ${isActive ? "ring-1 ring-primary" : ""}`}
                              >
                                {/* Line number */}
                                <div className="w-12 px-2 py-0.5 text-right text-muted-foreground border-r border-border shrink-0">
                                  {line.lineNumber || ""}
                                </div>

                                {/* Add comment button */}
                                <button
                                  onClick={() => {
                                    if (line.lineNumber) {
                                      setActiveComment({
                                        file: file.path,
                                        lineNumber: line.lineNumber,
                                        lineContent: line.content,
                                      });
                                    }
                                  }}
                                  className="w-6 flex items-center justify-center opacity-0 group-hover:opacity-100 hover:bg-primary/20 shrink-0"
                                >
                                  <Plus className="h-3 w-3 text-primary" />
                                </button>

                                {/* Line content */}
                                <div className="flex-1 px-2 py-0.5 whitespace-pre overflow-x-auto">
                                  <span
                                    className={
                                      line.type === "add"
                                        ? "text-base0B"
                                        : line.type === "remove"
                                          ? "text-base08"
                                          : ""
                                    }
                                  >
                                    {line.type === "add"
                                      ? "+"
                                      : line.type === "remove"
                                        ? "-"
                                        : " "}
                                    {line.content}
                                  </span>
                                </div>

                                {/* Comment indicator */}
                                {lineComments.length > 0 && (
                                  <div className="w-6 flex items-center justify-center shrink-0">
                                    <MessageSquare className="h-3 w-3 text-primary" />
                                  </div>
                                )}
                              </div>

                              {/* Inline comments */}
                              {lineComments.map((c) => (
                                <div
                                  key={c.id}
                                  className={`ml-12 mr-2 my-1 p-2 rounded border ${typeColors[c.type]}`}
                                >
                                  <div className="flex items-start justify-between gap-2">
                                    <p className="text-sm">{c.comment}</p>
                                    <button
                                      onClick={() => removeComment(c.id)}
                                      className="text-muted-foreground hover:text-foreground"
                                    >
                                      <X className="h-3 w-3" />
                                    </button>
                                  </div>
                                </div>
                              ))}

                              {/* Active comment input */}
                              {isActive && (
                                <div className="ml-12 mr-2 my-2 p-2 rounded border bg-card">
                                  <div className="flex gap-1 mb-2">
                                    {(
                                      [
                                        "issue",
                                        "suggestion",
                                        "question",
                                      ] as const
                                    ).map((t) => (
                                      <button
                                        key={t}
                                        onClick={() => setCommentType(t)}
                                        className={`px-2 py-0.5 rounded text-xs ${
                                          commentType === t
                                            ? typeColors[t]
                                            : "bg-muted text-muted-foreground"
                                        }`}
                                      >
                                        {t}
                                      </button>
                                    ))}
                                  </div>
                                  <Textarea
                                    value={commentText}
                                    onChange={(e) =>
                                      setCommentText(e.target.value)
                                    }
                                    placeholder="Add your comment..."
                                    className="min-h-[60px] text-sm mb-2"
                                    autoFocus
                                  />
                                  <div className="flex gap-2">
                                    <Button
                                      size="sm"
                                      onClick={addComment}
                                      disabled={!commentText.trim()}
                                    >
                                      Add
                                    </Button>
                                    <Button
                                      size="sm"
                                      variant="ghost"
                                      onClick={() => {
                                        setActiveComment(null);
                                        setCommentText("");
                                      }}
                                    >
                                      Cancel
                                    </Button>
                                  </div>
                                </div>
                              )}
                            </div>
                          );
                        })}
                      </div>
                    ))}
                  </div>
                )}
              </div>
            ))}
          </div>
        </ScrollArea>
      </div>

      {/* Comments Panel */}
      <div className="w-80 flex flex-col bg-card/30 shrink-0">
        <div className="p-3 border-b flex items-center justify-between">
          <span className="font-medium">Review Comments</span>
          <Badge variant="secondary">{comments.length}</Badge>
        </div>

        <ScrollArea className="flex-1">
          <div className="p-2 space-y-2">
            {comments.length === 0 ? (
              <p className="text-sm text-muted-foreground text-center py-4">
                Click + on any line to add a comment
              </p>
            ) : (
              comments.map((c) => (
                <div
                  key={c.id}
                  className={`p-2 rounded border ${typeColors[c.type]}`}
                >
                  <div className="flex items-start justify-between gap-2 mb-1">
                    <span className="text-xs font-mono truncate">
                      {c.file}:{c.lineNumber}
                    </span>
                    <button
                      onClick={() => removeComment(c.id)}
                      className="text-muted-foreground hover:text-foreground"
                    >
                      <X className="h-3 w-3" />
                    </button>
                  </div>
                  <p className="text-sm">{c.comment}</p>
                </div>
              ))
            )}
          </div>
        </ScrollArea>

        {comments.length > 0 && (
          <div className="p-3 border-t">
            <Button onClick={handleSubmit} className="w-full">
              <Send className="h-4 w-4 mr-2" />
              Send {comments.length} comment{comments.length !== 1 ? "s" : ""}{" "}
              to Agent
            </Button>
          </div>
        )}
      </div>
    </div>
  );
}
