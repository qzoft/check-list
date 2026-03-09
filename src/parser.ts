export interface Task {
  text: string;
  checked: boolean;
  line: number;
}

export interface TaskSection {
  name: string;
  tasks: Task[];
}

/**
 * Parses a markdown string, finding section headers (## SectionName) and
 * checkbox lines within each section.
 */
export function parseTasks(markdown: string): TaskSection[] {
  const lines = markdown.replace(/\r/g, '').split('\n');
  const sections: TaskSection[] = [];
  let currentSection: TaskSection | null = null;

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];

    // Match section headers: ## SectionName
    const sectionMatch = line.match(/^##\s+(.+)$/);
    if (sectionMatch) {
      currentSection = { name: sectionMatch[1].trim(), tasks: [] };
      sections.push(currentSection);
      continue;
    }

    // Match checkbox lines within a section
    if (currentSection) {
      const checkedMatch = line.match(/^- \[x\]\s+(.+)$/i);
      const uncheckedMatch = line.match(/^- \[ \]\s+(.+)$/);

      if (checkedMatch) {
        currentSection.tasks.push({
          text: checkedMatch[1].trim(),
          checked: true,
          line: i,
        });
      } else if (uncheckedMatch) {
        currentSection.tasks.push({
          text: uncheckedMatch[1].trim(),
          checked: false,
          line: i,
        });
      }
    }
  }

  return sections;
}

/**
 * Applies updates to the original markdown, toggling checkbox state for each
 * specified line. All other content is preserved exactly as-is.
 */
export function serializeTasks(
  original: string,
  updates: { line: number; checked: boolean }[]
): string {
  const lines = original.split('\n');

  for (const update of updates) {
    const line = lines[update.line];
    if (line === undefined) continue;

    if (update.checked) {
      // Mark as checked: replace - [ ] with - [x]
      lines[update.line] = line.replace(/^(- )\[ \]/, '$1[x]');
    } else {
      // Mark as unchecked: replace - [x] with - [ ]
      lines[update.line] = line.replace(/^(- )\[[xX]\]/, '$1[ ]');
    }
  }

  return lines.join('\n');
}
