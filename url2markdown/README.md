# url2markdown
> 基于 [joeseesun/markdown-proxy](https://github.com/joeseesun/markdown-proxy)
> 支持将任意 URL 转换为干净的结构化 Markdown，支持需登录访问的页面（如 X/Twitter、微信公众号、飞书文档等）。

## 改动优化部分

基于 [joeseesun/markdown-proxy](https://github.com/joeseesun/markdown-proxy) 做了以下改动：

- **`fetch_feishu.py` 增加域名限制**：加入 URL 合法性校验，只允许 `feishu.cn` / `larksuite.com`，防止 SSRF 攻击
- **`fetch_weixin.py` `fetch_feishu.py` 页面解析优化**
- **去掉 YouTube 路由**：YouTube 抓取依赖外部 `yt-search-download` skill，不作为本 skill 的内置功能
- **优化 SKILL.md 指令结构**：
  - 删除与 Workflow 重复的路由规则表和代理优先级表，减少维护歧义
  - Step 1/2 补充明确的成功判断标准（内容长度 > 200 字符）
  - Step 3 明确 agent-fetch → defuddle CLI 的先后顺序
  - 补充全部方法失败时的兜底指引（告知用户原因和手动操作建议）
  - 去掉 curl 的 `2>/dev/null`，保留错误输出以便 AI 判断失败原因
  - 删除输出格式规范（Step 4/5）

## 功能

给 AI agent 发一个 URL，自动抓取完整内容并转为 Markdown。智能路由支持三种 URL 类型：

| URL 类型 | 抓取方式 | 原因 |
|----------|---------|------|
| 微信公众号 (`mp.weixin.qq.com`) | 内置 Playwright 脚本 | 反爬需要无头浏览器 |
| 飞书文档 (`feishu.cn/docx/`, `/wiki/`, `/docs/`) | 内置飞书 API 脚本 | 需要 API 认证 |
| 其他所有 URL | 代理级联：r.jina.ai → defuddle.md → agent-fetch → defuddle CLI | 免费、无需 API key |

## 代理级联

普通 URL 依次尝试四个服务：

1. **r.jina.ai** — 内容最完整，保留图片链接
2. **defuddle.md** — 输出更干净，带 YAML frontmatter
3. **[agent-fetch](https://github.com/teng-lin/agent-fetch)** — 本地工具，无需网络代理
4. **defuddle CLI** — 本地 CLI 兜底

所有方式均失败时，AI agent 会告知可能原因（登录墙、严格反爬、地区限制）并建议手动复制内容。

## 前置条件

- [ ] **curl**（macOS/Linux 自带）
- [ ] （公众号抓取）Python 3.8+ 及 playwright
  ```bash
  pip install playwright beautifulsoup4 lxml
  playwright install chromium
  ```
- [ ] （代理降级）[agent-fetch](https://github.com/teng-lin/agent-fetch)
  ```bash
  npx agent-fetch --help  # 无需预装，npx 自动下载
  ```
- [ ] （飞书抓取）环境变量 `FEISHU_APP_ID` 和 `FEISHU_APP_SECRET`
  ```bash
  echo $FEISHU_APP_ID  # 验证已配置
  ```

## 安装

```bash
npx skills add hyforthy/skills --skill url2markdown
```

## 使用示例

直接给 AI agent 发 URL：

- "帮我读一下这篇文章：https://example.com/post"
- "抓取这条推文：https://x.com/user/status/123456"
- "读一下这篇公众号：https://mp.weixin.qq.com/s/abc123"
- "把这个飞书文档转成 Markdown：https://xxx.feishu.cn/docx/xxxxxxxx"
- "读一下这个飞书知识库页面：https://xxx.feishu.cn/wiki/xxxxxxxx"

## 飞书文档支持

内置 `fetch_feishu.py` 脚本，通过飞书开放 API 抓取文档内容并自动转为 Markdown：

- 支持新版文档（docx）、旧版文档（doc）、知识库页面（wiki）
- 自动解析 blocks，支持类型：
  - 正文段落、标题（H1–H6）
  - 无序列表、有序列表、待办（支持多级嵌套）
  - 代码块（含语言标识）、行内代码、公式（inline `$` / block `$$`）
  - 引用块（含子块递归）、Callout（输出为 blockquote，含 emoji）
  - 表格（自动输出 Markdown 表格格式）
  - 多列布局（Grid/GridColumn，透明容器，内容正常输出）
  - 图片（输出 `feishu-image://token` 引用）
  - 行内格式：加粗、斜体、加粗斜体、删除线、行内代码、超链接、@用户、文档引用、附件
- 需要环境变量 `FEISHU_APP_ID` 和 `FEISHU_APP_SECRET`
- 应用需要 `docx:document:readonly` 权限（wiki 页面还需 `wiki:wiki:readonly`）

## 常见问题

| 问题 | 解决方法 |
|------|---------|
| 公众号抓取失败 | 运行 `playwright install chromium` |
| 飞书文档返回权限错误 | 检查环境变量，确认应用有文档读取权限 |
| 飞书知识库页面失败 | 确认应用有 `wiki:wiki:readonly` 权限 |
| r.jina.ai 返回空内容 | 自动降级到 defuddle.md（无需操作） |
| 所有代理都失败 | URL 可能有严格认证限制，尝试手动复制内容 |

## 致谢

- 基于 [joeseesun/markdown-proxy](https://github.com/joeseesun/markdown-proxy)


