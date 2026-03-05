# Copilot Instructions

This is an MCP App for interactive task management from markdown files, rendered as a checkbox UI in VS Code Copilot Chat.

## Project Overview

- **Language:** TypeScript
- **Runtime:** Node.js 18+
- **Build:** `npm run build` (compiles `src/` → `dist/`)

## Key Files

- `src/server.ts` — MCP server entry point
- `src/parser.ts` — Markdown checkbox parser
- `src/writer.ts` — File read/write utilities
- `ui/task-checklist.html` — Interactive checkbox UI rendered in iframe

## Tools

- **`list_tasks`** — Reads the task file and displays the checkbox UI
- **`update_tasks`** — Writes updated task state back to the markdown file

## Conventions

- The task file path is configured via the `TASK_FILE` environment variable
- Task files use `## Section` headers with `- [ ]` / `- [x]` checkbox syntax
