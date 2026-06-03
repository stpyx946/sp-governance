# SP Governance Plugin

零耦合多项目治理插件，基于 Claude Code 官方契约（`installed_plugins.json` + frontmatter）做能力发现。提供项目边界守护、危险命令拦截、上游能力自动撮合。

SP v10 重构核心：放弃 v9 的三层架构与硬编码上游名映射，改为运行时 capability discovery + 用户主权的信任策略 (`.omc/sp.json`)。**v10 代码中不出现任何具体上游插件名**（agent / skill / marketplace / MCP tool）。

**版本**: 10.0.0 | **作者**: leosyli | **许可证**: UNLICENSED

---

## 特性

- **零耦合发现** — SP 只读 Claude Code 官方契约（插件目录结构 + frontmatter），不依赖任何具体上游名
- **分级信任** — `.omc/sp.json::trust` 由用户主控；新插件默认 `ask`，由用户决策 allow/deny
- **自动撮合** — `route-guard` 注入 `<sp-capability-match>JSON</sp-capability-match>`，让主模型按 description token 匹配选择合适的 agent/skill/command
- **双角色 Allowlist** — workspace 根 = PM，子项目 = Team-Lead；MCP 工具放行从信任策略动态推导
- **governance_mode 字段** — `auto` / `readonly` / `off` / `external` 分级控制每个子项目的治理力度
- **Destructive Guard** — 拦截危险 Bash 命令（rm -rf、git push --force、DROP TABLE 等）
- **子项目自动跳过** — 已注册项目目录内打开 Claude Code 时所有 SP hooks 自动绕过
- **7 天静默缓存** — bootstrap state 自动管理，无需手动诊断
- **双轨回退** — v9 hooks 保留为 `*.v9.mjs`，可通过 `sp.json::execution_engine = "v9"` 切换
- **Skill System** — 30+ 预置 skill 覆盖构建、测试、部署、审查、飞书集成等场景

---

## 快速开始

### 安装

```bash
# 1. 注册为本地 marketplace
claude plugin marketplace add ~/.claude/plugins/marketplaces/sp-governance

# 2. 安装插件
claude plugin install sp-governance@sp-governance

# 3. 注入 SP 感知块到工作空间 CLAUDE.md
node ~/.claude/plugins/sp-governance/scripts/sp-install-claudemd.mjs
```

### 从 v9 升级

```bash
node ~/.claude/plugins/sp-governance/scripts/migrate-v9-to-v10.mjs
```

迁移会自动备份 v9 状态文件并生成 `.omc/sp.json`。详见 [MIGRATION-V10.md](MIGRATION-V10.md)。

### 运行时控制

| 指令 | 动作 |
|------|------|
| `启用SP` / `enable SP` / `sp on` | 启用 SP 治理 |
| `关闭SP` / `disable SP` / `sp off` | 停用 SP 治理 |
| `SP 信任默认 allow\|deny\|ask` | 修改 `trust.default_policy` |
| `信任 marketplace <name>` | 写 `trust.marketplaces[name] = "allow"` |
| `取消信任 <name>` / `拉黑 <name>` | 写 `"ask"` / `"deny"` |
| `重置 SP 信任` | 删除 `.omc/sp.json` 重新引导 |
| `切换 SP 引擎 v9\|v10` | 双轨切换（v9 fallback） |

---

## 架构概览

### v10 数据流

```
~/.claude/plugins/installed_plugins.json (Claude Code 官方契约)
       │
       ▼
lib/plugin-index.mjs                     ← 读取 + sha256 source signature
       │
       ▼
lib/trust-policy.mjs (.omc/sp.json)      ← 用户主控的信任决策
       │
       ▼ filterByTrust → allowed/denied/pending
       │
       ▼
lib/capability-discovery.mjs              ← 扫描 frontmatter，倒排索引
       │                                    缓存到 .omc/cache/capabilities.json
       ▼ matchCapabilities(prompt)
       │
       ▼
route-guard 注入 <sp-capability-match>JSON</sp-capability-match>
```

### Hook 流程

```
用户输入 (UserPromptSubmit)
  └─→ engine-router.mjs bootstrap-guard
       ├─→ sp-bootstrap-guard.mjs (v10) ← 默认
       └─→ sp-bootstrap-guard.v9.mjs    ← sp.json::execution_engine="v9"

工具调用前 (PreToolUse)
  ├─→ engine-router.mjs pm-allowlist-guard  [* matcher]
  │    双角色 + governance_mode 跳过 + MCP allowlist 从 trust 动态推导
  │
  ├─→ engine-router.mjs route-guard          [Agent matcher]
  │    项目上下文注入 + 能力撮合 JSON
  │
  └─→ sp-destructive-guard.mjs               [Bash matcher] (单轨)
       破坏性命令模式匹配 + PM 范围校验
```

所有 hook 超时 5 秒，超时视为允许（fail-open，destructive guard 除外）。
单次 hook 平均耗时 < 30ms（缓存命中）；全量重扫 < 500ms。

### 目录结构

