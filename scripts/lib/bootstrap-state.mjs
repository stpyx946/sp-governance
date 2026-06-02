// bootstrap-state.mjs — manages .omc/bootstrap-state.json (7-day staleness)

import { existsSync, readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { join } from 'node:path';

export const STALE_MS = 7 * 24 * 60 * 60 * 1000;  // 7 days

function statePath(workspaceRoot) {
  return join(workspaceRoot, '.omc', 'bootstrap-state.json');
}

export function readState(workspaceRoot) {
  const p = statePath(workspaceRoot);
  if (!existsSync(p)) return null;
  try { return JSON.parse(readFileSync(p, 'utf-8')); }
  catch { return null; }
}

export function writeState(workspaceRoot, state) {
  const dir = join(workspaceRoot, '.omc');
  mkdirSync(dir, { recursive: true });
  writeFileSync(statePath(workspaceRoot), JSON.stringify(state));
}

export function isStale(state) {
  if (!state || !state.last_full_diagnostic) return true;
  const t = new Date(state.last_full_diagnostic).getTime();
  if (isNaN(t)) return true;
  return (Date.now() - t) > STALE_MS;
}

export function refreshState(workspaceRoot) {
  const existing = readState(workspaceRoot) || {};
  existing.last_full_diagnostic = new Date().toISOString();
  if (!existing.version) existing.version = 'auto-created';
  writeState(workspaceRoot, existing);
  return existing;
}
