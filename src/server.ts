import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { z } from 'zod';
import { fileURLToPath } from 'url';
import path from 'path';
import { readTaskFile, writeTaskFile } from './writer.js';
import { parseTasks, serializeTasks } from './parser.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const taskFile = process.env['TASK_FILE'];
if (!taskFile) {
  console.error('Error: TASK_FILE environment variable is not set.');
  console.error('Set it to the path of your task.md file, e.g.:');
  console.error('  export TASK_FILE=~/repos/personal-os/task.md');
  process.exit(1);
}

// Resolve ~ and relative paths
const resolvedTaskFile = taskFile.startsWith('~')
  ? path.join(process.env['HOME'] ?? '', taskFile.slice(1))
  : path.resolve(taskFile);

// Path to the MCP App HTML file (bundled alongside this server)
const uiHtmlPath = path.resolve(__dirname, '..', 'ui', 'task-checklist.html');
const uiResourceUri = `file://${uiHtmlPath}`;

const server = new McpServer({
  name: 'check-list',
  version: '1.0.0',
});

server.registerTool(
  'list_tasks',
  {
    description: 'Read and display the task checklist from the configured markdown file',
    inputSchema: {},
  },
  async () => {
    let content: string;
    try {
      content = await readTaskFile(resolvedTaskFile);
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      return {
        isError: true,
        content: [
          {
            type: 'text' as const,
            text: `Error reading task file at ${resolvedTaskFile}: ${message}`,
          },
        ],
      };
    }

    const sections = parseTasks(content);

    return {
      _meta: {
        ui: {
          resourceUri: uiResourceUri,
        },
      },
      content: [
        {
          type: 'text' as const,
          text: JSON.stringify(sections, null, 2),
        },
      ],
    };
  }
);

server.registerTool(
  'update_tasks',
  {
    description: 'Update checkbox states in the task markdown file',
    inputSchema: {
      updates: z.array(
        z.object({
          line: z.number().describe('0-indexed line number in the markdown file'),
          checked: z.boolean().describe('New checked state for the checkbox'),
        })
      ).describe('Array of line updates to apply'),
    },
  },
  async ({ updates }) => {
    let content: string;
    try {
      content = await readTaskFile(resolvedTaskFile);
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      return {
        isError: true,
        content: [
          {
            type: 'text' as const,
            text: `Error reading task file at ${resolvedTaskFile}: ${message}`,
          },
        ],
      };
    }

    const updated = serializeTasks(content, updates);

    try {
      await writeTaskFile(resolvedTaskFile, updated);
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      return {
        isError: true,
        content: [
          {
            type: 'text' as const,
            text: `Error writing task file at ${resolvedTaskFile}: ${message}`,
          },
        ],
      };
    }

    const checkedCount = updates.filter((u) => u.checked).length;
    const uncheckedCount = updates.filter((u) => !u.checked).length;
    const parts: string[] = [];
    if (checkedCount > 0) parts.push(`${checkedCount} task(s) marked as done`);
    if (uncheckedCount > 0) parts.push(`${uncheckedCount} task(s) marked as undone`);

    return {
      content: [
        {
          type: 'text' as const,
          text: `✅ Saved: ${parts.join(', ')}.`,
        },
      ],
    };
  }
);

const transport = new StdioServerTransport();
await server.connect(transport);
