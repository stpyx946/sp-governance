# SP Governance v9.0.0 迁移指南

> 从 v7.x / v8.x 迁移到 v9.0.0 的完整指南。

---

## 一、Agent 映射表

v9 彻底废弃 `sp-governance:sp-*` agents，所有 agent 工作统一使用 OMC agents：

| 旧 SP Agent | 新 OMC Agent | 说明 |
|-------------|-------------|------|
| `sp-governance:sp-architect` | `oh-my-claudecode:architect` | 架构分析、设计方案 |
| `sp-governance:sp-coder` | `oh-my-claudecode:executor` | 业务代码实现 |
| `sp-governance:sp-reviewer` | `oh-my-claudecode:code-reviewer` | 代码审查 |
| `sp-governance:sp-tester` | `oh-my-claudecode:test-engineer` | 测试编写、验收 |
| `sp-governance:sp-doc-engineer` | `oh-my-claudecode:writer` | 文档编写 |
| `sp-governance:sp-team-lead` | `oh-my-claudecode:planner` | 项目调度、任务规划 |
| `sp-governance:sp-group-lead` | `oh-my-claudecode:planner` | 组内协调（合并至 planner） |
| `sp-governance:sp-cross-architect` | `oh-my-claudecode:architect` | 组间接口设计（合并至 architect） |
| `sp-governance:sp-cross-reviewer` | `oh-my-claudecode:code-reviewer` | 组间一致性审查（合并至 code-reviewer） |

旧 agent 定义文件已归档至 `agents/_archived/`，保留作为历史参考。

---

## 二、Workspace CLAUDE.md 变更

如果你的 workspace 级 CLAUDE.md 中包含 `sp-governance:sp-*` 的 agent 引用，需要：

1. 移除所有 `sp-governance:sp-*` agent 调用示例
2. 移除 SP agent 角色清单表格（如有）
3. 移除 PM 身份和核心规则中的 agent 派发相关内容
4. 保留 SP 治理激活条件、运行时开关等基础配置

示例：移除类似以下内容：
```
Agent(subagent_type="sp-governance:sp-architect", prompt="...")
Agent(subagent_type="sp-governance:sp-coder", prompt="...", isolation="worktree")
```

替换为 OMC agent 调用：
```
Task(subagent_type="oh-my-claudecode:architect", prompt="...")
Task(subagent_type="oh-my-claudecode:executor", prompt="...")
```

---

## 三、运行模式

v9 引入四种运行模式，由 bootstrap-guard 自动探测：

| 模式 | 条件 | 说明 |
|------|------|------|
| `full` | SP + OMC + ECC 均可用 | 三层完整协作 |
| `sp-omc` | SP + OMC 可用，无 ECC | SP 治理 + OMC 执行 |
| `sp-ecc` | SP + ECC 可用，无 OMC | SP 治理 + ECC 质量（较少见） |
| `sp-only` | 仅 SP 可用 | 纯治理模式，边界守护和安全防护 |

运行模式存储在 `.sp/integration.json` 中，bootstrap-guard 每次会话启动时刷新。

---

## 四、新 Skill 说明

v9 新增 5 个集成管理 skill：

| Skill | 说明 |
|-------|------|
| `sp-install-omc` | 安装/配置 OMC (oh-my-claudecode) 集成 |
| `sp-install-ecc` | 安装/配置 ECC (everything-claude-code) 集成 |
| `sp-integration-check` | 检查三层集成状态和兼容性 |
| `sp-learning-status` | 查看 ECC learning bridge 状态 |
| `sp-upgrade-check` | 检查 SP/OMC/ECC 版本兼容性 |

---

## 五、集成状态文件

v9 使用 `.sp/integration.json` 管理集成状态（替代旧的 `.sp/state.json`）：

```json
{
  "version": "9.0.0",
  "mode": "sp-omc",
  "omc": {
    "detected": true,
    "version": "1.x.x"
  },
  "ecc": {
    "detected": false,
    "version": null,
    "minVersion": "1.8.0"
  },
  "lastRefresh": "2026-04-20T00:00:00Z"
}
```

---

## 六、迁移步骤总结

1. 更新 sp-governance 插件到 v9.0.0
2. 清理 workspace CLAUDE.md 中的 `sp-governance:sp-*` 引用
3. 确认 OMC (oh-my-claudecode) 已安装（推荐）
4. 运行 `sp-integration-check` 验证集成状态
5. （可选）安装 ECC 获得完整三层能力
