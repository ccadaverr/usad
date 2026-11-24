import { readFile, stat, writeFile } from 'node:fs/promises';

const database = new URL('./db.json', import.meta.url);
const reset = process.argv.includes('--reset');
const existing = reset ? undefined : await stat(database).catch((error) => {
  if (error.code !== 'ENOENT') throw error;
});

if (!existing) {
  const seed = JSON.parse(await readFile(new URL('./seed.json', import.meta.url), 'utf8'));
  const now = new Date();
  const localDate = (offset) => {
    const date = new Date(now.getFullYear(), now.getMonth(), now.getDate() + offset);
    return [date.getFullYear(), date.getMonth() + 1, date.getDate()]
      .map((value) => String(value).padStart(2, '0')).join('-');
  };
  const tasks = seed.tasks.map(({ dueInDays, ...task }) => ({
    ...task,
    dueDate: dueInDays === null ? null : localDate(dueInDays),
    createdAt: now.toISOString(),
    updatedAt: now.toISOString(),
  }));
  await writeFile(database, JSON.stringify({ tasks }, null, 2) + '\n', { flag: reset ? 'w' : 'wx' }).catch((error) => {
    if (reset || error.code !== 'EEXIST') throw error;
  });
}
