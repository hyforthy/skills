# Session Viewer

> [中文说明](README-cn.md)

A local web UI for browsing, searching, and exploring your Claude Code conversation history.

## Features

- **Modern UI** — Dark/light/system themes with smooth animations and gradients
- **Session Sidebar** — Sessions grouped by date (Today, Yesterday, etc.) with relative timestamps
- **Conversation Viewer** — Color-coded blocks for User, Assistant, Tool Call, Tool Result, and Thinking messages
- **Filtering** — Filter by message type (User / Assistant / Tool)
- **Collapsible Blocks** — Expand/collapse individual blocks or all at once
- **Thinking Toggle** — Show/hide thinking/reasoning blocks
- **Auto-Shutdown** — Server automatically exits 5 seconds after you close the browser tab (via SSE heartbeat)
- **Cross-Platform** — Works on Windows, macOS, and Linux

## Prerequisites

- **Node.js** (any version that supports `require` — Node 14+)

No npm install or build step required. The script is a single self-contained `.js` file.

## Usage

### Via Claude Code (Recommended)

Simply ask Claude Code:
- "Show my sessions"
- "Browse claude history"
- "Open session viewer"

The [SKILL.md](SKILL.md) will automatically trigger and launch the viewer.

### Direct Execution

```bash
node scripts/session-viewer.js
```

The server starts on `http://localhost:3333` and opens your default browser automatically.

## Command Line Options

| Flag | Description |
|------|-------------|
| `--all` | Show sessions from all projects under `~/.claude/projects/` |
| `--dir <path>` | Show sessions from a specific directory |
| `--port <n>` | Preferred port (default: `3333`, falls back to `3334` and `3335`) |
| `--no-open` | Don't open the browser automatically |
| `--version`, `-v` | Print version |
| `--help`, `-h` | Print help text |

### Examples

```bash
# Current project's sessions
node scripts/session-viewer.js

# All projects
node scripts/session-viewer.js --all

# Custom directory
node scripts/session-viewer.js --dir ~/work/my-project

# Specific port, no auto-open
node scripts/session-viewer.js --port 8080 --no-open
```

## How It Works

1. **Locates session files** — Reads `.jsonl` files from `~/.claude/projects/<project-slug>/`
2. **Starts HTTP server** — Serves the UI and REST API on a local port
3. **Opens browser** — Uses the OS default browser (`start` on Windows, `open` on macOS, `xdg-open` on Linux)
4. **Auto-shutdown** — Maintains an SSE heartbeat connection; exits when the tab is closed

## Data Storage

Claude Code stores session data as `.jsonl` files (one JSON object per line) under:

```
~/.claude/projects/<project-slug>/
```

The `<project-slug>` is derived from your current working directory path (with `\`, `/`, and `:` replaced by `-`).

## Directory Structure

```
session-viewer/
├── SKILL.md              # Claude Code skill definition
├── scripts/
│   └── session-viewer.js # Self-contained Node.js server + UI
└── README.md             # This file
```

## Cross-Platform Compatibility

| Platform | Path Resolution | Browser Open | Status |
|----------|-----------------|--------------|--------|
| **Windows** | ✅ `path.join()`, `os.homedir()` | ✅ `start "" <url>` | Supported |
| **macOS** | ✅ | ✅ `open <url>` | Supported |
| **Linux** | ✅ | ✅ `xdg-open <url>` | Supported |

### Windows Notes

- Uses `start ""` to open the default browser (the empty `""` prevents the URL from being interpreted as a window title)
- File system operations use Node.js built-in `fs` and `path` modules, which handle Windows paths correctly
- A brief console window flash may occur when opening the browser (normal Windows behavior for `start`)

## Troubleshooting

| Problem | Solution |
|---------|----------|
| "Could not find an available port" | Use `--port <n>` to specify a different port, or free up ports 3333-3335 |
| "Sessions directory not found" | Run inside a Claude Code project directory, or use `--all` to see all projects |
| "No sessions found" | No conversations have been recorded yet for the current project |
| Browser doesn't open | Use `--no-open` and manually navigate to `http://localhost:3333` |
| Failed to parse session | Some lines in the `.jsonl` file may be malformed; a warning banner will appear in the UI |

## License

Bundled with Claude Code.
