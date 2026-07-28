const test = require('node:test');
const assert = require('node:assert/strict');
const { createDiagnostics, hashIdentifier, sanitizeContext } = require('./diagnostics');

test('diagnostic context exposes operational counts but hides sensitive room data', () => {
  const room = {
    status: 'em_jogo',
    recoveryRevision: 7,
    jogadores: [
      { id: 'secret-player-id', nome: 'Danilo', connected: true },
      { id: 'other-player', nome: 'Amigo', connected: false },
    ],
    papeisDesignados: [
      { id: 'secret-player-id', papel: 'Rei', objetivo: 'Segredo' },
    ],
  };
  const context = sanitizeContext({
    event: 'alterarVida',
    roomCode: 'ABCD',
    playerId: 'secret-player-id',
    room,
    recoveryToken: 'never-log-this',
  });
  const serialized = JSON.stringify(context);

  assert.deepEqual(context, {
    event: 'alterarVida',
    roomCode: 'ABCD',
    playerHash: hashIdentifier('secret-player-id'),
    roomStatus: 'em_jogo',
    totalPlayers: 2,
    connectedPlayers: 1,
    recoveryRevision: 7,
    storageMode: undefined,
  });
  assert.doesNotMatch(serialized, /Danilo|Amigo|Rei|Segredo|secret-player-id|never-log-this/);
});

test('socket errors receive a traceable code and structured JSON log', () => {
  const warnings = [];
  const diagnostics = createDiagnostics({
    logger: {
      warn: (value) => warnings.push(value),
      log() {},
      error() {},
    },
    now: () => '2026-01-01T00:00:00.000Z',
    createId: () => 'MK-ABC123',
  });

  const diagnosticId = diagnostics.reportSocketError('Sala nao encontrada.', {
    event: 'entrarSala',
    roomCode: 'A1B2',
    playerId: 'player-id',
  });

  assert.equal(diagnosticId, 'MK-ABC123');
  assert.deepEqual(JSON.parse(warnings[0]), {
    timestamp: '2026-01-01T00:00:00.000Z',
    kind: 'socket_error',
    event: 'entrarSala',
    roomCode: 'A1B2',
    playerHash: hashIdentifier('player-id'),
    diagnosticId: 'MK-ABC123',
    message: 'Sala nao encontrada.',
  });
});
