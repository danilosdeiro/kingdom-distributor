const fs = require('fs');
const path = require('path');
const { createClient } = require('redis');

const DEFAULT_REDIS_KEY = 'meukingdom:rooms';

function filterActiveRooms(rooms, ttlMs, now = Date.now()) {
  if (!rooms || typeof rooms !== 'object' || Array.isArray(rooms)) return {};

  return Object.fromEntries(
    Object.entries(rooms)
      .filter(([, room]) => room && now - (room.updatedAt || 0) <= ttlMs)
  );
}

function parseStoredState(value, ttlMs) {
  const parsed = typeof value === 'string' ? JSON.parse(value) : value;
  if (parsed?.rooms && Number.isFinite(parsed.storeVersion)) {
    return {
      storeVersion: parsed.storeVersion,
      rooms: filterActiveRooms(parsed.rooms, ttlMs),
    };
  }

  return {
    storeVersion: 0,
    rooms: filterActiveRooms(parsed, ttlMs),
  };
}

function createRoomStore(options) {
  const {
    stateFile,
    ttlMs,
    redisUrl = process.env.REDIS_URL,
    redisKey = process.env.REDIS_ROOMS_KEY || DEFAULT_REDIS_KEY,
    logger = console,
    createRedis = (url) => createClient({
      url,
      socket: {
        connectTimeout: 2000,
        reconnectStrategy: (retries) => (
          retries < 3 ? Math.min(250 * (2 ** retries), 1000) : false
        ),
      },
    }),
  } = options;
  const ttlSeconds = Math.max(60, Math.ceil(ttlMs / 1000));
  let redisClient = null;
  let mode = redisUrl ? 'connecting' : 'file';
  let writeQueue = Promise.resolve();
  let storeVersion = 0;

  function loadFile() {
    try {
      if (!fs.existsSync(stateFile)) return { storeVersion: 0, rooms: {} };
      return parseStoredState(fs.readFileSync(stateFile, 'utf8'), ttlMs);
    } catch (error) {
      logger.error('Nao foi possivel carregar o arquivo de salas:', error);
      return { storeVersion: 0, rooms: {} };
    }
  }

  function saveFile(state) {
    try {
      fs.mkdirSync(path.dirname(stateFile), { recursive: true });
      const tempFile = `${stateFile}.tmp`;
      fs.writeFileSync(tempFile, JSON.stringify(state, null, 2));
      fs.renameSync(tempFile, stateFile);
    } catch (error) {
      logger.error('Nao foi possivel salvar o arquivo de salas:', error);
    }
  }

  async function initialize() {
    const localState = loadFile();
    storeVersion = localState.storeVersion;
    if (!redisUrl) return localState.rooms;

    try {
      redisClient = createRedis(redisUrl);
      redisClient.on?.('error', (error) => {
        logger.error('Falha na conexao Redis:', error);
      });
      await redisClient.connect();

      const remoteState = await redisClient.get(redisKey);
      if (remoteState) {
        const parsedRemoteState = parseStoredState(remoteState, ttlMs);
        const selectedState = localState.storeVersion > parsedRemoteState.storeVersion
          ? localState
          : parsedRemoteState;
        storeVersion = selectedState.storeVersion;
        if (selectedState === localState) {
          await redisClient.set(redisKey, JSON.stringify(localState), { EX: ttlSeconds });
        }
        mode = 'redis';
        return selectedState.rooms;
      }

      if (Object.keys(localState.rooms).length > 0) {
        await redisClient.set(redisKey, JSON.stringify(localState), { EX: ttlSeconds });
      }
      mode = 'redis';
      return localState.rooms;
    } catch (error) {
      mode = 'file-fallback';
      logger.error('Redis indisponivel; usando arquivo local:', error);
      return localState.rooms;
    }
  }

  function save(rooms) {
    storeVersion = Math.max(Date.now(), storeVersion + 1);
    const state = { storeVersion, rooms };
    saveFile(state);
    if (!redisClient?.isReady) return;

    const payload = JSON.stringify(state);
    writeQueue = writeQueue
      .then(() => redisClient.set(redisKey, payload, { EX: ttlSeconds }))
      .then(() => {
        mode = 'redis';
      })
      .catch((error) => {
        mode = 'file-fallback';
        logger.error('Nao foi possivel salvar salas no Redis:', error);
      });
  }

  async function close() {
    await writeQueue;
    if (redisClient?.isOpen) await redisClient.quit();
  }

  function getStatus() {
    return {
      mode,
      durable: mode === 'redis',
    };
  }

  return {
    close,
    getStatus,
    initialize,
    save,
  };
}

module.exports = {
  createRoomStore,
  filterActiveRooms,
  parseStoredState,
};
