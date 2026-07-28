const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const os = require('os');
const path = require('path');
const { createRoomStore, filterActiveRooms } = require('./roomStore');

function createFakeRedis({ remoteState = null, connectError = null } = {}) {
  const calls = [];
  const client = {
    isOpen: false,
    isReady: false,
    on() {},
    async connect() {
      if (connectError) throw connectError;
      this.isOpen = true;
      this.isReady = true;
    },
    async get(key) {
      calls.push(['get', key]);
      return remoteState;
    },
    async set(key, value, options) {
      calls.push(['set', key, JSON.parse(value), options]);
    },
    async quit() {
      this.isOpen = false;
      this.isReady = false;
    },
  };
  return { calls, client };
}

function createTempStateFile() {
  const directory = fs.mkdtempSync(path.join(os.tmpdir(), 'meukingdom-store-'));
  return {
    directory,
    stateFile: path.join(directory, 'rooms.json'),
  };
}

test('filterActiveRooms removes expired and malformed rooms', () => {
  const now = Date.now();
  const rooms = filterActiveRooms({
    ACTIVE: { updatedAt: now - 100 },
    EXPIRED: { updatedAt: now - 2000 },
    INVALID: null,
  }, 1000, now);

  assert.deepEqual(rooms, {
    ACTIVE: { updatedAt: now - 100 },
  });
});

test('file store loads and atomically saves rooms without Redis', async () => {
  const { directory, stateFile } = createTempStateFile();
  const now = Date.now();
  fs.writeFileSync(stateFile, JSON.stringify({
    KEEP: { updatedAt: now },
    DROP: { updatedAt: now - 5000 },
  }));
  const store = createRoomStore({ stateFile, ttlMs: 1000 });

  try {
    assert.deepEqual(await store.initialize(), {
      KEEP: { updatedAt: now },
    });
    assert.deepEqual(store.getStatus(), { mode: 'file', durable: false });

    store.save({ NEW: { updatedAt: now } });
    const savedState = JSON.parse(fs.readFileSync(stateFile, 'utf8'));
    assert.ok(savedState.storeVersion >= now);
    assert.deepEqual(savedState.rooms, {
      NEW: { updatedAt: now },
    });
  } finally {
    await store.close();
    fs.rmSync(directory, { recursive: true, force: true });
  }
});

test('Redis state is preferred and queued writes are flushed on close', async () => {
  const { directory, stateFile } = createTempStateFile();
  const now = Date.now();
  fs.writeFileSync(stateFile, JSON.stringify({ LOCAL: { updatedAt: now } }));
  const remoteRooms = { REMOTE: { updatedAt: now } };
  const fakeRedis = createFakeRedis({ remoteState: JSON.stringify(remoteRooms) });
  const store = createRoomStore({
    stateFile,
    ttlMs: 120000,
    redisUrl: 'redis://test',
    createRedis: () => fakeRedis.client,
  });

  try {
    assert.deepEqual(await store.initialize(), remoteRooms);
    assert.deepEqual(store.getStatus(), { mode: 'redis', durable: true });

    const nextRooms = { NEXT: { updatedAt: now } };
    store.save(nextRooms);
    await store.close();
    const lastCall = fakeRedis.calls.at(-1);
    assert.equal(lastCall[0], 'set');
    assert.equal(lastCall[1], 'meukingdom:rooms');
    assert.ok(lastCall[2].storeVersion >= now);
    assert.deepEqual(lastCall[2].rooms, nextRooms);
    assert.deepEqual(lastCall[3], { EX: 120 });
  } finally {
    fs.rmSync(directory, { recursive: true, force: true });
  }
});

test('Redis connection failure falls back to the local file', async () => {
  const { directory, stateFile } = createTempStateFile();
  const now = Date.now();
  const localRooms = { LOCAL: { updatedAt: now } };
  fs.writeFileSync(stateFile, JSON.stringify(localRooms));
  const fakeRedis = createFakeRedis({ connectError: new Error('offline') });
  const errors = [];
  const store = createRoomStore({
    stateFile,
    ttlMs: 120000,
    redisUrl: 'redis://offline',
    createRedis: () => fakeRedis.client,
    logger: { error: (...args) => errors.push(args) },
  });

  try {
    assert.deepEqual(await store.initialize(), localRooms);
    assert.deepEqual(store.getStatus(), { mode: 'file-fallback', durable: false });
    assert.equal(errors.length, 1);
  } finally {
    await store.close();
    fs.rmSync(directory, { recursive: true, force: true });
  }
});

test('a newer local snapshot replaces stale Redis state including deletions', async () => {
  const { directory, stateFile } = createTempStateFile();
  const now = Date.now();
  const localState = {
    storeVersion: 20,
    rooms: {},
  };
  const remoteState = {
    storeVersion: 19,
    rooms: { DELETED: { updatedAt: now } },
  };
  fs.writeFileSync(stateFile, JSON.stringify(localState));
  const fakeRedis = createFakeRedis({ remoteState: JSON.stringify(remoteState) });
  const store = createRoomStore({
    stateFile,
    ttlMs: 120000,
    redisUrl: 'redis://test',
    createRedis: () => fakeRedis.client,
  });

  try {
    assert.deepEqual(await store.initialize(), {});
    assert.deepEqual(fakeRedis.calls.at(-1), [
      'set',
      'meukingdom:rooms',
      localState,
      { EX: 120 },
    ]);
  } finally {
    await store.close();
    fs.rmSync(directory, { recursive: true, force: true });
  }
});
