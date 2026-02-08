import { useState, useMemo } from "react";
import {
  MessageSquare,
  Send,
  X,
  Plus,
  ChevronDown,
  ChevronRight,
  Columns,
  Rows,
} from "lucide-react";
import { Button } from "./ui/button";
import { Textarea } from "./ui/textarea";
import { ScrollArea } from "./ui/scroll-area";
import { Badge } from "./ui/badge";
import { ButtonGroup } from "./ui/button-group";

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
  startLineOld: number;
  startLineNew: number;
  lines: DiffLine[];
}

interface DiffLine {
  type: "add" | "remove" | "context";
  content: string;
  oldLineNumber: number | null;
  newLineNumber: number | null;
}

interface SplitLine {
  left: DiffLine | null;
  right: DiffLine | null;
}

function parseDiff(diff: string): DiffFile[] {
  const files: DiffFile[] = [];
  if (!diff) return files;

  const lines = diff.split("\n");
  let currentFile: DiffFile | null = null;
  let currentHunk: DiffHunk | null = null;
  let oldLineNumber = 0;
  let newLineNumber = 0;

  for (const line of lines) {
    if (line.startsWith("diff --git") || line.startsWith("===")) {
      if (currentFile) files.push(currentFile);
      currentFile = { path: "", hunks: [] };
      currentHunk = null;
      continue;
    }

    if (line.startsWith("+++ ") && currentFile) {
      currentFile.path = line.slice(4).replace(/^[ab]\//, "");
      continue;
    }

    if (line.startsWith("@@") && currentFile) {
      const match = line.match(/@@ -(\d+)(?:,\d+)? \+(\d+)/);
      oldLineNumber = match ? parseInt(match[1]) - 1 : 0;
      newLineNumber = match ? parseInt(match[2]) - 1 : 0;
      currentHunk = {
        header: line,
        startLineOld: oldLineNumber + 1,
        startLineNew: newLineNumber + 1,
        lines: [],
      };
      currentFile.hunks.push(currentHunk);
      continue;
    }

    if (currentHunk) {
      if (line.startsWith("+")) {
        newLineNumber++;
        currentHunk.lines.push({
          type: "add",
          content: line.slice(1),
          oldLineNumber: null,
          newLineNumber,
        });
      } else if (line.startsWith("-")) {
        oldLineNumber++;
        currentHunk.lines.push({
          type: "remove",
          content: line.slice(1),
          oldLineNumber,
          newLineNumber: null,
        });
      } else if (line.startsWith(" ") || line === "") {
        oldLineNumber++;
        newLineNumber++;
        currentHunk.lines.push({
          type: "context",
          content: line.slice(1) || "",
          oldLineNumber,
          newLineNumber,
        });
      }
    }
  }

  if (currentFile && currentFile.path) files.push(currentFile);
  return files;
}

// Convert unified diff lines to split view pairs
function toSplitLines(lines: DiffLine[]): SplitLine[] {
  const result: SplitLine[] = [];
  let i = 0;

  while (i < lines.length) {
    const line = lines[i];

    if (line.type === "context") {
      result.push({ left: line, right: line });
      i++;
    } else if (line.type === "remove") {
      // Check if next line is an add (modification)
      const nextLine = lines[i + 1];
      if (nextLine && nextLine.type === "add") {
        result.push({ left: line, right: nextLine });
        i += 2;
      } else {
        result.push({ left: line, right: null });
        i++;
      }
    } else if (line.type === "add") {
      result.push({ left: null, right: line });
      i++;
    } else {
      i++;
    }
  }

  return result;
}

const typeColors = {
  issue: "bg-base08/20 text-base08 border-base08/30",
  suggestion: "bg-base0C/20 text-base0C border-base0C/30",
  question: "bg-base09/20 text-base09 border-base09/30",
};

type ViewMode = "unified" | "split";

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
  const [viewMode, setViewMode] = useState<ViewMode>("unified");

  const files = useMemo(() => parseDiff(diff), [diff]);

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
            {files.length} file{files.length !== 1 ? "s" : ""} changed
          </span>
          <div className="flex items-center gap-2">
            <span className="text-xs text-muted-foreground">
              Click + to add comment
            </span>
            <ButtonGroup>
              <Button
                variant={viewMode === "unified" ? "secondary" : "ghost"}
                size="sm"
                onClick={() => setViewMode("unified")}
                className="h-7 px-2"
              >
                <Rows className="h-3.5 w-3.5" />
              </Button>
              <Button
                variant={viewMode === "split" ? "secondary" : "ghost"}
                size="sm"
                onClick={() => setViewMode("split")}
                className="h-7 px-2"
              >
                <Columns className="h-3.5 w-3.5" />
              </Button>
            </ButtonGroup>
          </div>
        </div>
        <ScrollArea className="flex-1">
          <div className="p-2">
            {files.map((file) => (
              <div
                key={file.path}
                className="mb-4 rounded-lg border overflow-hidden"
              >
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
                      {comments.filter((c) => c.file === file.path).length}
                    </Badge>
                  )}
                </button>

                {expandedFiles.has(file.path) && (
                  <div className="text-xs font-mono">
                    {file.hunks.map((hunk, hi) => (
                      <div key={hi}>
                        <div className="px-3 py-1 bg-base0C/10 text-base0C text-xs">
                          {hunk.header}
                        </div>
                        {viewMode === "unified" ? (
                          <UnifiedView
                            hunk={hunk}
                            file={file}
                            activeComment={activeComment}
                            setActiveComment={setActiveComment}
                            getLineComments={getLineComments}
                            removeComment={removeComment}
                            commentText={commentText}
                            setCommentText={setCommentText}
                            commentType={commentType}
                            setCommentType={setCommentType}
                            addComment={addComment}
                          />
                        ) : (
                          <SplitView
                            hunk={hunk}
                            file={file}
                            activeComment={activeComment}
                            setActiveComment={setActiveComment}
                            getLineComments={getLineComments}
                            removeComment={removeComment}
                            commentText={commentText}
                            setCommentText={setCommentText}
                            commentType={commentType}
                            setCommentType={setCommentType}
                            addComment={addComment}
                          />
                        )}
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
              Send {comments.length} comment{comments.length !== 1 ? "s" : ""}
            </Button>
          </div>
        )}
      </div>
    </div>
  );
}

// Shared props for view components
interface ViewProps {
  hunk: DiffHunk;
  file: DiffFile;
  activeComment: {
    file: string;
    lineNumber: number;
    lineContent: string;
  } | null;
  setActiveComment: (
    comment: { file: string; lineNumber: number; lineContent: string } | null,
  ) => void;
  getLineComments: (file: string, lineNumber: number | null) => ReviewComment[];
  removeComment: (id: string) => void;
  commentText: string;
  setCommentText: (text: string) => void;
  commentType: ReviewComment["type"];
  setCommentType: (type: ReviewComment["type"]) => void;
  addComment: () => void;
}

function UnifiedView({
  hunk,
  file,
  activeComment,
  setActiveComment,
  getLineComments,
  removeComment,
  commentText,
  setCommentText,
  commentType,
  setCommentType,
  addComment,
}: ViewProps) {
  return (
    <>
      {hunk.lines.map((line, li) => {
        const lineNumber = line.newLineNumber ?? line.oldLineNumber;
        const lineComments = getLineComments(file.path, lineNumber);
        const isActive =
          activeComment?.file === file.path &&
          activeComment?.lineNumber === lineNumber;

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
              <div className="w-12 px-2 py-0.5 text-right text-muted-foreground border-r border-border shrink-0">
                {lineNumber || ""}
              </div>

              <button
                onClick={() => {
                  if (lineNumber) {
                    setActiveComment({
                      file: file.path,
                      lineNumber,
                      lineContent: line.content,
                    });
                  }
                }}
                className="w-6 flex items-center justify-center opacity-0 group-hover:opacity-100 hover:bg-primary/20 shrink-0"
              >
                <Plus className="h-3 w-3 text-primary" />
              </button>

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

              {lineComments.length > 0 && (
                <div className="w-6 flex items-center justify-center shrink-0">
                  <MessageSquare className="h-3 w-3 text-primary" />
                </div>
              )}
            </div>

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

            {isActive && (
              <CommentInput
                commentText={commentText}
                setCommentText={setCommentText}
                commentType={commentType}
                setCommentType={setCommentType}
                addComment={addComment}
                onCancel={() => {
                  setActiveComment(null);
                  setCommentText("");
                }}
              />
            )}
          </div>
        );
      })}
    </>
  );
}

function SplitView({
  hunk,
  file,
  activeComment,
  setActiveComment,
  getLineComments,
  removeComment,
  commentText,
  setCommentText,
  commentType,
  setCommentType,
  addComment,
}: ViewProps) {
  const splitLines = useMemo(() => toSplitLines(hunk.lines), [hunk.lines]);

  return (
    <>
      {splitLines.map((pair, pi) => {
        const leftLineNumber = pair.left?.oldLineNumber;
        const rightLineNumber = pair.right?.newLineNumber;
        const leftComments = getLineComments(file.path, leftLineNumber ?? null);
        const rightComments = getLineComments(
          file.path,
          rightLineNumber ?? null,
        );
        const isLeftActive =
          activeComment?.file === file.path &&
          activeComment?.lineNumber === leftLineNumber;
        const isRightActive =
          activeComment?.file === file.path &&
          activeComment?.lineNumber === rightLineNumber;

        return (
          <div key={pi}>
            <div className="flex">
              {/* Left side (old) */}
              <div
                className={`flex-1 flex items-stretch border-r ${
                  pair.left?.type === "remove"
                    ? "bg-base08/10"
                    : pair.left?.type === "context"
                      ? ""
                      : "bg-muted/20"
                } ${isLeftActive ? "ring-1 ring-primary" : ""}`}
              >
                <div className="w-10 px-1 py-0.5 text-right text-muted-foreground border-r border-border shrink-0 text-xs">
                  {leftLineNumber || ""}
                </div>
                {pair.left && (
                  <button
                    onClick={() => {
                      if (leftLineNumber) {
                        setActiveComment({
                          file: file.path,
                          lineNumber: leftLineNumber,
                          lineContent: pair.left!.content,
                        });
                      }
                    }}
                    className="w-5 flex items-center justify-center opacity-0 hover:opacity-100 hover:bg-primary/20 shrink-0 group-hover:opacity-100"
                  >
                    <Plus className="h-3 w-3 text-primary" />
                  </button>
                )}
                <div className="flex-1 px-1 py-0.5 whitespace-pre overflow-x-auto">
                  <span
                    className={
                      pair.left?.type === "remove" ? "text-base08" : ""
                    }
                  >
                    {pair.left?.content ?? ""}
                  </span>
                </div>
              </div>

              {/* Right side (new) */}
              <div
                className={`flex-1 flex items-stretch ${
                  pair.right?.type === "add"
                    ? "bg-base0B/10"
                    : pair.right?.type === "context"
                      ? ""
                      : "bg-muted/20"
                } ${isRightActive ? "ring-1 ring-primary" : ""}`}
              >
                <div className="w-10 px-1 py-0.5 text-right text-muted-foreground border-r border-border shrink-0 text-xs">
                  {rightLineNumber || ""}
                </div>
                {pair.right && (
                  <button
                    onClick={() => {
                      if (rightLineNumber) {
                        setActiveComment({
                          file: file.path,
                          lineNumber: rightLineNumber,
                          lineContent: pair.right!.content,
                        });
                      }
                    }}
                    className="w-5 flex items-center justify-center opacity-0 hover:opacity-100 hover:bg-primary/20 shrink-0"
                  >
                    <Plus className="h-3 w-3 text-primary" />
                  </button>
                )}
                <div className="flex-1 px-1 py-0.5 whitespace-pre overflow-x-auto">
                  <span
                    className={pair.right?.type === "add" ? "text-base0B" : ""}
                  >
                    {pair.right?.content ?? ""}
                  </span>
                </div>
                {rightComments.length > 0 && (
                  <div className="w-5 flex items-center justify-center shrink-0">
                    <MessageSquare className="h-3 w-3 text-primary" />
                  </div>
                )}
              </div>
            </div>

            {/* Comments for left side */}
            {leftComments.map((c) => (
              <div
                key={c.id}
                className={`ml-10 mr-2 my-1 p-2 rounded border ${typeColors[c.type]}`}
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

            {/* Comments for right side */}
            {rightComments.map((c) => (
              <div
                key={c.id}
                className={`ml-10 mr-2 my-1 p-2 rounded border ${typeColors[c.type]}`}
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

            {isLeftActive && (
              <CommentInput
                commentText={commentText}
                setCommentText={setCommentText}
                commentType={commentType}
                setCommentType={setCommentType}
                addComment={addComment}
                onCancel={() => {
                  setActiveComment(null);
                  setCommentText("");
                }}
              />
            )}

            {isRightActive && !isLeftActive && (
              <CommentInput
                commentText={commentText}
                setCommentText={setCommentText}
                commentType={commentType}
                setCommentType={setCommentType}
                addComment={addComment}
                onCancel={() => {
                  setActiveComment(null);
                  setCommentText("");
                }}
              />
            )}
          </div>
        );
      })}
    </>
  );
}

function CommentInput({
  commentText,
  setCommentText,
  commentType,
  setCommentType,
  addComment,
  onCancel,
}: {
  commentText: string;
  setCommentText: (text: string) => void;
  commentType: ReviewComment["type"];
  setCommentType: (type: ReviewComment["type"]) => void;
  addComment: () => void;
  onCancel: () => void;
}) {
  return (
    <div className="mx-2 my-2 p-2 rounded border bg-card">
      <div className="flex gap-1 mb-2">
        {(["issue", "suggestion", "question"] as const).map((t) => (
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
        onChange={(e) => setCommentText(e.target.value)}
        placeholder="Add your comment..."
        className="min-h-[60px] text-sm mb-2"
        autoFocus
      />
      <div className="flex gap-2">
        <Button size="sm" onClick={addComment} disabled={!commentText.trim()}>
          Add
        </Button>
        <Button size="sm" variant="ghost" onClick={onCancel}>
          Cancel
        </Button>
      </div>
    </div>
  );
}
