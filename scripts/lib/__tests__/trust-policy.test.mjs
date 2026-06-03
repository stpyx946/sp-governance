import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, writeFileSync, readFileSync, rmSync, existsSync, mkdirSync, readdirSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import {
  SCHEMA_NAME,
  createDefaultState,
  readSPState,
  writeSPState,
  decideTrust,
  filterByTrust,
} from '../trust-policy.mjs';

function makeWorkspace() {
  return mkdtempSync(join(tmpdir(), 'sp-tp-'));
}

test('createDefaultState returns a valid default object', () => {
  const s = createDefaultState();
  assert.equal(s.schema, SCHEMA_NAME);
  assert.equal(s.execution_engine, 'v10');
  assert.equal(s.trust.default_policy, 'ask');
  assert.deepEqual(s.trust.marketplaces, {});
  assert.deepEqual(s.trust.plugins, {});
  assert.deepEqual(s.trust.decisions, []);
});

test('readSPState returns default when file missing', () => {
  const dir = makeWorkspace();
  try {
    const s = readSPState(dir);
    assert.equal(s.schema, SCHEMA_NAME);
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

test('writeSPState + readSPState round-trips', () => {
  const dir = makeWorkspace();
  try {
    const s1 = createDefaultState();
    s1.trust.marketplaces['mkt-x'] = 'allow';
    writeSPState(dir, s1);
    const s2 = readSPState(dir);
    assert.equal(s2.trust.marketplaces['mkt-x'], 'allow');
    assert.ok(existsSync(join(dir, '.omc', 'sp.json')));
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

test('readSPState recovers from corruption with .bak rename', () => {
  const dir = makeWorkspace();
  try {
    mkdirSync(join(dir, '.omc'), { recursive: true });
    writeFileSync(join(dir, '.omc', 'sp.json'), '{not json');
    const s = readSPState(dir);
    assert.equal(s.schema, SCHEMA_NAME);
    const files = readdirSync(join(dir, '.omc'));
    assert.ok(files.some(f => f.startsWith('sp.json.bak.')));
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

test('decideTrust: plugins overrides marketplaces overrides default', () => {
  const policy = {
    default_policy: 'ask',
    marketplaces: { 'mkt-a': 'allow', 'mkt-b': 'deny' },
    plugins: { 'mkt-a/plug-special': 'deny' },
  };
  // plugins-level wins
  assert.equal(decideTrust(policy, 'mkt-a', 'plug-special'), 'deny');
  // marketplace-level
  assert.equal(decideTrust(policy, 'mkt-a', 'other'), 'allow');
  assert.equal(decideTrust(policy, 'mkt-b', 'other'), 'deny');
  // default
  assert.equal(decideTrust(policy, 'mkt-unknown', 'other'), 'ask');
});

test('filterByTrust splits into allowed / denied / pending', () => {
  const policy = {
    default_policy: 'ask',
    marketplaces: { 'a': 'allow', 'b': 'deny' },
    plugins: {},
  };
  const plugins = [
    { key: 'p1@a', plugin: 'p1', marketplace: 'a' },
    { key: 'p2@b', plugin: 'p2', marketplace: 'b' },
    { key: 'p3@c', plugin: 'p3', marketplace: 'c' },
  ];
  const { allowed, denied, pending } = filterByTrust(plugins, policy);
  assert.equal(allowed.length, 1);
  assert.equal(allowed[0].plugin, 'p1');
  assert.equal(denied.length, 1);
  assert.equal(denied[0].plugin, 'p2');
  assert.equal(pending.length, 1);
  assert.equal(pending[0].plugin, 'p3');
});
