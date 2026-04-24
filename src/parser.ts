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

      // Stop parsing tasks once we hit the Log section
      if (level === 2 && name === 'Log') break;

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

/**
 * Returns the breadcrumb trail for a task at the given line number,
 * e.g. "Plan > Decisions for Meeting > sub topic 1".
 */
export function getTaskBreadcrumb(sections: TaskSection[], lineNumber: number): string {
  for (const section of sections) {
    const hasTask = section.tasks.some(t => t.line === lineNumber);
    if (hasTask) {
      const parts = section.parents ? [...section.parents, section.name] : [section.name];
      return parts.join(' > ');
    }
  }
  return '';
}

/**
 * Adds a log entry to the end of the markdown content under ## Log > ### date.
 * Creates the Log section and/or date sub-header if they don't exist.
 */
export function addLogEntry(content: string, breadcrumb: string, taskText: string, date: string): string {
  const entry = breadcrumb ? `- ${breadcrumb}: ${taskText}` : `- ${taskText}`;
  const lines = content.replace(/\r/g, '').split('\n');

  // Find the ## Log section
  let logIndex = -1;
  for (let i = 0; i < lines.length; i++) {
    if (/^## Log\s*$/.test(lines[i])) {
      logIndex = i;
      break;
    }
  }

  if (logIndex === -1) {
    // No Log section — append one at the end
    // Ensure trailing newline before new section
    const trimmed = content.replace(/\n+$/, '');
    return trimmed + '\n\n## Log\n\n### ' + date + '\n' + entry + '\n';
  }

  // Log section exists — find or create the date sub-header
  let dateIndex = -1;
  let nextH2 = lines.length; // end of file if no next ## header
  for (let i = logIndex + 1; i < lines.length; i++) {
    if (/^## /.test(lines[i])) {
      nextH2 = i;
      break;
    }
    if (lines[i] === `### ${date}`) {
      dateIndex = i;
    }
  }

  if (dateIndex !== -1) {
    // Date header exists — find the end of its entries and append
    let insertAt = dateIndex + 1;
    for (let i = dateIndex + 1; i < nextH2; i++) {
      if (/^###\s/.test(lines[i])) break;
      if (lines[i].startsWith('- ')) insertAt = i + 1;
      else if (lines[i].trim() === '' && insertAt > dateIndex + 1) continue;
      else if (/^###\s/.test(lines[i])) break;
    }
    lines.splice(insertAt, 0, entry);
  } else {
    // Date header doesn't exist — add at the end of the Log section (before next ## or EOF)
    const insertAt = nextH2;
    const block = (lines[insertAt - 1]?.trim() === '' ? '' : '\n') + `### ${date}\n${entry}\n`;
    lines.splice(insertAt, 0, ...block.split('\n'));
  }

  return lines.join('\n');
}

/**
 * Removes a log entry matching the given task text from the ## Log section.
 * Cleans up empty date sub-headers and empty Log sections.
 */
export function removeLogEntry(content: string, taskText: string): string {
  const lines = content.replace(/\r/g, '').split('\n');

  // Find the ## Log section
  let logIndex = -1;
  for (let i = 0; i < lines.length; i++) {
    if (/^## Log\s*$/.test(lines[i])) {
      logIndex = i;
      break;
    }
  }

  if (logIndex === -1) return content; // No log section

  // Find the end of the Log section
  let logEnd = lines.length;
  for (let i = logIndex + 1; i < lines.length; i++) {
    if (/^## /.test(lines[i])) {
      logEnd = i;
      break;
    }
  }

  // Find and remove the matching entry line
  let removed = false;
  for (let i = logIndex + 1; i < logEnd; i++) {
    if (lines[i].startsWith('- ') && lines[i].endsWith(taskText)) {
      lines.splice(i, 1);
      logEnd--;
      removed = true;
      break;
    }
  }

  if (!removed) return content;

  // Clean up empty date sub-headers
  for (let i = logEnd - 1; i > logIndex; i--) {
    if (/^### /.test(lines[i])) {
      // Check if this date header has any entries
      let hasEntries = false;
      for (let j = i + 1; j < logEnd; j++) {
        if (/^### /.test(lines[j])) break;
        if (lines[j].startsWith('- ')) { hasEntries = true; break; }
      }
      if (!hasEntries) {
        // Remove the date header and any blank lines after it
        let removeEnd = i + 1;
        while (removeEnd < logEnd && lines[removeEnd]?.trim() === '') removeEnd++;
        lines.splice(i, removeEnd - i);
        logEnd -= (removeEnd - i);
      }
    }
  }

  // Clean up empty Log section
  let logHasContent = false;
  for (let i = logIndex + 1; i < logEnd; i++) {
    if (lines[i].trim() !== '') { logHasContent = true; break; }
  }
  if (!logHasContent) {
    // Remove the entire Log section including trailing blank lines
    let removeEnd = logEnd;
    // Also remove leading blank lines before ## Log
    let removeStart = logIndex;
    while (removeStart > 0 && lines[removeStart - 1]?.trim() === '') removeStart--;
    lines.splice(removeStart, removeEnd - removeStart);
  }

  return lines.join('\n');
}
