# Agent 健康监控规则

> 本文件定义 Agent 存活检测、汇报协议和异常恢复流程。

## 一、超时控制

### 基础超时值

| 角色 | 基础超时 | 超时后处理 |
|------|----------|------------|
| sp-architect | 10 min | TeamLead 记录 + 重试 1 次 |
| sp-coder | 15 min | TeamLead 记录 + 重试 1 次 |
| sp-reviewer | 8 min | TeamLead 记录 + 重试 1 次 |
| sp-tester | 15 min | TeamLead 记录 + 重试 1 次 |
| sp-doc-engineer | 8 min | TeamLead 记录 + 重试 1 次 |
| sp-team-lead | 20 min | Group-Lead/PM 介入 |
| sp-group-lead | 25 min | PM 介入 |
| sp-cross-architect | 10 min | PM 介入 |
| sp-cross-reviewer | 10 min | PM 介入 |

### 复杂度乘数 (自适应超时)

基础超时值适用于 B 级项目 (≤100 源文件)。实际超时 = 基础超时 × 复杂度乘数。

```
复杂度乘数计算:
  source_files = portfolio.json 中项目的 source_files 字段
  直接按 source_files 数值查表，不依赖 level 字段:

  ≤20 文件:   乘数 = 0.7  (任务简单，缩短超时)
  ≤100 文件:  乘数 = 1.0  (基准)
  ≤300 文件:  乘数 = 1.5
  >300 文件:  乘数 = 2.0

示例:
  sp-architect 分析 snapmaker-micro (359 文件):
    基础 10 min × 2.0 = 20 min 超时

  sp-coder 修改 snapmaker-parent (37 文件):
    基础 15 min × 1.0 = 15 min 超时

跨项目任务:
  取涉及项目中最高的乘数
```

TeamLead 生成 Agent 时应根据 portfolio.json 的 source_files 直接查表计算实际超时值。

## 二、Agent 汇报协议

每个 Agent 完成时必须输出标准化报告:

```json
{
  "agent_role": "sp-coder",
  "agent_instance": "micro-coder-1",
  "requirement": "REQ-001",
  "status": "completed | failed | blocked | partial",
  "output_summary": "实现了 X 功能, 修改了 Y 个文件",
  "files_modified": ["src/a.java", "src/b.java"],
  "files_created": [],
  "issues_found": ["Z 接口需要 Architect 确认"],
  "tests_status": "not_applicable | passed | failed",
  "duration_minutes": 8,
  "next_action": "ready_for_review | needs_architect_decision | needs_retry"
}
```

### 汇报规则
- 缺失报告 = 异常, TeamLead 标记并处理
- status = "partial" 时必须说明完成了什么、剩余什么
- status = "failed" 时必须说明失败原因和建议
- status = "blocked" 时必须说明阻塞原因

## 三、状态巡检

### PM 巡检 (每轮交互后)
- 检查 TaskList: in_progress 超过阈值 → 标记异常
- 检查 TeamLead 最后汇报时间: 超时 → 主动询问
- 检查是否有 pending 且无 blockedBy 的任务未分配

### Group-Lead 巡检 (组内)
- 检查组内各 TeamLead 状态
- 检查跨项目任务的进度对齐

### TeamLead 巡检 (项目内)
- 每个 Agent 完成后检查汇报是否存在
- 汇报缺失 → 视为异常
- 多个需求的进度同步

## 四、异常恢复流程

### Agent 异常 (超时/无响应/失败)

```
1. TeamLead 记录异常:
   - 哪个 Agent
   - 什么任务
   - 什么症状 (超时/错误/无输出)

2. 检查已完成的部分:
   - 读取已修改的文件
   - 读取已创建的分支
   - 评估完成度

3. 重新生成同角色 Agent, 输入:
   - 原始任务描述
   - 前一个 Agent 已完成的部分 (如有)
   - 异常上下文: "前一个 Agent 在 X 步骤超时/失败"

4. 重试 1 次

5. 仍失败 → 上报 Group-Lead/PM
```

### TeamLead 异常 (超时/无响应)

```
1. Group-Lead 或 PM 接管该项目
2. 读取 active-requirements.json 恢复状态
3. 读取 TaskList 了解当前进度
4. 重新生成 TeamLead, 传入当前完整状态
```

### 系统性问题 (多个 Agent 连续失败)

```
1. PM 评估是否为系统性问题 (如 API 限流、网络异常)
2. 调整策略:
   - 降低并发
   - 拆分任务为更小的单元
   - 建议降级通道（如标准→快速、完整→标准）
3. 通知用户: 说明问题 + 已采取的措施
```

## 五、治理效率巡检

### 效率指标

每次任务完成后，PM 记录以下指标到验收报告:

```
governance_metrics:
  agent_count: 实际使用的 Agent 数量
  total_rounds: Agent 交互总轮次
  files_modified: 实际修改的文件数
  channel_used: 使用的通道
  duration_minutes: 总耗时
```

### 效率比率

```
治理开销比 = agent_count / files_modified

  ≤1.5: 高效 (正常)
  1.5~3.0: 合理 (标准/完整通道的正常范围)
  >3.0: 过重 → PM 向用户建议:
    - 降级通道 (标准→快速, 完整→标准)
    - 合并小任务为批量处理
```

### 趋势追踪

PM 在每轮健康巡检时检查最近 3 次任务的效率比率:
- 连续 3 次 >3.0 → 主动建议降级通道（如标准→快速、完整→标准）
- 连续 3 次 ≤1.0 → 当前模式高效，无需调整
