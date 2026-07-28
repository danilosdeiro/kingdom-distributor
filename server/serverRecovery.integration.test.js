const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const os = require('os');
const path = require('path');
const { spawn } = require('child_process');
const { io } = require('socket.io-client');

function waitForEvent(socket, eventName, predicate = () => true, timeoutMs = 10000) {
  return new Promise((resolve, reject) => {
    const timeout = setTimeout(() => {
      socket.off(eventName, handler);
      reject(new Error(`Timeout aguardando ${eventName}`));
    }, timeoutMs);
    const handler = (data) => {
      if (!predicate(data)) return;
      clearTimeout(timeout);
      socket.off(eventName, handler);
      resolve(data);
    };
    socket.on(eventName, handler);
  });
}

async function waitForHealth(url, expectedRooms = undefined) {
  const deadline = Date.now() + 10000;
  while (Date.now() < deadline) {
    try {
      const response = await fetch(`${url}/health`);
      const health = await response.json();
      if (health.ok && (expectedRooms === undefined || health.activeRooms === expectedRooms)) return health;
    } catch {
      // The child process can take a moment to bind its port.
    }
    await new Promise((resolve) => setTimeout(resolve, 100));
  }
  throw new Error('Servidor de teste nao ficou disponivel.');
}

function startServer(port, stateFile) {
  return spawn(process.execPath, ['server.js'], {
    cwd: __dirname,
    env: {
      ...process.env,
      PORT: String(port),
      ROOM_STATE_FILE: stateFile,
      ROOM_RECOVERY_SECRET: 'integration-recovery-secret',
      RECONNECT_GRACE_MS: '60000',
    },
    stdio: ['ignore', 'pipe', 'pipe'],
  });
}

async function stopServer(child) {
  if (!child || child.exitCode !== null) return;
  child.kill();
  await Promise.race([
    new Promise((resolve) => child.once('exit', resolve)),
    new Promise((resolve) => setTimeout(resolve, 3000)),
  ]);
}

function connect(url) {
  return io(url, {
    transports: ['websocket'],
    reconnection: false,
    timeout: 5000,
  });
}

