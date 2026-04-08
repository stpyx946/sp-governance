# SP Governance (Lite) — v8.0.0

> 轻量多项目治理层。Agents 统一使用 OMC (`oh-my-claudecode:*`)。

## 激活条件

- 工作空间存在 `portfolio.json` → SP 治理激活
- 子项目目录内 → 所有 SP hooks 自动跳过
- 禁用: 创建 `.sp-disabled` 标记文件

## Agent 使用

| 任务 | Agent |
|------|-------|
| 架构分析 | `oh-my-claudecode:architect` |
| 代码实现 | `oh-my-claudecode:executor` |
| 代码审查 | `oh-my-claudecode:code-reviewer` |
| 测试编写 | `oh-my-claudecode:test-engineer` |
| 文档编写 | `oh-my-claudecode:writer` |

## 运行时开关

- **关闭**: `关闭SP` / `禁用SP` / `disable SP` / `sp off`
- **开启**: `启用SP` / `开启SP` / `enable SP` / `sp on`

## 与 OMC 共存

- SP hooks 在 `portfolio.json` 存在时执行，但 CWD 在已注册子项目内时自动跳过
- SP 标记 (`<!-- SP:START/END -->`) 与 OMC 标记 (`<!-- OMC:START/END -->`) 互不干扰
