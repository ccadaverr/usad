const WATERINGS_PER_LEVEL = 2;
const MAX_LEVEL = 10;
const FULL_GROWTH = (MAX_LEVEL - 1) * WATERINGS_PER_LEVEL;
const DAY_MS = 86_400_000;
const DEFAULT_TIME_ZONE = 'UTC';
const countWaterings = entries => entries.filter(entry => entry.wateringId).length;
const emptyGarden = () => ({ version: 3, revision: 0, legacyWaterings: 0, entries: [] });

function upgradeGarden(garden) {
  if (garden.version === 1) {
    // The fixed v1 allowance preserves growth historically granted without a receipt.
    const legacyWaterings = Math.max(0, Math.min(FULL_GROWTH, garden.entries.length) - countWaterings(garden.entries));
    return { ...garden, version: 3, revision: 0, legacyWaterings };
  }
  if (![2, 3].includes(garden.version)
    || !Number.isInteger(garden.legacyWaterings) || garden.legacyWaterings < 0 || garden.legacyWaterings > FULL_GROWTH
    || garden.version === 3 && (!Number.isSafeInteger(garden.revision) || garden.revision < 0)) {
    throw new Error('Invalid garden ledger');
  }
  return garden.version === 3 ? garden : { ...garden, version: 3, revision: 0 };
}

function guestTimeZone(value) {
  if (typeof value === 'string' && value.length <= 100 && /^(?:UTC|[A-Za-z_]+(?:\/[A-Za-z0-9_+\-]+)+)$/.test(value)) {
    try {
      return new Intl.DateTimeFormat('en', { timeZone: value }).resolvedOptions().timeZone;
    } catch { /* Use UTC for invalid or unavailable zones. */ }
  }
  return DEFAULT_TIME_ZONE;
}

function calendarDay(time, zone) {
  const date = new Intl.DateTimeFormat('en-CA', {
    timeZone: zone, year: 'numeric', month: '2-digit', day: '2-digit', calendar: 'iso8601',
  }).formatToParts(time);
  return ['year', 'month', 'day'].map(part => date.find(value => value.type === part).value).join('-');
}

function completedIds(tasks) {
  return new Set(tasks.filter(task => task.status === 'completed').map(task => task.id));
}

// Only newly observed completions receive a historical date. Imported task records have no trustworthy date.
function reconcileGarden(garden, tasks, previousTasks, time, zone) {
  const active = completedIds(tasks);
  const previous = completedIds(previousTasks);
  const changed = active.size !== previous.size || [...active].some(id => !previous.has(id));
  const known = new Set(garden.entries.map(entry => entry.taskId));
  const first = [...active].filter(id => !known.has(id));
  if (!changed && !first.length) return garden;
  const stamp = first.length && time !== undefined
    ? { firstCompletedAt: new Date(time).toISOString(), completionDay: calendarDay(time, zone) } : {};
  return {
    ...garden, revision: garden.revision + 1,
    entries: [...garden.entries, ...first.map(taskId => previous.has(taskId) ? { taskId } : { taskId, ...stamp })],
  };
}

function activeStreak(entries, time, zone) {
  const days = new Set(entries.map(entry => entry.completionDay).filter(Boolean));
  if (!days.size) return 0;
  const today = Date.parse(calendarDay(time, zone) + 'T00:00:00Z');
  const dateAt = offset => new Date(today - offset * DAY_MS).toISOString().slice(0, 10);
  let offset = days.has(dateAt(0)) ? 0 : 1;
  let streak = 0;
  while (days.has(dateAt(offset++))) streak++;
  return streak;
}

function gardenView(garden, tasks, time = Date.now(), zone = DEFAULT_TIME_ZONE) {
  const active = completedIds(tasks);
  const entries = garden.entries.filter(entry => active.has(entry.taskId));
  const activeWaterings = countWaterings(entries);
  const growth = Math.min(FULL_GROWTH, activeWaterings + garden.legacyWaterings);
  return {
    revision: garden.revision, lifetime: garden.entries.length, waterings: countWaterings(garden.entries),
    activeWaterings, growth, level: 1 + Math.floor(growth / WATERINGS_PER_LEVEL),
    available: entries.length - activeWaterings, streak: activeStreak(entries, time, zone),
  };
}

function spendWater(garden, tasks, wateringId) {
  const receipt = garden.entries.find(entry => entry.wateringId === wateringId);
  if (receipt) return { garden, receipt };
  const active = completedIds(tasks);
  const target = garden.entries.findIndex(entry => !entry.wateringId && active.has(entry.taskId));
  if (target === -1) return null;
  const revision = garden.revision + 1;
  const newReceipt = {
    ...garden.entries[target], wateringId, wateringNumber: countWaterings(garden.entries) + 1, wateringRevision: revision,
  };
  const entries = garden.entries.map((entry, index) => index === target ? newReceipt : entry);
  return { garden: { ...garden, revision, entries }, receipt: newReceipt };
}

function wateringView(confirmed, tasks, time, zone) {
  return {
    ...gardenView(confirmed.garden, tasks, time, zone),
    wateringNumber: confirmed.receipt.wateringNumber ?? null,
    wateringRevision: confirmed.receipt.wateringRevision ?? null,
  };
}

module.exports = { DEFAULT_TIME_ZONE, emptyGarden, upgradeGarden, guestTimeZone, reconcileGarden, gardenView, spendWater, wateringView };