```
sp-governance/
├── .claude-plugin/              # 插件元数据
├── hooks/hooks.json             # hook 注册
├── scripts/
│   ├── run.cjs
│   ├── engine-router.mjs        # v9/v10 dispatcher
│   ├── sp-bootstrap-guard.mjs   # v10
│   ├── sp-pm-allowlist-guard.mjs # v10
│   ├── sp-route-guard.mjs       # v10
│   ├── sp-destructive-guard.mjs # 单轨保留
│   ├── sp-bootstrap-guard.v9.mjs    # v9 双轨保留
│   ├── sp-pm-allowlist-guard.v9.mjs # v9 双轨保留
│   ├── sp-route-guard.v9.mjs        # v9 双轨保留
│   ├── migrate-v9-to-v10.mjs    # 升级脚本
│   └── lib/
│       ├── portfolio.mjs            # 30s LRU + governance helpers
│       ├── frontmatter-parser.mjs   # 零依赖 YAML 子集
│       ├── stopwords.mjs            # CN+EN 停用词
│       ├── plugin-index.mjs         # installed_plugins.json 读取
│       ├── trust-policy.mjs         # .omc/sp.json 读写
│       ├── capability-discovery.mjs # 倒排索引 + 缓存
│       ├── runtime-switch.mjs       # 关键词检测
│       ├── bootstrap-state.mjs      # 7-day stale 管理
│       ├── integration-probe.mjs    # 二元模式探测
│       ├── audit-log.mjs            # 审计日志（rotation）
│       └── stdin.mjs
├── skills/                      # 30+ 预置 skill
├── templates/                   # 项目配置模板
├── docs/                        # 文档
└── CLAUDE.md                    # 治理规则
```

---

## Agent 推荐

v10 不再使用固定 agent 映射表。`route-guard` 根据用户 prompt 通过 `discoverCapabilities() + matchCapabilities()` 自动撮合，注入 JSON 候选列表：

```html
<sp-capability-match>
{
  "prompt_keywords": ["审查", "code"],
  "matches": [
    {
      "plugin": "<plugin-key>",
      "name": "<agent-name>",
      "kind": "agent",
      "model": "opus",
      "score": 4
    }
  ]
}
</sp-capability-match>
```

主模型解析后可直接 `Task(subagent_type=..., model=...)`。SP 不写死任何具体 agent/skill 名。

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

### governance_mode 字段

| 值 | 含义 | hooks 行为 |
|---|---|---|
| `auto` (默认) | 全部 hooks 生效 | 进入 → Team-Lead 角色 |
| `readonly` | 只读 fork/学习材料 | 子项目检测跳过；不进入 Team-Lead |
| `off` | 完全关闭 SP 干预 | 同 readonly + destructive guard 也不拦截 |
| `external` | 不在本仓库的占位 | 子项目检测跳过 |

使用 `/sp-governance:sp-classify-projects` skill 半自动批量迁移。

### 项目分级

| 级别 | 源文件数 |
|------|----------|
| C 级 | ≤20 |
| B 级 | ≤100 |
| A 级 | >100 |

---

## 信任策略 (.omc/sp.json)

```json
{
  "version": "1.0",
  "schema": "sp-state-v1",
  "execution_engine": "v10",
  "trust": {
    "default_policy": "ask",
    "marketplaces": { "<mkt-name>": "allow|deny|ask" },
    "plugins": { "<mkt>/<plugin>": "allow|deny|ask" },
    "decisions": []
  },
  "config": {}
}
```

**决策优先级**：`plugins[mkt/plug]` > `marketplaces[mkt]` > `default_policy`

文件损坏自动备份为 `.omc/sp.json.bak.<ts>` 并重建默认。原子写（temp + rename）。

---

## v10 核心 Skills

| Skill | 用途 |
|-------|------|
| `sp-bootstrap` | 首次启用引导 + 7 天 stale 刷新 |
| `sp-status` | 只读状态显示 |
| `sp-discovery-status` | capability discovery 状态报告 |
| `sp-trust-edit` | 对话式编辑信任策略 |
| `sp-classify-projects` | 半自动批量迁移 governance_mode |

完整 30+ skill 涵盖：构建（node/java/nuxt/electron/docker/python）、测试（jest/vitest/playwright/pytest）、代码质量（lint/typecheck/dep-audit）、架构（arch-analysis/api-contract/prisma）、部署（deploy-check/cf-deploy/release）、飞书集成（login/prd/weekly/bitable/doc/notify）。

---

## 版本历史

| 版本 | 说明 |
|------|------|
| **10.0.0** | **零耦合 capability discovery，移除 adapters 与硬编码上游名，引入 sp.json 信任策略，9 个新 lib 模块，双轨 v9 保留** |
| 9.0.0 | 三层架构：废弃 SP agents，引入 OMC 执行层 + ECC 质量层集成 |
| 8.0.0 | 轻量化重构：去掉 PM 角色限制和 SP agents，统一使用 OMC agents |
| 7.3.x | PM fail-closed allowlist 模型，9 个专用 agents，24h 强制诊断 |

详细变更记录见 [CHANGELOG.md](CHANGELOG.md)。v9→v10 迁移指南见 [MIGRATION-V10.md](MIGRATION-V10.md)。

---

## License

UNLICENSED
