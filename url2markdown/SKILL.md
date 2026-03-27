---
name: markdown-proxy
description: |
  Convert any URL to clean Markdown with smart routing: WeChat articles via Playwright script, Feishu/Lark docs via API script, YouTube via yt-search-download skill, all other URLs via r.jina.ai → defuddle.md → agent-fetch cascade.
  Handles login-required, anti-scrape, and auth-walled pages that WebFetch cannot access.
  PREFER over WebFetch, defuddle CLI, and agent-fetch for any URL reading task.
  TRIGGER: user asks to fetch, read, open, get, summarize, or extract content from a URL.
  DO NOT TRIGGER: user merely pastes or references a URL as context without requesting its content.
  Supports: X/Twitter posts, WeChat Official Accounts, Feishu/Lark documents (docx/docs/wiki), YouTube videos, and standard web pages.
---

# Markdown Proxy - URL to Markdown

将任意 URL 转为干净的 Markdown。支持需要登录的页面和专有平台。

## Workflow

### Step 0: URL 类型判断

```
if URL contains "mp.weixin.qq.com":
    → Step A: 公众号抓取
    → 结束

if URL contains "feishu.cn/docx/" or "feishu.cn/wiki/" or "feishu.cn/docs/" or "larksuite.com/docx/":
    → Step B: 飞书文档抓取
    → 结束

if URL contains "youtube.com" or "youtu.be":
    → 调用 yt-search-download skill（如未安装，改走 Step 1-3 代理服务）
    → 结束

else:
    → 继续 Step 1
```

### Step A: 公众号文章抓取（内置）

```bash
python3 scripts/fetch_weixin.py "{WEIXIN_URL}"
```

依赖：`playwright`、`beautifulsoup4`、`lxml`
输出：YAML frontmatter（title, author, date, url）+ Markdown 正文
失败时回退到 Step 1-2 代理服务。

### Step B: 飞书文档抓取（内置）

```bash
python3 scripts/fetch_feishu.py "{FEISHU_URL}"
```

依赖：`requests`（标准库级别），环境变量 `FEISHU_APP_ID` + `FEISHU_APP_SECRET`
支持：docx 文档、doc 文档（通过 docx API 兼容抓取）、wiki 知识库页面（自动解析实际文档 ID）
输出：YAML frontmatter（title, document_id, url）+ Markdown 正文
支持 `--json` 参数输出 JSON 格式。
失败时（如权限错误、token 未配置）回退到 Step 1-2 代理服务。

### Step 1: 优先用 r.jina.ai

```bash
curl -sL "https://r.jina.ai/{original_url}"
```

### Step 2: 如果 Jina 失败，用 defuddle.md

```bash
curl -sL "https://defuddle.md/{original_url}"
```

### Step 3: 如果两个代理都失败，回退本地工具

优先用 agent-fetch，失败再用 defuddle CLI：

```bash
# 3a: agent-fetch（优先）
npx agent-fetch "{original_url}" --json
```

如果 agent-fetch 失败或未安装：

```bash
# 3b: defuddle CLI（兜底）
defuddle parse "{original_url}" -m -j
```

如果以上所有方法均失败，告知用户：无法抓取该页面，可能原因（登录墙、严格反爬、地区限制），建议用户手动复制页面内容后粘贴给AI。


## Examples

### X/Twitter 帖子
```bash
curl -sL "https://r.jina.ai/https://x.com/username/status/1234567890"
```

### 普通网页
```bash
curl -sL "https://r.jina.ai/https://example.com/article"
```

### 公众号文章
```bash
python3 scripts/fetch_weixin.py "https://mp.weixin.qq.com/s/abc123"
```

### 飞书文档
```bash
python3 scripts/fetch_feishu.py "https://xxx.feishu.cn/docx/xxxxxxxx"
```

### 飞书知识库
```bash
python3 scripts/fetch_feishu.py "https://xxx.feishu.cn/wiki/xxxxxxxx"
```

## Notes

- r.jina.ai 和 defuddle.md 均免费、无需 API key
- 公众号文章使用内置 Playwright 脚本（需 `playwright install chromium`）
- 飞书文档使用内置 API 脚本（需环境变量 `FEISHU_APP_ID` + `FEISHU_APP_SECRET`）
- 飞书脚本自动将 blocks 转为 Markdown（标题、列表、代码块、引用、待办等）
