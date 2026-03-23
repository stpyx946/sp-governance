# SP Governance Plugin

多项目 Portfolio 治理插件，为 Claude Code 提供角色物理约束和项目级管控。

SP Governance 在 Claude Code 会话中引入 Portfolio Manager (PM) 角色，通过 hook 物理拦截和 agent 工具约束，实现多项目环境下的角色分离、权限隔离和流程管控。PM 作为调度者协调 9 个专职 agent，每个 agent 拥有独立的工具权限边界，确保架构师不能改代码、审查员不能写文件、编码员必须在 worktree 中隔离执行。

**版本**: 7.3.0 | **作者**: leosyli | **许可证**: UNLICENSED

---

## 目录

- [特性](#特性)
- [快速开始](#快速开始)
- [架构概览](#架构概览)
- [Agent 角色](#agent-角色)
- [Skills 列表](#skills-列表)
- [治理规则概要](#治理规则概要)
- [PM 工具约束](#pm-工具约束)
- [配置说明](#配置说明)
- [版本历史](#版本历史)
- [License](#license)

---

## 特性

- **PM Allowlist Guard** -- fail-closed 白名单模型，PM 仅能使用明确允许的工具，未知工具默认拒绝
- **角色物理约束** -- 9 个专职 agent 各自拥有框架级 `disallowedTools` 约束，不依赖 prompt 遵守
- **Bootstrap Protocol** -- 会话启动时自动检测 portfolio.json，执行引导检查、漂移检测、健康诊断
- **Route Guard** -- Agent 调用时校验 SP-ROLE 标记与 agent 类型匹配关系
- **Destructive Guard** -- 拦截危险 Bash 命令（文件重定向、强制 git 操作等）
- **Skill System** -- 30 个预置 skill 覆盖构建、测试、部署、审查等场景
- **项目分级管理** -- 按源文件数自动分级（C/B/A 级），治理强度随级别递增
- **技术栈自动检测** -- 支持 Java、Node.js、Rust、Go、Python、.NET、PHP、Flutter 及主流 Monorepo 方案
- **与 OMC 共存** -- `sp-governance:sp-*` 与 `oh-my-claudecode:*` 命名空间独立，hook 互不干扰

---

## 快速开始

### 前置条件

- Claude Code CLI (`claude`) 已安装并在 PATH 中可用

### 安装

```bash
# 1. 解压插件到 marketplace 目录
unzip sp-governance-v7.1.zip -d ~/.claude/plugins/marketplaces/sp-governance/

# 2. 注册为本地 marketplace
claude plugin marketplace add ~/.claude/plugins/marketplaces/sp-governance

# 3. 安装插件
claude plugin install sp-governance@sp-governance

# 4. 注入 SP 感知块到全局 CLAUDE.md
node ~/.claude/plugins/sp-governance/scripts/sp-install-claudemd.mjs
```

第 4 步是幂等操作，可安全重复执行。

### 验证

```bash
claude plugin list
# 应显示: sp-governance@sp-governance (enabled)
```

### 运行时控制

在任意 Claude 会话中：

- **启用**: `启用SP` / `enable SP` / `sp on`
- **禁用**: `关闭SP` / `disable SP` / `sp off`

### 更新

```bash
claude plugin marketplace update sp-governance
claude plugin update sp-governance@sp-governance
node ~/.claude/plugins/sp-governance/scripts/sp-install-claudemd.mjs
```

### 卸载

```bash
node ~/.claude/plugins/sp-governance/scripts/sp-install-claudemd.mjs --uninstall
claude plugin uninstall sp-governance@sp-governance
claude plugin marketplace remove sp-governance
rm -rf ~/.claude/plugins/marketplaces/sp-governance
```

---

## 架构概览

### 目录结构

```
sp-governance/
├── .claude-plugin/
│   ├── plugin.json          # 插件元数据 (名称、版本、描述)
│   └── marketplace.json     # marketplace 注册信息
├── agents/                  # 9 个 agent 定义文件
│   ├── sp-architect.md
│   ├── sp-coder.md
│   ├── sp-reviewer.md
│   ├── sp-tester.md
│   ├── sp-team-lead.md
│   ├── sp-group-lead.md
│   ├── sp-doc-engineer.md
│   ├── sp-cross-architect.md
│   └── sp-cross-reviewer.md
├── governance/              # 治理规则文件 (5 个)
│   ├── role-permissions.md
│   ├── workflow-rules.md
│   ├── escalation-rules.md
│   ├── violation-protocol.md
│   └── health-monitoring.md
├── hooks/
│   └── hooks.json           # hook 注册 (3 个事件点)
├── scripts/                 # hook 实现和工具脚本
│   ├── run.cjs              # hook 运行器
│   ├── sp-bootstrap-guard.mjs
│   ├── sp-pm-allowlist-guard.mjs
│   ├── sp-route-guard.mjs
│   ├── sp-destructive-guard.mjs
│   ├── sp-install-claudemd.mjs
│   ├── sp-pack.mjs
│   └── lib/                 # 共享工具库
├── skills/                  # 30 个预置 skill
├── templates/               # 项目配置模板 (10 个)
├── docs/                    # 文档资源
├── CLAUDE.md                # 治理规则权威源
└── INSTALL.md               # 安装说明
```

### Hook 流程

插件通过 3 个 hook 事件点实现物理约束：

```
用户输入提交 (UserPromptSubmit)
  └─→ sp-bootstrap-guard.mjs
       检查 portfolio.json 是否存在，执行引导检查，管理豁免状态

工具调用前 (PreToolUse)
  ├─→ sp-pm-allowlist-guard.mjs  [匹配: 所有工具]
  │    fail-closed 白名单检查，未知工具默认拒绝
  │    子 agent 自动跳过（由框架 disallowedTools 控制）
  │
  ├─→ sp-route-guard.mjs  [匹配: Agent 调用]
  │    校验 SP-ROLE 标记与目标 agent 类型的匹配关系
  │
  └─→ sp-destructive-guard.mjs  [匹配: Bash 调用]
       拦截文件重定向 (> >> tee sed -i) 和危险 git 操作
```

所有 hook 超时设定为 5 秒，超时视为拒绝。

---

## Agent 角色

| Agent | 定位 | 物理约束 |
|-------|------|----------|
| `sp-governance:sp-architect` | 只读分析，设计方案 | 禁止 Edit / Write / Bash |
| `sp-governance:sp-coder` | 业务代码实现 | 全权限（worktree 隔离） |
| `sp-governance:sp-reviewer` | 只读审查，输出报告 | 禁止 Edit / Write / Bash |
| `sp-governance:sp-tester` | 测试编写 + 验收门禁 | 全权限 |
| `sp-governance:sp-team-lead` | 项目调度 | 全权限 |
| `sp-governance:sp-group-lead` | 组内协调 | 禁止 Edit / Write |
| `sp-governance:sp-doc-engineer` | 仅写 .md 文档 | 禁止 Bash |
| `sp-governance:sp-cross-architect` | 组间接口设计 | 禁止 Edit / Write / Bash |
| `sp-governance:sp-cross-reviewer` | 组间一致性审查 | 禁止 Edit / Write / Bash |

### 调用方式

**推荐 -- Plugin Agent 直接调用**（disallowedTools 由框架物理执行）：

```
Agent(subagent_type="sp-governance:sp-architect", prompt="项目上下文 + 任务")
Agent(subagent_type="sp-governance:sp-coder", prompt="项目上下文 + 任务", isolation="worktree")
```

**兼容 -- OMC Agent + SP-ROLE 标记**（仅依赖 prompt 约束）：

```
Agent(subagent_type="oh-my-claudecode:architect", prompt="[SP-ROLE:architect] ...")
```

---

## Skills 列表

30 个预置 skill，按用途分类：

### 治理与诊断

| Skill | 说明 |
|-------|------|
| `sp-bootstrap` | 完整 SP 治理诊断（agent、governance 文件、项目目录、漂移检测） |
| `sp-scan` | 工作区扫描 |
| `sp-status` | 项目状态查看 |
| `sp-dispatch` | 任务派发 |
| `sp-impact-analysis` | 变更影响分析 |

### 构建与编译

| Skill | 说明 |
|-------|------|
| `sp-node-build` | Node.js 项目构建 |
| `sp-java-build` | Java 项目构建 |
| `sp-nuxt-build` | Nuxt 项目构建 |
| `sp-electron-build` | Electron 项目构建 |
| `sp-docker-build` | Docker 镜像构建 |
| `sp-python-setup` | Python 环境配置 |

### 测试

| Skill | 说明 |
|-------|------|
| `sp-jest` | Jest 测试执行 |
| `sp-vitest` | Vitest 测试执行 |
| `sp-playwright` | Playwright E2E 测试 |
| `sp-pytest` | pytest 测试执行 |
| `sp-java-test` | Java 测试执行 |

### 代码质量

| Skill | 说明 |
|-------|------|
| `sp-lint` | 代码 lint 检查 |
| `sp-typecheck` | TypeScript 类型检查 |
| `sp-python-lint` | Python lint 检查 |
| `sp-code-review` | 代码审查 |
| `sp-dep-audit` | 依赖安全审计 |
| `sp-dep-graph` | 依赖关系图生成 |

### 架构与接口

| Skill | 说明 |
|-------|------|
| `sp-arch-analysis` | 架构分析 |
| `sp-api-contract` | API 契约检查 |
| `sp-prisma` | Prisma schema 操作 |
| `sp-db-check` | 数据库检查 |

### 部署与发布

| Skill | 说明 |
|-------|------|
| `sp-deploy-check` | 部署前检查 |
| `sp-cf-deploy` | Cloudflare 部署 |
| `sp-release` | 发布流程 |

### 文档

| Skill | 说明 |
|-------|------|
| `sp-docs-sync` | 文档同步 |

---

## 治理规则概要

完整规则见 `CLAUDE.md` 和 `governance/` 目录下的 5 个规则文件。

### MUST（必须）

1. 会话启动时执行引导检查（Bootstrap Guard hook 自动触发）
2. 任务派发前读取 `portfolio.json` 确认项目归属
3. 新仓库执行完整引导：分析 → 注册 → 配置 → 汇报
4. 使用 `sp-governance:sp-*` agents 派发项目级任务
5. 每个需求必须有对应测试用例（无测试 = 验收失败 REJECTED）
6. 代码修改必须通过测试验证（编译检查 + 单元测试 + UI 测试方案）
7. 所有 git 操作前必须先拉取最新代码（`git fetch` + `git pull --rebase`）
8. 遇到 git 冲突必须使用 rebase 解决，禁止 merge commit

### MUST NOT（禁止）

1. PM 禁止编写任何项目的业务代码或测试代码
2. PM 禁止对非管理路径执行 Edit/Write
3. 禁止绕过层级直接指派（不跳过 TeamLead/Group-Lead）
4. PM 禁止直接读取源代码文件（.ts/.js/.py 等）
5. PM 禁止通过 Bash 重定向/管道写入文件
6. PM 禁止使用 Glob/Grep/NotebookEdit/python_repl/ast_grep/lsp_* 等工具

### 治理规则文件索引

| 文件 | 内容 |
|------|------|
| `governance/role-permissions.md` | 角色权限与约束机制 |
| `governance/workflow-rules.md` | 通道选择、工作流、并发模型 |
| `governance/escalation-rules.md` | 升级决策 L0-L4 |
| `governance/violation-protocol.md` | 违规检测 V1-V4、拦截流程 |
| `governance/health-monitoring.md` | 超时、汇报、巡检、异常恢复 |

---

## PM 工具约束

PM 的工具使用受 `sp-pm-allowlist-guard.mjs` 物理约束，采用 fail-closed 白名单模型。

### 允许的工具

| 工具 | 约束 |
|------|------|
| Agent / Task* / Team* / SendMessage | 无限制（PM 核心调度职能） |
| AskUserQuestion / Skill | 无限制 |
| Read | 禁止读取源代码文件（.ts/.js/.py 等），管理路径和配置文件允许 |
| Write / Edit | 仅管理路径（portfolio.json, groups/, .omc/, templates/ 等） |
| Bash | allowlist 命令 + 禁止重定向，git 限只读子命令 |
| OMC state/notepad/memory 工具 | 无限制 |

### 禁止的工具（默认拒绝）

Glob, Grep, NotebookEdit, ast_grep_*, python_repl, lsp_*, WebFetch, WebSearch

### 豁免机制

- **子 agent 豁免**: 子 agent（agent_id 存在）自动跳过此 guard，由框架 disallowedTools 控制权限
- **用户豁免**: 通过关键词（"PM亲自执行"、"你自己去做"、"不要派发"）临时解除约束，120 秒有效

### 审计日志

所有工具调用记录在 `.omc/logs/pm-audit.jsonl`（5MB 轮转）。

---

## 配置说明

### portfolio.json

`portfolio.json` 是项目注册的缓存文件，由引导协议自动生成和维护。

- 存在且合法 → 正常加载，执行完整启动或静默启动
- 存在但损坏 → 告知用户，重建
- 不存在 → 扫描工作区，交互式引导

### 项目接入流程

1. **获取** -- clone 或验证本地路径
2. **分析** -- 技术栈、源文件数、构建命令、测试框架、级别判定
3. **注册** -- 写入 portfolio.json
4. **建组** -- 仅用户指定时创建 `groups/{name}/`
5. **配置** -- 参照 `templates/` 生成项目 CLAUDE.md、初始化 .omc/、生成 .claudeignore
6. **汇报** -- 输出分析结果，等待用户确认

### 项目分级

| 级别 | 源文件数 | 治理强度 |
|------|----------|----------|
| C 级 | ≤20 | 轻量 |
| B 级 | ≤100 | 标准 |
| A 级 | >100 | 完整 |

### 技术栈检测

| 标识文件 | 检测结果 |
|----------|----------|
| `pom.xml` | java_maven |
| `build.gradle` | java_gradle |
| `package.json` + next | nextjs |
| `package.json` + express | nodejs_express |
| `Cargo.toml` | rust |
| `go.mod` | go |
| `pyproject.toml` / `requirements.txt` | python |
| `*.csproj` / `*.sln` | dotnet |
| `composer.json` | php |
| `pubspec.yaml` | flutter |
| `pnpm-workspace.yaml` | pnpm_workspace |
| `nx.json` | nx |
| `turbo.json` | turborepo |
| `lerna.json` | lerna |

### 模板文件

`templates/` 目录提供 10 个配置模板：

| 模板 | 用途 |
|------|------|
| `project-claude.md.template` | 项目级 CLAUDE.md |
| `monorepo-package-claude.md.template` | Monorepo 子包 CLAUDE.md |
| `group-config.md.template` | 项目组配置 |
| `interface-contracts.md.template` | 组间接口契约 |
| `shared-protocols.md.template` | 共享协议 |
| `dependency-graph.md.template` | 依赖关系图 |
| `memory.md.template` | 项目记忆文件 |
| `bootstrap-state.json.template` | 引导状态 |
| `active-requirements.json.template` | 活跃需求 |
| `claudeignore.template` | .claudeignore 文件 |

---

## 版本历史

| 版本 | 说明 |
|------|------|
| 7.3.0 | 当前版本（plugin.json） |

---

## License

UNLICENSED
