const test = require('node:test');
const assert = require('node:assert/strict');
const {
  createRoomRecoveryToken,
  getRecoverySecret,
  recoverRoomFromToken,
} = require('./roomRecovery');

const TEST_SECRET = 'test-recovery-secret';

test('room recovery token restores the complete encrypted snapshot', () => {
  const room = {
    status: 'em_jogo',
    jogadores: [{ id: 'a', nome: 'A', vida: 31 }],
    papeisDesignados: [{ id: 'a', papel: 'Rei', vivo: true }],
  };
  const token = createRoomRecoveryToken('ABCD', room, {
    secret: TEST_SECRET,
    now: 1000,
    ttlMs: 5000,
  });

  assert.ok(!token.includes('Rei'));
  assert.deepEqual(recoverRoomFromToken('ABCD', token, {
    secret: TEST_SECRET,
    now: 2000,
  }), room);
});

test('room recovery rejects tampered, expired, and mismatched tokens', () => {
  const room = { jogadores: [{ id: 'a' }] };
  const token = createRoomRecoveryToken('ABCD', room, {
    secret: TEST_SECRET,
    now: 1000,
    ttlMs: 5000,
  });
  const tampered = `${token.slice(0, -1)}${token.endsWith('a') ? 'b' : 'a'}`;

  assert.equal(recoverRoomFromToken('WXYZ', token, { secret: TEST_SECRET, now: 2000 }), null);
  assert.equal(recoverRoomFromToken('ABCD', token, { secret: TEST_SECRET, now: 7000 }), null);
  assert.equal(recoverRoomFromToken('ABCD', tampered, { secret: TEST_SECRET, now: 2000 }), null);
  assert.equal(recoverRoomFromToken('ABCD', token, { secret: 'wrong-secret', now: 2000 }), null);
});

test('Render service id provides a stable per-service fallback secret', () => {
  assert.equal(
    getRecoverySecret({ RENDER_SERVICE_ID: 'srv-example' }),
    'meukingdom-room-recovery-v1:render:srv-example'
  );
  assert.equal(
    getRecoverySecret({ RENDER_EXTERNAL_HOSTNAME: 'example.onrender.com' }),
    'meukingdom-room-recovery-v1:local:example.onrender.com'
  );
});
