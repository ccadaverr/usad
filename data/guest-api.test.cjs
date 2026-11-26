const assert = require('node:assert/strict');
const { spawn } = require('node:child_process');
const { createHash, createHmac } = require('node:crypto');
const { once } = require('node:events');
const { mkdtempSync, readFileSync, readdirSync, rmSync, symlinkSync, writeFileSync } = require('node:fs');
const { tmpdir } = require('node:os');
const { join } = require('node:path');
const test = require('node:test');
const { createGuestApp } = require('./guest-api.cjs');
const { SESSION_MS } = require('./guest-storage.cjs');

const origin = 'https://frontend.example';
const assertGarden = (actual, expected) => assert.deepEqual(
  Object.fromEntries(Object.keys(expected).map(key => [key, actual[key]])), expected,
);
const blank = { lifetime: 0, waterings: 0, growth: 0, level: 1, available: 0 };
const task = {
  id: 'first-task', title: 'Finish field notes', subject: 'Research', description: '', dueDate: '2026-11-27',
  priority: 'medium', status: 'pending', order: 'a0', createdAt: '2026-11-24T04:00:00.000Z', updatedAt: '2026-11-24T04:00:00.000Z',
};
const exportPath = '/workspace/export';

function workspaceFile(directory, cookie) {
  const key = createHash('sha256').update(cookie.split('=')[1]).digest('hex');
  return join(directory, key + '.json');
}

