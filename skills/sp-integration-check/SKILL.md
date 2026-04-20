---
name: sp-integration-check
description: 检测 OMC/ECC 集成状态，输出三层架构运行报告
triggers:
  - "集成检查"
  - "integration check"
  - "三层状态"
---

# SP Integration Check

检测 SP/OMC/ECC 三层集成状态并输出报告。

## Use When

- 用户说"集成检查"、"integration check"、"三层状态"
- 需要确认 OMC 或 ECC 是否正确安装和配置
- 排查集成问题时

## Workflow

### 0. 获取数据

运行脚本获取真实状态数据：
```bash
node <sp-governance-path>/skills/sp-integration-check/check.mjs <workspace-root>
```
基于脚本输出的 JSON 数据进行后续分析和回答。

### 1. 读取集成状态

读取 .sp/integration.json，如不存在则执行探测。

### 2. 检测各层状态

对每一层执行：
- **SP Core**: 检查 portfolio.json 存在、hooks/hooks.json 存在、governance/ 目录完整
- **OMC**: 探测安装路径，读取版本号，验证兼容性（min_compatible: 1.0.0）
- **ECC**: 探测安装路径，读取版本号，验证兼容性（min_compatible: 1.8.0）

### 3. 检测 ECC Rules 覆盖

对 portfolio.json 中每个项目的 techStack，检查 ECC 是否有对应的 rules 目录。

### 4. 输出报告

```
SP Governance v9 — 三层集成报告
================================
运行模式: full / sp-omc / sp-ecc / sp-only

Layer 1 - ECC (质量层):
  状态:     ✓ active / ✗ 未安装
  版本:     v1.10.0
  兼容性:   ✓ compatible (min: 1.8.0)
  Rules 覆盖:
    AutoAIPost (vue)     → typescript/, web/  ✓
    AutoLinuxdo (python)  → python/           ✓
    CLIProxyAPI (go)      → golang/           ✓

Layer 2 - OMC (编排层):
  状态:     ✓ active / ✗ 未安装
  版本:     v2.x
  兼容性:   ✓ compatible (min: 1.0.0)

Layer 3 - SP Core (治理层):
  状态:     ✓ active
  版本:     v9.0.0
  项目:     6 个已注册
  Guards:   4/4 active
```

## Notes

- 只读操作，唯一写入是刷新 .sp/integration.json
- PM 可直接执行（治理管理操作）
