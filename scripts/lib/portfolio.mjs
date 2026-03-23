import { existsSync } from 'fs';
import { join, dirname } from 'path';

/**
 * Walk up from startDir to find the nearest ancestor containing portfolio.json.
 * Returns the directory containing portfolio.json, or startDir if not found.
 */
export function findPortfolioRoot(startDir) {
  let dir = startDir;
  while (true) {
    if (existsSync(join(dir, 'portfolio.json'))) return dir;
    const parent = dirname(dir);
    if (parent === dir) break;
    dir = parent;
  }
  return startDir;
}
