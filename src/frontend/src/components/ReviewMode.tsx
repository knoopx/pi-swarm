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
import { FileTree } from "./FileTree";

interface ReviewModeProps {
  diff: string;
  onSubmitReview: (comments: ReviewComment[]) => void;
  onCommentsChange?: (comments: ReviewComment[]) => void;
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
  issue: "review-comment-type-issue",
  suggestion: "review-comment-type-suggestion",
  question: "review-comment-type-question",
};

function InlineComment({
  comment,
  onRemove,
  className = "ml-12 mr-2",
}: {
  comment: ReviewComment;
  onRemove: (id: string) => void;
  className?: string;
}) {
  return (
    <div
      className={`${className} review-inline-comment ${typeColors[comment.type]}`}
    >
      <div className="flex items-start justify-between gap-2">
        <p className="text-sm">{comment.comment}</p>
        <button
          onClick={() => onRemove(comment.id)}
          className="text-muted-foreground hover:text-foreground"
        >
          <X className="h-3 w-3" />
        </button>
      </div>
    </div>
  );
}

function InlineCommentsList({
  comments,
  onRemove,
  className,
}: {
  comments: ReviewComment[];
  onRemove: (id: string) => void;
  className?: string;
}) {
  return (
    <>
      {comments.map((c) => (
        <InlineComment
          key={c.id}
          comment={c}
          onRemove={onRemove}
          className={className}
        />
      ))}
    </>
  );
}

type ViewMode = "unified" | "split";

