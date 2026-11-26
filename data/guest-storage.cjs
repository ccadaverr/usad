const { DEFAULT_TIME_ZONE, upgradeGarden } = require('./garden.cjs');
const { createHash, createHmac, randomBytes, timingSafeEqual } = require('node:crypto');
const {
  closeSync, constants, fstatSync, lstatSync, mkdirSync, openSync, readSync,
  readdirSync, realpathSync, renameSync, rmSync, writeFileSync,
} = require('node:fs');
const { join, resolve } = require('node:path');
const { version: appVersion } = require('../package.json');

const SESSION_MS = 30 * 24 * 60 * 60 * 1000;
const MAX_WORKSPACE_BYTES = 2 * 1024 * 1024;
const MAX_EXPORT_BYTES = MAX_WORKSPACE_BYTES + 1024;
const WORKSPACE_NAME = /^[a-f0-9]{64}\.json$/;
const TASK_EXPORT_FIELDS = ['id', 'title', 'subject', 'description', 'priority', 'status', 'dueDate', 'order', 'createdAt', 'updatedAt'];
const ENTRY_EXPORT_FIELDS = ['taskId', 'firstCompletedAt', 'completionDay', 'wateringId', 'wateringNumber', 'wateringRevision'];

function project(record, fields) {
  return Object.fromEntries(fields.map(field => [field, record[field]]));
}

// Field order is part of the v1 signature encoding. See docs/recovery/export-contract.md.
function encodeExport(snapshot, time, sourceId, proofKey) {
  const { profile, tasks, garden } = snapshot;
  const exportedAt = new Date(time).toISOString();
  const payload = {
    format: 'usad-workspace',
    schemaVersion: 1,
    exportedAt,
    appVersion,
    timeZone: profile.timeZone,
    tasks: tasks.map(task => project(task, TASK_EXPORT_FIELDS)),
    garden: {
      version: garden.version,
      revision: garden.revision,
      legacyWaterings: garden.legacyWaterings,
      entries: garden.entries.map(entry => project(entry, ENTRY_EXPORT_FIELDS)),
    },
    provenance: { sourceId },
  };
  const json = JSON.stringify(payload);
  const digest = createHmac('sha256', proofKey).update(json).digest('base64url');
  const integrity = { algorithm: 'HMAC-SHA-256', digest };
  const bytes = Buffer.from(json.slice(0, -1) + ',"integrity":' + JSON.stringify(integrity) + '}\n');
  if (bytes.length > MAX_EXPORT_BYTES) throw new Error('Workspace export exceeds its size limit.');
  return { bytes, filename: `usad-workspace-${exportedAt.slice(0, 10)}.json` };
}

function readPrivateFile(file, size) {
  let fd;
  try {
    fd = openSync(file, constants.O_RDONLY | constants.O_NOFOLLOW | constants.O_NONBLOCK);
    const info = fstatSync(fd);
    if (!info.isFile() || info.nlink !== 1 || info.size > size) throw new Error('Invalid guest storage file.');
    const buffer = Buffer.alloc(info.size);
    if (readSync(fd, buffer, 0, buffer.length, 0) !== buffer.length) throw new Error('Incomplete guest storage file.');
    return buffer;
  } catch (error) {
    if (error.code === 'ENOENT') return null;
    throw error;
  } finally {
    if (fd !== undefined) closeSync(fd);
  }
}

function replacePrivateFile(file, value) {
  const temporary = `${file}.${randomBytes(12).toString('hex')}.tmp`;
  try {
    writeFileSync(temporary, value, { flag: 'wx', flush: true, mode: 0o600 });
    renameSync(temporary, file);
  } finally {
    rmSync(temporary, { force: true });
  }
}

function guestStorage(directory, { now = Date.now, maxGuests = 1500, persist = replacePrivateFile } = {}) {
  // Canonicalize the root once. Reject symlink roots and refuse to use a replaced directory.
  directory = resolve(directory);
  mkdirSync(directory, { recursive: true, mode: 0o700 });
  const initial = lstatSync(directory);
  if (!initial.isDirectory()) throw new Error('Guest storage must be a real directory.');
  directory = realpathSync(directory);
  function checkRoot() {
    const current = lstatSync(directory);
    if (!current.isDirectory() || current.dev !== initial.dev || current.ino !== initial.ino) {
      throw new Error('Guest storage directory changed.');
    }
  }
  checkRoot();

  const keyFile = join(directory, '.session-key');
  let key = readPrivateFile(keyFile, 32);
  if (!key) {
    if (readdirSync(directory).some(name => WORKSPACE_NAME.test(name))) {
      throw new Error('The guest signing key is missing from existing storage.');
    }
    key = randomBytes(32);
    // A single writer owns the volume. The signing key is published before serving any requests.
    replacePrivateFile(keyFile, key);
  }
  if (key.length !== 32) throw new Error('Invalid guest signing key.');
  const sign = (bytes) => createHmac('sha256', key).update(bytes).digest();
  const proofKey = sign('usad:workspace-export:proof:v1');
  const sourceKey = sign('usad:workspace-export:source:v1');

  function exportWorkspace(session, snapshot) {
    const sourceId = createHmac('sha256', sourceKey).update(session.key).digest('base64url');
    return encodeExport(snapshot, now(), sourceId, proofKey);
  }

  function issue() {
    const ticket = randomBytes(40);
    ticket.writeBigUInt64BE(BigInt(now() + SESSION_MS), 32);
    return Buffer.concat([ticket, sign(ticket)]).toString('base64url');
  }

  function verify(token) {
    if (typeof token !== 'string' || !/^[A-Za-z0-9_-]{96}$/.test(token)) return null;
    const bytes = Buffer.from(token, 'base64url');
    const ticket = bytes.subarray(0, 40);
    if (!timingSafeEqual(bytes.subarray(40), sign(ticket))) return null;
    const expiresAt = Number(ticket.readBigUInt64BE(32));
    if (expiresAt <= now()) return null;
    return { key: createHash('sha256').update(token).digest('hex'), expiresAt };
  }

  function load(session) {
    checkRoot();
    const bytes = readPrivateFile(join(directory, session.key + '.json'), MAX_WORKSPACE_BYTES);
    if (!bytes) return null;
    const snapshot = JSON.parse(bytes);
    if (snapshot.profile?.expiresAt !== session.expiresAt || !Array.isArray(snapshot.tasks)
      || !Array.isArray(snapshot.garden?.entries)) {
      throw new Error('Invalid guest workspace.');
    }
    snapshot.garden = upgradeGarden(snapshot.garden);
    snapshot.profile.timeZone ??= DEFAULT_TIME_ZONE;
    return snapshot;
  }

  function save(session, snapshot) {
    checkRoot();
    const bytes = Buffer.from(JSON.stringify(snapshot) + '\n');
    if (bytes.length > MAX_WORKSPACE_BYTES) return false;
    persist(join(directory, session.key + '.json'), bytes);
    return true;
  }

  function hasCapacity() {
    checkRoot();
    const ids = readdirSync(directory).filter(name => WORKSPACE_NAME.test(name));
    return ids.length < maxGuests;
  }

  return { issue, verify, load, save, hasCapacity, exportWorkspace };
}

module.exports = { guestStorage, SESSION_MS };
