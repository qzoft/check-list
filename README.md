# @qzoft/check-list

A general-purpose MCP App that discovers and displays checklists from **all markdown files** in your project, rendered as an interactive checkbox UI inside VS Code Copilot Chat. Changes are saved automatically — no confirmation needed.

Available on npm: [`@qzoft/check-list`](https://www.npmjs.com/package/@qzoft/check-list)

## Prerequisites

- Node.js 18+
- VS Code Insiders (for [MCP Apps support](https://code.visualstudio.com/blogs/2026/01/26/mcp-apps-support))

## Setup

Add the following to your project's `.vscode/mcp.json`:

```json
{
  "servers": {
    "check-list": {
      "command": "npx",
      "args": ["-y", "@qzoft/check-list"],
      "env": {
        "PROJECT_DIR": "${workspaceFolder}"
      }
    }
  }
}
```

That's it — VS Code will download and run the server automatically. No cloning or building required.

In Copilot Chat, ask **"show my tasks"** → the `list_tasks` tool scans the project and renders the interactive checkbox UI.

## Usage

Once the server is running, you can use two tools in Copilot Chat:

- **`list_tasks`** — scans all `.md` files in the project directory, finds checkbox items, and displays an interactive UI grouped by file and section. Toggle any checkbox and it saves automatically.
- **`update_tasks`** — called automatically when you toggle a checkbox. Can also be called directly by Copilot to update tasks in any markdown file.

## How it works

```
┌──────────────────────────┐
│   VS Code Copilot Chat   │
│                          │
│  "show my tasks"         │
│         │                │
│         ▼                │
│   list_tasks tool ───────┼──► MCP Server (Node.js)
│         │                │         │
│         │                │    scans project for *.md
│         │                │    parses checkboxes
│         │                │         │
│   renders iframe UI ◄────┼─────────┘
│   (task-checklist.html)  │
│         │                │
│   [checkbox toggle]      │
│         │                │
│   auto-save ─────────────┼──► MCP Server writes to file
└──────────────────────────┘
```

1. The MCP server recursively discovers all `.md` files in the project directory.
2. Each file is parsed for `## Section` headers and `- [ ]` / `- [x]` checkbox items.
3. VS Code renders `ui/task-checklist.html` as an interactive iframe grouped by file.
4. Toggling a checkbox **immediately saves** the change back to the originating file — no save button required.

## Configuration

| Variable      | Description                                         | Example                          |
|---------------|-----------------------------------------------------|----------------------------------|
| `PROJECT_DIR` | Root directory to scan for markdown files            | `~/repos/my-project`             |

If neither is set, the server uses the current working directory.

## Task file format

The parser recognizes `## Section` headers and checkbox list items in any `.md` file:

```markdown
## Today
- [ ] Write tests
- [ ] Update README

## This Week
- [ ] Review PRs
- [ ] Deploy to staging
```

Checkbox items that appear before any section header are grouped under a default "Tasks" section. Non-checkbox content is preserved as-is when writing back.

The server skips common non-project directories (`node_modules`, `.git`, `dist`, `build`, etc.) during scanning.

## Project structure

```
@qzoft/check-list
├── package.json
├── tsconfig.json
├── README.md
├── src/
│   ├── server.ts          # MCP server entry point
│   ├── parser.ts          # Markdown checkbox parser
│   └── writer.ts          # File discovery & read/write
└── ui/
    └── task-checklist.html # MCP App UI rendered in iframe
```

## Learn more

- [MCP Apps support in VS Code](https://code.visualstudio.com/blogs/2026/01/26/mcp-apps-support)
- [Model Context Protocol SDK](https://github.com/modelcontextprotocol/typescript-sdk)
