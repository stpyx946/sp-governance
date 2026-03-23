# sp-governance Plugin Installation

## Prerequisites

- Claude Code CLI (`claude`) installed and available in PATH

## Install

```bash
# 1. Unzip plugin to marketplace directory
unzip sp-governance-v7.1.zip -d ~/.claude/plugins/marketplaces/sp-governance/

# 2. Register as local marketplace
claude plugin marketplace add ~/.claude/plugins/marketplaces/sp-governance

# 3. Install plugin
claude plugin install sp-governance@sp-governance

# 4. Inject SP awareness into global CLAUDE.md
node ~/.claude/plugins/sp-governance/scripts/sp-install-claudemd.mjs
```

Step 4 injects a lightweight SP awareness block into `~/.claude/CLAUDE.md`.
The script is idempotent — safe to run multiple times.

## Runtime Commands

Once installed, you can control SP governance per-workspace:

- **Enable**: Type `启用SP` or `enable SP` in any Claude session
- **Disable**: Type `关闭SP` or `disable SP` in any Claude session

## Update (after modifying plugin files)

```bash
claude plugin marketplace update sp-governance
claude plugin update sp-governance@sp-governance
# Re-run CLAUDE.md injection to pick up any snippet changes
node ~/.claude/plugins/sp-governance/scripts/sp-install-claudemd.mjs
```

## Repackage (after modifications)

```bash
node ~/.claude/plugins/sp-governance/scripts/sp-pack.mjs --output-dir ~/Desktop
```

## Uninstall

```bash
# Remove SP block from global CLAUDE.md
node ~/.claude/plugins/sp-governance/scripts/sp-install-claudemd.mjs --uninstall

# Remove plugin
claude plugin uninstall sp-governance@sp-governance
claude plugin marketplace remove sp-governance
rm -rf ~/.claude/plugins/marketplaces/sp-governance
```

## Verify

```bash
claude plugin list
# Should show: sp-governance@sp-governance (enabled)
```
