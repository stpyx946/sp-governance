// runtime-switch.mjs — detect runtime commands in user prompts
//
// Returns one of:
//   null                                            — no command detected
//   { action: 'disable_sp' }
//   { action: 'enable_sp' }
//   { action: 'set_default_trust', value: 'allow'|'deny'|'ask' }
//   { action: 'trust_marketplace', target: <name> }
//   { action: 'untrust', target: <name> }
//   { action: 'deny', target: <name> }
//   { action: 'reset_trust' }
//   { action: 'switch_engine', value: 'v9'|'v10' }
//
// Consumers (bootstrap-guard) emit additionalContext directives so Claude
// performs the actual Edit on .omc/sp.json. This module is pure detection.

const DISABLE_PATTERNS = [
  /关闭\s*sp\b/i,
  /禁用\s*sp\b/i,
  /\bdisable\s+sp\b/i,
  /\bsp\s+off\b/i,
];

const ENABLE_PATTERNS = [
  /启用\s*sp\b/i,
  /开启\s*sp\b/i,
  /\benable\s+sp\b/i,
  /\bsp\s+on\b/i,
];

export function detectRuntimeCommand(prompt) {
  if (!prompt || typeof prompt !== 'string') return null;
  const text = prompt.trim();
  if (!text) return null;

  // Order matters: more specific patterns first.

  // switch engine
  let m = text.match(/切换\s*sp\s*引擎\s*(v9|v10)/i);
  if (m) return { action: 'switch_engine', value: m[1].toLowerCase() };

  // reset trust
  if (/重置\s*sp\s*信任/i.test(text)) return { action: 'reset_trust' };

  // set default trust
  m = text.match(/(?:sp\s*)?信任\s*默认\s*(allow|deny|ask|信任|允许|拒绝|拉黑|询问)/i);
  if (m) {
    const raw = m[1].toLowerCase();
    let value = raw;
    if (raw === '信任' || raw === '允许') value = 'allow';
    else if (raw === '拒绝' || raw === '拉黑') value = 'deny';
    else if (raw === '询问') value = 'ask';
    return { action: 'set_default_trust', value };
  }

  // untrust / deny / 拉黑 (check BEFORE trust_marketplace so "取消信任" doesn't
  // match the bare "信任 X" pattern.)
  m = text.match(/取消信任\s+(\S+)/i);
  if (m) return { action: 'untrust', target: m[1] };
  m = text.match(/拉黑\s+(\S+)/i);
  if (m) return { action: 'deny', target: m[1] };

  // trust specific marketplace
  m = text.match(/信任\s*(?:marketplace\s+)?(\S+)/i);
  if (m && !/默认/.test(text)) {
    // Avoid matching "信任默认 allow" which was already handled above.
    return { action: 'trust_marketplace', target: m[1] };
  }

  // enable/disable SP (after more-specific so "sp on" doesn't shadow "sp 信任默认")
  for (const re of DISABLE_PATTERNS) {
    if (re.test(text)) return { action: 'disable_sp' };
  }
  for (const re of ENABLE_PATTERNS) {
    if (re.test(text)) return { action: 'enable_sp' };
  }

  return null;
}
