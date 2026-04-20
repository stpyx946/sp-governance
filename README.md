# SP Governance Plugin

三层架构多项目治理层，为 Claude Code 提供项目边界守护、安全防护，并与 OMC 执行层和 ECC 质量层协作。

SP Governance v9 采用三层架构（SP 治理层 / OMC 执行层 / ECC 质量层），废弃所有 `sp-governance:sp-*` agents，统一使用 OMC agents (`oh-my-claudecode:*`)。SP 负责项目注册、边界守护、危险操作拦截和集成协调。

**版本**: 9.0.0 | **作者**: leosyli | **许可证**: UNLICENSED

---

## 特性

- **轻量治理** -- 不限制工具使用，不强制角色分配，不要求启动诊断
- **子项目自动跳过** -- 在已注册项目目录内打开 Claude Code 时，所有 SP hooks 自动绕过
- **Destructive Guard** -- 拦截危险 Bash 命令（rm -rf、git push --force 等）
- **治理文件保护** -- governance/ 和 agents/ 目录写入需用户审批
- **项目上下文注入** -- Agent 调用涉及已注册项目时自动注入项目信息
- **7 天静默缓存** -- bootstrap state 自动管理，无需手动诊断
- **Skill System** -- 30+ 预置 skill 覆盖构建、测试、部署、审查等场景
- **飞书集成** -- 8 个飞书自动化 skill（PRD、周报、项目看板等）
- **与 OMC 共存** -- hooks 互不干扰，命名空间独立

---

## 快速开始

### 安装

```bash
# 1. 注册为本地 marketplace
claude plugin marketplace add ~/.claude/plugins/marketplaces/sp-governance

# 2. 安装插件
claude plugin install sp-governance@sp-governance

# 3. 注入 SP 感知块到全局 CLAUDE.md
node ~/.claude/plugins/sp-governance/scripts/sp-install-claudemd.mjs
```

### 运行时控制

- **启用**: `启用SP` / `enable SP` / `sp on`
- **禁用**: `关闭SP` / `disable SP` / `sp off`

---

## 架构概览

### 三层架构

```
┌─────────────────────────────────────────┐
│  SP 治理层 (sp-governance)              │
│  项目注册 · 边界守护 · 安全防护 · 集成协调  │
├─────────────────────────────────────────┤
│  OMC 执行层 (oh-my-claudecode)          │
│  Agent 编排 · 任务执行 · 并行调度         │
├─────────────────────────────────────────┤
│  ECC 质量层 (everything-claude-code)     │
│  规则学习 · 质量门禁 · 持续改进（可选）     │
└─────────────────────────────────────────┘
```

运行模式: `full` (三层完整) / `sp-omc` (SP+OMC) / `sp-ecc` (SP+ECC) / `sp-only` (纯治理)

### Hook 流程

```
用户输入 (UserPromptSubmit)
  └─→ sp-bootstrap-guard.mjs
       子项目检测 → 运行时开关 → state 管理（静默）

工具调用前 (PreToolUse)
  ├─→ sp-pm-allowlist-guard.mjs  [匹配: 所有工具]
  │    双角色: workspace 根=PM(fail-closed), 子项目=Team-Lead(全放行)
  │    PM 可用 Glob/Grep/Read 导航，可写 .md 文档（plan 模式不受限）
  │    子 agent 自动跳过
  │
  ├─→ sp-route-guard.mjs  [匹配: Agent]
  │    子项目跳过 → 项目上下文注入（信息性，不阻断）
  │
  └─→ sp-destructive-guard.mjs  [匹配: Bash]
       危险命令拦截（rm -rf, git push --force 等）
```

所有 hook 超时 5 秒，超时视为允许（fail-open，destructive guard 除外）。

### 子项目检测

三个 guard 共享相同逻辑：读取 portfolio.json 中的项目列表，检查当前 CWD 是否在某个已注册项目目录内。如果是，该 guard 直接 passThrough，不施加任何限制。

### 目录结构

```
sp-governance/
├── .claude-plugin/          # 插件元数据
├── agents/_archived/        # v7 agent 定义存档
├── governance/              # 治理规则参考
├── hooks/hooks.json         # hook 注册
├── scripts/                 # hook 实现
│   ├── sp-bootstrap-guard.mjs
│   ├── sp-pm-allowlist-guard.mjs
│   ├── sp-route-guard.mjs
│   ├── sp-destructive-guard.mjs
│   └── lib/
├── skills/                  # 30+ 预置 skill
├── templates/               # 项目配置模板
├── docs/                    # 文档
└── CLAUDE.md                # 治理规则
```

---

## Agent 使用

v9 起统一使用 OMC agents（v7 的 `sp-governance:sp-*` agents 已废弃）：

| 任务 | OMC Agent |
|------|-----------|
| 架构分析 | `oh-my-claudecode:architect` |
| 代码实现 | `oh-my-claudecode:executor` |
| 代码审查 | `oh-my-claudecode:code-reviewer` |
| 测试编写 | `oh-my-claudecode:test-engineer` |
| 文档编写 | `oh-my-claudecode:writer` |
| 安全审查 | `oh-my-claudecode:security-reviewer` |
| 调试分析 | `oh-my-claudecode:debugger` |
| 代码搜索 | `oh-my-claudecode:explore` |
| 方案规划 | `oh-my-claudecode:planner` |

v7 的 `sp-governance:sp-*` agents 已废弃并归档至 `agents/_archived/`。迁移详情见 [MIGRATION.md](MIGRATION.md)。

---

## 项目管理

### portfolio.json

项目注册缓存，由引导协议自动生成：

```json
{
  "projects": [
    {
      "name": "ProjectName",
      "path": "ProjectName",
      "tech_stack": "nodejs",
      "framework": "nextjs",
      "level": "A",
      "group": "group-name",
      "governance_mode": "auto"
    }
  ],
  "groups": { ... }
}
```

### 项目分级

| 级别 | 源文件数 |
|------|----------|
| C 级 | ≤20 |
| B 级 | ≤100 |
| A 级 | >100 |

---

## Skills 列表

30+ 预置 skill，涵盖：构建 (node/java/nuxt/electron/docker/python)、测试 (jest/vitest/playwright/pytest)、代码质量 (lint/typecheck/dep-audit)、架构 (arch-analysis/api-contract/prisma)、部署 (deploy-check/cf-deploy/release)、飞书集成 (login/prd/weekly/bitable/doc/notify)。

---

## 版本历史

| 版本 | 说明 |
|------|------|
| 9.0.0 | 三层架构：废弃 SP agents，引入 OMC 执行层 + ECC 质量层集成，新增 5 个集成 skill |
| 8.0.0 | 轻量化重构：去掉 PM 角色限制和 SP agents，统一使用 OMC agents，子项目自动跳过 |
| 7.3.x | PM fail-closed allowlist 模型，9 个专用 agents，24h 强制诊断 |

详细变更记录见 [CHANGELOG.md](CHANGELOG.md)。

---

## License

UNLICENSED
