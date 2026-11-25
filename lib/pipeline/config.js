// config.js — single source of truth for paths and thresholds.
// Override via env vars; defaults fall back to the project root (cwd).
import path from 'node:path'

const projectRoot = process.env.FIS_PROJECT_ROOT || process.cwd()

export const config = {
  paths: {
    projectRoot,
    metricsDir: process.env.FIS_METRICS_DIR || path.join(projectRoot, 'metrics'),
    memoryFile: process.env.FIS_MEMORY_FILE || path.join(projectRoot, 'memory', 'instincts.json'),
  },
  // Module 6 — recovery thresholds.
  maxAttemptsPerStage: Number(process.env.FIS_MAX_ATTEMPTS_PER_STAGE ?? 3),
  stallThreshold: Number(process.env.FIS_STALL_THRESHOLD ?? 3),
  // Module 3 — instinct confidence scoring.
  confidence: {
    initial: 0.5,
    observeStep: 0.1,
    correctStep: 0.2,
    max: 0.9,
    min: 0.1,
    promoteThreshold: 0.7,
    decayPerDay: 0.01,
  },
  // Memory pruning — remove stale, never-observed instincts.
  prune: {
    maxAgeDays: 30,
  },
  // Boundary — guarded (fail-closed) operations.
  guard: {
    maxIdLength: 64,
    confirmRequired: ['delete', 'publish', 'mass_update'],
  },
  // Observations — tool response envelope + output bounding.
  observations: {
    maxDataBytes: 16 * 1024,
    truncationMarker: '…[truncated]',
  },
}
