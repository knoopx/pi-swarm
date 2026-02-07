import { FileCode, FilePlus, FileMinus, FileEdit } from "lucide-react";
import { ScrollArea } from "./ui/scroll-area";

interface FilesListProps {
  files: string[];
  diffStat: string;
  className?: string;
}

interface FileChange {
  path: string;
  additions: number;
  deletions: number;
  binary: boolean;
}

function parseDiffStat(diffStat: string, files: string[]): FileChange[] {
  const changes: FileChange[] = [];
  const statLines = diffStat.split("\n").filter((line) => line.includes("|"));

  // Create a map from stat lines
  const statMap = new Map<
    string,
    { additions: number; deletions: number; binary: boolean }
  >();

  for (const line of statLines) {
    // Parse lines like: "file.txt | 10 ++++++----" or "file.txt | Bin 0 -> 1234 bytes"
    const match = line.match(/^\s*(.+?)\s*\|\s*(.+)$/);
    if (match) {
      const path = match[1].trim();
      const stats = match[2].trim();

      if (stats.startsWith("Bin")) {
        statMap.set(path, { additions: 0, deletions: 0, binary: true });
      } else {
        const numMatch = stats.match(/^(\d+)/);
        const plusCount = (stats.match(/\+/g) || []).length;
        const minusCount = (stats.match(/-/g) || []).length;
        const total = numMatch ? parseInt(numMatch[1]) : plusCount + minusCount;

        // Distribute based on +/- symbols or estimate
        const additions = plusCount || Math.ceil(total / 2);
        const deletions = minusCount || Math.floor(total / 2);

        statMap.set(path, { additions, deletions, binary: false });
      }
    }
  }

  // Process all files
  for (const file of files) {
    const stat = statMap.get(file);
    if (stat) {
      changes.push({ path: file, ...stat });
    } else {
      // File in list but no stat - assume it's new or modified
      changes.push({ path: file, additions: 0, deletions: 0, binary: false });
    }
  }

  // Sort: most changes first
  changes.sort(
    (a, b) => b.additions + b.deletions - (a.additions + a.deletions),
  );

  return changes;
}

function getFileIcon(change: FileChange) {
  if (change.deletions > 0 && change.additions === 0) {
    return <FileMinus className="h-4 w-4 text-base08" />;
  }
  if (change.additions > 0 && change.deletions === 0) {
    return <FilePlus className="h-4 w-4 text-base0B" />;
  }
  if (change.additions > 0 || change.deletions > 0) {
    return <FileEdit className="h-4 w-4 text-base09" />;
  }
  return <FileCode className="h-4 w-4 text-muted-foreground" />;
}

function ChangeBar({
  additions,
  deletions,
}: {
  additions: number;
  deletions: number;
}) {
  const total = additions + deletions;
  if (total === 0) return null;

  const maxBars = 20;
  const scale = total > maxBars ? maxBars / total : 1;
  const addBars = Math.round(additions * scale);
  const delBars = Math.round(deletions * scale);

  return (
    <div className="flex items-center gap-1">
      <span className="text-xs text-muted-foreground w-8 text-right">
        {total}
      </span>
      <div className="flex">
        {Array.from({ length: addBars }).map((_, i) => (
          <div key={`add-${i}`} className="w-1.5 h-3 bg-base0B mr-px" />
        ))}
        {Array.from({ length: delBars }).map((_, i) => (
          <div key={`del-${i}`} className="w-1.5 h-3 bg-base08 mr-px" />
        ))}
      </div>
    </div>
  );
}

function getFileName(path: string): { dir: string; name: string } {
  const parts = path.split("/");
  const name = parts.pop() || path;
  const dir = parts.join("/");
  return { dir, name };
}

export function FilesList({ files, diffStat, className }: FilesListProps) {
  const changes = parseDiffStat(diffStat, files);

  const totalAdditions = changes.reduce((sum, c) => sum + c.additions, 0);
  const totalDeletions = changes.reduce((sum, c) => sum + c.deletions, 0);

  if (files.length === 0) {
    return (
      <div className="flex items-center justify-center h-full text-muted-foreground">
        No modified files
      </div>
    );
  }

  return (
    <ScrollArea className={className}>
      <div className="p-3">
        {/* Summary */}
        <div className="flex items-center justify-between mb-3 pb-3 border-b border-border">
          <div className="text-sm font-medium">
            {files.length} file{files.length !== 1 ? "s" : ""} changed
          </div>
          <div className="flex items-center gap-3 text-xs">
            {totalAdditions > 0 && (
              <span className="text-base0B">+{totalAdditions}</span>
            )}
            {totalDeletions > 0 && (
              <span className="text-base08">-{totalDeletions}</span>
            )}
          </div>
        </div>

        {/* File list */}
        <div className="space-y-1">
          {changes.map((change, i) => {
            const { dir, name } = getFileName(change.path);
            return (
              <div
                key={i}
                className="flex items-center gap-2 py-1.5 px-2 rounded hover:bg-muted/50 group"
              >
                {getFileIcon(change)}
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-1 text-sm">
                    {dir && (
                      <span className="text-muted-foreground truncate">
                        {dir}/
                      </span>
                    )}
                    <span className="font-medium truncate">{name}</span>
                  </div>
                </div>
                {change.binary ? (
                  <span className="text-xs text-muted-foreground">binary</span>
                ) : (
                  <ChangeBar
                    additions={change.additions}
                    deletions={change.deletions}
                  />
                )}
              </div>
            );
          })}
        </div>
      </div>
    </ScrollArea>
  );
}
