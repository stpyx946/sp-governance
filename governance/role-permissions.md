# 角色权限参考 (v8 — 存档)

> 本文件为 SP Governance v7 时代的角色权限矩阵存档。
> v8 起，SP 不再定义专用 agents，所有 agent 工作由 OMC 体系承担。
> 保留此文件作为权限设计参考。

## OMC Agent 权限映射

| 任务类型 | OMC Agent | 权限 |
|----------|-----------|------|
| 架构分析 (只读) | oh-my-claudecode:architect | Read-only |
| 代码实现 | oh-my-claudecode:executor | Full write |
| 代码审查 (只读) | oh-my-claudecode:code-reviewer | Read-only |
| 测试编写 | oh-my-claudecode:test-engineer | Full write |
| 文档编写 | oh-my-claudecode:writer | Write (.md) |
| 安全审查 (只读) | oh-my-claudecode:security-reviewer | Read-only |
| 调试修复 | oh-my-claudecode:debugger | Edit/Write |

## 项目边界守护

v8 的边界守护由 hooks 实现，而非 agent 角色约束：

| 守护层 | 机制 | 说明 |
|--------|------|------|
| 治理文件保护 | pm-guard hook | governance/ 和 agents/ 目录写入需用户审批 |
| 危险命令拦截 | destructive-guard hook | rm -rf, git push --force 等被拦截 |
| 项目上下文 | route-guard hook | 涉及已注册项目时注入上下文信息（不阻断）|
| 子项目绕过 | 三个 guard 共同 | CWD 在已注册项目内时跳过所有 PM 层约束 |
