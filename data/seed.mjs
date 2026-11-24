import { randomUUID } from 'node:crypto';
import { link, mkdir, readFile, rename, rm, stat, writeFile } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const configuredFile = process.env.USAD_DATA_FILE;
const database = resolve(configuredFile || fileURLToPath(new URL('./db.json', import.meta.url)));
const reset = process.argv.includes('--reset');
if (reset && (configuredFile || process.env.RAILWAY_ENVIRONMENT_ID)) {
  throw new Error('Database reset is only available for the default local database.');
}
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
  await mkdir(dirname(database), { recursive: true });
  const temporary = `${database}.${randomUUID()}.tmp`;
  try {
    await writeFile(temporary, JSON.stringify({ tasks }, null, 2) + '\n', { flag: 'wx', flush: true, mode: 0o600 });
    if (reset) {
      await rename(temporary, database);
    } else {
      // Publish the complete seed only if another startup has not created the database.
      await link(temporary, database).catch((error) => {
        if (error.code !== 'EEXIST') throw error;
      });
    }
  } finally {
    await rm(temporary, { force: true });
  }
}
