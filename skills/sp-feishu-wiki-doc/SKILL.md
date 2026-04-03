---
name: sp-feishu-wiki-doc
description: 在飞书 Wiki 中创建子页面（支持去重管理）
triggers:
  - "飞书wiki"
  - "wiki子页面"
  - "创建wiki文档"
---

# SP Feishu Wiki Doc Skill

在飞书知识库（Wiki）中创建子页面，支持文档注册管理和去重。

## Use When

- 需要在飞书 Wiki 的指定页面下创建子文档
- 需要批量同步本地 Markdown 文档到飞书 Wiki
- 需要追踪已创建文档避免重复

## Workflow

### 1. 创建 Wiki 子页面

```bash
node scripts/feishu/feishu-create-wiki-doc.mjs \
  --user default \
  --parent-url "https://my.feishu.cn/wiki/xxxxx" \
  --title "文档标题" \
  --content-file "path/to/file.md"
```

### 2. 去重机制

脚本自动检查 `config/doc-registry.json`，同一父页面下同名文档不会重复创建。
使用 `--force true` 可跳过检查。

### 3. 查看已创建文档

文档注册表: `config/doc-registry.json`

## Parameters

| 参数 | 必需 | 说明 |
|------|------|------|
| --user | 否 | 飞书账户（默认 default） |
| --parent-url | 是 | 父 Wiki 页面 URL |
| --title | 是 | 文档标题 |
| --content | 条件 | 文档内容（与 content-file 二选一）|
| --content-file | 条件 | 内容文件路径 |
| --force | 否 | true 跳过去重检查 |

### 更新 Wiki 页面

```bash
node scripts/feishu/feishu-update-wiki-doc.mjs \
  --user default \
  --wiki-url "https://my.feishu.cn/wiki/xxxxx" \
  --title "新标题" \
  --content-file "path/to/file.md"
```

参数：
| 参数 | 必需 | 说明 |
|------|------|------|
| --user | 否 | 飞书账户（默认 default） |
| --wiki-url | 是 | 要更新的 Wiki 页面 URL |
| --title | 否 | 新标题（不填则保留原标题）|
| --content | 条件 | 新内容（与 content-file 二选一）|
| --content-file | 条件 | 新内容文件路径 |

说明：更新采用清空重写模式，先完整清除页面内容再写入新内容。

## Notes

- 执行角色: sp-team-lead
- 需要有效飞书登录态（先执行 sp-feishu-login）
- Wiki 页面编辑器与普通文档共用，支持完整 Markdown
- 创建记录保存在 config/doc-registry.json
