import { promises as fs } from 'fs';

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
