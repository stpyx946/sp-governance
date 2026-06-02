// portfolio.mjs — portfolio.json resolution + 30s LRU cache + governance helpers
//
// Exports:
//   findPortfolioRoot(cwd)            — walk up from cwd to find directory with portfolio.json
//   readPortfolio(cwd)                — cached read of portfolio.json (30s TTL + mtime check)
//   getProjectForCwd(rawCwd, root)    — return matched project entry or null
//   isProjectGovernanceSkipped(p)     — true if governance_mode is 'readonly' or 'off'
//   __resetPortfolioCache()           — test-only: clear cache state

import { existsSync, readFileSync, statSync } from 'node:fs';
import { join, resolve, dirname } from 'node:path';

const CACHE_TTL_MS = 30_000;
let portfolioCache = null;  // { cwd, mtime, data, expiry }

export function __resetPortfolioCache() {
  portfolioCache = null;
}

export function findPortfolioRoot(cwd) {
  let dir = resolve(cwd);
  while (true) {
    if (existsSync(join(dir, 'portfolio.json'))) return dir;
    const parent = dirname(dir);
    if (parent === dir) return resolve(cwd);  // hit filesystem root
    dir = parent;
  }
}

export function readPortfolio(cwd) {
  const portfolioPath = join(cwd, 'portfolio.json');
  if (!existsSync(portfolioPath)) return null;

  const now = Date.now();
  if (portfolioCache &&
      portfolioCache.cwd === cwd &&
      portfolioCache.expiry > now) {
    return portfolioCache.data;
  }

  let stat;
  try { stat = statSync(portfolioPath); }
  catch { return null; }

  if (portfolioCache &&
      portfolioCache.cwd === cwd &&
      portfolioCache.mtime === stat.mtimeMs) {
    portfolioCache.expiry = now + CACHE_TTL_MS;
    return portfolioCache.data;
  }

  let data;
  try { data = JSON.parse(readFileSync(portfolioPath, 'utf-8')); }
  catch { return null; }

  portfolioCache = { cwd, mtime: stat.mtimeMs, data, expiry: now + CACHE_TTL_MS };
  return data;
}

export function getProjectForCwd(rawCwd, portfolioRoot) {
  const pf = readPortfolio(portfolioRoot);
  if (!pf?.projects?.length) return null;

  const normRaw = resolve(rawCwd).replace(/\\/g, '/').toLowerCase();
  const normRoot = resolve(portfolioRoot).replace(/\\/g, '/').toLowerCase();
  if (normRaw === normRoot) return null;

  for (const proj of pf.projects) {
    const pp = resolve(portfolioRoot, proj.path).replace(/\\/g, '/').toLowerCase();
    if (normRaw === pp || normRaw.startsWith(pp + '/')) return proj;
  }
  return null;
}

export function isProjectGovernanceSkipped(project) {
  if (!project) return false;
  const mode = project.governance_mode;
  return mode === 'readonly' || mode === 'off';
}
