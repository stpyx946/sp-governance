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
