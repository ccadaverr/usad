const jsonServer = require('json-server');
const bodyParser = require('body-parser');
const { gardenView, reconcileGarden, spendWater } = require('./garden.cjs');
const { guestStorage, SESSION_MS } = require('./guest-storage.cjs');

const DEV_ORIGINS = ['http://localhost:4200', 'http://127.0.0.1:4200'];
const MAX_GARDEN_ENTRIES = 3000;
const TASK_ID = /^[a-zA-Z0-9_-]{1,80}$/;
const WATER_ID = /^[a-z\d-]{16,80}$/i;
const STAGES = ['pending', 'in-progress', 'completed'];
const PRIORITIES = ['high', 'medium', 'low'];
const MUTABLE_TASK_FIELDS = ['title', 'subject', 'description', 'priority', 'status', 'dueDate', 'order', 'updatedAt'];

function configuredOrigins(value, hosted) {
  const entries = value === undefined ? (hosted ? [] : DEV_ORIGINS) : value.split(',').map(origin => origin.trim()).filter(Boolean);
  return new Set(entries.map(origin => {
    const url = new URL(origin);
    if (url.origin !== origin || (hosted ? url.protocol !== 'https:' : !['https:', 'http:'].includes(url.protocol))) {
      throw new Error('USAD_ALLOWED_ORIGINS must contain exact frontend origins without paths.');
    }
    return origin;
  }));
}

function quota(limit, period, now) {
  let end = 0;
  let used = 0;
  return () => {
    const time = now();
    if (time >= end) {
      end = time + period;
      used = 0;
    }
    if (used >= limit) return Math.max(1, Math.ceil((end - time) / 1000));
    used++;
    return 0;
  };
}

