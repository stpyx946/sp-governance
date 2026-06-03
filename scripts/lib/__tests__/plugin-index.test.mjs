import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, writeFileSync, rmSync, mkdirSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { readInstalledPlugins, computeSourceSignature, defaultInstalledPluginsPath } from '../plugin-index.mjs';

function makeFixture(content) {
  const dir = mkdtempSync(join(tmpdir(), 'sp-pi-'));
  const path = join(dir, 'installed_plugins.json');
  writeFileSync(path, JSON.stringify(content));
  return { dir, path };
}

test('readInstalledPlugins returns flattened entries', () => {
  const { dir, path } = makeFixture({
    version: 2,
    plugins: {
      'foo@bar': [{ scope: 'user', installPath: '/p/foo', version: '1.0.0', gitCommitSha: 'abc' }],
      'baz@bar': [{ scope: 'user', installPath: '/p/baz', version: '2.0.0', gitCommitSha: 'def' }],
    },
  });
  try {
    const list = readInstalledPlugins(path);
    assert.equal(list.length, 2);
    const foo = list.find(p => p.plugin === 'foo');
    assert.equal(foo.marketplace, 'bar');
    assert.equal(foo.version, '1.0.0');
    assert.equal(foo.sha, 'abc');
    assert.equal(foo.installPath, '/p/foo');
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

test('readInstalledPlugins returns [] on missing file', () => {
  assert.deepEqual(readInstalledPlugins('/no/such/path.json'), []);
});

test('readInstalledPlugins returns [] on corrupt JSON', () => {
  const dir = mkdtempSync(join(tmpdir(), 'sp-pi-'));
  const path = join(dir, 'installed_plugins.json');
  writeFileSync(path, '{not json');
  try {
    assert.deepEqual(readInstalledPlugins(path), []);
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

test('computeSourceSignature is stable for same inputs', () => {
  const a = [{ key: 'foo@bar', plugin: 'foo', marketplace: 'bar', version: '1', sha: 'a', installPath: '/p' }];
  const sig1 = computeSourceSignature(a);
  const sig2 = computeSourceSignature(a);
  assert.equal(sig1, sig2);
  assert.equal(typeof sig1, 'string');
  assert.equal(sig1.length, 64);  // sha256 hex
});

test('computeSourceSignature differs on any field change', () => {
  const base = [{ key: 'foo@bar', plugin: 'foo', marketplace: 'bar', version: '1', sha: 'a', installPath: '/p' }];
  const sigBase = computeSourceSignature(base);
  assert.notEqual(sigBase, computeSourceSignature([{ ...base[0], version: '2' }]));
  assert.notEqual(sigBase, computeSourceSignature([{ ...base[0], sha: 'b' }]));
  assert.notEqual(sigBase, computeSourceSignature([{ ...base[0], installPath: '/q' }]));
});

test('defaultInstalledPluginsPath returns a path', () => {
  const p = defaultInstalledPluginsPath();
  assert.equal(typeof p, 'string');
  assert.ok(p.endsWith('installed_plugins.json'));
});
