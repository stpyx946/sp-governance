// plugin-index.mjs — reads ~/.claude/plugins/installed_plugins.json
// and exposes a stable source signature for cache invalidation.

import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { homedir } from 'node:os';
import { createHash } from 'node:crypto';

export function defaultInstalledPluginsPath() {
  return join(homedir(), '.claude', 'plugins', 'installed_plugins.json');
}

// Returns flattened array of { key, plugin, marketplace, version, sha, installPath, scope }
// On any failure: returns [] (callers degrade to sp-only).
export function readInstalledPlugins(path = defaultInstalledPluginsPath()) {
  if (!existsSync(path)) return [];
  let raw;
  try { raw = readFileSync(path, 'utf-8'); }
  catch { return []; }
  let data;
  try { data = JSON.parse(raw); }
  catch { return []; }

  const plugins = data?.plugins;
  if (!plugins || typeof plugins !== 'object') return [];

  const result = [];
  for (const [key, installs] of Object.entries(plugins)) {
    if (!Array.isArray(installs)) continue;
    const sepIdx = key.lastIndexOf('@');
    const plugin = sepIdx > 0 ? key.slice(0, sepIdx) : key;
    const marketplace = sepIdx > 0 ? key.slice(sepIdx + 1) : '';
    for (const inst of installs) {
      if (!inst || typeof inst !== 'object') continue;
      if (!inst.installPath) continue;
      result.push({
        key,
        plugin,
        marketplace,
        version: inst.version || '',
        sha: inst.gitCommitSha || '',
        installPath: inst.installPath,
        scope: inst.scope || '',
      });
    }
  }
  return result;
}

// SHA-256 of sorted (key|version|sha|installPath) tuples.
// Used as cache invalidation key for capability discovery.
export function computeSourceSignature(plugins) {
  if (!Array.isArray(plugins) || plugins.length === 0) {
    return createHash('sha256').update('empty').digest('hex');
  }
  const parts = plugins
    .map(p => `${p.key}|${p.version}|${p.sha}|${p.installPath}`)
    .sort();
  return createHash('sha256').update(parts.join('\n')).digest('hex');
}
