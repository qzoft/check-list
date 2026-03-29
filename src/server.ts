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
    description: 'Discover and display checklists from markdown files. IMPORTANT: Always pass the `cwd` parameter with the absolute path of the current workspace folder so the tool knows where to look for files. When the user asks to see tasks in a specific file, also pass its ABSOLUTE file path as the `file` parameter.',
    inputSchema: {
      cwd: z.string().describe('REQUIRED. The absolute path to the current workspace/project folder (e.g. "C:\\\\Users\\\\me\\\\projects\\\\my-app" or "/home/me/projects/my-app"). This tells the tool where to scan for markdown files.'),
      file: z.string().optional().describe('Optional ABSOLUTE path to a specific markdown file. Omit to scan all markdown files in the workspace folder.'),
    },
    _meta: { ui: { resourceUri: uiResourceUri } },
  },
  async ({ cwd, file }) => {
    // Use the provided cwd, fall back to env/config projectDir
    const effectiveDir = cwd ? path.resolve(cwd) : projectDir;
    let mdFiles: string[];

    if (file) {
      // Single-file mode
      const resolved = path.isAbsolute(file) ? path.resolve(file) : path.resolve(effectiveDir, file);
      if (!fs.existsSync(resolved)) {
        // Try to find by filename in the workspace
        const basename = path.basename(file);
        try {
          const allMd = await discoverMarkdownFiles(effectiveDir);
          const match = allMd.find(f => f.endsWith(path.sep + file.replace(/\//g, path.sep)))
            || allMd.find(f => path.basename(f) === basename);
          if (match) {
            mdFiles = [match];
          } else {
            return {
              isError: true,
              content: [{ type: 'text' as const, text: `File not found: ${file}` }],
            };
          }
        } catch {
          return {
            isError: true,
            content: [{ type: 'text' as const, text: `File not found: ${file}` }],
          };
        }
      } else {
        mdFiles = [resolved];
      }
    } else {
      // All-files mode: discover every markdown file in the workspace
      try {
        mdFiles = await discoverMarkdownFiles(effectiveDir);
      } catch (err) {
        const message = err instanceof Error ? err.message : String(err);
        return {
          isError: true,
          content: [
            {
              type: 'text' as const,
              text: `Error scanning directory ${effectiveDir}: ${message}`,
            },
          ],
        };
      }
    }

    const fileGroups: FileTaskGroup[] = [];

    for (const filePath of mdFiles) {
      let content: string;
      try {
        content = await readTaskFile(filePath);
      } catch {
        if (file) {
          return {
            isError: true,
            content: [{ type: 'text' as const, text: `Could not read file: ${filePath}` }],
          };
        }
        continue; // skip files we can't read
      }

      const sections = parseTasks(content);
      const hasTasks = sections.some((s) => s.tasks.length > 0);
      if (!hasTasks) continue;

      const relPath = path.relative(effectiveDir, filePath);
      fileGroups.push({ file: relPath, absolutePath: filePath, sections });
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
    description: 'Update checkbox states in a markdown file (auto-saved on toggle)',
    inputSchema: {
      file: z.string().describe('ABSOLUTE path to the markdown file.'),
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
    const filePath = path.isAbsolute(file) ? path.resolve(file) : path.resolve(projectDir, file);

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
