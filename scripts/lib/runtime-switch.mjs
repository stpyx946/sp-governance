// runtime-switch.mjs — detect runtime commands in user prompts
//
// Pure detection — returns one of these descriptors or null:
//   { action: 'disable_sp' | 'enable_sp' }
//   { action: 'set_default_trust', value: 'allow'|'deny'|'ask' }
//   { action: 'trust_marketplace' | 'untrust' | 'deny', target: <name> }
//   { action: 'reset_trust' }
//   { action: 'switch_engine', value: 'v9'|'v10' }
//
// Anti-false-positive: enable/disable require imperative form
// (start of line, or after only a Chinese/English polite prefix).
// This prevents prose like "I want to disable SP because..." from triggering.
//
// Consumers (bootstrap-guard) emit additionalContext directives so Claude
// performs the actual Edit on .omc/sp.json.

export const ACTIONS = Object.freeze({
  DISABLE_SP: 'disable_sp',
  ENABLE_SP: 'enable_sp',
  SET_DEFAULT_TRUST: 'set_default_trust',
  TRUST_MARKETPLACE: 'trust_marketplace',
  UNTRUST: 'untrust',
  DENY: 'deny',
  RESET_TRUST: 'reset_trust',
  SWITCH_ENGINE: 'switch_engine',
});

// Strip trailing list/sentence punctuation from a captured target.
function cleanTarget(t) {
  return t.replace(/[,，;；。.!?！？]+$/, '');
}

// Imperative prefix: ^ optionally followed by a polite word like "please/请/帮"
const IMPERATIVE = `^\\s*(?:please\\s+|请\\s*|帮(?:我)?\\s*)?`;

const DISABLE_PATTERNS = [
  new RegExp(`${IMPERATIVE}关闭\\s*sp\\b`, 'i'),
  new RegExp(`${IMPERATIVE}禁用\\s*sp\\b`, 'i'),
  new RegExp(`${IMPERATIVE}disable\\s+sp\\b`, 'i'),
  new RegExp(`${IMPERATIVE}sp\\s+off\\b`, 'i'),
];

const ENABLE_PATTERNS = [
  new RegExp(`${IMPERATIVE}启用\\s*sp\\b`, 'i'),
  new RegExp(`${IMPERATIVE}开启\\s*sp\\b`, 'i'),
  new RegExp(`${IMPERATIVE}enable\\s+sp\\b`, 'i'),
  new RegExp(`${IMPERATIVE}sp\\s+on\\b`, 'i'),
];

export function detectRuntimeCommand(prompt) {
  if (!prompt || typeof prompt !== 'string') return null;
  const text = prompt.trim();
  if (!text) return null;

  // Order matters: more specific patterns first.

  // 1. switch engine
  let m = text.match(/切换\s*sp\s*引擎\s*(v9|v10)/i);
  if (m) return { action: ACTIONS.SWITCH_ENGINE, value: m[1].toLowerCase() };

  // 2. reset trust
  if (/重置\s*sp\s*信任/i.test(text)) return { action: ACTIONS.RESET_TRUST };

  // 3. set default trust
  m = text.match(/(?:sp\s*)?信任\s*默认\s*(allow|deny|ask|信任|允许|拒绝|拉黑|询问)/i);
  if (m) {
    const raw = m[1].toLowerCase();
    let value = raw;
    if (raw === '信任' || raw === '允许') value = 'allow';
    else if (raw === '拒绝' || raw === '拉黑') value = 'deny';
    else if (raw === '询问') value = 'ask';
    return { action: ACTIONS.SET_DEFAULT_TRUST, value };
  }

  // 4. untrust / deny / 拉黑 (BEFORE trust_marketplace to avoid greedy match)
  m = text.match(/取消信任\s+(\S+)/i);
  if (m) {
    const target = cleanTarget(m[1]);
    if (target) return { action: ACTIONS.UNTRUST, target };
  }
  m = text.match(/拉黑\s+(\S+)/i);
  if (m) {
    const target = cleanTarget(m[1]);
    if (target) return { action: ACTIONS.DENY, target };
  }

  // 5. trust specific marketplace
  // First try the explicit "信任 marketplace <name>" form
  m = text.match(/信任\s+marketplace\s+(\S+)/i);
  if (m && !/默认/.test(text)) {
    const target = cleanTarget(m[1]);
    if (target && target !== 'marketplace') return { action: ACTIONS.TRUST_MARKETPLACE, target };
  }
  // Then the bare "信任 <name>" form, but only if not the default form
  // and not matching the literal word 'marketplace' (which means user gave no target)
  m = text.match(/信任\s+(\S+)/i);
  if (m && !/默认/.test(text)) {
    const target = cleanTarget(m[1]);
    if (target && target !== 'marketplace') return { action: ACTIONS.TRUST_MARKETPLACE, target };
  }

  // 6. enable/disable SP (imperative-anchored to avoid prose false-positives)
  for (const re of DISABLE_PATTERNS) {
    if (re.test(text)) return { action: ACTIONS.DISABLE_SP };
  }
  for (const re of ENABLE_PATTERNS) {
    if (re.test(text)) return { action: ACTIONS.ENABLE_SP };
  }

  return null;
}