export function ReviewMode({
  diff,
  onSubmitReview,
  onCommentsChange,
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
  const [viewMode, setViewMode] = useState<ViewMode>("unified");
  const [selectedFile, setSelectedFile] = useState<string | undefined>();
  const [treeExpandedPaths, setTreeExpandedPaths] = useState<Set<string>>(
    new Set(),
  );

  const files = useMemo(() => parseDiff(diff), [diff]);

  // Initialize expandedFiles with all file paths (expanded by default)
  const [expandedFiles, setExpandedFiles] = useState<Set<string>>(new Set());
  useMemo(() => {
    if (files.length > 0) {
      const allFilePaths = new Set(files.map((f) => f.path));
      setExpandedFiles(allFilePaths);
    }
  }, [files]);

  const fileTreeData = useMemo(
    () =>
      files.map((file) => ({
        path: file.path,
        commentCount: comments.filter((c) => c.file === file.path).length,
      })),
    [files, comments],
  );

  // Initialize tree with all directories expanded
  useMemo(() => {
    if (files.length > 0 && treeExpandedPaths.size === 0) {
      const allDirPaths = new Set<string>();
      files.forEach((file) => {
        const parts = file.path.split("/");
        for (let i = 1; i < parts.length; i++) {
          const dirPath = parts.slice(0, i).join("/");
          allDirPaths.add(dirPath);
        }
      });
      setTreeExpandedPaths(allDirPaths);
    }
  }, [files]);

  const handleTreeToggleExpand = (path: string) => {
    const next = new Set(treeExpandedPaths);
    if (next.has(path)) {
      next.delete(path);
    } else {
      next.add(path);
    }
    setTreeExpandedPaths(next);
  };

  const handleSelectFile = (path: string) => {
    setSelectedFile(path);
    // Auto-expand the file in the diff view
    setExpandedFiles((prev) => new Set([...prev, path]));
  };

  const toggleFile = (path: string) => {
    const next = new Set(expandedFiles);
    if (next.has(path)) {
      next.delete(path);
    } else {
      next.add(path);
      setSelectedFile(path); // Sync selection when expanding in diff view
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

    const newComments = [...comments, newComment];
    setComments(newComments);
    onCommentsChange?.(newComments);
    setActiveComment(null);
    setCommentText("");
  };

  const removeComment = (id: string) => {
    const newComments = comments.filter((c) => c.id !== id);
    setComments(newComments);
    onCommentsChange?.(newComments);
  };

  const handleSubmit = () => {
    if (comments.length === 0) return;
    onSubmitReview(comments);
    const newComments: ReviewComment[] = [];
    setComments(newComments);
    onCommentsChange?.(newComments);
  };

  const getLineComments = (file: string, lineNumber: number | null) => {
    if (lineNumber === null) return [];
    return comments.filter(
      (c) => c.file === file && c.lineNumber === lineNumber,
    );
  };

  if (!diff) {
    return (
      <div className={`review-empty ${className}`}>
        <p className="text-muted-foreground">No changes to review</p>
      </div>
    );
  }

  return (
    <div className={`review-container ${className}`}>
      {/* Sidebar */}
      <div className="review-sidebar">
        <div className="flex flex-col flex-1 min-h-0">
          <div className="review-sidebar-header">
            <span className="review-sidebar-title">Files</span>
          </div>
          <ScrollArea className="flex-1">
            <FileTree
              files={fileTreeData}
              expandedPaths={treeExpandedPaths}
              onToggleExpand={handleTreeToggleExpand}
              onSelectFile={handleSelectFile}
              selectedFile={selectedFile}
            />
          </ScrollArea>
        </div>

        <div className="review-comments-panel">
          <div className="review-comments-header">
            <span className="review-comments-title">Review Comments</span>
            <Badge variant="outline">{comments.length}</Badge>
          </div>

          <ScrollArea className="flex-1 min-h-0">
            <div className="review-comments-list">
              {comments.length === 0 ? (
                <p className="review-comments-empty">No comments yet</p>
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
            <div className="review-comments-footer">
              <Button onClick={handleSubmit} className="w-full">
                <Send className="h-4 w-4 mr-2" />
                Send {comments.length} comment{comments.length !== 1 ? "s" : ""}
              </Button>
            </div>
          )}
        </div>
      </div>

      {/* Diff View */}
      <div className="review-diff-view">
        <div className="review-diff-header">
          <span className="review-diff-title">
            {files.length} file{files.length !== 1 ? "s" : ""} changed
          </span>
          <div className="review-diff-controls">
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
          <div className="review-diff-content">
            {files.map((file) => (
              <div key={file.path} className="review-file-card">
                <button
                  onClick={() => toggleFile(file.path)}
                  className="review-file-header"
                >
                  {expandedFiles.has(file.path) ? (
                    <ChevronDown className="h-4 w-4" />
                  ) : (
                    <ChevronRight className="h-4 w-4" />
                  )}
                  <span className="review-file-name">{file.path}</span>
                  {comments.filter((c) => c.file === file.path).length > 0 && (
                    <Badge variant="outline" className="text-xs">
                      {comments.filter((c) => c.file === file.path).length}
                    </Badge>
                  )}
                </button>

                {expandedFiles.has(file.path) && (
                  <div className="review-hunk">
                    {file.hunks.map((hunk, hi) => (
                      <div key={hi}>
                        <div className="review-hunk-header">{hunk.header}</div>
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
              className={`review-line group ${
                line.type === "add"
                  ? "review-line-add"
                  : line.type === "remove"
                    ? "review-line-remove"
                    : ""
              } ${isActive ? "review-line-active" : ""}`}
            >
              <div className="review-line-number">{lineNumber || ""}</div>

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
                className="review-line-add-btn"
              >
                <Plus className="h-3 w-3 text-primary" />
              </button>

              <div className="review-line-content">
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
                <div className="review-line-comment-indicator">
                  <MessageSquare className="h-3 w-3 text-primary" />
                </div>
              )}
            </div>

            <InlineCommentsList
              comments={lineComments}
              onRemove={removeComment}
            />

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
            <div className="review-split-line">
              {/* Left side (old) */}
              <div
                className={`review-split-side review-split-side-left ${
                  pair.left?.type === "remove"
                    ? "review-line-remove"
                    : pair.left?.type === "context"
                      ? ""
                      : "bg-muted/20"
                } ${isLeftActive ? "review-line-active" : ""}`}
              >
                <div className="review-split-line-number">
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
                    className="review-split-add-btn"
                  >
                    <Plus className="h-3 w-3 text-primary" />
                  </button>
                )}
                <div className="review-split-content">
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
                className={`review-split-side ${
                  pair.right?.type === "add"
                    ? "review-line-add"
                    : pair.right?.type === "context"
                      ? ""
                      : "bg-muted/20"
                } ${isRightActive ? "review-line-active" : ""}`}
              >
                <div className="review-split-line-number">
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
                    className="review-split-add-btn"
                  >
                    <Plus className="h-3 w-3 text-primary" />
                  </button>
                )}
                <div className="review-split-content">
                  <span
                    className={pair.right?.type === "add" ? "text-base0B" : ""}
                  >
                    {pair.right?.content ?? ""}
                  </span>
                </div>
                {rightComments.length > 0 && (
                  <div className="review-line-comment-indicator">
                    <MessageSquare className="h-3 w-3 text-primary" />
                  </div>
                )}
              </div>
            </div>

            {/* Comments for left side */}
            <InlineCommentsList
              comments={leftComments}
              onRemove={removeComment}
              className="ml-10 mr-2"
            />

            {/* Comments for right side */}
            <InlineCommentsList
              comments={rightComments}
              onRemove={removeComment}
              className="ml-10 mr-2"
            />

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
    <div className="review-comment-input">
      <div className="review-comment-type-selector">
        {(["issue", "suggestion", "question"] as const).map((t) => (
          <button
            key={t}
            onClick={() => setCommentType(t)}
            className={`review-comment-type-btn ${
              commentType === t
                ? typeColors[t]
                : "review-comment-type-btn-inactive"
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
        className="review-comment-textarea"
        autoFocus
      />
      <div className="review-comment-actions">
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
