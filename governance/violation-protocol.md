# 违规处理协议

> 本文件定义角色越权时的处理流程。

## 一、违规检测

### 自检 (Agent 自身)
每个 Agent 执行操作前应自检:
- 该操作是否在角色权限白名单内?
- 是 → 直接执行
- 否 → 触发违规拦截

### 审计 (当前限制)
Claude Code 不提供跨 agent 工具调用审计 API。当前可行的检查:
- Reviewer 检查 git diff 中是否有不属于 Coder/Tester 预期范围的文件变更
- 如发现可疑变更 → 标记为审计关注项 → 上报 TeamLead
- 物理拦截依赖 sp-governance:sp-* 的 disallowedTools (推荐路径) 和 Route Guard hook

### 系统拦截 (SP-ROLE Hook)
PM 派发涉及已注册项目的 Agent 调用时:
- `.claude/hooks/sp-route-guard.js` 在 PreToolUse 阶段检查 `[SP-ROLE:xxx]` 标记
- 缺少合法标记 → 调用被物理拦截，Agent 无法执行
- 合法标记 → 放行，但 Agent 行为仍受 prompt 中嵌入的角色约束

注: sp-*.md 中的 `allowedTools` 和 `mode: plan` 定义了期望约束，供 PM 嵌入 prompt 和 Reviewer 审计参照，但不构成运行时物理拦截。

## 二、违规拦截流程

```
Agent 检测到即将越权:
    │
    ▼
1. 立即停止当前操作
    │
    ▼
2. 输出标准声明:
   "{角色名} 违规拦截: 我作为{角色}不能{操作描述}"
    │
    ▼
3. 说明:
   - 需要执行什么操作
   - 为什么需要这个操作
   - 建议由哪个角色来执行
    │
    ▼
4. 等待重新分配:
   - TeamLead 将操作分配给正确角色
   - 或 TeamLead 上报 PM
```

## 三、违规场景与处理

| 场景 | 违规角色 | 正确做法 |
|------|----------|----------|
| Architect 想修一个"顺手"的 bug | Architect | 创建任务交给 Coder |
| Coder 不确定要不要改接口签名 | Coder | 上报 Architect 决策 |
| Reviewer 直接改了代码格式 | Reviewer | 提出审查意见交 Coder 修改 |
| TeamLead 直接操作其他项目 | TeamLead | 上报 PM 由协调层处理 |
| PM 直接写业务代码 | PM | 派发给 TeamLead |
| PM 写入非管理路径文件 | PM | 向用户确认后再操作 (V4) |
| Tester 修改了业务逻辑 | Tester | 提 bug 交 Coder 修复 |
| Doc Engineer 修改了配置文件 | Doc Engineer | 上报 TeamLead 分配给 Coder |
| Coder 越界写入其他项目文件 | Coder | 拦截 + 上报 TeamLead (V3) |
| Tester 写入非测试目录文件 | Tester | 拦截 + 上报 TeamLead (V3) |

### 违规级别说明

| 级别 | 含义 | 处理 |
|------|------|------|
| V1 | 轻微越权 (如 Coder 修改了注释格式) | Agent 自行声明，继续工作 |
| V2 | 一般越权 (如跨模块修改) | 上报 TeamLead 裁决 |
| V3 | 严重越权 (如越界写入、跨项目操作) | 上报 PM，PM 向用户报告 |
| V4 | 关键越权 (如 PM 写入非管理路径、修改治理文件) | 必须用户审批 |

## 四、越权操作的用户审批

当 Agent 确实需要执行超出权限的操作时:
1. Agent 声明越权
2. TeamLead 上报 PM
3. PM 向用户说明情况并请求审批
4. 用户批准 → **本次单独授权** (不修改角色定义)
5. 用户拒绝 → 改由正确角色执行

**重要**: 单次授权不构成角色变更。下次同样操作仍需审批。

## 五、治理文件修改审批

以下文件的修改必须经用户审批:
- governance/ 下的所有文件
- .claude/agents/ 下的所有 Agent 定义
- 根目录 CLAUDE.md
