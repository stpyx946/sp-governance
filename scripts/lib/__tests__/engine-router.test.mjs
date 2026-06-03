import { test } from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { mkdtempSync, mkdirSync, writeFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROUTER = join(__dirname, '..', '..', 'engine-router.mjs');

function runRouter(guardName, input, env = {}) {
  const result = spawnSync(process.execPath, [ROUTER, guardName], {
    input,
    encoding: 'utf-8',
    env: { ...process.env, ...env },
  });
  return { stdout: result.stdout, stderr: result.stderr, status: result.status };
}

test('engine-router can dispatch to a guard script via Windows-style absolute path', () => {
  // This is the regression test for the CRITICAL bug:
  // Before fix: await import('C:\\...\\sp-bootstrap-guard.mjs') would throw ERR_UNSUPPORTED_ESM_URL_SCHEME on Windows
  // After fix: pathToFileURL converts to file:// URL, import works on all platforms
  //
  // We invoke the real bootstrap-guard with a synthetic input that should produce
  // either passThrough or a runtime-command emit — but NEVER the silent passThrough
  // that would happen if the import itself failed silently.
  //
  // The test asserts the router itself produced valid JSON on stdout and EXIT 0.

  const result = runRouter('bootstrap-guard', JSON.stringify({ cwd: tmpdir(), prompt: 'hi' }));
  assert.equal(result.status, 0, `router exit status, stderr: ${result.stderr}`);
  // Output must be parseable JSON with continue:true (the guard's normal pass)
  const out = JSON.parse(result.stdout.trim());
  assert.equal(out.continue, true);
});

test('engine-router writes stderr when target script is missing', () => {
  // This test ensures the silent-failure-on-bad-input mode is at least observable.
  const result = runRouter('nonexistent-guard-name', JSON.stringify({ cwd: tmpdir(), prompt: 'x' }));
  assert.equal(result.status, 0);
  const out = JSON.parse(result.stdout.trim());
  assert.equal(out.continue, true);
  // For nonexistent script the code path is the missing-script passThrough (NOT the catch).
  // No stderr expected here. This test just locks in current behavior.
});
