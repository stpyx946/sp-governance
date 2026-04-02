<!-- template: project-board -->
<!-- required: project_name -->
<!-- optional: author, date, team_members[], milestones[], start_date -->

# {{project_name}} - 项目看板

> 作者：{{author}}
> 创建时间：{{date}}
> 开始日期：{{start_date}}

---

## 一、项目概述

<!-- Agent 填写：项目背景、目标、范围 -->

### 1.1 项目背景

<!-- 为什么要做这个项目？ -->

### 1.2 项目目标

<!-- 项目要达成什么目标？可量化的指标是什么？ -->

### 1.3 项目范围

<!-- 包含什么？不包含什么？ -->

---

## 二、团队结构

| 角色 | 成员 | 职责 |
|------|------|------|
{{#each team_members}}
| {{this.role}} | {{this.name}} | {{this.responsibility}} |
{{/each}}

---

## 三、里程碑时间线

| 里程碑 | 目标日期 | 交付物 | 状态 |
|--------|----------|--------|------|
{{#each milestones}}
| {{this.name}} | {{this.date}} | {{this.deliverables}} | {{this.status}} |
{{/each}}

---

## 四、任务看板概览

任务看板使用飞书多维表格（Bitable）管理：

- **任务列表**：https://feishu.cn/bitable/{{bitable_id}}
- **甘特图**：`output/{{project_name}}-gantt.md`
- **里程碑**：`output/{{project_name}}-milestone.md`

### 4.1 任务分类

| 分类 | 描述 | 负责人 |
|------|------|--------|
| 设计 | 产品设计、UI/UX | |
| 开发 | 前端、后端开发 | |
| 测试 | 测试用例、bug修复 | |
| 运维 | 部署、监控 | |

---

## 五、周会议题模板

### 5.1 上周回顾

- 完成的任务：
- 遇到的问题：

### 5.2 本周计划

- 计划完成的任务：
- 需要协调的资源：

### 5.3 风险与阻塞

| 风险/阻塞 | 影响 | 需要的支持 |
|-----------|------|-----------|

### 5.4 会议记录

| 日期 | 参会人 | 主要结论 | 待办事项 |
|------|--------|----------|----------|
| | | | |

---

## 六、沟通与协作

- **项目文档**：https://feishu.cn/doc/{{doc_id}}
- **项目群**：https://feishu.cn/group/{{group_id}}
- **周会时间**：每周 {{meeting_day}} {{meeting_time}}

---

## 七、验收标准

<!-- 项目完成的验收条件 -->

1.
2.
3.
