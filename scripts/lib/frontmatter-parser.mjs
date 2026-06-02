// frontmatter-parser.mjs — zero-dependency YAML subset for Claude Code agent/skill frontmatter
//
// Supports the subset actually used in agents/*.md and skills/*/SKILL.md:
//   - Top-of-file --- block
//   - One key:value per line
//   - Optional single/double quotes around value
//
// Does NOT support: nested keys, arrays, multi-line values, YAML refs.
// Failure mode: returns null if no frontmatter; skips malformed lines.

export function parseFrontmatter(content) {
  if (!content || typeof content !== 'string') return null;
  const match = content.match(/^---\n([\s\S]*?)\n---/);
  if (!match) return null;

  const result = {};
  for (const line of match[1].split('\n')) {
    const colonIdx = line.indexOf(':');
    if (colonIdx === -1) continue;
    const key = line.slice(0, colonIdx).trim();
    if (!key) continue;
    let value = line.slice(colonIdx + 1).trim();
    if ((value.startsWith('"') && value.endsWith('"')) ||
        (value.startsWith("'") && value.endsWith("'"))) {
      value = value.slice(1, -1);
    }
    result[key] = value;
  }
  return result;
}
