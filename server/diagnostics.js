const crypto = require('crypto');

function hashIdentifier(value) {
  if (!value) return undefined;
  return crypto.createHash('sha256').update(String(value)).digest('hex').slice(0, 10);
}

function sanitizeContext(context = {}) {
  const room = context.room;
  return {
    event: context.event ? String(context.event).slice(0, 60) : undefined,
    roomCode: context.roomCode ? String(context.roomCode).slice(0, 8) : undefined,
    playerHash: hashIdentifier(context.playerId),
    roomStatus: room?.status,
    totalPlayers: Array.isArray(room?.jogadores) ? room.jogadores.length : undefined,
    connectedPlayers: Array.isArray(room?.jogadores)
      ? room.jogadores.filter((player) => player.connected).length
      : undefined,
    recoveryRevision: Number.isInteger(room?.recoveryRevision)
      ? room.recoveryRevision
      : undefined,
    storageMode: context.storageMode,
  };
}

function withoutUndefined(value) {
  return Object.fromEntries(Object.entries(value).filter(([, item]) => item !== undefined));
}

function createDiagnostics(options = {}) {
  const logger = options.logger || console;
  const now = options.now || (() => new Date().toISOString());
  const createId = options.createId || (() => `MK-${crypto.randomBytes(3).toString('hex').toUpperCase()}`);

  function write(method, kind, context = {}, extra = {}) {
    const entry = withoutUndefined({
      timestamp: now(),
      kind,
      ...sanitizeContext(context),
      ...extra,
    });
    logger[method](JSON.stringify(entry));
    return entry;
  }

  function reportSocketError(message, context = {}) {
    const diagnosticId = createId();
    write('warn', 'socket_error', context, {
      diagnosticId,
      message: String(message).slice(0, 180),
    });
    return diagnosticId;
  }

  function reportEvent(kind, context = {}) {
    return write('log', kind, context);
  }

  function reportSystemError(message, error, context = {}) {
    return write('error', 'system_error', context, {
      message: String(message).slice(0, 180),
      errorType: error?.name || 'Error',
    });
  }

  return {
    reportEvent,
    reportSocketError,
    reportSystemError,
  };
}

module.exports = {
  createDiagnostics,
  hashIdentifier,
  sanitizeContext,
};