async function setup(context, options = {}) {
  const root = mkdtempSync(join(tmpdir(), 'usad-guest-test-'));
  const directory = join(root, 'guests');
  const legacy = join(root, 'db.json');
  const legacyBytes = JSON.stringify({ tasks: [{ id: 'legacy' }], garden: { version: 1, entries: [{ taskId: 'legacy' }] } });
  writeFileSync(legacy, legacyBytes);
  let server, base;
  const stop = () => new Promise(resolve => server.close(resolve));
  async function start() {
    server = createGuestApp(directory, { hosted: true, allowedOrigins: origin, ...options }).listen(0, '127.0.0.1');
    await new Promise(resolve => server.once('listening', resolve));
    base = 'http://127.0.0.1:' + server.address().port;
  }
  context.after(async () => {
    if (server?.listening) await stop();
    try {
      assert.equal(readFileSync(legacy, 'utf8'), legacyBytes);
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });
  await start();
  const restart = async () => { await stop(); await start(); };
  async function request(path, { method = 'GET', cookie, body, from = origin, headers } = {}) {
    const response = await fetch(base + path, {
      method,
      headers: {
        ...(from ? { Origin: from } : {}), ...(cookie ? { Cookie: cookie } : {}),
        ...(body !== undefined ? { 'Content-Type': 'application/json' } : {}), ...headers,
      },
      body: body === undefined ? undefined : JSON.stringify(body),
    });
    return {
      status: response.status, headers: response.headers,
      body: response.status !== 204 ? await response.json() : null,
    };
  }
  const post = (path, cookie, body) => request(path, { method: 'POST', cookie, body });
  async function bootstrap() {
    const result = await post('/session/bootstrap');
    assert.equal(result.status, 204);
    return result.headers.get('set-cookie');
  }
  async function guest(displayName, timeZone) {
    const cookie = (await bootstrap()).split(';')[0];
    const result = await post('/session/guest', cookie, { displayName, timeZone });
    assert.equal(result.status, 201);
    return cookie;
  }
  return { request, post, bootstrap, guest, restart, directory, legacy, upstream: base };
}

test('export signs the complete private snapshot and excludes authentication and server metadata', async context => {
  const time = Date.parse('2026-11-26T18:00:00.000Z');
  const { guest, post, request, directory, restart } = await setup(context, { now: () => time });
  const cookie = await guest('Backup Student', 'Asia/Manila');
  const completed = { ...task, status: 'completed', description: 'Private field notes.', order: 'a03' };
  await post('/tasks', cookie, completed);
  const removed = { ...completed, id: 'removed' };
  await post('/tasks', cookie, removed);
  const wateringId = 'export-watering-0001';
  await post('/garden/water', cookie, { id: wateringId });
  await request('/tasks/removed', { method: 'DELETE', cookie });
  const file = workspaceFile(directory, cookie);
  const saved = JSON.parse(readFileSync(file));
  // A future internal field at any level must not enter the public format by default.
  const privateMarker = 'server-only-marker';
  saved.internal = privateMarker;
  saved.profile.internal = privateMarker;
  saved.tasks[0].internal = privateMarker;
  saved.garden.internal = privateMarker;
  saved.garden.entries[0].internal = privateMarker;
  writeFileSync(file, JSON.stringify(saved));
  const before = readFileSync(file);

  const result = await request(exportPath, { cookie, from: null, headers: { 'If-None-Match': '*' } });
  assert.equal(result.status, 200);
  assert.equal(result.headers.get('content-type'), 'application/json; charset=utf-8');
  assert.equal(result.headers.get('content-disposition'), 'attachment; filename="usad-workspace-2026-11-26.json"');
  assert.equal(result.headers.get('content-length'), String(Buffer.byteLength(JSON.stringify(result.body) + '\n')));
  assert.equal(result.headers.get('cache-control'), 'private, no-store');
  assert.equal(result.headers.get('cdn-cache-control'), 'no-store');
  assert.equal(result.headers.get('vercel-cdn-cache-control'), 'no-store');
  assert.equal(result.headers.get('cross-origin-resource-policy'), 'same-origin');
  assert.equal(result.headers.get('set-cookie'), null);
  const { integrity, ...payload } = result.body;
  const { sourceId } = payload.provenance;
  assert.match(sourceId, /^[A-Za-z0-9_-]{43}$/);
  assert.deepEqual(payload, {
    format: 'usad-workspace', schemaVersion: 1, exportedAt: '2026-11-26T18:00:00.000Z',
    appVersion: require('../package.json').version,
    timeZone: 'Asia/Manila', tasks: [completed],
    garden: {
      version: 3, revision: 4, legacyWaterings: 0, entries: [
        { taskId: task.id, firstCompletedAt: '2026-11-26T18:00:00.000Z', completionDay: '2026-11-27',
          wateringId, wateringNumber: 1, wateringRevision: 3 },
        { taskId: removed.id, firstCompletedAt: '2026-11-26T18:00:00.000Z', completionDay: '2026-11-27' },
      ],
    },
    provenance: { sourceId },
  });
  const sessionKey = readFileSync(join(directory, '.session-key'));
  const proofKey = createHmac('sha256', sessionKey).update('usad:workspace-export:proof:v1').digest();
  const digest = value => createHmac('sha256', proofKey).update(JSON.stringify(value)).digest('base64url');
  assert.deepEqual(integrity, { algorithm: 'HMAC-SHA-256', digest: digest(payload) });
  const tampered = structuredClone(payload);
  tampered.garden.entries[0].wateringId = 'forged-watering-0001';
  assert.notEqual(integrity.digest, digest(tampered));
  const output = JSON.stringify(result.body);
  for (const secret of [cookie, cookie.split('=')[1], sessionKey.toString('hex'), sessionKey.toString('base64url'),
    file, privateMarker, 'expiresAt', 'Backup Student']) {
    assert.equal(output.includes(secret), false);
  }
  await restart();
  assert.deepEqual((await request(exportPath, { cookie })).body, result.body);
  assert.deepEqual(readFileSync(file), before);
});

test('export requires a live workspace and ignores guest selectors supplied by callers', async context => {
  let time = Date.now();
  const { bootstrap, guest, request, post, directory } = await setup(context, { now: () => time });
  const a = await guest('First Guest');
  const b = await guest('Second Guest');
  const otherTask = { ...task, id: 'other-task', status: 'completed' };
  await post('/tasks', a, task);
  await post('/tasks', b, otherTask);

  const unsigned = (await bootstrap()).split(';')[0];
  for (const cookie of [undefined, unsigned, a + '; ' + b, a.slice(0, -1) + (a.endsWith('a') ? 'b' : 'a')]) {
    const denied = await request(exportPath, { cookie });
    assert.equal(denied.status, 401);
    assert.equal(denied.headers.get('content-disposition'), null);
  }
  const aExport = await request(exportPath + '?workspace=' + workspaceFile(directory, b), { cookie: a });
  const bExport = await request(exportPath, { cookie: b });
  assert.deepEqual(aExport.body.tasks, [task]);
  assert.deepEqual(aExport.body.garden.entries, []);
  assert.deepEqual(bExport.body.tasks, [otherTask]);
  assert.equal(bExport.body.garden.entries[0].taskId, otherTask.id);
  assert.notEqual(aExport.body.provenance.sourceId, bExport.body.provenance.sourceId);
  time += SESSION_MS;
  assert.equal((await request(exportPath, { cookie: a })).status, 401);
});

test('export fails closed when storage is unreadable or oversized', async context => {
  const { guest, request, directory } = await setup(context);
  const cookie = await guest('Backup Student');
  const file = workspaceFile(directory, cookie);
  for (const content of ['invalid JSON', Buffer.alloc(2 * 1024 * 1024 + 1)]) {
    writeFileSync(file, content);
    const result = await request(exportPath, { cookie });
    assert.equal(result.status, 503);
    assert.equal(result.headers.get('content-disposition'), null);
    assert.deepEqual(result.body, { message: 'Could not access guest storage. Please try again.' });
    assert.deepEqual(readFileSync(file), Buffer.from(content));
  }
});

test('exports racing completion, watering and undo contain whole committed revisions', async context => {
  const { guest, post, request } = await setup(context);
  const cookie = await guest('Backup Student');
  await post('/tasks', cookie, task);
  const read = () => request(exportPath, { cookie });
  const move = status => request('/tasks/' + task.id, { cookie, method: 'PATCH', body: { status } });
  const wateringId = 'racing-watering-0001';
  const exports = [await read()];
  for (const write of [() => move('completed'), () => post('/garden/water', cookie, { id: wateringId }), () => move('pending')]) {
    const [before, after, saved] = await Promise.all([read(), read(), write()]);
    assert.equal(saved.status, 200);
    exports.push(before, after, await read());
  }
  const expected = [
    { status: 'pending', entries: 0, watered: undefined },
    { status: 'completed', entries: 1, watered: undefined },
    { status: 'completed', entries: 1, watered: wateringId },
    { status: 'pending', entries: 1, watered: wateringId },
  ];
  for (const result of exports) {
    assert.equal(result.status, 200);
    const { tasks, garden } = result.body;
    assert.deepEqual({ status: tasks[0].status, entries: garden.entries.length, watered: garden.entries[0]?.wateringId },
      expected[garden.revision]);
  }
});

test('workspace profile, tasks, garden and watering are isolated and durable', async context => {
  const { bootstrap, guest, request, post, restart, directory } = await setup(context);
  const a = (await bootstrap()).split(';')[0];
  const attempts = await Promise.all([post('/session/guest', a, { displayName: '  Jaztin  ' }),
    post('/session/guest', a, { displayName: '  Jaztin  ' })]);
  assert.deepEqual(attempts.map(attempt => attempt.status).sort(), [200, 201]);
  assert.deepEqual(attempts[0].body, attempts[1].body);
  const b = await guest('Nguyễn-Anne O’Neil');
  assert.notEqual(a, b);
  for (const cookie of [a, b]) {
    assert.deepEqual((await request('/tasks', { cookie })).body, []);
    assertGarden((await request('/garden', { cookie })).body, blank);
  }
  const created = await post('/tasks', a, task);
  assert.equal(created.status, 201);
  assert.deepEqual((await post('/tasks', a, task)).body, created.body);
  const taskPath = '/tasks/' + task.id;
  for (const method of ['GET', 'PATCH', 'DELETE']) {
    const result = await request(taskPath, { method, cookie: b, body: method === 'PATCH' ? { status: 'completed' } : undefined });
    assert.equal(result.status, 404);
  }
  const completed = await request(taskPath, { method: 'PATCH', cookie: a, body: { status: 'completed', order: 'a1' } });
  assert.equal(completed.headers.get('x-usad-water-earned'), '1');
  const watering = { id: 'guest-watering-0001' };
  assert.equal((await post('/garden/water', b, watering)).status, 409);
  assertGarden((await request('/garden', { cookie: a })).body, { ...blank, lifetime: 1, available: 1 });
  assertGarden((await post('/garden/water', a, watering)).body, { ...blank, lifetime: 1, waterings: 1, growth: 1, wateringNumber: 1 });
  assertGarden((await request('/garden', { cookie: b })).body, blank);
  assert.deepEqual((await request('/session', { cookie: a })).body, { guest: { displayName: 'Jaztin', onboardingComplete: false } });

  const saved = await post('/session/onboarding-complete', a);
  assert.equal(saved.body.guest.onboardingComplete, true);
  assert.deepEqual((await post('/session/onboarding-complete', a)).body, saved.body);
  const retry = await post('/session/guest', a, { displayName: 'Different' });
  assert.deepEqual(retry.body, saved.body);
  assert.equal(readdirSync(directory).filter(file => file.endsWith('.json')).length, 2);

  await restart();
  assert.deepEqual((await request('/session', { cookie: a })).body, saved.body);
  assert.deepEqual((await request('/tasks', { cookie: a })).body, [completed.body]);
  assert.deepEqual((await request('/tasks', { cookie: b })).body, []);
  assertGarden((await post('/garden/water', a, watering)).body, { ...blank, lifetime: 1, waterings: 1, growth: 1, wateringNumber: 1 });
  for (let index = 2; index <= 5; index++) {
    const result = await post('/tasks', a, { ...task, id: 'stage-' + index, status: 'completed' });
    assert.equal(result.headers.get('x-usad-water-earned'), '1');
    assert.equal(result.headers.get('x-usad-garden-level'), null);
  }
  assertGarden((await request('/garden', { cookie: a })).body,
    { lifetime: 5, waterings: 1, growth: 1, level: 1, available: 4 });
  const second = { id: 'guest-watering-0002' };
  // Ignore the write response and retry the same ID after a restart.
  await post('/garden/water', a, second);
  await restart();
  assertGarden((await post('/garden/water', a, second)).body,
    { lifetime: 5, waterings: 2, growth: 2, level: 2, available: 3, wateringNumber: 2 });
  assertGarden((await post('/garden/water', a, watering)).body,
    { lifetime: 5, waterings: 2, growth: 2, level: 2, available: 3, wateringNumber: 1 });
  const scope = (await request('/garden', { cookie: a })).headers.get('X-USAD-Garden-Scope');
  assert.match(scope, /^[0-9a-f]{64}$/);
  assert.equal((await request('/garden/water', { method: 'POST', cookie: b, body: second,
    headers: { 'X-USAD-Garden-Scope': scope } })).status, 409);
  assertGarden((await request('/garden', { cookie: b })).body, blank);
});

test('concurrent completion and undo/recompletion award one drop per guest task', async context => {
  const { guest, request, post, restart } = await setup(context);
  const cookie = await guest('Jaztin');
  assert.equal((await post('/tasks', cookie, task)).status, 201);
  const path = '/tasks/' + task.id;
  const update = (status, order) => request(path, { method: 'PATCH', cookie, body: { status, order } });
  assert.equal((await update('in-progress', 'a1')).status, 200);
  const responses = await Promise.all([update('completed', 'a2'), update('completed', 'a2')]);
  assert.deepEqual(responses.map(response => response.status), [200, 200]);
  assert.equal(responses.filter(response => response.headers.get('x-usad-water-earned') === '1').length, 1);
  assert.equal((await update('in-progress', 'a1')).body.order, 'a1');

  await restart();
  const completed = await update('completed', 'a2');
  assert.equal(completed.status, 200);
  assert.equal(completed.body.order, 'a2');
  assert.equal(completed.body.createdAt, task.createdAt);
  assert.equal(completed.headers.get('x-usad-water-earned'), null);
  assertGarden((await request('/garden', { cookie })).body, { ...blank, lifetime: 1, available: 1 });
});

test('secure host-only cookies, exact origin validation and fail-closed public routes', async context => {
  let time = Date.now();
  const { request, bootstrap, post } = await setup(context, { now: () => time });
  assert.equal((await request('/session/bootstrap', { method: 'POST', from: 'https://attacker.example' })).status, 403);
  assert.equal((await request('/session/bootstrap', { method: 'POST', from: null })).status, 403);
  assert.equal((await request('/session/bootstrap', { method: 'POST', from: origin + '.example', headers: { 'X-Forwarded-Host': 'frontend.example' } })).status, 403);
  const attributes = await bootstrap();
  assert.match(attributes, /^__Secure-usad_guest=[A-Za-z0-9_-]{96};/);
  for (const flag of ['HttpOnly', 'Secure', 'SameSite=Lax', 'Path=/api', 'Max-Age=2592000']) {
    assert.ok(attributes.split('; ').includes(flag));
  }
  assert.doesNotMatch(attributes, /Domain=/i);
  const cookie = attributes.split(';')[0];
  const creation = await request('/session/guest', { method: 'POST', cookie, body: { displayName: '李小龍' },
    headers: { 'X-Forwarded-Host': 'railway.example', Host: 'different.example' } });
  assert.equal(creation.status, 201);
  assert.deepEqual(creation.body, { guest: { displayName: '李小龍', onboardingComplete: false } });
  assert.equal(creation.headers.get('access-control-allow-origin'), null);
  assert.match(creation.headers.get('cache-control'), /no-store/);
  assert.equal((await request('/tasks', { method: 'POST', cookie, from: 'https://attacker.example', body: task })).status, 403);
  const forged = cookie.slice(0, -1) + (cookie.endsWith('A') ? 'B' : 'A');
  for (const invalid of [undefined, forged, cookie + '; ' + cookie]) {
    assert.deepEqual((await request('/session', { cookie: invalid })).body, { guest: null });
    assert.equal((await request('/tasks', { cookie: invalid })).status, 401);
    assert.equal((await request('/garden', { cookie: invalid })).status, 401);
  }
  assert.equal((await request('/db', { cookie })).status, 404);
  assert.equal((await request('/api/tasks', { cookie })).status, 404);
  assert.equal((await post('/session/guest', undefined, { displayName: 'New' })).status, 409);
  time += SESSION_MS;
  assert.deepEqual((await request('/session', { cookie })).body, { guest: null });
  assert.equal((await request('/tasks', { cookie })).status, 401);
  assert.notEqual((await bootstrap()).split(';')[0], cookie);
});

test('hosted origin configuration fails closed, while the local proxy can use an HTTP cookie', async context => {
  const hosted = await setup(context, { allowedOrigins: undefined });
  assert.equal((await hosted.post('/session/bootstrap')).status, 403);
  const local = await setup(context, { hosted: false, allowedOrigins: undefined });
  const from = 'http://localhost:4200';
  assert.deepEqual((await local.request('/session', { from: null })).body, { guest: null });
  assert.equal((await local.request('/session/bootstrap', { method: 'POST', from: 'http://localhost:4201' })).status, 403);
  const parsed = await local.request('/session/bootstrap', { method: 'POST', from });
  assert.equal(parsed.status, 204);
  const [cookie, ...attributes] = parsed.headers.get('set-cookie').split('; ');
  assert.match(cookie, /^usad_guest=/);
  assert.ok(attributes.includes('Path=/api') && attributes.includes('HttpOnly') && attributes.includes('SameSite=Lax'));
  assert.ok(!attributes.includes('Secure') && !attributes.some(value => value.startsWith('Domain=')));
  assert.equal((await local.request('/session/guest', { method: 'POST', from, cookie, body: { displayName: 'Jaztin' } })).status, 201);
  assert.deepEqual((await local.request('/tasks', { cookie })).body, []);
  assert.equal((await local.request('/tasks', { method: 'POST', from, cookie, body: task })).status, 201);
  await local.restart();
  assert.deepEqual((await local.request('/session', { cookie })).body, { guest: { displayName: 'Jaztin', onboardingComplete: false } });
  assert.deepEqual((await local.request('/tasks', { cookie })).body, [task]);
});

test('invalid input, payload size, task count, creation quota and capacity are bounded', async context => {
  const { request, post, bootstrap, guest } = await setup(context, { maxGuests: 1, maxTasks: 1, createLimit: 2, bootstrapLimit: 4 });
  const ticket = (await bootstrap()).split(';')[0];
  for (const displayName of ['', '   ', 'A'.repeat(33), '<img src=x>', 'Name\nOther', 123]) {
    assert.equal((await post('/session/guest', ticket, { displayName })).status, 400);
  }
  assert.equal((await post('/session/guest', ticket, { displayName: 'x'.repeat(17000) })).status, 413);
  const cookie = await guest('José-María');
  assert.equal((await post('/tasks', cookie, { ...task, subject: 'x'.repeat(61) })).status, 400);
  assert.equal((await post('/tasks', cookie, { ...task, dueDate: '2026-02-31' })).status, 400);
  assert.equal((await post('/tasks', cookie, { ...task, id: '../outside' })).status, 400);
  assert.equal((await post('/tasks', cookie, task)).status, 201);
  assert.equal((await post('/tasks', cookie, { ...task, id: 'extra' })).status, 409);
  assert.equal((await post('/session/guest', ticket, { displayName: 'Other' })).status, 503);
  assert.equal((await post('/session/guest', ticket, { displayName: 'Other' })).status, 429);
  await bootstrap();
  await bootstrap();
  assert.equal((await request('/session/bootstrap', { method: 'POST' })).status, 429);
});

test('storage failure or a linked guest file cannot expose state or award credit', async context => {
  let fail = false;
  const { request, guest, post, directory, legacy } = await setup(context, {
    persist: (file, bytes) => {
      if (fail) throw new Error('Simulated unavailable volume');
      writeFileSync(file, bytes, { mode: 0o600 });
    },
  });
  const cookie = await guest('Guest');
  await post('/tasks', cookie, task);
  fail = true;
  const failed = await request('/tasks/' + task.id, { method: 'PATCH', cookie, body: { status: 'completed' } });
  assert.equal(failed.status, 503);
  assert.equal(failed.headers.get('x-usad-water-earned'), null);
  assert.deepEqual((await request('/tasks', { cookie })).body, [task]);
  assertGarden((await request('/garden', { cookie })).body, blank);
  assert.equal((await post('/session/onboarding-complete', cookie)).status, 503);
  assert.equal((await request('/session', { cookie })).body.guest.onboardingComplete, false);

  fail = false;
  assert.equal((await request('/tasks/' + task.id, { method: 'PATCH', cookie, body: { status: 'completed' } })).status, 200);
  fail = true;
  const watering = { id: 'failure-watering-0001' };
  assert.equal((await post('/garden/water', cookie, watering)).status, 503);
  assert.equal((await request('/garden', { cookie })).body.available, 1);
  fail = false;
  assertGarden((await post('/garden/water', cookie, watering)).body, { ...blank, lifetime: 1, waterings: 1, growth: 1, wateringNumber: 1 });
  assertGarden((await post('/garden/water', cookie, watering)).body, { ...blank, lifetime: 1, waterings: 1, growth: 1, wateringNumber: 1 });

  const token = cookie.split('=')[1];
  const file = join(directory, createHash('sha256').update(token).digest('hex') + '.json');
  rmSync(file);
  symlinkSync(legacy, file);
  assert.equal((await request('/session', { cookie })).status, 503);
  assert.equal((await request('/tasks', { cookie })).status, 503);
});

test('leave clears only the browser cookie at its original scope and preserves both guests', async context => {
  const { guest, request, post, restart, directory } = await setup(context);
  const jaztin = await guest('Jaztin');
  const other = await guest('Lia');
  await post('/tasks', jaztin, { ...task, status: 'completed' });
  const key = createHash('sha256').update(jaztin.split('=')[1]).digest('hex');
  const path = join(directory, key + '.json');
  const before = readFileSync(path);
  for (const from of [null, origin + '.other']) {
    const forbidden = await request('/session/leave', { method: 'POST', cookie: jaztin, from });
    assert.equal(forbidden.status, 403);
    assert.equal(forbidden.headers.get('set-cookie'), null);
  }
  for (const cookie of [jaztin, undefined]) {
    const left = await post('/session/leave', cookie, { workspace: 'ignored' });
    assert.equal(left.status, 204);
    const cleared = left.headers.get('set-cookie');
    assert.match(cleared, /^__Secure-usad_guest=;/);
    for (const flag of ['Path=/api', 'HttpOnly', 'Secure', 'SameSite=Lax', 'Expires=Thu, 01 Jan 1970 00:00:00 GMT']) {
      assert.ok(cleared.split('; ').includes(flag), flag);
    }
    assert.doesNotMatch(cleared, /Domain=/i);
  }
  const detached = await request('/session');
  assert.equal(detached.status, 200);
  assert.deepEqual(detached.body, { guest: null });

  const alex = await guest('Alex');
  assert.notEqual(jaztin, alex);
  await restart();
  assert.deepEqual((await request('/session', { cookie: alex })).body.guest, { displayName: 'Alex', onboardingComplete: false });
  assert.deepEqual((await request('/tasks', { cookie: alex })).body, []);
  assert.equal((await request('/tasks/' + task.id, { cookie: alex })).status, 404);
  assertGarden((await request('/garden', { cookie: alex })).body, blank);
  assert.equal((await request('/session', { cookie: other })).body.guest.displayName, 'Lia');
  assertGarden((await request('/garden', { cookie: jaztin })).body, { ...blank, lifetime: 1, available: 1 });
  assert.deepEqual(readFileSync(path), before);
});

test('the Angular development proxy forwards matching cookie attributes for session leave', { timeout: 90000 }, async context => {
  const { directory, upstream } = await setup(context, { hosted: false, allowedOrigins: undefined });
  const proxyFile = join(directory, '..', 'proxy.json');
  const config = structuredClone(require('../proxy.conf.json'));
  config['/api/**'].target = upstream;
  writeFileSync(proxyFile, JSON.stringify(config));
  const localOrigin = 'http://localhost:4200';
  const angular = spawn(process.execPath, [
    require.resolve('@angular/cli/bin/ng.js'), 'serve', '--host', 'localhost', '--port', '0',
    '--no-watch', '--proxy-config', proxyFile,
  ], { cwd: join(__dirname, '..'), env: { ...process.env, NO_COLOR: '1' } });
  const closed = once(angular, 'close');
  context.after(async () => {
    angular.kill();
    await closed;
  });
  let output = '';
  angular.stderr.on('data', data => { output += data; });
  const frontend = await Promise.race([
    new Promise(resolve => angular.stdout.on('data', data => {
      output += data;
      const url = output.match(/http:\/\/localhost:\d+\//)?.[0];
      if (url) resolve(url);
    })),
    closed.then(() => { throw new Error(output); }),
  ]);
  const call = (path, options) => fetch(new URL('api/session' + path, frontend), options);
  const post = (path, headers = {}, body) => call(path, {
    method: 'POST', headers: { Origin: localOrigin, ...headers }, body,
  });
  const bootstrap = await post('/bootstrap');
  assert.equal(bootstrap.status, 204);
  const [cookie, ...setFlags] = bootstrap.headers.get('set-cookie').split('; ');
  const guest = await post('/guest', { Cookie: cookie, 'Content-Type': 'application/json' }, '{"displayName":"Jaztin"}');
  assert.equal(guest.status, 201);
  await guest.json();
  const forbidden = await post('/leave', { Cookie: cookie, Origin: localOrigin + '.invalid' });
  assert.equal(forbidden.status, 403);
  assert.equal(forbidden.headers.get('set-cookie'), null);
  await forbidden.json();
  for (const headers of [{ Cookie: cookie }, {}]) {
    const left = await post('/leave', headers);
    assert.equal(left.status, 204);
    assert.equal(await left.text(), '');
    const [expiredCookie, ...clearFlags] = left.headers.get('set-cookie').split('; ');
    assert.equal(expiredCookie, cookie.split('=')[0] + '=');
    for (const flag of ['Path=/api', 'HttpOnly', 'SameSite=Lax']) {
      assert.ok(setFlags.includes(flag) && clearFlags.includes(flag), flag);
    }
    assert.ok(!clearFlags.some(flag => /^(Domain=|Secure$)/.test(flag)));
    assert.ok(clearFlags.includes('Expires=Thu, 01 Jan 1970 00:00:00 GMT'));
    const readback = await call('');
    assert.equal(readback.status, 200);
    assert.deepEqual(await readback.json(), { guest: null });
  }
});

test('version-1 guest ledgers keep their growth, credits and receipts after one migration', async context => {
  const { guest, request, post, directory, restart } = await setup(context);
  const cookie = await guest('Jaztin');
  const key = createHash('sha256').update(cookie.split('=')[1]).digest('hex');
  const file = join(directory, key + '.json');
  const snapshot = JSON.parse(readFileSync(file, 'utf8'));
  snapshot.garden.version = 1;
  delete snapshot.garden.legacyWaterings;
  const watering = 'legacy-watering-0001';
  snapshot.garden.entries = Array.from({ length: 6 }, (_, index) => ({
    taskId: 'old-' + index, ...(index === 0 ? { wateringId: watering } : {}),
  }));
  snapshot.tasks = snapshot.garden.entries.map(({ taskId: id }) => ({ ...task, id, status: 'completed' }));
  const original = JSON.stringify(snapshot) + '\n';
  writeFileSync(file, original);
  await restart();
  const expected = { lifetime: 6, waterings: 1, growth: 6, level: 4, available: 5, streak: 0 };
  assertGarden((await request('/garden', { cookie })).body, expected);
  const backup = (await request(exportPath, { cookie })).body;
  assert.deepEqual(backup.garden, { version: 3, revision: 0, legacyWaterings: 5, entries: snapshot.garden.entries });
  assert.deepEqual(backup.tasks, snapshot.tasks);
  assertGarden((await post('/garden/water', cookie, { id: watering })).body, { ...expected, wateringNumber: null });
  assert.equal(readFileSync(file, 'utf8'), original);
  const completion = await post('/tasks', cookie, { ...task, status: 'completed' });
  assert.equal(completion.headers.get('X-USAD-Water-Earned'), '1');
  assert.equal(completion.headers.get('X-USAD-Garden-Level'), null);
  const committed = JSON.parse(readFileSync(file, 'utf8'));
  assert.equal(committed.garden.version, 3);
  assert.equal(committed.garden.legacyWaterings, 5);
  assert.deepEqual(committed.garden.entries.slice(0, 6), snapshot.garden.entries);
  await restart();
  assertGarden((await request('/garden', { cookie })).body, { ...expected, lifetime: 7, available: 6, streak: 1 });
  assertGarden((await post('/garden/water', cookie, { id: 'legacy-watering-0002' })).body,
    { ...expected, lifetime: 7, waterings: 2, growth: 7, wateringNumber: 2, streak: 1 });
});

test('revokes spent and unspent rewards atomically and reactivates their immutable original receipts', async context => {
  const { guest, post, request, restart } = await setup(context);
  const cookie = await guest('Reversible');
  const view = async () => (await request('/garden', { cookie })).body;
  const state = (id, status) => request('/tasks/' + id, { cookie, method: 'PATCH', body: { status } });
  for (const id of ['one', 'two', 'three']) await post('/tasks', cookie, { ...task, id, status: 'completed' });
  assertGarden(await view(), { available: 3, growth: 0, level: 1, streak: 1 });
  const first = 'original-water-receipt-1';
  const second = 'original-water-receipt-2';
  await post('/garden/water', cookie, { id: first });
  await post('/garden/water', cookie, { id: second });
  assertGarden(await view(), { waterings: 2, activeWaterings: 2, growth: 2, level: 2, available: 1 });

  assert.equal((await state('one', 'in-progress')).headers.get('x-usad-garden-changed'), '1');
  assertGarden(await view(), { lifetime: 3, waterings: 2, activeWaterings: 1, growth: 1, level: 1, available: 1 });
  await state('three', 'pending');
  await restart();
  assertGarden(await view(), { lifetime: 3, waterings: 2, activeWaterings: 1, available: 0 });
  assertGarden((await post('/garden/water', cookie, { id: first })).body, {
    waterings: 2, activeWaterings: 1, wateringNumber: 1, wateringRevision: 4, level: 1,
  });
  const reactivate = await state('one', 'completed');
  assert.equal(reactivate.headers.get('x-usad-water-earned'), null);
  assertGarden(await view(), { waterings: 2, activeWaterings: 2, level: 2, available: 0 });
  await state('three', 'completed');
  assertGarden(await view(), { available: 1, streak: 1 });
  await request('/tasks/one', { cookie, method: 'DELETE' });
  assertGarden(await view(), { activeWaterings: 1, available: 1 });
  const recreated = await post('/tasks', cookie, { ...task, id: 'one', status: 'completed' });
  assert.equal(recreated.headers.get('x-usad-water-earned'), null);
  assertGarden(await view(), { lifetime: 3, waterings: 2, activeWaterings: 2, available: 1, streak: 1 });
  const spends = await Promise.all(['concurrent-watering-1', 'concurrent-watering-2'].map(id => post('/garden/water', cookie, { id })));
  assert.deepEqual(spends.map(result => result.status).sort(), [200, 409]);
  assertGarden(await view(), { activeWaterings: 3, waterings: 3, available: 0 });
});

test('daily streak uses a fixed guest calendar, server time and active first completions', async context => {
  let clock = Date.parse('2026-03-08T04:55:00Z'); // March 7 at 23:55 in New York.
  const { guest, post, request, restart, directory } = await setup(context, { now: () => clock });
  const cookie = await guest('Calendar', 'America/New_York');
  const file = join(directory, createHash('sha256').update(cookie.split('=')[1]).digest('hex') + '.json');
  const view = async () => (await request('/garden', { cookie })).body;
  const create = id => post('/tasks', cookie, { ...task, id, status: 'completed', updatedAt: '2000-01-01T00:00:00Z' });
  const update = (id, status) => request('/tasks/' + id, { cookie, method: 'PATCH', body: { status, updatedAt: '2099-01-01T00:00:00Z' } });
  const key = readFileSync(join(directory, '.session-key'));
  assert.match((await create('first')).headers.get('x-usad-streak-milestone'), /^1:0:1$/);
  assert.equal((await create('same-day')).headers.get('x-usad-streak-milestone'), null);
  assert.equal((await view()).streak, 1);
  clock = Date.parse('2026-03-08T05:05:00Z');
  assert.equal((await view()).streak, 1, 'Yesterday is still eligible early today');
  assert.match((await create('next-day')).headers.get('x-usad-streak-milestone'), /^3:1:2$/);
  assert.equal((await view()).streak, 2, 'Local midnight forms a new day');
  await update('first', 'pending');
  assert.equal((await view()).streak, 2, 'Another task supports that first day');
  await update('same-day', 'in-progress');
  assert.equal((await view()).streak, 1);
  assert.equal((await update('first', 'completed')).headers.get('x-usad-streak-milestone'), null);
  assert.equal((await view()).streak, 2, 'Recompletion restores its original date');
  clock = Date.parse('2026-03-09T04:05:00Z'); // March 9 after the DST change, 23 hours later.
  await update('next-day', 'pending');
  await update('next-day', 'completed');
  assert.equal((await view()).streak, 2, 'Toggling an old task cannot qualify the new day');
  await create('after-dst');
  await post('/session/guest', cookie, { displayName: 'Other', timeZone: 'Pacific/Honolulu' });
  await restart();
  assert.equal((await view()).streak, 3);
  assert.deepEqual(readFileSync(join(directory, '.session-key')), key);
  const saved = JSON.parse(readFileSync(file));
  assert.equal(saved.profile.timeZone, 'America/New_York');
  assert.deepEqual(saved.garden.entries.map(entry => entry.completionDay),
    ['2026-03-07', '2026-03-07', '2026-03-08', '2026-03-09']);
  assert.equal(saved.garden.entries[0].firstCompletedAt, '2026-03-08T04:55:00.000Z');
  clock = Date.parse('2026-03-11T04:01:00Z');
  assert.equal((await view()).streak, 0, 'A missed full calendar day breaks the streak');
});

test('version-2 migration keeps receipts and fixed allowance without dating legacy completions', async context => {
  const { guest, request, post, restart, directory } = await setup(context, { now: () => Date.parse('2026-12-31T23:59:00Z') });
  const cookie = await guest('Historic', 'Invalid/Zone');
  const file = join(directory, createHash('sha256').update(cookie.split('=')[1]).digest('hex') + '.json');
  const snapshot = JSON.parse(readFileSync(file));
  snapshot.tasks = [{ ...task, status: 'completed' }];
  snapshot.garden = { version: 2, legacyWaterings: 4, entries: [
    { taskId: task.id, wateringId: 'previous-watering-1', wateringNumber: 1 },
    { taskId: 'deleted', wateringId: 'previous-watering-2', wateringNumber: 2 },
  ] };
  delete snapshot.profile.timeZone;
  const bytes = JSON.stringify(snapshot);
  writeFileSync(file, bytes);
  await restart();
  assertGarden((await request('/garden', { cookie })).body, {
    revision: 0, lifetime: 2, waterings: 2, activeWaterings: 1, growth: 5, available: 0, streak: 0,
  });
  const backup = (await request(exportPath, { cookie })).body;
  assert.equal(backup.timeZone, 'UTC');
  assert.deepEqual(backup.garden, { ...snapshot.garden, version: 3, revision: 0 });
  const retry = await post('/garden/water', cookie, { id: 'previous-watering-2' });
  assertGarden(retry.body, { wateringNumber: 2, wateringRevision: null, available: 0 });
  assert.equal(readFileSync(file, 'utf8'), bytes);
  await request('/tasks/' + task.id, { cookie, method: 'PATCH', body: { status: 'pending' } });
  const migrated = JSON.parse(readFileSync(file));
  assert.equal(migrated.profile.timeZone, 'UTC');
  assert.deepEqual(migrated.garden, { ...snapshot.garden, version: 3, revision: 1 });
});
