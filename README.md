# check-list

An MCP App for interactive task management from markdown files, rendered as a rich checkbox UI inside VS Code Copilot Chat.

## Prerequisites

- Node.js 18+
- VS Code Insiders (for [MCP Apps support](https://code.visualstudio.com/blogs/2026/01/26/mcp-apps-support))

## Setup

1. Clone this repo:
   ```sh
   git clone https://github.com/qzoft/check-list.git
   cd check-list
   ```

2. Install dependencies:
   ```sh
   npm install
   ```

3. Build the project:
   ```sh
   npm run build
   ```

4. Set the `TASK_FILE` environment variable to point to your `task.md` file:
   ```sh
   export TASK_FILE=~/repos/personal-os/task.md
   ```

5. Open VS Code — the `.vscode/mcp.json` config auto-registers the server. VS Code will pick it up automatically when you open the workspace.

6. In Copilot Chat, ask **"show my tasks"** → the `list_tasks` tool renders the interactive checkbox UI.

## Usage

Once the server is running, you can use two tools in Copilot Chat:

- **`list_tasks`** — reads your `task.md` file and displays an interactive checkbox UI. Click checkboxes to toggle task states.
- **`update_tasks`** — called automatically when you click "💾 Save changes" in the UI. Can also be called directly by Copilot to update tasks.

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
│         │                │    reads task.md
│         │                │    parses checkboxes
│         │                │         │
│   renders iframe UI ◄────┼─────────┘
│   (task-checklist.html)  │
│         │                │
│   [checkbox clicks]      │
│         │                │
│   update_tasks ──────────┼──► MCP Server writes task.md
└──────────────────────────┘
```

1. The MCP server reads your `task.md` file, parses the checkbox sections, and returns structured JSON.
2. VS Code renders `ui/task-checklist.html` as an interactive iframe inside the chat.
3. The HTML UI receives the task data, displays grouped checkboxes, and lets you toggle them.
4. Clicking "💾 Save changes" calls the `update_tasks` tool which writes the updated state back to `task.md`.

## Configuration

| Variable    | Description                                      | Example                                    |
|-------------|--------------------------------------------------|--------------------------------------------|
| `TASK_FILE` | Path to the markdown file with your task list    | `~/repos/personal-os/task.md`              |

The `TASK_FILE` path is configured in `.vscode/mcp.json`:

```json
{
  "servers": {
    "check-list": {
      "command": "node",
      "args": ["dist/server.js"],
      "env": {
        "TASK_FILE": "${workspaceFolder}/../personal-os/task.md"
      }
    }
  }
}
```

Adjust the `TASK_FILE` value to point to wherever your `task.md` lives.

## Task file format

The parser recognizes `## Section` headers and checkbox list items:

```markdown
## Today
- [ ] Write tests
- [x] Update README

## This Week
- [ ] Review PRs
- [ ] Deploy to staging
```

Non-checkbox list items and other markdown content are preserved as-is when writing back.

## Project structure

```
check-list/
├── package.json
├── tsconfig.json
├── README.md
├── .vscode/
│   └── mcp.json          # VS Code MCP server config
├── src/
│   ├── server.ts          # MCP server entry point
│   ├── parser.ts          # Markdown checkbox parser
│   └── writer.ts          # File read/write utilities
└── ui/
    └── task-checklist.html # MCP App UI rendered in iframe
```

## Learn more

- [MCP Apps support in VS Code](https://code.visualstudio.com/blogs/2026/01/26/mcp-apps-support)
- [Model Context Protocol SDK](https://github.com/modelcontextprotocol/typescript-sdk)
