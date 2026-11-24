const levelFor = (count) => Math.min(10, 1 + Math.floor(count / 5));

/** Version 1 imports only observable completed records. The first commit saves the migration. */
function reconcileGarden(garden, tasks) {
  if (garden && garden.version !== 1) throw new Error('Unsupported garden ledger version');
  const entries = [...(garden?.entries ?? [])];
  const known = new Set(entries.map(({ taskId }) => taskId));
  for (const task of tasks) {
    if (task.status !== 'completed' || known.has(task.id)) continue;
    known.add(task.id);
    entries.push({ taskId: task.id });
  }
  return { version: 1, entries };
}

function gardenView(garden) {
  const lifetime = garden.entries.length;
  const level = levelFor(lifetime);
  return { lifetime, level, available: garden.entries.filter(entry => !entry.wateringId).length };
}

function spendWater(garden, wateringId) {
  // A retry after a lost response acknowledges the original spend.
  if (garden.entries.some(entry => entry.wateringId === wateringId)) return garden;
  const target = garden.entries.findIndex(entry => !entry.wateringId);
  if (target === -1) return null;
  return {
    ...garden,
    entries: garden.entries.map((entry, index) => index === target ? { ...entry, wateringId } : entry),
  };
}

module.exports = { levelFor, reconcileGarden, gardenView, spendWater };
