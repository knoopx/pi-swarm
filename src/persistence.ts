// Agent persistence - save/load/delete agent sessions

import { existsSync } from "fs";
import {
  serializeAgent,
  buildAgentSessionDir,
  buildAgentMetadataPath,
  buildSessionsDir,
  type Agent,
} from "./core";

export interface PersistenceConfig {
  basePath: string;
}

// Create persistence functions bound to a base path
export function createPersistence(config: PersistenceConfig) {
  const { basePath } = config;
  const sessionsDir = buildSessionsDir(basePath);

  function getAgentSessionDir(agentId: string): string {
    return buildAgentSessionDir(basePath, agentId);
  }

  function getAgentMetadataPath(agentId: string): string {
    return buildAgentMetadataPath(basePath, agentId);
  }

  async function ensureSessionDir(agentId: string): Promise<void> {
    const dir = getAgentSessionDir(agentId);
    if (!existsSync(dir)) {
      await Bun.$`mkdir -p ${dir}`.quiet();
    }
  }

  async function saveAgent(agent: Agent): Promise<void> {
    await ensureSessionDir(agent.id);
    const metadataPath = getAgentMetadataPath(agent.id);
    await Bun.write(
      metadataPath,
      JSON.stringify(serializeAgent(agent), null, 2),
    );
  }

  async function deleteAgentSession(agentId: string): Promise<void> {
    const dir = getAgentSessionDir(agentId);
    if (existsSync(dir)) {
      await Bun.$`rm -rf ${dir}`.quiet();
    }
  }

  async function loadAgents(): Promise<Map<string, Agent>> {
    const agents = new Map<string, Agent>();

    try {
      if (!existsSync(sessionsDir)) {
        return agents;
      }

      const entries = await Bun.$`ls -1 ${sessionsDir}`.quiet();
      const agentIds = entries.stdout.toString().split("\n").filter(Boolean);

      for (const agentId of agentIds) {
        const metadataPath = getAgentMetadataPath(agentId);
        if (existsSync(metadataPath)) {
          const agentData = await Bun.file(metadataPath).json();
          // Reset running agents to stopped on restart
          if (agentData.status === "running") {
            agentData.status = "stopped";
          }
          agents.set(agentData.id, agentData);
        }
      }
      console.log(`📂 Loaded ${agents.size} agents from ${sessionsDir}`);
    } catch (err) {
      console.error("Failed to load agents:", err);
    }

    return agents;
  }

  return {
    getAgentSessionDir,
    getAgentMetadataPath,
    ensureSessionDir,
    saveAgent,
    deleteAgentSession,
    loadAgents,
    sessionsDir,
  };
}

export type Persistence = ReturnType<typeof createPersistence>;
