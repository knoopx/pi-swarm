import React, { useMemo } from "react";
import {
  ChevronDown,
  ChevronRight,
  File,
  Folder,
  FolderOpen,
} from "lucide-react";
import { cn } from "src/lib/utils";

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
}: {
  node: FileNode;
  level?: number;
  expandedPaths: Set<string>;
  onToggleExpand: (path: string) => void;
  onSelectFile: (path: string) => void;
  selectedFile?: string;
}) {
  const isExpanded = expandedPaths.has(node.path);
  const isSelected = selectedFile === node.path;
  const hasChildren = node.children && node.children.length > 0;

  return (
    <div>
      <button
        onClick={() => {
          if (node.type === "directory") {
            onToggleExpand(node.path);
          } else {
            onSelectFile(node.path);
          }
        }}
        className={cn(
          "flex w-full items-center gap-1 rounded px-2 py-1 text-left text-sm hover:bg-muted/50",
          isSelected && "bg-muted",
          level > 0 && "ml-4",
        )}
        style={{ paddingLeft: `${level * 16 + 8}px` }}
      >
        {node.type === "directory" ? (
          <>
            {hasChildren ? (
              isExpanded ? (
                <ChevronDown className="h-3 w-3 shrink-0" />
              ) : (
                <ChevronRight className="h-3 w-3 shrink-0" />
              )
            ) : (
              <div className="h-3 w-3 shrink-0" />
            )}
            {isExpanded ? (
              <FolderOpen className="h-3 w-3 shrink-0 text-blue-500" />
            ) : (
              <Folder className="h-3 w-3 shrink-0 text-blue-500" />
            )}
          </>
        ) : (
          <>
            <div className="h-3 w-3 shrink-0" />
            <File className="h-3 w-3 shrink-0 text-gray-500" />
          </>
        )}
        <span className="truncate flex-1">{node.name}</span>
        {node.commentCount && node.commentCount > 0 && (
          <span className="ml-1 rounded-full bg-primary px-1.5 py-0.5 text-xs text-primary-foreground">
            {node.commentCount}
          </span>
        )}
      </button>

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
  const treeData = useMemo(() => buildFileTree(files), [files]);

  if (treeData.length === 0) {
    return (
      <div className={cn("p-4 text-center text-muted-foreground", className)}>
        No files to display
      </div>
    );
  }

  return (
    <div className={cn("overflow-auto", className)}>
      {treeData.map((node) => (
        <FileTreeNode
          key={node.path}
          node={node}
          expandedPaths={expandedPaths}
          onToggleExpand={onToggleExpand}
          onSelectFile={onSelectFile}
          selectedFile={selectedFile}
        />
      ))}
    </div>
  );
}
