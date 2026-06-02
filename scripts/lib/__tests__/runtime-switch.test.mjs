import { test } from 'node:test';
import assert from 'node:assert/strict';
import { detectRuntimeCommand } from '../runtime-switch.mjs';

test('detects disable SP commands', () => {
  for (const kw of ['关闭SP', '禁用SP', 'disable SP', 'sp off']) {
    const cmd = detectRuntimeCommand(kw);
    assert.equal(cmd?.action, 'disable_sp', `failed: ${kw}`);
  }
});

test('detects enable SP commands', () => {
  for (const kw of ['启用SP', '开启SP', 'enable SP', 'sp on']) {
    const cmd = detectRuntimeCommand(kw);
    assert.equal(cmd?.action, 'enable_sp', `failed: ${kw}`);
  }
});

test('detects set default trust policy', () => {
  let cmd = detectRuntimeCommand('SP 信任默认 allow');
  assert.equal(cmd?.action, 'set_default_trust');
  assert.equal(cmd?.value, 'allow');
  cmd = detectRuntimeCommand('SP 信任默认 deny');
  assert.equal(cmd?.value, 'deny');
  cmd = detectRuntimeCommand('SP 信任默认 ask');
  assert.equal(cmd?.value, 'ask');
});

test('detects trust marketplace', () => {
  const cmd = detectRuntimeCommand('信任 marketplace omc');
  assert.equal(cmd?.action, 'trust_marketplace');
  assert.equal(cmd?.target, 'omc');
});

test('detects untrust marketplace', () => {
  const cmd = detectRuntimeCommand('取消信任 omc');
  assert.equal(cmd?.action, 'untrust');
  assert.equal(cmd?.target, 'omc');
});

test('detects deny marketplace', () => {
  const cmd = detectRuntimeCommand('拉黑 evil-mkt');
  assert.equal(cmd?.action, 'deny');
  assert.equal(cmd?.target, 'evil-mkt');
});

test('detects reset trust', () => {
  const cmd = detectRuntimeCommand('重置 SP 信任');
  assert.equal(cmd?.action, 'reset_trust');
});

test('detects engine switch', () => {
  let cmd = detectRuntimeCommand('切换 SP 引擎 v9');
  assert.equal(cmd?.action, 'switch_engine');
  assert.equal(cmd?.value, 'v9');
  cmd = detectRuntimeCommand('切换 SP 引擎 v10');
  assert.equal(cmd?.value, 'v10');
});

test('returns null for unrelated prompts', () => {
  assert.equal(detectRuntimeCommand('please review my code'), null);
  assert.equal(detectRuntimeCommand(''), null);
  assert.equal(detectRuntimeCommand(null), null);
});

test('does NOT trigger disable on prose mention', () => {
  assert.equal(detectRuntimeCommand('I want to disable SP because it broke'), null);
  assert.equal(detectRuntimeCommand('我已经关闭SP了'), null);
  assert.equal(detectRuntimeCommand('I disabled SP yesterday'), null);
  assert.equal(detectRuntimeCommand('he tried to disable sp but failed'), null);
});

test('does trigger disable on imperative form', () => {
  assert.equal(detectRuntimeCommand('disable SP')?.action, 'disable_sp');
  assert.equal(detectRuntimeCommand('please disable SP')?.action, 'disable_sp');
  assert.equal(detectRuntimeCommand('请关闭SP')?.action, 'disable_sp');
  assert.equal(detectRuntimeCommand('帮我关闭SP')?.action, 'disable_sp');
  assert.equal(detectRuntimeCommand('关闭SP')?.action, 'disable_sp');
});

test('信任 marketplace without target is null (not literal "marketplace")', () => {
  assert.equal(detectRuntimeCommand('信任 marketplace'), null);
});

test('trailing punctuation is stripped from target', () => {
  const cmd = detectRuntimeCommand('拉黑 omc,');
  assert.equal(cmd?.action, 'deny');
  assert.equal(cmd?.target, 'omc');
});
