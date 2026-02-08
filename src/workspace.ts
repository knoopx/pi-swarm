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
): Promise<string> {
  const workspace = buildWorkspacePath(basePath, id);
  await Bun.$`mkdir -p ${basePath}/.pi/swarm/workspaces`.quiet();
  // Use -r default@ to make the new workspace's change descend from the default workspace's current change
  // Without this, the new workspace would be a sibling (same parent) instead of a child
  await Bun.$`cd ${basePath} && jj workspace add ${workspace} --name ${id} -m ${instruction} -r default@`.quiet();
  return workspace;
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

export async function getModifiedFiles(workspace: string): Promise<string[]> {
  try {
    // Compare agent workspace against default workspace to show all changes made by the agent
    const result =
      await Bun.$`cd ${workspace} && jj diff --name-only --from default@ --to @`.quiet();
    return result.stdout.toString().split("\n").filter(Boolean);
  } catch {
    return [];
  }
}

export async function getDiffStat(workspace: string): Promise<string> {
  try {
    // Compare agent workspace against default workspace to show all changes made by the agent
    const result =
      await Bun.$`cd ${workspace} && jj diff --stat --from default@ --to @`.quiet();
    return result.stdout.toString();
  } catch {
    return "";
  }
}

export async function getDiff(workspace: string): Promise<string> {
  try {
    // Compare agent workspace against default workspace to show all changes made by the agent
    const result =
      await Bun.$`cd ${workspace} && jj diff --git --from default@ --to @`.quiet();
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
    // Re-use current change and update its description
    await Bun.$`cd ${workspace} && jj describe -m ${instruction}`.quiet();
  } else {
    // Create a new change
    await Bun.$`cd ${workspace} && jj new -m ${instruction}`.quiet();
  }
}
