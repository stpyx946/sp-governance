import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, rmSync, existsSync, mkdirSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { readState, writeState, refreshState, isStale, STALE_MS } from '../bootstrap-state.mjs';

function ws() { return mkdtempSync(join(tmpdir(), 'sp-bs-')); }

test('readState returns null when missing', () => {
  const dir = ws();
  try { assert.equal(readState(dir), null); }
  finally { rmSync(dir, { recursive: true, force: true }); }
});

test('writeState creates .omc/bootstrap-state.json', () => {
  const dir = ws();
  try {
    writeState(dir, { last_full_diagnostic: '2026-06-02T00:00:00.000Z' });
    assert.ok(existsSync(join(dir, '.omc', 'bootstrap-state.json')));
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

test('readState returns written state', () => {
  const dir = ws();
  try {
    writeState(dir, { last_full_diagnostic: '2026-06-02T00:00:00.000Z', custom: 'x' });
    const s = readState(dir);
    assert.equal(s.custom, 'x');
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

test('readState returns null for corrupt JSON', () => {
  const dir = ws();
  try {
    mkdirSync(join(dir, '.omc'), { recursive: true });
    writeFileSync(join(dir, '.omc', 'bootstrap-state.json'), '{not json');
    assert.equal(readState(dir), null);
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

test('isStale detects >7 days old timestamps', () => {
  const old = new Date(Date.now() - STALE_MS - 1000).toISOString();
  const fresh = new Date().toISOString();
  assert.equal(isStale({ last_full_diagnostic: old }), true);
  assert.equal(isStale({ last_full_diagnostic: fresh }), false);
  assert.equal(isStale({ last_full_diagnostic: 'garbage' }), true);
  assert.equal(isStale({}), true);
  assert.equal(isStale(null), true);
});

test('refreshState updates timestamp and persists', () => {
  const dir = ws();
  try {
    const before = new Date(Date.now() - 10000).toISOString();
    writeState(dir, { last_full_diagnostic: before });
    const updated = refreshState(dir);
    assert.notEqual(updated.last_full_diagnostic, before);
    const reread = readState(dir);
    assert.equal(reread.last_full_diagnostic, updated.last_full_diagnostic);
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});
