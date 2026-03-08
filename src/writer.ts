import { promises as fs } from 'fs';
import path from 'path';

/** Directories to skip when discovering markdown files. */
const IGNORED_DIRS = new Set([
  'node_modules',
  '.git',
  'dist',
  '.next',
  '.nuxt',
  'build',
  'coverage',
  'vendor',
  '__pycache__',
]);

/**
 * Recursively discovers all `.md` files under the given directory,
 * skipping common non-project directories.
 */
export async function discoverMarkdownFiles(dir: string): Promise<string[]> {
  const results: string[] = [];

  async function walk(current: string): Promise<void> {
    let entries;
    try {
      entries = await fs.readdir(current, { withFileTypes: true });
    } catch {
      return; // skip directories we can't read
    }

    for (const entry of entries) {
      if (entry.name.startsWith('.')) continue;

      const fullPath = path.join(current, entry.name);

      if (entry.isDirectory()) {
        if (!IGNORED_DIRS.has(entry.name)) {
          await walk(fullPath);
        }
      } else if (entry.isFile() && entry.name.endsWith('.md')) {
        results.push(fullPath);
      }
    }
  }

  await walk(dir);
  // Sort alphabetically for consistent ordering in the UI
  results.sort();
  return results;
}

/**
 * Reads the markdown file from disk and returns its content as a string.
 */
export async function readTaskFile(filePath: string): Promise<string> {
  return fs.readFile(filePath, 'utf-8');
}

/**
 * Writes the updated markdown content back to the local file.
 */
export async function writeTaskFile(filePath: string, content: string): Promise<void> {
  await fs.writeFile(filePath, content, 'utf-8');
}
