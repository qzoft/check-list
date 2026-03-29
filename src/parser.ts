export interface Task {
  text: string;
  checked: boolean;
  line: number;
}

export interface TaskSection {
  name: string;
  level: number;
  parents?: string[];
  tasks: Task[];
}

/** Represents all checkbox tasks found in a single markdown file. */
export interface FileTaskGroup {
  file: string;
  absolutePath?: string;
  sections: TaskSection[];
}

/**
 * Parses a markdown string, finding section headers (## SectionName) and
 * checkbox lines within each section.
 */
export function parseTasks(markdown: string): TaskSection[] {
  const lines = markdown.replace(/\r/g, '').split('\n');
  const sections: TaskSection[] = [];
  let currentSection: TaskSection | null = null;
  // Track current header at each level for parent breadcrumbs
  let currentH2 = '';
  let currentH3 = '';

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];

    // Match section headers: ##, ### or #### SectionName
    const sectionMatch = line.match(/^(#{2,4})\s+(.+)$/);
    if (sectionMatch) {
      const level = sectionMatch[1].length;
      const name = sectionMatch[2].trim();
      const parents: string[] = [];
      if (level === 2) {
        currentH2 = name;
        currentH3 = '';
      } else if (level === 3) {
        currentH3 = name;
        if (currentH2) parents.push(currentH2);
      } else if (level === 4) {
        if (currentH2) parents.push(currentH2);
        if (currentH3) parents.push(currentH3);
      }
      currentSection = { name, level, parents: parents.length ? parents : undefined, tasks: [] };
      sections.push(currentSection);
      continue;
    }

    // Match checkbox lines (with or without a section header)
    const checkedMatch = line.match(/^- \[x\]\s+(.+)$/i);
    const uncheckedMatch = line.match(/^- \[ \]\s+(.+)$/);

    if (checkedMatch || uncheckedMatch) {
      // Ensure there is a section to hold the task
      if (!currentSection) {
        currentSection = { name: 'Tasks', level: 2, tasks: [] };
        sections.push(currentSection);
      }

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
