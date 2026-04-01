---
name: session-viewer
description: >
  Launches a local web UI to browse Claude Code conversation history.
  Use this skill whenever the user wants to view, browse, search, or explore
  their Claude Code sessions or conversation history. Trigger on phrases like
  "show my sessions", "browse claude history", "open session viewer",
  "view my conversations", or any request to inspect past Claude Code
  interactions. Trigger even if the user just asks what sessions they have.
---

## What this skill does

Starts a local web server (session-viewer.js, bundled with this skill) and
automatically opens it in the user's default browser. The server reads
.jsonl session files that Claude Code stores under ~/.claude/projects/.

## Locating the script

The script is bundled at `scripts/session-viewer.js` inside this skill's
directory. 

## Steps

1. **Resolve the script path**

   ```bash
   SCRIPT="$HOME/.claude/skills/session-viewer/scripts/session-viewer.js"
   ```

2. **Parse arguments** (pass through directly if the user provided any)

   Supported flags:
   - `--all` -- show sessions from all projects, not just the current one
   - `--dir <path>` -- show sessions from a specific directory
   - `--port <n>` -- preferred port (default 3333, tries 3334 and 3335 as fallback)
   - `--no-open` -- not open browser automatically

3. **Start the server and open the browser**

   The script opens the browser automatically on startup.

   ```bash
   node "$SCRIPT" $ARGUMENTS 2>&1
   ```

   Tell the user:
   > Session viewer is opening in your browser.
   > It will shut down automatically when you close the tab.

   If the shell reports an error on startup (e.g. all ports busy), report it and suggest
   freeing a port or using `--port`.
