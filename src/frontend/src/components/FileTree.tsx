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
              "file-tree-node",
              isSelected && "file-tree-node-selected",
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
                  className="file-tree-expand-btn"
                  aria-label={isExpanded ? "Collapse" : "Expand"}
                >
                  {hasChildren ? (
                    isExpanded ? (
                      <ChevronDown className="file-tree-expand-icon" />
                    ) : (
                      <ChevronRight className="file-tree-expand-icon" />
                    )
                  ) : (
                    <div className="w-3 h-3" />
                  )}
                </button>
                {isExpanded ? (
                  <FolderOpen className="file-tree-folder-icon" />
                ) : (
                  <Folder className="file-tree-folder-icon" />
                )}
              </>
            ) : (
              <>
                <div className="w-4 h-4 flex-shrink-0" />
                <div className="file-tree-file-icon-wrapper">
                  {getFileIcon(node.name)}
                </div>
              </>
            )}

            <Tooltip>
              <TooltipTrigger asChild>
                <span className="file-tree-node-name">{node.name}</span>
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
      <div className={cn("file-tree-empty", className)}>
        <File className="file-tree-empty-icon" />
        <p className="file-tree-empty-text">No files to display</p>
      </div>
    );
  }

  return (
    <div className={cn("file-tree-container", className)}>
      <div className="file-tree-search">
        <div className="file-tree-search-wrapper">
          <Search className="file-tree-search-icon" />
          <Input
            type="text"
            placeholder="Search files..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="file-tree-search-input"
          />
          {searchTerm && (
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setSearchTerm("")}
              className="file-tree-search-clear"
            >
              <X className="h-3 w-3" />
            </Button>
          )}
        </div>
      </div>

      <div className="file-tree-content">
        <div className="file-tree-items">
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
