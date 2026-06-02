import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, writeFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import {
  findPortfolioRoot,
  readPortfolio,
  getProjectForCwd,
  isProjectGovernanceSkipped,
  __resetPortfolioCache,
} from '../portfolio.mjs';

function makeFixture() {
  const dir = mkdtempSync(join(tmpdir(), 'sp-pf-'));
  writeFileSync(join(dir, 'portfolio.json'), JSON.stringify({
    projects: [
      { name: 'alpha', path: 'alpha', tech_stack: 'nodejs', framework: 'x', level: 'B', group: 'g' },
      { name: 'beta', path: 'beta', tech_stack: 'go', framework: 'x', level: 'C', group: 'g', governance_mode: 'readonly' },
      { name: 'gamma', path: 'gamma', tech_stack: 'python', framework: 'x', level: 'C', group: 'g', governance_mode: 'off' },
    ],
  }));
  return dir;
}

test('readPortfolio returns parsed data', () => {
  __resetPortfolioCache();
  const dir = makeFixture();
  try {
    const pf = readPortfolio(dir);
    assert.equal(pf.projects.length, 3);
  } finally {
    rmSync(dir, { recursive: true, force: true });
    __resetPortfolioCache();
  }
});

test('readPortfolio caches reads within TTL', () => {
  __resetPortfolioCache();
  const dir = makeFixture();
  try {
    const a = readPortfolio(dir);
    const b = readPortfolio(dir);
    assert.strictEqual(a, b, 'cached object should be same reference');
  } finally {
    rmSync(dir, { recursive: true, force: true });
    __resetPortfolioCache();
  }
});

test('getProjectForCwd matches sub-project path', () => {
  __resetPortfolioCache();
  const dir = makeFixture();
  try {
    const proj = getProjectForCwd(join(dir, 'alpha', 'src'), dir);
    assert.equal(proj?.name, 'alpha');
  } finally {
    rmSync(dir, { recursive: true, force: true });
    __resetPortfolioCache();
  }
});

test('getProjectForCwd returns null at portfolio root', () => {
  __resetPortfolioCache();
  const dir = makeFixture();
  try {
    const proj = getProjectForCwd(dir, dir);
    assert.equal(proj, null);
  } finally {
    rmSync(dir, { recursive: true, force: true });
    __resetPortfolioCache();
  }
});

test('isProjectGovernanceSkipped: readonly and off are skipped', () => {
  __resetPortfolioCache();
  const dir = makeFixture();
  try {
    const beta = getProjectForCwd(join(dir, 'beta'), dir);
    const gamma = getProjectForCwd(join(dir, 'gamma'), dir);
    const alpha = getProjectForCwd(join(dir, 'alpha'), dir);
    assert.equal(isProjectGovernanceSkipped(beta), true);
    assert.equal(isProjectGovernanceSkipped(gamma), true);
    assert.equal(isProjectGovernanceSkipped(alpha), false);
  } finally {
    rmSync(dir, { recursive: true, force: true });
    __resetPortfolioCache();
  }
});
