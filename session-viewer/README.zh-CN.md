# Session Viewer

> [English README](README.md)

一个用于浏览、搜索和查看 Claude Code 对话历史的本地 Web 界面。

## 功能特性

- **现代化 UI** — 深色/浅色/系统主题，流畅的动画和渐变效果
- **会话侧边栏** — 按日期分组（今天、昨天等），显示相对时间
- **对话查看器** — 彩色区块区分用户、助手、工具调用、工具结果和思考消息
- **消息过滤** — 按消息类型过滤（用户 / 助手 / 工具）
- **可折叠区块** — 单独或一键展开/折叠所有区块
- **思考开关** — 显示/隐藏思考/推理区块
- **自动关闭** — 关闭浏览器标签页后服务器自动退出（通过 SSE 心跳检测）
- **跨平台** — 支持 Windows、macOS 和 Linux

## 前置要求

- **Node.js**（任何支持 `require` 的版本 — Node 14+）

无需 npm 安装或构建步骤。脚本是单个自包含的 `.js` 文件。

## 安装

```bash
npx skills add hyforthy/skills --skill session-viewer
```

## 使用方法

### 通过 Claude Code（推荐）

直接向 Claude Code 提问：
- "显示我的会话"
- "浏览 Claude 历史"
- "打开会话查看器"

[SKILL.md](SKILL.md) 会自动触发并启动查看器。

### 直接运行

```bash
node scripts/session-viewer.js
```

服务器默认在 `http://localhost:3333` 启动，并自动打开默认浏览器。

## 命令行参数

| 参数 | 说明 |
|------|------|
| `--all` | 显示 `~/.claude/projects/` 下所有项目的会话 |
| `--dir <path>` | 从指定目录读取会话 |
| `--port <n>` | 指定端口（默认 `3333`，备用 `3334` 和 `3335`） |
| `--no-open` | 不自动打开浏览器 |
| `--version`, `-v` | 显示版本号 |
| `--help`, `-h` | 显示帮助信息 |

### 示例

```bash
# 当前项目的会话
node scripts/session-viewer.js

# 所有项目
node scripts/session-viewer.js --all

# 指定目录
node scripts/session-viewer.js --dir ~/work/my-project

# 指定端口，不自动打开浏览器
node scripts/session-viewer.js --port 8080 --no-open
```

## 工作原理

1. **定位会话文件** — 从 `~/.claude/projects/<project-slug>/` 读取 `.jsonl` 文件
2. **启动 HTTP 服务器** — 在本地端口提供 UI 和 REST API
3. **打开浏览器** — 使用系统默认浏览器（Windows 用 `start`，macOS 用 `open`，Linux 用 `xdg-open`）
4. **自动关闭** — 维持 SSE 心跳连接；标签页关闭后自动退出

## 数据存储

Claude Code 将会话数据存储为 `.jsonl` 文件（每行一个 JSON 对象），位于：

```
~/.claude/projects/<project-slug>/
```

`<project-slug>` 由当前工作目录路径生成（将 `\`、`/` 和 `:` 替换为 `-`）。

## 目录结构

```
session-viewer/
├── SKILL.md              # Claude Code skill 定义文件
├── scripts/
│   └── session-viewer.js # 自包含的 Node.js 服务器 + UI
└── README.md             # 英文说明文件
└── README-cn.md          # 本文件（中文说明）
```

## 跨平台兼容性

| 平台 | 路径解析 | 打开浏览器 | 状态 |
|------|----------|------------|------|
| **Windows** | ✅ `path.join()`, `os.homedir()` | ✅ `start "" <url>` | 支持 |
| **macOS** | ✅ | ✅ `open <url>` | 支持 |
| **Linux** | ✅ | ✅ `xdg-open <url>` | 支持 |

### Windows 注意事项

- 使用 `start ""` 打开默认浏览器（空 `""` 防止 URL 被解释为窗口标题）
- 文件系统操作使用 Node.js 内置的 `fs` 和 `path` 模块，正确处理 Windows 路径
- 打开浏览器时可能会出现短暂的控制台窗口闪烁（Windows `start` 命令的正常行为）

## 常见问题

| 问题 | 解决方法 |
|------|----------|
| "Could not find an available port" | 使用 `--port <n>` 指定其他端口，或释放 3333-3335 端口 |
| "Sessions directory not found" | 在 Claude Code 项目目录中运行，或使用 `--all` 查看所有项目 |
| "No sessions found" | 当前项目尚未记录任何对话 |
| 浏览器没有打开 | 使用 `--no-open` 并手动访问 `http://localhost:3333` |
| 解析会话失败 | `.jsonl` 文件中某些行可能格式不正确，UI 中会显示警告横幅 |
