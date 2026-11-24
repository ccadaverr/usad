const assert = require('node:assert/strict');
const { execFile } = require('node:child_process');
const { mkdtempSync, readFileSync, rmSync, writeFileSync } = require('node:fs');
const { tmpdir } = require('node:os');
const { join } = require('node:path');
const test = require('node:test');
const { promisify } = require('node:util');
const { gardenView, reconcileGarden } = require('./garden.cjs');
const { createApp } = require('./server.cjs');

test('growth advances every two distinct completions and caps at ten', () => {
  const tasks = Array.from({ length: 56 }, (_, id) => ({ id: String(id), status: 'completed' }));
  for (let count = 0; count <= tasks.length; count++) {
    const garden = reconcileGarden(undefined, tasks.slice(0, count));
    assert.deepEqual(gardenView(garden), { lifetime: count, level: Math.min(10, 1 + Math.floor(count / 2)), available: count });
    assert.deepEqual(reconcileGarden(garden, tasks.slice(0, count)), garden);
  }
});

test('task PATCH and achievement share a durable commit, and watering retries spend at most one credit', async (context) => {
  const directory = mkdtempSync(join(tmpdir(), 'usad-garden-test-'));
  const file = join(directory, 'db.json');
  const start = { tasks: [
    ...Array.from({ length: 3 }, (_, id) => ({ id: String(id), status: 'completed' })),
    { id: 'pending', status: 'pending', order: 'a0' },
  ] };
  const snapshot = () => JSON.parse(readFileSync(file));
  writeFileSync(file, JSON.stringify(start));
  let failWrite = false;
  const app = createApp(file, (target, data) => {
    if (failWrite) throw new Error('Simulated disk failure');
    writeFileSync(target, JSON.stringify(data));
  });
  const server = app.listen(0, '127.0.0.1');
  context.after(() => { server.close(); rmSync(directory, { recursive: true, force: true }); });
  await new Promise(resolve => server.once('listening', resolve));
  const base = `http://127.0.0.1:${server.address().port}`;
  const request = (path, method = 'GET', body) => fetch(base + path, {
    method, headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body),
  });
  const read = async () => (await request('/garden')).json();
  assert.deepEqual(await read(), { lifetime: 3, level: 2, available: 3 });
  assert.deepEqual(snapshot(), start, 'Migration has no read-side disk write');

  failWrite = true;
  const rejected = await request('/tasks/pending', 'PATCH', { status: 'completed' });
  assert.equal(rejected.status, 500);
  assert.equal(rejected.headers.get('X-USAD-Water-Earned'), null);
  assert.equal(rejected.headers.get('X-USAD-Garden-Level'), null);
  assert.deepEqual(snapshot(), start);
  assert.equal((await (await request('/tasks/pending')).json()).status, 'pending');
  assert.deepEqual(await read(), { lifetime: 3, level: 2, available: 3 });

  failWrite = false;
  const completed = await request('/tasks/pending', 'PATCH', { status: 'completed' });
  assert.equal(completed.headers.get('X-USAD-Garden-Level'), '3');
  assert.equal(completed.headers.get('X-USAD-Water-Earned'), '1');
  await request('/tasks/pending', 'PATCH', { status: 'pending', order: 'a0' });
  const repeated = await request('/tasks/pending', 'PATCH', { status: 'completed' });
  assert.equal(repeated.headers.get('X-USAD-Garden-Level'), null);
  assert.equal(repeated.headers.get('X-USAD-Water-Earned'), null);
  await request('/tasks/pending', 'DELETE');
  assert.deepEqual(await read(), { lifetime: 4, level: 3, available: 4 });

  const id = 'water-operation-0001';
  failWrite = true;
  assert.equal((await request('/garden/water', 'POST', { id })).status, 503);
  assert.equal((await read()).available, 4);
  failWrite = false;
  const attempts = await Promise.all([request('/garden/water', 'POST', { id }), request('/garden/water', 'POST', { id })]);
  for (const attempt of attempts) assert.equal((await attempt.json()).available, 3);
  assert.deepEqual(gardenView(reconcileGarden(snapshot().garden, snapshot().tasks)), {
    lifetime: 4, level: 3, available: 3,
  });
});

test('the garden and watering routes restore existing history from disk after restart', async context => {
  const directory = mkdtempSync(join(tmpdir(), 'usad-garden-restart-'));
  const file = join(directory, 'db.json');
  writeFileSync(file, JSON.stringify({
    tasks: [{ id: 'new', status: 'pending' }],
    garden: { version: 1, entries: [{ taskId: 'deleted' }] },
  }));
  async function start() {
    const server = createApp(file).listen(0, '127.0.0.1');
    await new Promise(resolve => server.once('listening', resolve));
    return { server, base: `http://127.0.0.1:${server.address().port}` };
  }
  const stop = server => new Promise(resolve => server.close(resolve));
  let runtime = await start();
  context.after(async () => {
    if (runtime.server.listening) await stop(runtime.server);
    rmSync(directory, { recursive: true, force: true });
  });

  const state = async () => {
    const response = await fetch(runtime.base + '/garden');
    assert.equal(response.status, 200);
    return response.json();
  };
  const json = { 'Content-Type': 'application/json' };
  assert.equal((await fetch(runtime.base + '/api/garden')).status, 404, 'Angular owns the public /api prefix');
  assert.deepEqual(await state(), { lifetime: 1, available: 1, level: 1 });
  const completed = await fetch(runtime.base + '/tasks/new', {
    method: 'PATCH', headers: json, body: JSON.stringify({ status: 'completed' }),
  });
  assert.equal(completed.headers.get('X-USAD-Water-Earned'), '1', 'The second credit advances the level');
  assert.equal(completed.headers.get('X-USAD-Garden-Level'), '2');
  const water = () => fetch(runtime.base + '/garden/water', {
    method: 'POST', headers: json, body: JSON.stringify({ id: 'water-after-restart-01' }),
  });
  assert.equal((await water()).status, 200);
  await stop(runtime.server);
  runtime = await start();
  assert.deepEqual(await state(), { lifetime: 2, available: 1, level: 2 });
  assert.deepEqual(await (await water()).json(), { lifetime: 2, available: 1, level: 2 });
});

test('startup seeds a missing configured file and preserves existing database bytes', async context => {
  const directory = mkdtempSync(join(tmpdir(), 'usad-seed-test-'));
  context.after(() => rmSync(directory, { recursive: true, force: true }));
  const file = join(directory, 'storage', 'db.json');
  const run = promisify(execFile);
  const seed = (...args) => run(process.execPath, [join(__dirname, 'seed.mjs'), ...args], {
    env: { ...process.env, USAD_DATA_FILE: file },
  });

  await Promise.all([seed(), seed()]);
  const initial = JSON.parse(readFileSync(file, 'utf8'));
  assert.equal(initial.tasks[0].id, 'field-notes');
  assert.match(initial.tasks[0].dueDate, /^\d{4}-\d{2}-\d{2}$/);

  const existing = '{"tasks":[],"garden":{"version":1,"entries":[{"taskId":"saved"}]}}\n';
  writeFileSync(file, existing);
  await seed();
  await assert.rejects(seed('--reset'), /only available for the default local database/);
  assert.equal(readFileSync(file, 'utf8'), existing);
});
