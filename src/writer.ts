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

      // entry.isDirectory() doesn't follow symlinks/junctions;
      // fall back to fs.stat for symbolic links to resolve the real type.
      let isDir = entry.isDirectory();
      if (!isDir && entry.isSymbolicLink()) {
        try {
          const stat = await fs.stat(fullPath);
          isDir = stat.isDirectory();
        } catch {
          continue; // skip broken links
        }
      }

      if (isDir) {
        if (!IGNORED_DIRS.has(entry.name)) {
          await walk(fullPath);
        }
      } else if (entry.name.endsWith('.md')) {
        // Use stat to follow symlinks/hard links that isFile() may miss
        try {
          const stat = await fs.stat(fullPath);
          if (stat.isFile()) {
            results.push(fullPath);
          }
        } catch {
          // skip files we can't stat
        }
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
