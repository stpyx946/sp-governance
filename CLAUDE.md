# SP Governance Plugin (Lite, v10)

> 零耦合多项目治理层，基于 Claude Code 官方契约做能力发现，不写死任何上游插件名。

---

## 一、定位

SP Governance v10 是一个轻量治理层，与所有 Claude Code 上游插件解耦：

- **项目注册**: `portfolio.json` 记录工作空间内的项目、分组、技术栈、`governance_mode`
- **边界守护**: hooks 在涉及已注册项目时注入项目上下文 + 撮合候选 agent/skill
- **安全防护**: destructive guard 拦截危险的 Bash 命令
- **治理文件保护**: `governance/` 和 `agents/` 目录的修改需要用户审批
- **信任策略**: `.omc/sp.json::trust` 由用户决策；新插件默认 `ask`
- **零耦合发现**: 只读 `installed_plugins.json` + 各插件 frontmatter，不依赖任何具体插件名

**SP 不做的事：**
- 不限制工具使用（Glob、Grep、Read 等全部可用）
- 不强制 PM 角色（用户可以直接操作任何项目）
- 不要求 SP-ROLE 标记
- 不做启动诊断（静默创建 state，7 天刷新）
- 不写死上游插件的 agent/skill/mode/MCP 工具名

---

## 二、Agent 推荐机制

v10 不再使用固定 agent 映射表。`route-guard` 通过 `lib/capability-discovery.mjs` 在用户调用 Agent 工具时**自动撮合**：

1. 读 `~/.claude/plugins/installed_plugins.json` 获取已安装插件
2. 按 `.omc/sp.json::trust` 过滤出 allowed 插件
3. 扫描每个 allowed 插件的 `agents/*.md`、`skills/*/SKILL.md`、`commands/*.md` frontmatter
4. 建倒排索引（缓存在 `.omc/cache/capabilities.json`）
5. 把用户 prompt 分词、查索引、按 score 取 topK
6. 注入 `<sp-capability-match>JSON</sp-capability-match>` 给主模型解析

主模型直接据此 `Task(subagent_type=..., model=...)`，SP 不再硬编码任何 agent 名。

### 执行模式

模式名（autopilot / ultrawork / ralph / team / ralplan 等）来自上游插件自身的命令注册，SP 不维护映射。用户直接输入 `/<mode>` 即可。

---

## 三、项目注册

`portfolio.json` 记录所有已注册项目：

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
  "groups": {
    "group-name": {
      "description": "组描述",
      "projects": ["ProjectName"]
    }
  }
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

项目级别：A (>100 源文件) / B (≤100) / C (≤20)

---

## 四、Hooks

| Hook | 触发 | 作用 |
|------|------|------|
| bootstrap-guard | UserPromptSubmit | 子项目检测、运行时开关、信任指令检测、7 天 stale 刷新 |
| pm-allowlist-guard | PreToolUse (*) | 双角色 fail-closed allowlist；governance_mode 跳过；MCP 工具从信任策略动态推导 |
| route-guard | PreToolUse (Agent) | 项目上下文注入 + `<sp-capability-match>` JSON 注入 |
| destructive-guard | PreToolUse (Bash) | 危险命令拦截 (rm -rf、git push --force、DROP TABLE 等) |

三个非破坏性 hook 经 `engine-router.mjs` 调度，读 `.omc/sp.json::execution_engine`：v10（默认）或 v9（双轨回退）。

### 双角色模型

- **治理根目录 (portfolio.json 所在) → PM 角色**: fail-closed allowlist。可用 Glob/Grep/Read 导航，可写 `.md` 和管理路径，Bash 限只读
- **已注册子项目目录 (governance_mode=auto) → Team-Lead 角色**: 与 PM 相同的 fail-closed allowlist，但额外允许 WebFetch/WebSearch
- **governance_mode=readonly|off**: hook 完全跳过（不进入 Team-Lead）
- **MCP 工具**: prefix `mcp__plugin_<name>_t__*` 从 `trust.marketplaces[name]=allow` 的插件动态推导，未授权插件的 MCP 工具被拒绝

### 运行时指令

| 指令 | 动作 |
|------|------|
| `关闭SP` / `禁用SP` / `disable SP` / `sp off` | 创建 `.sp-disabled` |
| `启用SP` / `开启SP` / `enable SP` / `sp on` | 删除 `.sp-disabled` |
| `SP 信任默认 allow\|deny\|ask` | 写 `trust.default_policy` |
| `信任 marketplace <name>` | 写 `trust.marketplaces[name] = "allow"` |
| `取消信任 <name>` | 写 `"ask"` |
| `拉黑 <name>` | 写 `"deny"` |
| `重置 SP 信任` | 删除 `.omc/sp.json` |
| `切换 SP 引擎 v9\|v10` | 双轨切换 |

---

## 五、信任策略 (.omc/sp.json)

```json
{
  "version": "1.0",
  "schema": "sp-state-v1",
  "execution_engine": "v10",
  "trust": {
    "default_policy": "ask",
    "marketplaces": { "<mkt>": "allow|deny|ask" },
    "plugins": { "<mkt>/<plugin>": "allow|deny|ask" },
    "decisions": []
  },
  "config": {}
}
```

决策优先级：`plugins[mkt/plug]` > `marketplaces[mkt]` > `default_policy`。
文件损坏自动备份 `.bak.<ts>` 并重建默认。原子写（temp + rename）。

---

## 六、飞书自动化 (Feishu Integration)

| Skill | 触发词 | 说明 |
|-------|--------|------|
| sp-feishu-login | 飞书登录 | 会话登录 |
| sp-feishu-prd | PRD/产品需求 | PRD 文档生成 |
| sp-feishu-weekly | 周报/月报 | 周报月报生成 |
| sp-feishu-member-weekly | 成员周报 | 成员周报汇总 |
| sp-feishu-project-board | 创建飞书项目 | 项目空间初始化 |
| sp-feishu-bitable | 多维表格 | 多维表格管理 |
| sp-feishu-doc | 飞书文档 | 文档创建/读取 |
| sp-feishu-notify | 飞书通知 | Webhook 通知 |

依赖: playwright, marked, turndown
认证: `<workspace>/auth/`
