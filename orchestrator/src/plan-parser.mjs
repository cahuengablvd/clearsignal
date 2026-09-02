import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { basename } from 'node:path';

const taskHeading = /^##\s+((?:Phase\s+\d+)|(?:[A-Z][A-Za-z]*\d+[A-Za-z]?(?:\.\d+)*))\s*(?:[-\u2013\u2014:]\s*)?(.*)$/;

export function parsePlanText(text, sourceName = 'plan.md') {
  const lines = text.replace(/\r\n/g, '\n').split('\n');
  const found = [];
  for (let index = 0; index < lines.length; index++) {
    const match = lines[index].match(taskHeading);
    if (match) found.push({ index, id: match[1].replace(/\s+/g, '-').toUpperCase(), title: match[2].trim() });
  }
  if (!found.length) {
    const id = basename(sourceName).replace(/^TASKS?_?/i, '').replace(/\.md$/i, '').replace(/[^A-Za-z0-9]+/g, '-').replace(/^-|-$/g, '').toUpperCase() || 'TASK-1';
    found.push({ index: 0, id, title: lines.find((line) => line.startsWith('# '))?.slice(2).trim() || id });
  }
  const seen = new Set();
  const preamble = lines.slice(0, found[0].index).join('\n').trim();
  const tasks = found.map((heading, ordinal) => {
    if (seen.has(heading.id)) throw new Error(`Duplicate task id: ${heading.id}`);
    seen.add(heading.id);
    const end = found[ordinal + 1]?.index ?? lines.length;
    const body = lines.slice(heading.index, end).join('\n').trim();
    const acceptanceMatch = body.match(/###?\s+Acceptance(?: criteria)?\s*\n([\s\S]*?)(?=\n##|$)/i);
    return {
      id: heading.id,
      ordinal,
      objective: heading.title || heading.id,
      acceptance: acceptanceMatch?.[1]?.trim() || 'Satisfy the task section and all repository verification requirements.',
      dependencies: body.match(/(?:depends?\s+on|dependencies)\s*:\s*([^\n]+)/i)?.[1]?.split(/[,\s]+/).map((id) => id.trim().toUpperCase()).filter(Boolean) || (ordinal ? [found[ordinal - 1].id] : []),
      source: body,
      assignedRole: 'IMPLEMENTER',
      modelClass: 'standard'
    };
  });
  return { name: basename(sourceName, '.md'), sha256: createHash('sha256').update(text).digest('hex'), preamble, raw: text, tasks };
}

export function parsePlanFile(path) {
  return parsePlanText(readFileSync(path, 'utf8'), path);
}
