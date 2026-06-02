// trust-policy.mjs — .omc/sp.json read/write + trust decision logic
//
// sp.json schema (schema = "sp-state-v1"):
//   { version, schema, execution_engine, trust: { default_policy, marketplaces, plugins, decisions }, config }
//
// Decision priority: plugins[mkt/plug] > marketplaces[mkt] > default_policy
// Values: "allow" | "deny" | "ask"
//
// Corruption recovery: any read failure renames to .bak.<ts> and returns default state.

import { existsSync, readFileSync, writeFileSync, mkdirSync, renameSync } from 'node:fs';
import { join } from 'node:path';

export const SCHEMA_NAME = 'sp-state-v1';
export const VALID_POLICIES = new Set(['allow', 'deny', 'ask']);

export function createDefaultState() {
  return {
    version: '1.0',
    schema: SCHEMA_NAME,
    execution_engine: 'v10',
    trust: {
      default_policy: 'ask',
      marketplaces: {},
      plugins: {},
      decisions: [],
    },
    config: {},
  };
}

function spJsonPath(workspaceRoot) {
  return join(workspaceRoot, '.omc', 'sp.json');
}

export function readSPState(workspaceRoot) {
  const path = spJsonPath(workspaceRoot);
  if (!existsSync(path)) return createDefaultState();
  let raw;
  try { raw = readFileSync(path, 'utf-8'); }
  catch { return createDefaultState(); }

  try {
    const data = JSON.parse(raw);
    if (data?.schema !== SCHEMA_NAME) throw new Error('schema mismatch');
    // Defensive: fill missing keys
    if (!data.trust) data.trust = { default_policy: 'ask', marketplaces: {}, plugins: {}, decisions: [] };
    if (!data.trust.marketplaces) data.trust.marketplaces = {};
    if (!data.trust.plugins) data.trust.plugins = {};
    if (!Array.isArray(data.trust.decisions)) data.trust.decisions = [];
    if (!data.config) data.config = {};
    if (!data.execution_engine) data.execution_engine = 'v10';
    return data;
  } catch {
    // Corrupted — back up and return default
    const bak = `${path}.bak.${Date.now()}`;
    try { renameSync(path, bak); } catch { /* ignore */ }
    return createDefaultState();
  }
}

// Atomic write via temp file + rename.
export function writeSPState(workspaceRoot, state) {
  const dir = join(workspaceRoot, '.omc');
  mkdirSync(dir, { recursive: true });
  const path = spJsonPath(workspaceRoot);
  const tmp = `${path}.tmp.${process.pid}.${Date.now()}`;
  writeFileSync(tmp, JSON.stringify(state, null, 2));
  renameSync(tmp, path);
}

export function decideTrust(policy, marketplace, plugin) {
  const fullKey = `${marketplace}/${plugin}`;
  if (policy.plugins && policy.plugins[fullKey] && VALID_POLICIES.has(policy.plugins[fullKey])) {
    return policy.plugins[fullKey];
  }
  if (policy.marketplaces && policy.marketplaces[marketplace] && VALID_POLICIES.has(policy.marketplaces[marketplace])) {
    return policy.marketplaces[marketplace];
  }
  return policy.default_policy || 'ask';
}

// Splits plugins into { allowed, denied, pending } per policy.
export function filterByTrust(plugins, policy) {
  const allowed = [];
  const denied = [];
  const pending = [];
  for (const p of plugins) {
    const verdict = decideTrust(policy, p.marketplace, p.plugin);
    if (verdict === 'allow') allowed.push(p);
    else if (verdict === 'deny') denied.push(p);
    else pending.push(p);
  }
  return { allowed, denied, pending };
}
