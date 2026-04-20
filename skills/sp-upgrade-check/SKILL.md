---
name: sp-upgrade-check
description: 检查 SP/OMC/ECC 三层的版本兼容性和升级建议
triggers:
  - "升级检查"
  - "upgrade check"
  - "版本兼容"
---

# SP Upgrade Check

检查 SP/OMC/ECC 三层的版本兼容性，输出升级建议。

## Use When

- 定期版本兼容性检查
- 升级某一层后确认兼容性
- 排查因版本不匹配导致的问题

## Workflow

### 0. 获取数据

运行脚本获取版本兼容性数据：
```bash
node <sp-governance-path>/skills/sp-upgrade-check/check.mjs <workspace-root>
```
基于脚本输出的 JSON 数据进行后续分析和回答。

### 1. 读取各层版本

- SP: 从 plugin.json 或 package.json 读取
- OMC: 从探测路径的 package.json 读取
- ECC: 从 VERSION 文件或 package.json 读取

### 2. 兼容性检查

对照 SP 声明的兼容范围:
```
OMC: min_compatible = 1.0.0
ECC: min_compatible = 1.8.0, known_breaks = { "2.0.0": "Rust 重写，需重新验证" }
```

### 3. 适配层健康检查

验证适配层文件完整性:
- scripts/adapters/*.json (6 个文件)
- scripts/adapters/omc-adapter.mjs
- scripts/adapters/ecc-adapter.mjs
- scripts/lib/integration.mjs

### 4. 映射有效性检查

- omc-agent-map.json: 检查映射的 OMC Agent 是否在 OMC 安装中实际存在
- ecc-rules-map.json: 检查映射的 rules 目录是否在 ECC 安装中实际存在
- ecc-skill-augment.json: 检查引用的 ECC skill 是否实际存在

### 5. 输出报告

```
SP 升级兼容性报告
==================

版本矩阵:
  SP:  v9.0.0
  OMC: v2.1.0  (兼容范围: >= 1.0.0) ✓
  ECC: v1.10.0 (兼容范围: >= 1.8.0) ✓

适配层完整性: 9/9 文件 ✓

映射有效性:
  OMC Agent 映射:  10/10 有效 ✓
  ECC Rules 映射:  15/15 有效 ✓
  ECC Skill 增强:  10/10 有效 ✓
  (或列出失效的映射条目)

升级建议:
  · 无需操作
  (或具体建议)
```

## Notes

- 只读诊断操作
- 重点关注 ECC 的 skill rename 和目录变更
- known_breaks 中的版本需要人工审查适配层
