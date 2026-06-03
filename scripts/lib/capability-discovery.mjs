/**
 * capability-discovery.mjs — zero-coupling plugin capability discovery
 *
 * SP only trusts Claude Code official contracts:
 *   - Plugin directory structure (~/.claude/plugins/cache/<marketplace>/<plugin>/<version>/)
 *   - Frontmatter field names (name, description, model, etc.)
 *   - installed_plugins.json schema
 *
 * Does NOT hardcode any upstream plugin's specific agent/skill/mode/tool names.
 *
 * Trust tiering:
 *   - Official contracts → trusted by default (no user decision needed)
 *   - Non-official/unknown marketplaces → not trusted by default; user decides via sp.json::trust
 *
 * Upgrade safety:
 *   - Upstream plugin upgrade → installed_plugins.json gitCommitSha changes → cache invalidates → auto rescan
 *   - Upstream agent rename/add/remove → SP auto-tracks; no SP code change needed
 *   - Corrupted frontmatter → skip single file; rest of discovery continues
 *   - Upstream plugin disappears → SP silently degrades to sp-only mode
 */

import { existsSync, readFileSync, writeFileSync, mkdirSync, readdirSync, renameSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { parseFrontmatter } from './frontmatter-parser.mjs';
import { STOPWORDS, buildStopwordSet } from './stopwords.mjs';
import { readInstalledPlugins, computeSourceSignature, defaultInstalledPluginsPath } from './plugin-index.mjs';
import { readSPState, filterByTrust } from './trust-policy.mjs';

const CACHE_SCHEMA_VERSION = '1.0';

// ---------- Tokenization ----------

export function tokenize(text, stopwords = STOPWORDS) {
  if (!text || typeof text !== 'string') return [];
  const lower = text.toLowerCase();
  const chinese = lower.match(/[一-龥]{2,}/g) || [];
  const english = lower.match(/[a-z][a-z0-9-]+/g) || [];
  return [...chinese, ...english].filter(t => !stopwords.has(t));
}

// ---------- Scanning a single plugin directory ----------

function readFrontmatterFiles(dir) {
  if (!existsSync(dir)) return [];
  let entries;
  try { entries = readdirSync(dir, { withFileTypes: true }); }
  catch { return []; }
  const results = [];
  for (const ent of entries) {
    if (!ent.isFile() || !ent.name.endsWith('.md')) continue;
    const fullPath = join(dir, ent.name);
    let content;
    try { content = readFileSync(fullPath, 'utf-8'); }
    catch { continue; }
    const fm = parseFrontmatter(content);
    if (fm && fm.name) results.push(fm);
  }
  return results;
}

function readSkillFrontmatter(skillsDir) {
  if (!existsSync(skillsDir)) return [];
  let entries;
  try { entries = readdirSync(skillsDir, { withFileTypes: true }); }
  catch { return []; }
  const results = [];
  for (const ent of entries) {
    if (!ent.isDirectory()) continue;
    const skillMd = join(skillsDir, ent.name, 'SKILL.md');
    if (!existsSync(skillMd)) continue;
    let content;
    try { content = readFileSync(skillMd, 'utf-8'); }
    catch { continue; }
    const fm = parseFrontmatter(content);
    if (fm && fm.name) results.push(fm);
  }
  return results;
}

export function scanPlugin(installPath) {
  return {
    agents: readFrontmatterFiles(join(installPath, 'agents')),
    skills: readSkillFrontmatter(join(installPath, 'skills')),
    commands: readFrontmatterFiles(join(installPath, 'commands')),
  };
}

// ---------- Inverted index + matching ----------

export function buildIndex(capabilities) {
  const index = new Map();
  if (!capabilities?.plugins) return index;
  for (const [pluginKey, plugin] of Object.entries(capabilities.plugins)) {
    for (const kind of ['agents', 'skills', 'commands']) {
      const items = plugin[kind] || [];
      for (const item of items) {
        if (!item.name) continue;
        const tokens = tokenize(`${item.name} ${item.description || ''}`);
        const entry = {
          plugin: pluginKey,
          name: item.name,
          kind: kind.slice(0, -1),  // "agents" → "agent"
          description: item.description || '',
          model: item.model || null,
        };
        for (const tok of new Set(tokens)) {
          if (!index.has(tok)) index.set(tok, []);
          index.get(tok).push(entry);
        }
        // Also index the name itself for exact-match boost
        const nameLower = item.name.toLowerCase();
        if (!index.has(nameLower)) index.set(nameLower, []);
        if (!index.get(nameLower).includes(entry)) index.get(nameLower).push(entry);
      }
    }
  }
  return index;
}

export function matchCapabilities(prompt, index, opts = {}) {
  const { topK = 3, minScore = 2, boostNameExact = 3, stopwords = STOPWORDS } = opts;
  const tokens = new Set(tokenize(prompt, stopwords));
  if (tokens.size === 0) return [];

  const scores = new Map();  // entry → score
  for (const tok of tokens) {
    const hits = index.get(tok);
    if (!hits) continue;
    for (const entry of hits) {
      const cur = scores.get(entry) || 0;
      let add = 1;
      if (entry.name.toLowerCase() === tok) add += boostNameExact;
      scores.set(entry, cur + add);
    }
  }

  return [...scores.entries()]
    .filter(([, s]) => s >= minScore)
    .sort(([, a], [, b]) => b - a)
    .slice(0, topK)
    .map(([entry, score]) => ({ ...entry, score }));
}

// ---------- Discovery main entry ----------

function cachePath(workspaceRoot) {
  return join(workspaceRoot, '.omc', 'cache', 'capabilities.json');
}

function readCache(workspaceRoot) {
  const p = cachePath(workspaceRoot);
  if (!existsSync(p)) return null;
  try {
    const data = JSON.parse(readFileSync(p, 'utf-8'));
    if (data?.schema_version !== CACHE_SCHEMA_VERSION) return null;
    return data;
  } catch { return null; }
}

function writeCacheAtomic(workspaceRoot, data) {
  const dir = join(workspaceRoot, '.omc', 'cache');
  try { mkdirSync(dir, { recursive: true }); } catch { /* ignore */ }
  const p = cachePath(workspaceRoot);
  const tmp = `${p}.tmp.${process.pid}.${Date.now()}`;
  try {
    writeFileSync(tmp, JSON.stringify(data));
    renameSync(tmp, p);
  } catch { /* non-critical */ }
}

export function discoverCapabilities(workspaceRoot, opts = {}) {
  const { installedPath = defaultInstalledPluginsPath(), forceRefresh = false } = opts;
  const installed = readInstalledPlugins(installedPath);
  const sourceSig = computeSourceSignature(installed);
  const policy = readSPState(workspaceRoot).trust;

  if (!forceRefresh) {
    const cache = readCache(workspaceRoot);
    if (cache && cache.source_signature === sourceSig) {
      return {
        plugins: cache.plugins || {},
        index: rebuildIndexFromCache(cache.plugins || {}),
        stats: { source: 'cache', allowed: Object.keys(cache.plugins || {}).length, denied: 0, pending: 0 },
      };
    }
  }

  const { allowed, denied, pending } = filterByTrust(installed, policy);
  const plugins = {};
  for (const p of allowed) {
    const scanned = scanPlugin(p.installPath);
    plugins[p.key] = { version: p.version, ...scanned };
  }

  writeCacheAtomic(workspaceRoot, {
    schema_version: CACHE_SCHEMA_VERSION,
    generated_at: new Date().toISOString(),
    source_signature: sourceSig,
    plugins,
  });

  return {
    plugins,
    index: buildIndex({ plugins }),
    stats: { source: 'fresh', allowed: allowed.length, denied: denied.length, pending: pending.length },
    pending,
  };
}

function rebuildIndexFromCache(plugins) {
  return buildIndex({ plugins });
}

// ---------- MCP prefix derivation (used by pm-allowlist-guard) ----------

export function getTrustedMCPPrefixes(allowedPlugins) {
  if (!Array.isArray(allowedPlugins)) return [];
  return allowedPlugins.map(p => `mcp__plugin_${p.plugin}_t__`);
}

// ---------- Stats (used by sp-discovery-status skill) ----------

export function getDiscoveryStats(workspaceRoot) {
  const cache = readCache(workspaceRoot);
  const installed = readInstalledPlugins();
  const policy = readSPState(workspaceRoot).trust;
  const { allowed, denied, pending } = filterByTrust(installed, policy);
  let cacheAgeSec = null;
  if (cache?.generated_at) {
    try { cacheAgeSec = Math.round((Date.now() - new Date(cache.generated_at).getTime()) / 1000); }
    catch { /* ignore */ }
  }
  return {
    discovered_plugins: installed.length,
    allowed: allowed.length,
    denied: denied.length,
    pending: pending.length,
    cache_age_seconds: cacheAgeSec,
    cache_source_signature: cache?.source_signature || null,
  };
}
