const test = require('node:test');
const assert = require('node:assert/strict');
const {
  canStartGame,
  createMagicWarAssignments,
  ensureMagicWarColors,
  generateRoomCode,
  getLobbyPayload,
  getRoleLabel,
  getRoles,
  normalizePlayerId,
  normalizePlayerName,
  normalizeRoomCode,
  shuffle,
  transferMagicWarTargets,
  validateElimination,
} = require('./gameRules');

test('normalize room code and player name', () => {
  assert.equal(normalizeRoomCode(' abcd '), 'ABCD');
  assert.equal(normalizePlayerName('  Danilo  '), 'Danilo');
  assert.equal(normalizePlayerName(''), '');
  assert.equal(normalizePlayerId(' player-1 '), 'player-1');
});

test('generate room code avoids existing rooms', () => {
  let calls = 0;
  const code = generateRoomCode(() => {
    calls += 1;
    return false;
  });

  assert.equal(code.length, 4);
  assert.equal(calls, 1);
});

test('shuffle keeps the same items', () => {
  const randomInt = () => 0;
  const shuffled = shuffle(['a', 'b', 'c'], randomInt);

  assert.deepEqual(shuffled, ['b', 'c', 'a']);
  assert.deepEqual([...shuffled].sort(), ['a', 'b', 'c']);
});

test('role selection follows game modes', () => {
  assert.deepEqual(getRoles(5, 'convencional'), ['Rei', 'Cavaleiro', 'Assassino', 'Assassino', 'Usurpador']);
  assert.equal(getRoles(7, 'aleatorio').length, 7);
  assert.deepEqual(getRoles(6, 'personalizado', ['Usurpador', 'Coringa']), ['Rei', 'Cavaleiro', 'Assassino', 'Assassino', 'Usurpador', 'Coringa']);
  assert.equal(getRoleLabel('Cacador'), 'Caçador');
});

test('start rules validate player counts and custom roles', () => {
  assert.equal(canStartGame(4, 'aleatorio'), false);
  assert.equal(canStartGame(5, 'aleatorio'), true);
  assert.equal(canStartGame(6, 'convencional'), false);
  assert.equal(canStartGame(5, 'convencional'), true);
  assert.equal(canStartGame(6, 'personalizado', ['Usurpador']), false);
  assert.equal(canStartGame(6, 'personalizado', ['Usurpador', 'Coringa']), true);
  assert.equal(canStartGame(2, 'magic-war'), false);
  assert.equal(canStartGame(3, 'magic-war'), true);
  assert.equal(canStartGame(7, 'magic-war'), true);
});

test('Magic War gives each player a unique public color and a circular target', () => {
  const room = {
    jogadores: [
      { id: 'a', nome: 'A', socketId: 'socket-a' },
      { id: 'b', nome: 'B', socketId: 'socket-b' },
      { id: 'c', nome: 'C', socketId: 'socket-c' },
    ],
  };

  ensureMagicWarColors(room, () => 0);
  const assignments = createMagicWarAssignments(room.jogadores, () => 0);

  assert.equal(new Set(room.jogadores.map((player) => player.cor.id)).size, 3);
  assert.equal(assignments.length, 3);
  assignments.forEach((assignment) => {
    assert.notEqual(assignment.id, assignment.alvoId);
    assert.ok(assignment.cor);
    assert.ok(assignment.alvoCor);
  });
  assert.equal(new Set(assignments.map((assignment) => assignment.alvoId)).size, 3);
});

test('Magic War transfers a fallen target to the killer', () => {
  const victim = { id: 'victim', nome: 'Vitima', cor: { id: 'blue', nome: 'Azul' }, vivo: false };
  const killer = { id: 'killer', nome: 'Algoz', cor: { id: 'red', nome: 'Vermelho' }, vivo: true };
  const hunter = { id: 'hunter', alvoId: victim.id, vivo: true };
  const deadHunter = { id: 'dead-hunter', alvoId: victim.id, vivo: false };
  const assignments = [victim, killer, hunter, deadHunter];

  const affectedPlayers = transferMagicWarTargets(assignments, victim, killer);

  assert.deepEqual(affectedPlayers, [hunter]);
  assert.equal(hunter.alvoId, killer.id);
  assert.equal(hunter.alvoNome, killer.nome);
  assert.equal(hunter.alvoCor.id, 'red');
  assert.equal(deadHunter.alvoId, victim.id);
});

test('elimination validation rejects invalid reports', () => {
  const room = {
    papeisDesignados: [
      { id: 'victim', vivo: true },
      { id: 'killer', vivo: true },
    ],
  };

  assert.equal(validateElimination(room, room.papeisDesignados[0], room.papeisDesignados[1]), true);
  assert.equal(validateElimination(room, room.papeisDesignados[0], room.papeisDesignados[0]), false);
  assert.equal(validateElimination(room, { id: 'ghost', vivo: true }, room.papeisDesignados[1]), false);

  room.papeisDesignados[0].vivo = false;
  assert.equal(validateElimination(room, room.papeisDesignados[0], room.papeisDesignados[1]), false);
});

test('lobby payload exposes stable player ids but hides socket ids', () => {
  const payload = getLobbyPayload({
    hostId: 'player-host',
    modoDeJogo: 'magic-war',
    status: 'em_jogo',
    resultado: null,
    jogadores: [
      { id: 'player-host', socketId: 'socket-host', nome: 'Host', connected: true, cor: { id: 'red', nome: 'Vermelho', hex: '#df4c4c' } },
      { id: 'player-2', socketId: 'socket-2', nome: 'Guest', connected: false },
    ],
    papeisDesignados: [
      { id: 'player-host', vivo: true },
      { id: 'player-2', vivo: false },
    ],
  });

  assert.deepEqual(payload, {
    hostId: 'player-host',
    modoDeJogo: 'magic-war',
    status: 'em_jogo',
    resultado: null,
    jogadores: [
      { id: 'player-host', nome: 'Host', connected: true, vivo: true, cor: { id: 'red', nome: 'Vermelho', hex: '#df4c4c' } },
      { id: 'player-2', nome: 'Guest', connected: false, vivo: false, cor: null },
    ],
  });
});
