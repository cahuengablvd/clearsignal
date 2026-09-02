import { existsSync } from 'node:fs';
import { join } from 'node:path';

// Node 24 deliberately refuses direct .cmd spawning. These are fixed, local entry
// points; no model-produced command or shell string reaches this boundary.
export function requiredTestCommands(repository) {
  const entries = [
    ['tsc', join(repository, 'node_modules', 'typescript', 'bin', 'tsc'), ['--noEmit']],
    ['vitest', join(repository, 'node_modules', 'vitest', 'vitest.mjs'), ['run']],
    ['build', join(repository, 'node_modules', 'next', 'dist', 'bin', 'next'), ['build']]
  ];
  return entries.map(([name, entry, args]) => ({ name, command: process.execPath, args: [entry, ...args], entry, available: existsSync(entry) }));
}
