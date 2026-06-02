import { test } from 'node:test';
import assert from 'node:assert/strict';
import { parseFrontmatter } from '../frontmatter-parser.mjs';

test('parses standard frontmatter', () => {
  const result = parseFrontmatter('---\nname: architect\nmodel: opus\n---\nbody');
  assert.equal(result.name, 'architect');
  assert.equal(result.model, 'opus');
});

test('returns null when no frontmatter present', () => {
  assert.equal(parseFrontmatter('# just a heading'), null);
  assert.equal(parseFrontmatter(''), null);
});

test('strips single and double quotes from values', () => {
  const result = parseFrontmatter('---\nname: "quoted"\ndesc: \'single\'\n---\n');
  assert.equal(result.name, 'quoted');
  assert.equal(result.desc, 'single');
});

test('ignores lines without colons', () => {
  const result = parseFrontmatter('---\nname: x\njunk line\nmodel: y\n---\n');
  assert.equal(result.name, 'x');
  assert.equal(result.model, 'y');
  assert.equal(Object.keys(result).length, 2);
});

test('handles values containing colons', () => {
  const result = parseFrontmatter('---\nurl: https://example.com:8080/path\n---\n');
  assert.equal(result.url, 'https://example.com:8080/path');
});

test('handles CRLF line endings (Windows files)', () => {
  const content = '---\r\nname: x\r\nmodel: y\r\n---\r\nbody';
  const result = parseFrontmatter(content);
  assert.equal(result.name, 'x');
  assert.equal(result.model, 'y');
});

test('handles mixed CRLF and LF line endings', () => {
  const content = '---\r\nname: x\nmodel: y\r\n---\nbody';
  const result = parseFrontmatter(content);
  assert.equal(result.name, 'x');
  assert.equal(result.model, 'y');
});

test('returns null for null or undefined input', () => {
  assert.equal(parseFrontmatter(null), null);
  assert.equal(parseFrontmatter(undefined), null);
});

test('parses realistic agent frontmatter (commas, parens, numbers)', () => {
  const content = '---\nname: architect\ndescription: Strategic Architecture & Debugging Advisor (Opus, READ-ONLY)\nmodel: opus\nlevel: 3\ndisallowedTools: Write, Edit\n---\nbody';
  const result = parseFrontmatter(content);
  assert.equal(result.name, 'architect');
  assert.equal(result.description, 'Strategic Architecture & Debugging Advisor (Opus, READ-ONLY)');
  assert.equal(result.model, 'opus');
  assert.equal(result.level, '3');  // String, not number
  assert.equal(result.disallowedTools, 'Write, Edit');
});
