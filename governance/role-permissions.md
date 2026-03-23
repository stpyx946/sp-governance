# 角色权限矩阵

> 本文件是治理体系的核心, 所有 Agent 启动时必须读取。修改本文件需要用户审批。

## 权限矩阵

```
操作 \ 角色        │ PM │ Group │ Cross │ Cross │ Team │ Arch │ Coder │ Reviewer │ Tester │ Doc
                   │    │ Lead  │ Arch  │ Rev   │ Lead │      │       │          │        │ Eng
───────────────────┼────┼───────┼───────┼───────┼──────┼──────┼───────┼──────────┼────────┼─────
读取任意项目代码    │ ✓  │ 组内   │  ✓    │  ✓    │ 本项目│ 本项目│ 本项目 │  本项目   │ 本项目  │本项目
写业务代码         │ ✗  │  ✗    │  ✗    │  ✗    │  ✗   │  ✗   │  ✓    │   ✗      │  ✗     │  ✗
写测试代码         │ ✗  │  ✗    │  ✗    │  ✗    │  ✗   │  ✗   │  ✓    │   ✗      │  ✓     │  ✗
写文档文件(.md)    │ ✗  │  ✓¹   │  ✗⁶   │  ✗    │  ✓³  │  ✗   │  ✗    │   ✗      │  ✗     │  ✓
写配置文件         │ ✗  │  ✗    │  ✗    │  ✗    │  ✓   │  ✗   │  ✓    │   ✗      │  ✓⁴   │  ✗
创建/修改团队任务   │ ✓  │  ✓    │ 仅修改 │ 仅修改│  ✓   │  ✗   │  ✗    │   ✗      │  ✗     │  ✗
修改表结构/数据    │用户审批│ ✗  │  ✗    │  ✗    │  ✗   │  ✗   │用户审批│   ✗      │  ✗     │  ✗
审查设计方案       │ ✗  │  ✓    │  ✓    │  ✓    │  ✗   │  ✗   │  ✗    │   ✓      │  ✗     │  ✗
审查代码实现       │ ✗  │  ✗    │  ✗    │  ✓    │  ✗   │  ✗   │  ✗    │   ✓      │  ✗     │  ✗
做架构/技术决策    │ ✗  │  ✓    │  ✓    │  ✗    │  ✗   │  ✓   │  ✗    │   ✗      │  ✗     │  ✗
生成/释放团队成员  │ ✓  │  ✗    │  ✗    │  ✗    │  ✓   │  ✗   │  ✗    │   ✗      │  ✗     │  ✗
跨项目操作        │ ✓  │ 组内   │  ✓    │  ✓    │  ✗   │  ✗   │  ✗    │   ✗      │  ✗     │  ✗
更新 portfolio.json│ ✓  │  ✗    │  ✗    │  ✗    │  ✗   │  ✗   │  ✗    │   ✗      │  ✗     │  ✗
更新 project-memory│ ✓  │  ✗    │  ✗    │  ✗    │  ✓   │  ✗⁷  │  ✗    │   ✗      │  ✗     │  ✗

✓¹ = 仅限 groups/{group-name}/ 下的文档
✓³ = 仅限项目管理类文档 (进度、任务分配)
✓⁴ = 仅限测试配置文件
✗⁶ = Cross-Architect 无 Edit/Write 工具，设计文档通过 SendMessage 输出，由 PM 持久化到 cross-groups/
✗⁷ = Architect 无 Edit/Write 工具，架构决策通过 SendMessage 提交给 TeamLead 更新
```

## Agent 实际约束机制

| 角色 | 实际约束机制 |
|------|-------------|
| sp-architect | disallowedTools: Edit/Write/Bash/NotebookEdit (框架物理执行) |
| sp-reviewer | disallowedTools: Edit/Write/Bash/NotebookEdit (框架物理执行) |
| sp-cross-architect | disallowedTools: Edit/Write/Bash/NotebookEdit (框架物理执行) |
| sp-cross-reviewer | disallowedTools: Edit/Write/Bash/NotebookEdit (框架物理执行) |
| sp-group-lead | disallowedTools: NotebookEdit; prompt 约束: 仅 groups/ 下文档 |
| sp-coder | 无 disallowedTools; prompt 约束: 限本项目, worktree 隔离 |
| sp-tester | 无 disallowedTools; prompt 约束: 限测试文件 |
| sp-doc-engineer | disallowedTools: Bash; prompt 约束: 限 .md 文件 |
| sp-team-lead | 无 disallowedTools; 管理操作自主, 代码操作派发给 Coder |
