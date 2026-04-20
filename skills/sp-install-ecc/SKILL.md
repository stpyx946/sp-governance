---
name: sp-install-ecc
description: 引导安装 everything-claude-code (ECC) 质量层
triggers:
  - "安装ECC"
  - "install ecc"
  - "安装质量"
---

# SP Install ECC

引导安装 everything-claude-code 作为 SP 的质量层。

## Use When

- SP 检测到 ECC 未安装时的引导
- 用户主动要求安装 ECC
- 升级 ECC 版本

## Workflow

### 0. 获取数据

运行脚本获取真实安装状态：
```bash
node <sp-governance-path>/skills/sp-install-ecc/check.mjs
```
基于脚本输出的 JSON 数据进行后续分析和回答。

### 1. 检测现有安装

检查以下路径是否存在 ECC:
- ~/.claude/plugins/everything-claude-code
- ~/.claude/plugins/ecc
- ~/.claude/plugins/cache/everything-claude-code

### 2. 如果已安装

读取版本号，检查兼容性。输出:
```
ECC 已安装: v{version}
兼容性: ✓ / ✗ (SP 要求 >= 1.8.0)
```

### 3. 如果未安装

提示用户执行 ECC 安装命令:
```
建议安装方式:
  npm install -g ecc-universal
  npx ecc install --profile developer --target claude

或通过 Claude Code plugin:
  claude plugin install everything-claude-code
```

### 4. 配置 ECC Hook Profile

安装完成后自动配置:
- 设置 ECC_HOOK_PROFILE=standard
- 禁用与 SP 重叠的 GateGuard hook

### 5. 检测 Rules 覆盖

根据 portfolio.json 中的项目 techStack，检查 ECC 是否有对应的语言规则:
```
Rules 覆盖检查:
  AutoAIPost (vue)     → typescript/ ✓, web/ ✓
  AutoLinuxdo (python)  → python/ ✓
  CLIProxyAPI (go)      → golang/ ✓

如需安装额外语言规则:
  npx ecc <language>
```

### 6. 更新集成状态

更新 .sp/integration.json，记录 ECC 路径和版本。

## Notes

- SP 不直接执行 npm install，只提供引导信息
- ECC 安装后的 Hook 协调由 Bootstrap Guard 自动完成
