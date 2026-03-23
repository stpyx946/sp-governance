#!/usr/bin/env node
'use strict';
/**
 * SP Governance Cross-platform hook runner (run.cjs)
 *
 * Uses process.execPath (the Node binary already running this script) to spawn
 * the target .mjs hook, bypassing PATH / shell discovery issues.
 *
 * Adapted from oh-my-claudecode's run.cjs pattern.
 *
 * Usage (from hooks.json):
 *   node "$CLAUDE_PLUGIN_ROOT"/scripts/run.cjs \
 *       "$CLAUDE_PLUGIN_ROOT"/scripts/<hook>.mjs [args...]
 */

const { spawnSync } = require('child_process');
const { existsSync, readdirSync } = require('fs');
const { join, dirname } = require('path');

const target = process.argv[2];
if (!target) {
  // Nothing to run — exit cleanly so Claude Code hooks are never blocked.
  process.exit(0);
}

/**
 * Resolve the hook script target path, handling stale CLAUDE_PLUGIN_ROOT.
 *
 * When a plugin update replaces an old version directory, sessions that still
 * reference the old version via CLAUDE_PLUGIN_ROOT will fail.
 *
 * Resolution strategy:
 *   1. Use the target as-is if it exists.
 *   2. Scan the plugin cache for the latest available version that has the
 *      same script name and use that instead.
 *   3. If all else fails, return null (caller exits cleanly).
 */
function resolveTarget(targetPath) {
  // Fast path: target exists (common case)
  if (existsSync(targetPath)) return targetPath;

  // Fallback: scan plugin cache for the same script in the latest version.
  try {
    const pluginRoot = process.env.CLAUDE_PLUGIN_ROOT;
    if (!pluginRoot) return null;

    const cacheBase = dirname(pluginRoot);
    const scriptRelative = targetPath.slice(pluginRoot.length);

    if (!scriptRelative || !existsSync(cacheBase)) return null;

    const entries = readdirSync(cacheBase).filter(v => /^\d+\.\d+\.\d+/.test(v));

    // Sort descending by semver
    entries.sort((a, b) => {
      const pa = a.split('.').map(Number);
      const pb = b.split('.').map(Number);
      for (let i = 0; i < 3; i++) {
        if ((pa[i] || 0) !== (pb[i] || 0)) return (pb[i] || 0) - (pa[i] || 0);
      }
      return 0;
    });

    for (const version of entries) {
      const candidate = join(cacheBase, version) + scriptRelative;
      if (existsSync(candidate)) return candidate;
    }
  } catch {
    // Any error in fallback scan — give up gracefully
  }

  return null;
}

const resolved = resolveTarget(target);
if (!resolved) {
  // Target not found anywhere — exit cleanly so hooks are never blocked.
  process.exit(0);
}

const result = spawnSync(
  process.execPath,
  [resolved, ...process.argv.slice(3)],
  {
    stdio: 'inherit',
    env: process.env,
    windowsHide: true,
  }
);

// Propagate the child exit code (null → 0 to avoid blocking hooks).
process.exit(result.status ?? 0);
