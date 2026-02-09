import { useMemo, useState, useCallback } from "react";
import {
  ChevronDown,
  ChevronRight,
  File,
  Folder,
  FolderOpen,
  FileText,
  FileCode,
  FileImage,
  FileVideo,
  FileAudio,
  Archive,
  Search,
  X,
  MoreHorizontal,
} from "lucide-react";
import { cn } from "src/lib/utils";
import { Input } from "./ui/input";
import { Button } from "./ui/button";
import { Badge } from "./ui/badge";
import {
  ContextMenu,
  ContextMenuContent,
  ContextMenuItem,
  ContextMenuTrigger,
} from "./ui/context-menu";
import { Tooltip, TooltipContent, TooltipTrigger } from "./ui/tooltip";

interface FileNode {
  name: string;
  path: string;
  type: "file" | "directory";
  children?: FileNode[];
  commentCount?: number;
}

interface FileTreeProps {
  files: { path: string; commentCount?: number }[];
  expandedPaths: Set<string>;
  onToggleExpand: (path: string) => void;
  onSelectFile: (path: string) => void;
  selectedFile?: string;
  className?: string;
}

// Get file icon based on extension
function getFileIcon(filename: string) {
  const ext = filename.split(".").pop()?.toLowerCase();

  switch (ext) {
    case "js":
    case "jsx":
    case "ts":
    case "tsx":
    case "py":
    case "java":
    case "cpp":
    case "c":
    case "rs":
    case "go":
    case "php":
    case "rb":
    case "swift":
    case "kt":
      return <FileCode className="h-4 w-4" />;
    case "txt":
    case "md":
    case "json":
    case "yaml":
    case "yml":
    case "xml":
    case "csv":
      return <FileText className="h-4 w-4" />;
    case "png":
    case "jpg":
    case "jpeg":
    case "gif":
    case "svg":
    case "webp":
    case "ico":
      return <FileImage className="h-4 w-4" />;
    case "mp4":
    case "avi":
    case "mov":
    case "mkv":
    case "webm":
      return <FileVideo className="h-4 w-4" />;
    case "mp3":
    case "wav":
    case "flac":
    case "aac":
      return <FileAudio className="h-4 w-4" />;
    case "zip":
    case "tar":
    case "gz":
    case "rar":
    case "7z":
      return <Archive className="h-4 w-4" />;
    default:
      return <File className="h-4 w-4" />;
  }
}

function buildFileTree(
  files: { path: string; commentCount?: number }[],
): FileNode[] {
  const root: FileNode[] = [];

  for (const file of files) {
    const parts = file.path.split("/");
    let currentLevel = root;

    for (let i = 0; i < parts.length; i++) {
      const part = parts[i];
      const isLast = i === parts.length - 1;
      const currentPath = parts.slice(0, i + 1).join("/");

      let node = currentLevel.find((n) => n.name === part);

      if (!node) {
        node = {
          name: part,
          path: currentPath,
          type: isLast ? "file" : "directory",
          children: isLast ? undefined : [],
          commentCount: isLast ? file.commentCount : undefined,
        };
        currentLevel.push(node);
        currentLevel.sort((a, b) => {
          // Directories first, then files, alphabetical within each group
          if (a.type !== b.type) {
            return a.type === "directory" ? -1 : 1;
          }
          return a.name.localeCompare(b.name);
        });
      }

      if (!isLast && node.children) {
        currentLevel = node.children;
      }
    }
  }

  return root;
}

