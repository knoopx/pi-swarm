#!/usr/bin/env bun

import { existsSync } from "fs";
import { join, dirname } from "path";
import { fileURLToPath } from "url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const PACKAGE_ROOT = join(__dirname, "..");
const DIST_DIR = join(PACKAGE_ROOT, "dist");

// Check if frontend is built
if (!existsSync(join(DIST_DIR, "index.html"))) {
  console.error("❌ Frontend not built. Run 'bun run build' first.");
  process.exit(1);
}

// Set environment for the server
process.env.PI_SWARM_DIST = DIST_DIR;
process.env.PI_SWARM_CWD = process.cwd();

// Import and start server
await import("../src/server");
