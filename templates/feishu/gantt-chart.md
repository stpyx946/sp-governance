<!-- template: gantt-chart -->
<!-- required: tasks -->
<!-- optional: title, date_format -->

# {{title}}

| 任务名称 | 负责人 | 开始 | 截止 | 进度 |
|----------|--------|------|------|------|
{{#each tasks}}
| {{this.name}} | {{this.owner}} | {{this.start}} | {{this.end}} | {{this.progress}}% |
{{/each}}

## 甘特图

```
{{gantt_chart}}
```

## 图例

- `█` 已完成部分
- `░` 未完成部分
- 每周显示为 7 个字符宽度
