#!/usr/bin/env node
import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { registerAppTool, registerAppResource, RESOURCE_MIME_TYPE } from '@modelcontextprotocol/ext-apps/server';
import { z } from 'zod';
import { fileURLToPath } from 'url';
import path from 'path';
import fs from 'fs';
import { discoverMarkdownFiles, readTaskFile, writeTaskFile } from './writer.js';
import { parseTasks, serializeTasks, FileTaskGroup } from './parser.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Use PROJECT_DIR if set, otherwise fall back to TASK_FILE's parent dir, or CWD
const projectDir = (() => {
  const dir = process.env['PROJECT_DIR'];
  if (dir) {
    return dir.startsWith('~')
      ? path.join(process.env['HOME'] ?? '', dir.slice(1))
      : path.resolve(dir);
  }
  // Backward-compat: if TASK_FILE is set, use its parent directory
  const taskFile = process.env['TASK_FILE'];
  if (taskFile) {
    const resolved = taskFile.startsWith('~')
      ? path.join(process.env['HOME'] ?? '', taskFile.slice(1))
      : path.resolve(taskFile);
    return path.dirname(resolved);
  }
  return process.cwd();
})();

// MCP App UI resource
const uiHtmlPath = path.resolve(__dirname, '..', 'ui', 'task-checklist.html');
const uiResourceUri = 'ui://check-list/task-checklist.html';

const server = new McpServer({
  name: 'check-list',
  version: '2.0.0',
});

// Register the HTML resource for the UI
registerAppResource(
  server,
  'Task Checklist',
  uiResourceUri,
  { description: 'Interactive checkbox UI for task management' },
  async () => ({
    contents: [{
      uri: uiResourceUri,
      mimeType: RESOURCE_MIME_TYPE,
      text: fs.readFileSync(uiHtmlPath, 'utf-8'),
    }],
  }),
);

registerAppTool(
  server,
  'list_tasks',
  {
    description: 'Discover and display checklists from all markdown files in the project',
    _meta: { ui: { resourceUri: uiResourceUri } },
  },
  async () => {
    let mdFiles: string[];
    try {
      mdFiles = await discoverMarkdownFiles(projectDir);
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      return {
        isError: true,
        content: [
          {
            type: 'text' as const,
            text: `Error scanning project directory ${projectDir}: ${message}`,
          },
        ],
      };
    }

    const fileGroups: FileTaskGroup[] = [];

    for (const filePath of mdFiles) {
      let content: string;
      try {
        content = await readTaskFile(filePath);
      } catch {
        continue; // skip files we can't read
      }

      const sections = parseTasks(content);
      const hasTasks = sections.some((s) => s.tasks.length > 0);
      if (!hasTasks) continue;

      // Use relative path for cleaner display
      const relPath = path.relative(projectDir, filePath);
      fileGroups.push({ file: relPath, sections });
    }

    return {
      content: [
        {
          type: 'text' as const,
          text: 'The tasks are displayed in the interactive UI above. Do not repeat or summarize the task content in your response — the user can already see and interact with them.',
        },
      ],
      structuredContent: { files: fileGroups } as Record<string, unknown>,
    };
  }
);

registerAppTool(
  server,
  'update_tasks',
  {
    description: 'Update checkbox states in a project markdown file (auto-saved on toggle)',
    inputSchema: {
      file: z.string().describe('Relative path to the markdown file within the project'),
      updates: z.array(
        z.object({
          line: z.number().describe('0-indexed line number in the markdown file'),
          checked: z.boolean().describe('New checked state for the checkbox'),
        })
      ).describe('Array of line updates to apply'),
    },
    _meta: { ui: { resourceUri: uiResourceUri, visibility: ['app'] } },
  },
  async ({ file, updates }) => {
    const filePath = path.resolve(projectDir, file);

    let content: string;
    try {
      content = await readTaskFile(filePath);
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      return {
        isError: true,
        content: [
          {
            type: 'text' as const,
            text: `Error reading file ${file}: ${message}`,
          },
        ],
      };
    }

    const updated = serializeTasks(content, updates);

    try {
      await writeTaskFile(filePath, updated);
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      return {
        isError: true,
        content: [
          {
            type: 'text' as const,
            text: `Error writing file ${file}: ${message}`,
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
          text: `✅ Saved ${file}: ${parts.join(', ')}.`,
        },
      ],
    };
  }
);

const transport = new StdioServerTransport();
await server.connect(transport);