function FileTreeNode({
  node,
  level = 0,
  expandedPaths,
  onToggleExpand,
  onSelectFile,
  selectedFile,
  searchTerm,
  onContextMenu,
}: {
  node: FileNode;
  level?: number;
  expandedPaths: Set<string>;
  onToggleExpand: (path: string) => void;
  onSelectFile: (path: string) => void;
  selectedFile?: string;
  searchTerm: string;
  onContextMenu: (path: string, event: React.MouseEvent) => void;
}) {
  const isExpanded = expandedPaths.has(node.path);
  const isSelected = selectedFile === node.path;
  const hasChildren = node.children && node.children.length > 0;
  const isVisible =
    !searchTerm ||
    node.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    (node.type === "directory" &&
      node.children?.some((child) =>
        child.name.toLowerCase().includes(searchTerm.toLowerCase()),
      ));

  const handleClick = useCallback(
    (e: React.MouseEvent) => {
      e.stopPropagation();
      if (node.type === "directory") {
        onToggleExpand(node.path);
      } else {
        onSelectFile(node.path);
      }
    },
    [node, onToggleExpand, onSelectFile],
  );

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if (e.key === "Enter" || e.key === " ") {
        e.preventDefault();
        handleClick(e as any);
      }
    },
    [handleClick],
  );

  if (!isVisible) return null;

  return (
    <div>
      <ContextMenu>
        <ContextMenuTrigger>
          <div
            role="button"
            tabIndex={0}
            onClick={handleClick}
            onKeyDown={handleKeyDown}
            onContextMenu={(e) => onContextMenu(node.path, e)}
            className={cn(
              "group flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-left text-sm transition-all duration-150 ease-in-out",
              "hover:bg-muted/60 hover:shadow-sm",
              "focus:outline-none focus:ring-2 focus:ring-primary/50 focus:bg-muted/60",
              isSelected &&
                "bg-primary/10 text-primary border border-primary/20 shadow-sm",
              "min-w-0",
            )}
            style={{ paddingLeft: `${level * 10 + 8}px` }}
          >
            {/* Expand/collapse button for directories */}
            {node.type === "directory" ? (
              <div className="flex items-center gap-2 flex-shrink-0">
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    onToggleExpand(node.path);
                  }}
                  className="flex items-center justify-center w-5 h-5 rounded hover:bg-muted/80 transition-colors"
                  aria-label={isExpanded ? "Collapse" : "Expand"}
                >
                  {hasChildren ? (
                    isExpanded ? (
                      <ChevronDown className="h-3.5 w-3.5 text-muted-foreground group-hover:text-foreground transition-colors" />
                    ) : (
                      <ChevronRight className="h-3.5 w-3.5 text-muted-foreground group-hover:text-foreground transition-colors" />
                    )
                  ) : (
                    <div className="w-3.5 h-3.5" />
                  )}
                </button>
                {isExpanded ? (
                  <FolderOpen className="h-4 w-4 text-blue-500 flex-shrink-0" />
                ) : (
                  <Folder className="h-4 w-4 text-blue-500 flex-shrink-0" />
                )}
              </div>
            ) : (
              <div className="flex items-center gap-2 flex-shrink-0">
                <div className="w-5 h-5" />
                <div className="text-muted-foreground group-hover:text-foreground transition-colors">
                  {getFileIcon(node.name)}
                </div>
              </div>
            )}

            {/* File/directory name with comment count badge */}
            <Tooltip>
              <TooltipTrigger asChild>
                <span className="truncate flex-1 font-medium select-none inline-flex items-center gap-1.5">
                  {node.name}
                  {node.commentCount && node.commentCount > 0 && (
                    <Badge size="sm" className="flex-shrink-0">
                      {node.commentCount}
                    </Badge>
                  )}
                </span>
              </TooltipTrigger>
              <TooltipContent side="right" className="max-w-xs">
                {node.path}
              </TooltipContent>
            </Tooltip>
          </div>
        </ContextMenuTrigger>
        <ContextMenuContent className="w-48">
          <ContextMenuItem onClick={() => onSelectFile(node.path)}>
            Open File
          </ContextMenuItem>
          {node.type === "directory" && (
            <ContextMenuItem onClick={() => onToggleExpand(node.path)}>
              {isExpanded ? "Collapse" : "Expand"}
            </ContextMenuItem>
          )}
        </ContextMenuContent>
      </ContextMenu>

      {/* Children */}
      {node.type === "directory" && isExpanded && node.children && (
        <div className="animate-in slide-in-from-top-1 duration-150">
          {node.children.map((child) => (
            <FileTreeNode
              key={child.path}
              node={child}
              level={level + 1}
              expandedPaths={expandedPaths}
              onToggleExpand={onToggleExpand}
              onSelectFile={onSelectFile}
              selectedFile={selectedFile}
              searchTerm={searchTerm}
              onContextMenu={onContextMenu}
            />
          ))}
        </div>
      )}
    </div>
  );
}

export function FileTree({
  files,
  expandedPaths,
  onToggleExpand,
  onSelectFile,
  selectedFile,
  className,
}: FileTreeProps) {
  const [searchTerm, setSearchTerm] = useState("");

  const treeData = useMemo(() => buildFileTree(files), [files]);

  const handleContextMenu = useCallback(
    (path: string, event: React.MouseEvent) => {
      // Handle context menu logic here if needed
      console.log("Context menu for:", path);
    },
    [],
  );

  if (treeData.length === 0) {
    return (
      <div
        className={cn(
          "flex flex-col items-center justify-center p-8 text-center",
          className,
        )}
      >
        <File className="h-12 w-12 text-muted-foreground/50 mb-4" />
        <p className="text-sm text-muted-foreground">No files to display</p>
      </div>
    );
  }

  return (
    <div className={cn("flex flex-col h-full", className)}>
      {/* Search header */}
      <div className="p-3 border-b bg-muted/20">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            type="text"
            placeholder="Search files..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="pl-9 pr-9 h-8 text-sm border-muted focus:border-primary/50"
          />
          {searchTerm && (
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setSearchTerm("")}
              className="absolute right-1 top-1/2 transform -translate-y-1/2 h-6 w-6 p-0 hover:bg-muted/80"
            >
              <X className="h-3 w-3" />
            </Button>
          )}
        </div>
      </div>

      {/* Tree content */}
      <div className="flex-1 overflow-auto">
        <div className="p-2 space-y-0.5">
          {treeData.map((node) => (
            <FileTreeNode
              key={node.path}
              node={node}
              expandedPaths={expandedPaths}
              onToggleExpand={onToggleExpand}
              onSelectFile={onSelectFile}
              selectedFile={selectedFile}
              searchTerm={searchTerm}
              onContextMenu={handleContextMenu}
            />
          ))}
        </div>
      </div>
    </div>
  );
}
