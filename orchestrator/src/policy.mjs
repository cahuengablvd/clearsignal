export function compareTests(baseline, post) {
  return post.map((item) => {
    const before = baseline.find((candidate) => candidate.command?.startsWith(item.name) || candidate.command?.includes(item.name));
    if (!before) return { name: item.name, status: 'NEW_STAGE' };
    if (before.exit_code === 0 && item.exitCode !== 0) return { name: item.name, status: 'NEW_REGRESSION' };
    if (before.exit_code !== 0 && item.exitCode === 0) return { name: item.name, status: 'RESOLVED_FAILURE' };
    if (before.exit_code !== 0 && item.exitCode !== 0) return { name: item.name, status: 'UNCHANGED_FAILURE' };
    return { name: item.name, status: 'PASS' };
  });
}

export function passAllowed({ tests, baseline, fableDecision = null }) {
  if (fableDecision === 'BLOCKED' || fableDecision === 'FIX_REQUIRED') return false;
  const comparison = compareTests(baseline, tests);
  return tests.length === 3 && comparison.every((item) => item.status === 'PASS' || item.status === 'RESOLVED_FAILURE');
}

export function canExecute(openHumanActions) { return openHumanActions === 0; }
