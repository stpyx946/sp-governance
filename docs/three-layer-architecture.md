# SP Governance v9 — 三层松耦合架构

## 概述

SP Governance v9 采用三层松耦合架构，以 SP 为核心治理壳，可选集成 OMC（编排层）和 ECC（质量层），实现渐进式能力增强。

## 架构图

```
┌──────────────────────────────────────────────────┐
│  Layer 3: SP Governance (治理壳)                  │
│  · portfolio.json 多项目注册与分组                 │
│  · 4 个 Guard Hook 权限/安全拦截                  │
│  · 40+ Skill 操作流程                            │
│  · 飞书集成                                      │
│  · 多项目通道选择 + 升级决策                      │
├──────────────────────────────────────────────────┤
│  Layer 2: OMC (编排层) [可选]                     │
│  · Agent 定义与调度                               │
│  · 执行模式 (ralph/autopilot/team/ultrawork)     │
│  · 团队协作                                      │
│  · 状态管理                                      │
├──────────────────────────────────────────────────┤
│  Layer 1: ECC (质量层) [可选]                     │
│  · 14 语言方向编码规范 (rules)                     │
│  · 34 质量门禁 Hook                               │
│  · 183 领域知识 Skill                             │
│  · 跨会话持续学习                                  │
├──────────────────────────────────────────────────┤
│  Layer 0: Claude Code (宿主平台)                  │
└──────────────────────────────────────────────────┘
```

## 运行模式

| 模式 | 条件 | 能力 |
|------|------|------|
| **SP-only** | 仅 SP 安装 | 治理守护 + SP Skill + 手动 Agent |
| **SP + OMC** | SP + OMC 安装 | + Agent 编排 + 执行模式 + 团队协作 |
| **SP + OMC + ECC** | 三者全部安装 | + 编码规范 + 质量门禁 + 持续学习 |

## 适配层

适配层位于 `scripts/adapters/`，是三层之间的松耦合桥接：

### 文件清单

| 文件 | 用途 |
|------|------|
| `omc-adapter.mjs` | OMC 编排适配器 (5 函数) |
| `ecc-adapter.mjs` | ECC 质量适配器 (7 函数) |
| `ecc-learning-bridge.mjs` | ECC 学习数据桥接 (Phase 2, v9.1 接入) |
| `omc-agent-map.json` | SP 角色 → OMC Agent 映射 |
| `omc-mode-router.json` | 任务特征 → 执行模式路由 |
| `ecc-rules-map.json` | techStack → ECC rules 映射 |
| `ecc-skill-augment.json` | SP Skill → ECC 知识增强 |
| `ecc-hook-profile.json` | ECC Hook 协调配置 |
| `integration-schema.json` | 集成状态 JSON Schema |

### 核心库

| 文件 | 用途 |
|------|------|
| `scripts/lib/integration.mjs` | 集成状态管理 (7 函数) |

## 依赖模型

```
SP → OMC:  可选，推荐（提供 Agent 编排能力）
SP → ECC:  可选，推荐（提供编码质量能力）
OMC → SP:  无依赖
OMC → ECC: 无依赖
ECC → SP:  无依赖
ECC → OMC: 无依赖
```

**核心原则：每层的存在都是可选增强，不是必要前提。**

## 降级策略

| 场景 | 行为 |
|------|------|
| OMC 不存在 | SP 直接调用 Agent 工具，串行执行 |
| ECC 不存在 | Agent 无外部编码规范，SP Skill 独立运行 |
| ECC Skill 被 rename | SP Skill 增强静默失效，核心功能不受影响 |
| ECC Hook ID 改名 | 禁用列表失效，可能出现重复拦截（可接受） |
| ECC 2.0 大版本 | 适配层需审查，SP 核心不受影响 |

## 兼容性

| 组件 | 最低版本 | 最高测试版本 |
|------|---------|------------|
| OMC | 1.0.0 | 2.5.0 |
| ECC | 1.8.0 | 1.10.0 |

## 依赖插件管理

SP Governance 的三层架构依赖以下插件。所有依赖无论是否可选，均纳入集成状态管理。

| 插件 | 项目路径 | GitHub 源 | 最低版本 | 必需 | 状态检测 |
|------|---------|-----------|---------|------|---------|
| oh-my-claudecode (OMC) | /workspace/own/everything-claude-code/../ 或 ~/.claude/plugins/oh-my-claudecode | https://github.com/anthropics/claude-code (内置) | 1.0.0 | 否 | integration.mjs detectOMC() |
| everything-claude-code (ECC) | /workspace/own/everything-claude-code | https://github.com/affaan-m/everything-claude-code | 1.8.0 | 否 | integration.mjs detectECC() |

### 插件缺失处理

bootstrap-guard 在会话启动时自动探测所有依赖插件。当检测到插件缺失时：

- **OMC 缺失**: 提示用户 "OMC 未检测到，SP 将以 sp-only/sp-ecc 模式运行。如需安装：`omc update` 或参考 OMC 文档"
- **ECC 缺失**: 提示用户 "ECC 未检测到，质量规则注入和学习数据桥接不可用。如需安装：`claude plugin marketplace add --source git --url https://github.com/affaan-m/everything-claude-code.git everything-claude-code && claude plugin install everything-claude-code@everything-claude-code`"
- **两者都缺失**: 提示用户 "SP 以纯治理模式运行（sp-only），如需完整三层能力请安装 OMC 和 ECC"

### 运行模式自动判定

| 模式 | OMC | ECC | 能力 |
|------|-----|-----|------|
| full | ✓ | ✓ | 治理 + 执行调度 + 质量规则 |
| sp-omc | ✓ | ✗ | 治理 + 执行调度 |
| sp-ecc | ✗ | ✓ | 治理 + 质量规则 |
| sp-only | ✗ | ✗ | 纯治理（边界守护 + 安全防护）|

## 集成状态文件

`.sp/integration.json` 存储在工作空间根目录，记录三层的检测状态、版本、路径和功能开关。由 Bootstrap Guard 在会话启动时自动刷新（24h 缓存）。

## 新增 Skill

| Skill | 功能 |
|-------|------|
| `sp-integration-check` | 三层集成状态报告 |
| `sp-install-omc` | OMC 安装引导 |
| `sp-install-ecc` | ECC 安装引导 |
| `sp-upgrade-check` | 版本兼容性检查 |
