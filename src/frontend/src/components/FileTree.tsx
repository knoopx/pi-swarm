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
} from "lucide-react";
import { cn } from "src/lib/utils";
import { Input } from "./ui/input";
import { Button } from "./ui/button";
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
}

interface FileTreeProps {
  files: { path: string }[];
  expandedPaths: Set<string>;
  onToggleExpand: (path: string) => void;
  onSelectFile: (path: string) => void;
  selectedFile?: string;
  className?: string;
}

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

function buildFileTree(files: { path: string }[]): FileNode[] {
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
        };
        currentLevel.push(node);
        currentLevel.sort((a, b) => {
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
}: {
  node: FileNode;
  level?: number;
  expandedPaths: Set<string>;
  onToggleExpand: (path: string) => void;
  onSelectFile: (path: string) => void;
  selectedFile?: string;
  searchTerm: string;
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
            className={cn(
              "group flex w-full items-center gap-1.5 rounded-md px-2 py-1 text-left text-sm transition-colors",
              "hover:bg-muted/60",
              "focus:outline-none focus:ring-2 focus:ring-primary/50 focus:bg-muted/60",
              isSelected && "bg-primary/10 text-primary",
              "min-w-0",
            )}
            style={{ paddingLeft: `${level * 8 + 4}px` }}
          >
            {node.type === "directory" ? (
              <>
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    onToggleExpand(node.path);
                  }}
                  className="flex items-center justify-center w-4 h-4 flex-shrink-0"
                  aria-label={isExpanded ? "Collapse" : "Expand"}
                >
                  {hasChildren ? (
                    isExpanded ? (
                      <ChevronDown className="h-3 w-3 text-muted-foreground" />
                    ) : (
                      <ChevronRight className="h-3 w-3 text-muted-foreground" />
                    )
                  ) : (
                    <div className="w-3 h-3" />
                  )}
                </button>
                {isExpanded ? (
                  <FolderOpen className="h-4 w-4 text-blue-500 flex-shrink-0" />
                ) : (
                  <Folder className="h-4 w-4 text-blue-500 flex-shrink-0" />
                )}
              </>
            ) : (
              <>
                <div className="w-4 h-4 flex-shrink-0" />
                <div className="text-muted-foreground flex-shrink-0">
                  {getFileIcon(node.name)}
                </div>
              </>
            )}

            <Tooltip>
              <TooltipTrigger asChild>
                <span className="truncate flex-1 select-none">{node.name}</span>
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

      {node.type === "directory" && isExpanded && node.children && (
        <div>
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
      <div className="p-2 border-b">
        <div className="relative">
          <Search className="absolute left-2 top-1/2 transform -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
          <Input
            type="text"
            placeholder="Search files..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="pl-7 pr-7 h-7 text-sm"
          />
          {searchTerm && (
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setSearchTerm("")}
              className="absolute right-0.5 top-1/2 transform -translate-y-1/2 h-6 w-6 p-0"
            >
              <X className="h-3 w-3" />
            </Button>
          )}
        </div>
      </div>

      <div className="flex-1 overflow-auto">
        <div className="p-1">
          {treeData.map((node) => (
            <FileTreeNode
              key={node.path}
              node={node}
              expandedPaths={expandedPaths}
              onToggleExpand={onToggleExpand}
              onSelectFile={onSelectFile}
              selectedFile={selectedFile}
              searchTerm={searchTerm}
            />
          ))}
        </div>
      </div>
    </div>
  );
}
