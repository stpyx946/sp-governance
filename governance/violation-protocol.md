# 违规处理协议 (v8)

> v8 起不再依赖 SP agent disallowedTools 做角色约束。
> OMC agents 自带物理约束（architect/code-reviewer 为 read-only）。
> 本文件描述 v8 的安全防护机制。

## 一、防护层级

| 层级 | 机制 | 说明 |
|------|------|------|
| Hook 物理拦截 | destructive-guard | 危险 Bash 命令被 hook 拦截，无法执行 |
| Hook 文件保护 | pm-guard | governance/ 和 agents/ 写入被拒绝 |
| 框架约束 | OMC agent disallowedTools | architect/code-reviewer/security-reviewer 等为 read-only |
| 项目上下文 | route-guard | 涉及项目时注入上下文提醒 |

## 二、异常场景处理

| 场景 | 处理 |
|------|------|
| Agent 尝试写入 governance/ | pm-guard hook 拒绝，需用户审批 |
| Bash 执行危险命令 (rm -rf 等) | destructive-guard hook 拦截 |
| 跨项目操作 | route-guard 注入项目信息，提醒范围 |
| 修改治理文件 | 需用户明确审批 |

## 三、治理文件修改审批

以下路径的修改需要用户审批：
- `sp-governance/governance/` 下的所有文件
- `sp-governance/agents/` 下的所有文件
