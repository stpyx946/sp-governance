---
name: sp-feishu-doc
description: 飞书文档创建和读取
argument-hint: "--action <create|read> [options]"
triggers:
  - "飞书文档"
  - "创建飞书文档"
  - "读取飞书文档"
---

# SP Feishu Doc Skill

创建或读取飞书云文档。

## Use When
- 需要在飞书创建新文档
- 需要读取飞书文档内容为 Markdown

## Workflow
### 1. 创建文档
```bash
node scripts/feishu/feishu-create-doc.mjs --user <user> --title "<title>" --content "<content>"
node scripts/feishu/feishu-create-doc.mjs --user <user> --title "<title>" --content-file "<file.md>"
```

### 2. 读取文档
```bash
node scripts/feishu/feishu-read-doc.mjs --user <user> --url "<feishu-doc-url>"
```
输出文档标题和 Markdown 格式内容。

## Notes
- 执行角色: sp-team-lead
- 需要有效飞书登录态
- 创建文档支持内联内容或文件输入
