import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, mkdirSync, writeFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import {
  tokenize,
  scanPlugin,
  buildIndex,
  matchCapabilities,
  discoverCapabilities,
  getTrustedMCPPrefixes,
} from '../capability-discovery.mjs';

function makePluginDir(content = {}) {
  const root = mkdtempSync(join(tmpdir(), 'sp-cd-'));
  mkdirSync(join(root, 'agents'), { recursive: true });
  mkdirSync(join(root, 'skills', 'foo-skill'), { recursive: true });
  mkdirSync(join(root, 'commands'), { recursive: true });
  writeFileSync(join(root, 'agents', 'architect.md'),
    '---\nname: architect\ndescription: Strategic Architecture Advisor\nmodel: opus\n---\nbody');
  writeFileSync(join(root, 'agents', 'executor.md'),
    '---\nname: executor\ndescription: Code implementation specialist\nmodel: sonnet\n---\nbody');
  writeFileSync(join(root, 'skills', 'foo-skill', 'SKILL.md'),
    '---\nname: foo-skill\ndescription: Does a foo thing\n---\nbody');
  writeFileSync(join(root, 'commands', 'do-bar.md'),
    '---\nname: do-bar\ndescription: Performs bar\n---\nbody');
  return root;
}

test('tokenize extracts Chinese >=2 chars and English words', () => {
  const tokens = tokenize('帮我 review the code 审查');
  assert.ok(tokens.includes('review'));
  assert.ok(tokens.includes('code'));
  assert.ok(tokens.includes('审查'));
  assert.ok(!tokens.includes('the'));  // stopword
});

test('scanPlugin reads agents/skills/commands frontmatter', () => {
  const root = makePluginDir();
  try {
    const result = scanPlugin(root);
    assert.equal(result.agents.length, 2);
    assert.equal(result.skills.length, 1);
    assert.equal(result.commands.length, 1);
    const arch = result.agents.find(a => a.name === 'architect');
    assert.equal(arch.model, 'opus');
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});

test('buildIndex creates inverted index from capabilities', () => {
  const caps = {
    plugins: {
      'p@m': {
        agents: [{ name: 'reviewer', description: 'code review' }],
        skills: [],
        commands: [],
      },
    },
  };
  const idx = buildIndex(caps);
  assert.ok(idx.get('reviewer'));
  assert.ok(idx.get('code'));
  assert.ok(idx.get('review'));
});

test('matchCapabilities returns top-K scored matches', () => {
  const caps = {
    plugins: {
      'p@m': {
        agents: [
          { name: 'code-reviewer', description: 'reviews code carefully' },
          { name: 'architect', description: 'designs architecture' },
        ],
        skills: [],
        commands: [],
      },
    },
  };
  const idx = buildIndex(caps);
  const matches = matchCapabilities('please review my code', idx, { topK: 2, minScore: 1 });
  assert.ok(matches.length > 0);
  assert.equal(matches[0].name, 'code-reviewer');  // best match
});

test('matchCapabilities respects topK and minScore', () => {
  const caps = {
    plugins: {
      'p@m': {
        agents: [{ name: 'a', description: 'x' }, { name: 'b', description: 'x' }, { name: 'c', description: 'x' }],
        skills: [], commands: [],
      },
    },
  };
  const idx = buildIndex(caps);
  const all = matchCapabilities('x', idx, { topK: 2, minScore: 1 });
  assert.equal(all.length, 2);
  const none = matchCapabilities('zzz', idx, { topK: 5, minScore: 1 });
  assert.equal(none.length, 0);
});

test('getTrustedMCPPrefixes derives mcp__plugin_<name>_t__ from allowed plugins', () => {
  const allowed = [
    { plugin: 'oh-my-claudecode', marketplace: 'omc' },
    { plugin: 'sp-governance', marketplace: 'sp-governance' },
  ];
  const prefixes = getTrustedMCPPrefixes(allowed);
  assert.ok(prefixes.includes('mcp__plugin_oh-my-claudecode_t__'));
  assert.ok(prefixes.includes('mcp__plugin_sp-governance_t__'));
});
