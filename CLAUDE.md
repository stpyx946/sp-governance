# SP Governance Plugin (Lite)

> 轻量多项目治理层，为 Claude Code 提供项目边界守护和安全防护。
> 不限制工具使用，不强制角色分配，所有 agent 工作由 OMC 体系承担。

---

## 一、定位

SP Governance 是一个轻量治理层，叠加在 OMC (oh-my-claudecode) 之上：

- **项目注册**: portfolio.json 记录工作空间内的项目、分组、技术栈
- **边界守护**: hooks 在涉及已注册项目时注入上下文信息
- **安全防护**: destructive guard 拦截危险的 Bash 命令
- **治理文件保护**: governance/ 和 agents/ 目录的修改需要用户审批

**SP 不做的事：**
- 不限制工具使用（Glob、Grep、Read 等全部可用）
- 不强制 PM 角色（用户可以直接操作任何项目）
- 不要求 SP-ROLE 标记（OMC agents 直接使用）
- 不做启动诊断（静默创建 state，7 天刷新）

---

## 二、Agent 使用

所有 agent 工作统一使用 OMC agents，不再需要 `sp-governance:sp-*` agents：

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

### 执行模式

| 场景 | OMC 模式 |
|------|----------|
| 并行子任务 | `/ultrawork` |
| 迭代完成 | `/ralph` |
| 端到端自主 | `/autopilot` |
| 多 agent 协作 | `/team` |
| QA 循环 | `/ultraqa` |
| 复杂 bug | `/trace` |

---

## 三、项目注册

portfolio.json 记录所有已注册项目：

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

项目级别：A (>100 源文件) / B (≤100) / C (≤20)

---

## 四、Hooks

| Hook | 触发 | 作用 |
|------|------|------|
| bootstrap-guard | UserPromptSubmit | 子项目检测、运行时开关、state 管理 |
| pm-guard | PreToolUse (*) | 双角色模型：workspace 根=PM(fail-closed), 子项目=Team-Lead(全放行) |
| route-guard | PreToolUse (Agent) | 子项目绕过、项目上下文注入 |
| destructive-guard | PreToolUse (Bash) | 危险命令拦截 (rm -rf, git push --force 等) |

### 双角色模型

- **治理根目录 (portfolio.json 所在) → PM 角色**: fail-closed allowlist。可用 Glob/Grep/Read 导航，可写 .md 和管理路径，Bash 限只读。禁止 WebFetch/WebSearch/lsp_*/python_repl
- **已注册子项目目录 → Team-Lead 角色**: 与 PM 相同的 fail-closed allowlist，但额外允许 WebFetch/WebSearch（外部研究）
- **两个角色共同限制**: 业务代码(.ts/.js/.py等)和配置文件(package.json等)的写入必须委派 agent；构建/测试命令必须委派 agent；governance/ 修改需用户审批

### 运行时开关

- **关闭**: `关闭SP` / `禁用SP` / `disable SP` / `sp off`
- **开启**: `启用SP` / `开启SP` / `enable SP` / `sp on`

---

## 五、飞书自动化 (Feishu Integration)

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
