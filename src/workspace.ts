// Workspace operations - jujutsu-based version control for agent workspaces

import { buildWorkspacePath } from "./core";

export interface WorkspaceFile {
  name: string;
  source: "file";
  path: string;
}

export async function createWorkspace(
  basePath: string,
  id: string,
  instruction: string,
): Promise<{ workspace: string; baseRevision: string }> {
  const workspace = buildWorkspacePath(basePath, id);
  await Bun.$`mkdir -p ${basePath}/.pi/swarm/workspaces`.quiet();
  // Use -r default@ to make the new workspace's change descend from the default workspace's current change
  // Without this, the new workspace would be a sibling (same parent) instead of a child
  await Bun.$`cd ${basePath} && jj workspace add ${workspace} --name ${id} -m ${instruction} -r default@`.quiet();
  // Get the base revision (parent of the current change in the new workspace)
  const baseRevision =
    await Bun.$`cd ${workspace} && jj log -r @- -T 'change_id' --no-graph`
      .quiet()
      .then((r) => r.stdout.toString().trim());
  return { workspace, baseRevision };
}

export async function getWorkspaceFiles(
  workspace: string,
): Promise<WorkspaceFile[]> {
  try {
    // Use git ls-files which respects .gitignore
    const result =
      await Bun.$`cd ${workspace} && git ls-files --cached --others --exclude-standard 2>/dev/null || find . -type f -not -path '*/node_modules/*' -not -path '*/.git/*' | sed 's|^./||'`.quiet();
    const files = result.stdout.toString().split("\n").filter(Boolean);
    return files.map((file) => ({
      name: file,
      source: "file" as const,
      path: file,
    }));
  } catch {
    return [];
  }
}

export async function getModifiedFiles(
  workspace: string,
  baseRevision?: string,
): Promise<string[]> {
  try {
    // Compare agent workspace against base revision to show all changes made by the agent
    const base = baseRevision || "default@";
    const result =
      await Bun.$`cd ${workspace} && jj diff --name-only --from ${base} --to @`.quiet();
    return result.stdout.toString().split("\n").filter(Boolean);
  } catch {
    return [];
  }
}

export async function getDiffStat(
  workspace: string,
  baseRevision?: string,
): Promise<string> {
  try {
    // Compare agent workspace against base revision to show all changes made by the agent
    const base = baseRevision || "default@";
    const result =
      await Bun.$`cd ${workspace} && jj diff --stat --from ${base} --to @`.quiet();
    return result.stdout.toString();
  } catch {
    return "";
  }
}

export async function getDiff(
  workspace: string,
  baseRevision?: string,
): Promise<string> {
  try {
    // Compare agent workspace against base revision to show all changes made by the agent
    const base = baseRevision || "default@";
    const result =
      await Bun.$`cd ${workspace} && jj diff --git --from ${base} --to @`.quiet();
    return result.stdout.toString();
  } catch {
    return "";
  }
}

export async function isCurrentChangeEmpty(
  workspace: string,
): Promise<boolean> {
  try {
    // Check if the current change (@) has any file modifications
    const result =
      await Bun.$`cd ${workspace} && jj log -r @ --no-graph -T 'if(empty, "empty", "has-changes")'`.quiet();
    return result.stdout.toString().trim() === "empty";
  } catch {
    return false;
  }
}

export async function setOrCreateChange(
  workspace: string,
  instruction: string,
): Promise<void> {
  const isEmpty = await isCurrentChangeEmpty(workspace);
  if (isEmpty) {
    // Re-use current change, keep existing description
  } else {
    // Create a new change
    await Bun.$`cd ${workspace} && jj new -m ${instruction}`.quiet();
  }
}
