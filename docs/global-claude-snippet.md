# SP Governance Plugin (sp-governance v7.1.0)

> 多项目 Portfolio 治理插件。完整规则见项目级 CLAUDE.md 或 ~/.claude/plugins/sp-governance/CLAUDE.md

## 可用 Agents

| Agent | 定位 | 约束 |
|-------|------|------|
| `sp-governance:sp-architect` | 只读分析，设计方案 | 禁止 Edit/Write/Bash |
| `sp-governance:sp-coder` | 业务代码实现 | 全权限 (worktree 隔离) |
| `sp-governance:sp-reviewer` | 代码审查 | 禁止 Edit/Write/Bash |
| `sp-governance:sp-tester` | 测试 + 验收门禁 | 全权限 |
| `sp-governance:sp-team-lead` | 项目调度 | 全权限 |
| `sp-governance:sp-group-lead` | 组内协调 | 禁止 Edit/Write |
| `sp-governance:sp-doc-engineer` | .md 文档 | 禁止 Bash |
| `sp-governance:sp-cross-architect` | 组间接口设计 | 禁止 Edit/Write/Bash |
| `sp-governance:sp-cross-reviewer` | 组间一致性审查 | 禁止 Edit/Write/Bash |

## 激活条件

- 工作空间存在 `portfolio.json` → SP 治理自动激活
- 工作空间无 `portfolio.json` 且无 `.sp-disabled` → bootstrap guard 提示用户是否启用
- 启用: 从 `~/.claude/plugins/sp-governance/CLAUDE.md` 读取完整规则注入项目 CLAUDE.md
- 禁用: 创建 `.sp-disabled` 标记文件

## 运行时开关

用户可随时通过以下指令控制 SP 治理:
- **关闭**: `关闭SP` / `禁用SP` / `disable SP` / `sp off`
- **开启**: `启用SP` / `开启SP` / `enable SP` / `sp on`

## 与 OMC 共存

- SP agents 使用 `sp-governance:sp-*` 命名空间，与 `oh-my-claudecode:*` 独立
- SP hooks 仅在 `portfolio.json` 存在时执行约束
- SP 标记 (`<!-- SP:START/END -->`) 与 OMC 标记 (`<!-- OMC:START/END -->`) 互不干扰
