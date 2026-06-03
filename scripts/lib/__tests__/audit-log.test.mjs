import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, rmSync, existsSync, readFileSync, writeFileSync, mkdirSync, statSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { writeAuditLog } from '../audit-log.mjs';

test('writeAuditLog appends a JSON line', () => {
  const dir = mkdtempSync(join(tmpdir(), 'sp-al-'));
  try {
    writeAuditLog(dir, { tool: 'Glob', action: 'ALLOW' });
    const p = join(dir, '.omc', 'logs', 'pm-audit.jsonl');
    assert.ok(existsSync(p));
    const content = readFileSync(p, 'utf-8');
    assert.ok(content.includes('"tool":"Glob"'));
    assert.ok(content.endsWith('\n'));
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

test('writeAuditLog appends without overwriting', () => {
  const dir = mkdtempSync(join(tmpdir(), 'sp-al-'));
  try {
    writeAuditLog(dir, { tool: 'A' });
    writeAuditLog(dir, { tool: 'B' });
    const p = join(dir, '.omc', 'logs', 'pm-audit.jsonl');
    const lines = readFileSync(p, 'utf-8').trim().split('\n');
    assert.equal(lines.length, 2);
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

test('writeAuditLog never throws on bad inputs', () => {
  assert.doesNotThrow(() => writeAuditLog('/nonexistent/path/that/cannot/be/created/in/root', { x: 1 }));
});