test('an active match recovers after the server and ephemeral file are lost', { timeout: 30000 }, async () => {
  const port = 32000 + Math.floor(Math.random() * 1000);
  const url = `http://127.0.0.1:${port}`;
  const tempDirectory = fs.mkdtempSync(path.join(os.tmpdir(), 'meukingdom-recovery-'));
  const stateFile = path.join(tempDirectory, 'rooms.json');
  let serverProcess;
  let sockets = [];

  try {
    serverProcess = startServer(port, stateFile);
    await waitForHealth(url, 0);

    const ids = ['host-id', 'player-b-id', 'player-c-id'];
    const names = ['Host', 'Player B', 'Player C'];
    sockets = ids.map(() => connect(url));
    await Promise.all(sockets.map((socket) => waitForEvent(socket, 'connect')));

    let latestRecoveryToken = '';
    sockets[0].on('salvarRecuperacaoSala', ({ token }) => {
      latestRecoveryToken = token;
    });

    const roomCreated = waitForEvent(sockets[0], 'salaCriada');
    sockets[0].emit('criarSala', { nome: names[0], playerId: ids[0] });
    const { codigo } = await roomCreated;

    await Promise.all(sockets.slice(1).map((socket, index) => {
      const entered = waitForEvent(socket, 'entradaComSucesso');
      socket.emit('entrarSala', {
        codigo,
        nome: names[index + 1],
        playerId: ids[index + 1],
      });
      return entered;
    }));

    const magicWarLobby = waitForEvent(
      sockets[0],
      'atualizarLobby',
      (data) => data.modoDeJogo === 'magic-war'
    );
    sockets[0].emit('mudarModoDeJogo', { codigo, novoModo: 'magic-war' });
    await magicWarLobby;

    const roles = sockets.map((socket) => waitForEvent(socket, 'seuPapel'));
    sockets[0].emit('distribuirPapeis', { codigo });
    await Promise.all(roles);

    const tokenBeforeLifeChange = latestRecoveryToken;
    const recoveryAfterLife = waitForEvent(
      sockets[0],
      'salvarRecuperacaoSala',
      ({ token }) => token !== tokenBeforeLifeChange
    );
    const lifeAt39 = waitForEvent(
      sockets[0],
      'atualizarLobby',
      (data) => data.jogadores.find((player) => player.id === ids[0])?.vida === 39
    );
    sockets[0].emit('alterarVida', { codigo, delta: -1 });
    const [changedLobby] = await Promise.all([lifeAt39, recoveryAfterLife]);
    assert.equal(changedLobby.combatLog[0].playerName, names[0]);
    assert.equal(changedLobby.combatLog[0].delta, -1);
    assert.equal(changedLobby.combatLog[0].lifeAfter, 39);
    assert.ok(latestRecoveryToken);

    const tokenAfterLifeChange = latestRecoveryToken;
    const recoveryAfterUndo = waitForEvent(
      sockets[0],
      'salvarRecuperacaoSala',
      ({ token }) => token !== tokenAfterLifeChange
    );
    const lifeRestored = waitForEvent(
      sockets[0],
      'atualizarLobby',
      (data) => data.jogadores.find((player) => player.id === ids[0])?.vida === 40
    );
    const undoConfirmed = waitForEvent(sockets[0], 'alteracaoCombateDesfeita');
    sockets[0].emit('desfazerUltimaAlteracaoCombate', { codigo });
    const [restoredLobby] = await Promise.all([lifeRestored, recoveryAfterUndo, undoConfirmed]);
    assert.equal(restoredLobby.jogadores.find((player) => player.id === ids[0]).canUndoCombat, false);
    assert.deepEqual(restoredLobby.combatLog, []);

    const tokenAfterUndo = latestRecoveryToken;
    const recoveryAfterSecondLifeChange = waitForEvent(
      sockets[0],
      'salvarRecuperacaoSala',
      ({ token }) => token !== tokenAfterUndo
    );
    const lifeBackAt39 = waitForEvent(
      sockets[0],
      'atualizarLobby',
      (data) => data.jogadores.find((player) => player.id === ids[0])?.vida === 39
    );
    sockets[0].emit('alterarVida', { codigo, delta: -1 });
    await Promise.all([lifeBackAt39, recoveryAfterSecondLifeChange]);

    await stopServer(serverProcess);
    sockets.forEach((socket) => socket.disconnect());
    sockets = [];
    fs.rmSync(stateFile, { force: true });

    serverProcess = startServer(port, stateFile);
    await waitForHealth(url, 0);

    const recoveredHost = connect(url);
    sockets = [recoveredHost];
    await waitForEvent(recoveredHost, 'connect');

    const staleRecoveredLobby = waitForEvent(
      recoveredHost,
      'atualizarLobby',
      (data) => data.status === 'em_jogo'
    );
    const recoveredNotice = waitForEvent(recoveredHost, 'salaRecuperada');
    const enteredAgain = waitForEvent(recoveredHost, 'entradaComSucesso');
    recoveredHost.emit('entrarSala', {
      codigo,
      nome: names[0],
      playerId: ids[0],
      recoveryToken: tokenBeforeLifeChange,
    });

    const [staleLobby] = await Promise.all([staleRecoveredLobby, recoveredNotice, enteredAgain]);
    assert.equal(staleLobby.jogadores.find((player) => player.id === ids[0]).vida, 40);
    assert.equal(staleLobby.jogadores.length, 3);

    const recoveredPlayerB = connect(url);
    sockets.push(recoveredPlayerB);
    await waitForEvent(recoveredPlayerB, 'connect');

    const upgradedLobby = waitForEvent(
      recoveredHost,
      'atualizarLobby',
      (data) => data.jogadores.find((player) => player.id === ids[0])?.vida === 39
    );
    const playerBEntered = waitForEvent(recoveredPlayerB, 'entradaComSucesso');
    recoveredPlayerB.emit('entrarSala', {
      codigo,
      nome: names[1],
      playerId: ids[1],
      recoveryToken: latestRecoveryToken,
    });

    await Promise.all([upgradedLobby, playerBEntered]);

    const lifeAt38 = waitForEvent(
      recoveredHost,
      'atualizarLobby',
      (data) => data.jogadores.find((player) => player.id === ids[0])?.vida === 38
    );
    recoveredHost.emit('alterarVida', { codigo, delta: -1 });
    await lifeAt38;
  } finally {
    sockets.forEach((socket) => socket.disconnect());
    await stopServer(serverProcess);
    fs.rmSync(tempDirectory, { recursive: true, force: true });
  }
});