function displayName(value) {
  if (typeof value !== 'string') return null;
  const name = value.trim().normalize('NFC').replace(/ {2,}/g, ' ');
  if ([...name].length > 32 || !/^\p{L}[\p{L}\p{M}]*(?:[ .'’ʼ·‐‑-]\p{L}[\p{L}\p{M}]*)*\.?$/u.test(name)) return null;
  return name;
}

function publicProfile(snapshot) {
  return { displayName: snapshot.profile.displayName, onboardingComplete: snapshot.profile.onboardingComplete };
}

function dateOnly(value) {
  if (value === null) return true;
  if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(value) || value.startsWith('0000')) return false;
  const date = new Date(value + 'T00:00:00Z');
  return !Number.isNaN(date.valueOf()) && date.toISOString().slice(0, 10) === value;
}

function timestamp(value) {
  return typeof value === 'string' && /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d{3})?Z$/.test(value)
    && dateOnly(value.slice(0, 10)) && !Number.isNaN(Date.parse(value));
}

function taskValid(task) {
  return typeof task.id === 'string' && TASK_ID.test(task.id)
    && typeof task.title === 'string' && !!task.title.trim() && task.title.length <= 120
    && typeof task.subject === 'string' && !!task.subject.trim() && task.subject.length <= 60
    && typeof task.description === 'string' && task.description.length <= 1000
    && PRIORITIES.includes(task.priority) && STAGES.includes(task.status)
    && typeof task.order === 'string' && /^[a-zA-Z0-9]{1,512}$/.test(task.order)
    && dateOnly(task.dueDate) && timestamp(task.createdAt) && timestamp(task.updatedAt);
}

function error(response, code, message) {
  return response.status(code).json({ message });
}

function createGuestApp(directory, {
  hosted = false, allowedOrigins, now = Date.now, maxTasks = 300, maxGuests, persist,
  createLimit = 60, bootstrapLimit = 240,
} = {}) {
  const origins = configuredOrigins(allowedOrigins, hosted);
  const storage = guestStorage(directory, { now, maxGuests, persist });
  const createQuota = quota(createLimit, 10 * 60 * 1000, now);
  const bootstrapQuota = quota(bootstrapLimit, 60 * 1000, now);
  const cookieName = hosted ? '__Secure-usad_guest' : 'usad_guest';
  const cookieOptions = { httpOnly: true, secure: hosted, sameSite: 'lax', path: '/api' };
  const parseJson = bodyParser.json({ limit: '16kb', inflate: false });
  const app = jsonServer.create();
  app.disable('x-powered-by');
  app.disable('etag');

  function setCookie(response, token, expiresAt) {
    response.cookie(cookieName, token, {
      ...cookieOptions,
      maxAge: Math.max(0, Math.min(SESSION_MS, expiresAt - now())),
    });
  }

  function limited(response, wait) {
    response.set('Retry-After', String(wait));
    return error(response, 429, 'Too many guest requests. Please try again shortly.');
  }

  app.use((request, response, next) => {
    response.set({
      'Cache-Control': 'private, no-store',
      'CDN-Cache-Control': 'no-store',
      'Vercel-CDN-Cache-Control': 'no-store',
      'X-Content-Type-Options': 'nosniff',
    });
    // Vercel and the Angular proxy can change Host. Only the browser's exact Origin is trusted for mutations.
    if (!['GET', 'HEAD', 'OPTIONS'].includes(request.method) && !origins.has(request.get('Origin'))) {
      return error(response, 403, 'This request must come from the USAD website.');
    }
    if (Number(request.get('Content-Length')) > 16 * 1024) return error(response, 413, 'The request is too large.');
    next();
  });

  app.use((request, response, next) => {
    const values = (request.headers.cookie ?? '').split(';').map(pair => pair.trim())
      .filter(pair => pair.startsWith(cookieName + '='));
    response.locals.token = values.length === 1 ? values[0].slice(cookieName.length + 1) : null;
    response.locals.session = storage.verify(response.locals.token);
    next();
  });

  function current(response) {
    return response.locals.session ? storage.load(response.locals.session) : null;
  }

  function requireWorkspace(_request, response, next) {
    const snapshot = current(response);
    if (!snapshot) return error(response, 401, 'Your guest session is missing or expired.');
    response.locals.workspace = snapshot;
    next();
  }

  function save(response, workspace) {
    if (storage.save(response.locals.session, workspace)) return true;
    error(response, 409, 'This guest workspace has reached its storage limit.');
    return false;
  }

  app.get('/session', (_request, response) => {
    const workspace = current(response);
    response.json({ guest: workspace ? publicProfile(workspace) : null });
  });

  app.post('/session/bootstrap', (_request, response) => {
    const existing = response.locals.session;
    if (existing) {
      setCookie(response, response.locals.token, existing.expiresAt);
      return response.sendStatus(204);
    }
    const wait = bootstrapQuota();
    if (wait) return limited(response, wait);
    const token = storage.issue();
    setCookie(response, token, storage.verify(token).expiresAt);
    return response.sendStatus(204);
  });

  app.post('/session/leave', (_request, response) => {
    response.clearCookie(cookieName, cookieOptions).status(204).end();
  });

  app.post('/session/guest', parseJson, (request, response) => {
    const session = response.locals.session;
    if (!session) return error(response, 409, 'Allow cookies for USAD, then try again.');
    const existing = current(response);
    if (existing) return response.json({ guest: publicProfile(existing) });
    const name = displayName(request.body?.displayName);
    if (!name) return error(response, 400, 'Enter a name of up to 32 characters using letters and name punctuation.');
    const wait = createQuota();
    if (wait) return limited(response, wait);
    if (!storage.hasCapacity()) return error(response, 503, 'Guest workspaces are at capacity.');
    const workspace = {
      profile: { displayName: name, onboardingComplete: false, expiresAt: session.expiresAt },
      tasks: [],
      garden: { version: 1, entries: [] },
    };
    if (save(response, workspace)) response.status(201).json({ guest: publicProfile(workspace) });
  });

  app.post('/session/onboarding-complete', requireWorkspace, (_request, response) => {
    const workspace = response.locals.workspace;
    if (!workspace.profile.onboardingComplete) {
      workspace.profile.onboardingComplete = true;
      if (!save(response, workspace)) return;
    }
    response.json({ guest: publicProfile(workspace) });
  });

  function findTask(request, response, next) {
    const workspace = response.locals.workspace;
    const index = workspace.tasks.findIndex(task => task.id === request.params.id);
    if (index < 0) return error(response, 404, 'Task not found.');
    response.locals.index = index;
    next();
  }

  function saveTask(response, task, status) {
    const workspace = response.locals.workspace;
    const previous = gardenView(workspace.garden);
    workspace.garden = reconcileGarden(workspace.garden, workspace.tasks);
    const next = gardenView(workspace.garden);
    if (next.lifetime > MAX_GARDEN_ENTRIES) return error(response, 409, 'This garden has reached its storage limit.');
    if (!save(response, workspace)) return;
    if (next.lifetime > previous.lifetime) {
      response.set('X-USAD-Water-Earned', '1');
      response.set('X-USAD-Garden-Lifetime', String(next.lifetime));
      if (next.level > previous.level) response.set('X-USAD-Garden-Level', String(next.level));
    }
    response.status(status).json(task);
  }

  app.get('/tasks', requireWorkspace, (_request, response) => response.json(response.locals.workspace.tasks));
  app.get('/tasks/:id', requireWorkspace, findTask, (_request, response) => {
    response.json(response.locals.workspace.tasks[response.locals.index]);
  });
  app.post('/tasks', requireWorkspace, parseJson, (request, response) => {
    const workspace = response.locals.workspace;
    const fields = ['id', 'createdAt', ...MUTABLE_TASK_FIELDS];
    const body = request.body ?? {};
    const task = Object.fromEntries(fields.map(key => [key, body[key]]));
    if (Object.keys(body).some(key => !fields.includes(key)) || !taskValid(task)) return error(response, 400, 'Invalid task fields.');
    const existing = workspace.tasks.find(record => record.id === task.id);
    if (existing) {
      if (fields.every(key => existing[key] === task[key])) return response.json(existing);
      return error(response, 409, 'A task with that identifier already exists.');
    }
    if (workspace.tasks.length >= maxTasks) return error(response, 409, 'This workspace has reached its task limit.');
    workspace.tasks.push(task);
    saveTask(response, task, 201);
  });
  app.patch('/tasks/:id', requireWorkspace, parseJson, findTask, (request, response) => {
    const { workspace, index } = response.locals;
    const changes = request.body ?? {};
    if (!Object.keys(changes).length || Object.keys(changes).some(key => !MUTABLE_TASK_FIELDS.includes(key))) {
      return error(response, 400, 'Invalid task fields.');
    }
    const task = { ...workspace.tasks[index], ...changes };
    if (!taskValid(task)) return error(response, 400, 'Invalid task fields.');
    workspace.tasks[index] = task;
    saveTask(response, task, 200);
  });
  app.delete('/tasks/:id', requireWorkspace, findTask, (_request, response) => {
    const { workspace, index } = response.locals;
    workspace.tasks.splice(index, 1);
    if (save(response, workspace)) response.json({});
  });

  app.get('/garden', requireWorkspace, (_request, response) => response.json(gardenView(response.locals.workspace.garden)));
  app.post('/garden/water', requireWorkspace, parseJson, (request, response) => {
    const id = request.body?.id;
    if (typeof id !== 'string' || !WATER_ID.test(id)) return error(response, 400, 'Invalid watering identifier.');
    const workspace = response.locals.workspace;
    const next = spendWater(workspace.garden, id);
    if (!next) return error(response, 409, 'No water drops available.');
    if (next !== workspace.garden) {
      workspace.garden = next;
      if (!save(response, workspace)) return;
    }
    response.json(gardenView(workspace.garden));
  });

  app.use((_request, response) => error(response, 404, 'Route not found.'));
  app.use((failure, _request, response, next) => {
    if (response.headersSent) return next(failure);
    if (failure.status === 413) return error(response, 413, 'The request is too large.');
    if (failure.status >= 400 && failure.status < 500) return error(response, failure.status, 'Invalid request.');
    return error(response, 503, 'Could not access guest storage. Please try again.');
  });
  return app;
}

module.exports = { createGuestApp };
