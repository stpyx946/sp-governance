# SP Governance — v10.0.0

> 零耦合多项目治理层。能力发现基于 Claude Code 官方契约（installed_plugins.json + frontmatter），不写死任何上游插件名。

## 激活条件

- 工作空间存在 `portfolio.json` → SP 治理激活
- 子项目目录内 → 所有 SP hooks 自动跳过
- 禁用: 创建 `.sp-disabled` 标记文件

## 信任策略

- `.omc/sp.json::trust` 由用户主控
- 新发现的 marketplace 默认走 `default_policy`（出厂 `ask`）
- 决策优先级：`plugins[mkt/plug]` > `marketplaces[mkt]` > `default_policy`

## Agent 推荐

`route-guard` 自动撮合用户 prompt 到候选 agent/skill/command，注入 `<sp-capability-match>JSON</sp-capability-match>`。主模型按候选列表执行。SP 不写死任何 agent 名。

## 运行时指令

| 指令 | 动作 |
|------|------|
| `关闭SP` / `disable SP` / `sp off` | 停用 SP |
| `启用SP` / `enable SP` / `sp on` | 启用 SP |
| `SP 信任默认 allow\|deny\|ask` | 修改默认策略 |
| `信任 marketplace <name>` | allow 某 marketplace |
| `取消信任 <name>` / `拉黑 <name>` | ask / deny |
| `重置 SP 信任` | 删除 sp.json 重新引导 |
| `切换 SP 引擎 v9\|v10` | 双轨切换 |

## 与其他插件共存

- SP 标记 `<!-- SP:START/END -->` 与其他插件标记（如 `<!-- OMC:START/END -->`）互不干扰
- SP hooks 在 `portfolio.json` 存在时执行；子项目内自动跳过

详见 [sp-governance/CLAUDE.md](sp-governance/CLAUDE.md) 和 [README.md](sp-governance/README.md)。
