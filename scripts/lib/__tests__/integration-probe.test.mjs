import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, rmSync, mkdirSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { probeIntegration } from '../integration-probe.mjs';

test('probeIntegration returns sp-only when no plugins discovered', () => {
  const dir = mkdtempSync(join(tmpdir(), 'sp-ip-'));
  try {
    const result = probeIntegration(dir, { installedPath: '/does/not/exist.json' });
    assert.equal(result.mode, 'sp-only');
    assert.equal(result.plugin_count, 0);
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

test('probeIntegration returns with-plugins when plugins present', () => {
  const dir = mkdtempSync(join(tmpdir(), 'sp-ip-'));
  const pluginsPath = join(dir, 'installed_plugins.json');
  writeFileSync(pluginsPath, JSON.stringify({
    version: 2,
    plugins: {
      'foo@bar': [{ scope: 'user', installPath: '/p', version: '1', gitCommitSha: 'a' }],
    },
  }));
  try {
    const result = probeIntegration(dir, { installedPath: pluginsPath });
    assert.equal(result.mode, 'with-plugins');
    assert.equal(result.plugin_count, 1);
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

test('probeIntegration is fail-safe (no exceptions on invalid args)', () => {
  const result = probeIntegration('/tmp/nonexistent', { installedPath: '/also/no' });
  assert.equal(result.mode, 'sp-only');
});
