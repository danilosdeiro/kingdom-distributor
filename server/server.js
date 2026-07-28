// server/server.js

const express = require('express');
const http = require('http');
const path = require('path');
const { Server } = require('socket.io');
const cors = require('cors');
const {
  createRoomRecoveryToken,
  recoverRoomFromToken,
} = require('./roomRecovery');
const { createDiagnostics } = require('./diagnostics');
const { createRoomStore } = require('./roomStore');
const {
  DEFAULT_LIFE,
  addPartnerCommander,
  adjustCommanderDamage,
  adjustPlayerLife,
  MAX_PLAYERS,
  canStartGame,
  createMagicWarAssignments,
  ensureMagicWarColors,
  generateRoomCode,
  getLobbyPayload,
  getObjective,
  getRoleLabel,
  getRoles,
  initializeCombatState,
  normalizePlayerId,
  normalizePlayerName,
  normalizeRole,
  normalizeRoomCode,
  recordCombatChange,
  resetRoomForLobby,
  shuffle,
  setMagicWarColor,
  setMagicWarSurvivalObjective,
  undoLastCombatChange,
  validateElimination,
} = require('./gameRules');

const app = express();

const CLIENT_ORIGINS = (process.env.CLIENT_ORIGINS || 'http://localhost:5173,https://meukingdom.vercel.app,https://localhost,capacitor://localhost')
  .split(',')
  .map((origin) => origin.trim())
  .filter(Boolean);

const PORT = process.env.PORT || 3000;
const RECONNECT_GRACE_MS = Number(process.env.RECONNECT_GRACE_MS || 120000);
const ROOM_STATE_FILE = process.env.ROOM_STATE_FILE || path.join(__dirname, 'data', 'rooms.json');
const ROOM_STATE_TTL_MS = Number(process.env.ROOM_STATE_TTL_MS || 12 * 60 * 60 * 1000);
const SERVER_STARTED_AT = Date.now();
const roomStore = createRoomStore({
  stateFile: ROOM_STATE_FILE,
  ttlMs: ROOM_STATE_TTL_MS,
});
const diagnostics = createDiagnostics();
let saloes = {};

app.use(cors({ origin: CLIENT_ORIGINS }));
app.get('/health', (_req, res) => res.json({
  ok: true,
  roomRecovery: true,
  uptimeSeconds: Math.floor((Date.now() - SERVER_STARTED_AT) / 1000),
  activeRooms: Object.keys(saloes).length,
  storage: roomStore.getStatus(),
}));

const server = http.createServer(app);
const io = new Server(server, {
  cors: {
    origin: CLIENT_ORIGINS,
    methods: ['GET', 'POST'],
  },
});

function serializeRoom(sala) {
  return {
    ...sala,
    disconnectTimers: {},
  };
}

function getRoomRecoveryToken(codigo, sala) {
  return createRoomRecoveryToken(codigo, serializeRoom(sala), {
    ttlMs: ROOM_STATE_TTL_MS,
  });
}

function emitRoomRecovery(target, codigo, sala) {
  target.emit('salvarRecuperacaoSala', {
    codigo,
    token: getRoomRecoveryToken(codigo, sala),
  });
}

function getRecoveredRoom(codigo, recoveryToken) {
  const snapshot = recoverRoomFromToken(codigo, recoveryToken);
  if (!snapshot) return null;

  return restoreRoom(snapshot);
}

function preserveRuntimeConnections(recoveredRoom, currentRoom) {
  currentRoom?.jogadores?.forEach((currentPlayer) => {
    if (!currentPlayer.connected || !currentPlayer.socketId) return;

    const recoveredPlayer = recoveredRoom.jogadores.find((player) => player.id === currentPlayer.id);
    if (!recoveredPlayer) return;
    recoveredPlayer.connected = true;
    recoveredPlayer.socketId = currentPlayer.socketId;

    const recoveredRole = recoveredRoom.papeisDesignados?.find((role) => role.id === currentPlayer.id);
    if (recoveredRole) recoveredRole.socketId = currentPlayer.socketId;
  });
}

function installRecoveredRoom(codigo, recoveredRoom, currentRoom = null) {
  preserveRuntimeConnections(recoveredRoom, currentRoom);
  saloes[codigo] = recoveredRoom;
  saveRooms();
  diagnostics.reportEvent('room_recovered', {
    roomCode: codigo,
    room: recoveredRoom,
    storageMode: roomStore.getStatus().mode,
  });
  return recoveredRoom;
}

function restoreRoom(sala) {
  return {
    ...sala,
    jogadores: (sala.jogadores || []).map((player) => ({
      ...player,
      socketId: null,
      connected: false,
    })),
    papeisDesignados: sala.papeisDesignados?.map((player) => ({
      ...player,
      socketId: null,
    })),
    disconnectTimers: {},
  };
}

function saveRooms() {
  const serializableRooms = Object.fromEntries(
    Object.entries(saloes).map(([codigo, sala]) => [codigo, serializeRoom(sala)])
  );
  roomStore.save(serializableRooms);
}

function touchRoom(sala) {
  sala.updatedAt = Date.now();
}

function persistRoom(sala, { stateChanged = true } = {}) {
  touchRoom(sala);
  if (stateChanged) {
    sala.recoveryRevision = Number.isInteger(sala.recoveryRevision)
      ? sala.recoveryRevision + 1
      : 1;
  }
  saveRooms();
}

function removeRoom(codigo) {
  delete saloes[codigo];
  saveRooms();
}

function roomExists(codigo) {
  return Boolean(saloes[codigo]);
}

function emitSocketError(socket, mensagem) {
  const now = Date.now();
  const rate = socket.data.diagnosticRate || { startedAt: now, count: 0 };
  if (now - rate.startedAt > 60000) {
    rate.startedAt = now;
    rate.count = 0;
  }
  rate.count += 1;
  socket.data.diagnosticRate = rate;

  const found = findRoomBySocket(socket.id);
  const roomCode = socket.data.roomCode || found?.codigo;
  const room = roomCode ? saloes[roomCode] : found?.sala;
  const codigoDiagnostico = rate.count <= 20
    ? diagnostics.reportSocketError(mensagem, {
      event: socket.data.lastEvent,
      roomCode,
      playerId: socket.data.playerId || found?.jogador?.id,
      room,
      storageMode: roomStore.getStatus().mode,
    })
    : undefined;

  socket.emit('erro', {
    mensagem,
    codigoDiagnostico,
  });
}

function emitLobby(codigo, sala) {
  io.to(codigo).emit('atualizarLobby', getLobbyPayload(sala));
  emitRoomRecovery(io.to(codigo), codigo, sala);
}

function ensureRoomHasHost(sala) {
  if (!sala.jogadores.length) return;
  if (sala.jogadores.some((player) => player.id === sala.hostId && player.connected !== false)) return;

  sala.hostId = sala.jogadores.find((player) => player.connected !== false)?.id || sala.jogadores[0].id;
}

function clearDisconnectTimer(sala, playerId) {
  if (!sala.disconnectTimers?.[playerId]) return;

  clearTimeout(sala.disconnectTimers[playerId]);
  delete sala.disconnectTimers[playerId];
}

function schedulePlayerRemoval(codigo, sala, jogador) {
  sala.disconnectTimers = sala.disconnectTimers || {};
  clearDisconnectTimer(sala, jogador.id);

  sala.disconnectTimers[jogador.id] = setTimeout(() => {
    const salaAtual = saloes[codigo];
    if (!salaAtual) return;

    const jogadorAtual = salaAtual.jogadores.find((player) => player.id === jogador.id);
    if (!jogadorAtual || jogadorAtual.connected) return;

    if (salaAtual.status === 'em_jogo' || salaAtual.status === 'finalizado') {
      ensureRoomHasHost(salaAtual);
      persistRoom(salaAtual);
      emitLobby(codigo, salaAtual);
      return;
    }

    if (salaAtual.hostId === jogadorAtual.id) {
      ensureRoomHasHost(salaAtual);

      if (salaAtual.hostId === jogadorAtual.id) {
        io.to(codigo).emit('salaFechada', { mensagem: 'O host desconectou e a sala foi encerrada.' });
        removeRoom(codigo);
        return;
      }
    }

    salaAtual.jogadores = salaAtual.jogadores.filter((player) => player.id !== jogadorAtual.id);

    if (salaAtual.jogadores.length === 0) {
      removeRoom(codigo);
      return;
    }

    persistRoom(salaAtual);
    emitLobby(codigo, salaAtual);
  }, RECONNECT_GRACE_MS);
}

function updateAssignedRoleSocketId(sala, playerId, socketId) {
  if (!sala.papeisDesignados) return null;

  const papelDoJogador = sala.papeisDesignados.find((papel) => papel.id === playerId);
  if (papelDoJogador) {
    papelDoJogador.socketId = socketId;
  }

  return papelDoJogador || null;
}

function emitAssignedRole(socket, assignedRole) {
  if (!assignedRole) return;

  socket.emit('seuPapel', getAssignedRolePayload(assignedRole));
}

function getAssignedRolePayload(assignedRole) {
  if (assignedRole.papel === 'MagicWar') {
    if (assignedRole.objetivoSobrevivencia) {
      return {
        modoDeJogo: 'magic-war',
        papel: 'Magic War',
        objetivo: 'Seja o ultimo jogador sobrevivente.',
        objetivoSobrevivencia: true,
        cor: assignedRole.cor,
        alvo: null,
      };
    }

    return {
      modoDeJogo: 'magic-war',
      papel: 'Magic War',
      objetivo: `Elimine a cor ${assignedRole.alvoCor.nome}.`,
      objetivoSobrevivencia: false,
      cor: assignedRole.cor,
      alvo: {
        id: assignedRole.alvoId,
        nome: assignedRole.alvoNome,
        cor: assignedRole.alvoCor,
      },
    };
  }

  return {
    modoDeJogo: 'kingdom',
    papel: getRoleLabel(assignedRole.papel),
    objetivo: getObjective(assignedRole.papel),
  };
}

function findRoomBySocket(socketId) {
  for (const [codigo, sala] of Object.entries(saloes)) {
    const jogador = sala.jogadores.find((player) => player.socketId === socketId);
    if (jogador) return { codigo, sala, jogador };
  }

  return null;
}

function getRoleReveal(sala) {
  return (sala.papeisDesignados || []).map((player) => ({
    id: player.id,
    nome: player.nome,
    papel: player.papel === 'MagicWar' ? player.cor.nome : getRoleLabel(player.papel),
    cor: player.cor || null,
    vivo: player.vivo,
  }));
}

function finishGame(codigo, sala, vencedor, mensagem) {
  const resultado = {
    vencedor,
    mensagem,
    revelacao: getRoleReveal(sala),
  };

  sala.status = 'finalizado';
  sala.resultado = resultado;
  persistRoom(sala);
  emitRoomRecovery(io.to(codigo), codigo, sala);
  io.to(codigo).emit('fimDeJogo', resultado);
  return resultado;
}

io.on('connection', (socket) => {
  socket.onAny((event) => {
    socket.data.lastEvent = event;
  });

  socket.on('criarSala', ({ nome, playerId }) => {
    const nomeLimpo = normalizePlayerName(nome);
    const jogadorId = normalizePlayerId(playerId) || socket.id;
    socket.data.playerId = jogadorId;
    if (!nomeLimpo) {
      return emitSocketError(socket, 'Digite seu nome primeiro.');
    }

    const codigoSala = generateRoomCode(roomExists);
    saloes[codigoSala] = {
      hostId: jogadorId,
      jogadores: [{ id: jogadorId, socketId: socket.id, nome: nomeLimpo, connected: true, vida: DEFAULT_LIFE, danoComandante: {} }],
      modoDeJogo: 'aleatorio',
      status: 'lobby',
      resultado: null,
      disconnectTimers: {},
      recoveryRevision: 1,
      createdAt: Date.now(),
      updatedAt: Date.now(),
    };

    socket.join(codigoSala);
    socket.data.roomCode = codigoSala;
    saveRooms();
    emitRoomRecovery(socket, codigoSala, saloes[codigoSala]);
    socket.emit('salaCriada', { codigo: codigoSala, jogadores: saloes[codigoSala].jogadores });
  });

  socket.on('entrarSala', ({ codigo, nome, playerId, recoveryToken }) => {
    const codigoSala = normalizeRoomCode(codigo);
    const nomeLimpo = normalizePlayerName(nome);
    const jogadorId = normalizePlayerId(playerId) || socket.id;
    socket.data.playerId = jogadorId;
    socket.data.roomCode = codigoSala;
    let sala = saloes[codigoSala];
    let salaFoiRecuperada = false;
    const recoveredRoom = recoveryToken
      ? getRecoveredRoom(codigoSala, recoveryToken)
      : null;

    if (!sala && recoveredRoom) {
      sala = installRecoveredRoom(codigoSala, recoveredRoom);
      salaFoiRecuperada = Boolean(sala);
    } else if (
      sala
      && recoveredRoom
      && recoveredRoom.createdAt === sala.createdAt
      && (recoveredRoom.recoveryRevision || 0) > (sala.recoveryRevision || 0)
    ) {
      sala = installRecoveredRoom(codigoSala, recoveredRoom, sala);
      salaFoiRecuperada = true;
    }

    if (!sala) {
      return emitSocketError(socket, 'Sala nao encontrada.');
    }

    if (!nomeLimpo) {
      return emitSocketError(socket, 'Digite seu nome primeiro.');
    }

    let jogadorIndex = sala.jogadores.findIndex((player) => player.id === jogadorId || player.socketId === socket.id);
    const jogadorComMesmoNomeIndex = sala.jogadores.findIndex((player) => player.nome.toLowerCase() === nomeLimpo.toLowerCase());

    if (jogadorIndex === -1 && jogadorComMesmoNomeIndex > -1) {
      const jogadorComMesmoNome = sala.jogadores[jogadorComMesmoNomeIndex];
      if (jogadorComMesmoNome.connected) {
        return emitSocketError(socket, 'Esse nome ja esta em uso nessa sala.');
      }

      jogadorIndex = jogadorComMesmoNomeIndex;
    }

    if (jogadorIndex === -1 && sala.status !== 'lobby') {
      return emitSocketError(socket, 'A partida ja comecou. Apenas jogadores da sala podem reconectar.');
    }

    let roomStateChanged = false;

    if (jogadorIndex > -1) {
      const oldId = sala.jogadores[jogadorIndex].id;
      const oldName = sala.jogadores[jogadorIndex].nome;
      clearDisconnectTimer(sala, oldId);
      sala.jogadores[jogadorIndex] = {
        ...sala.jogadores[jogadorIndex],
        id: jogadorId,
        socketId: socket.id,
        nome: nomeLimpo,
        connected: true,
      };
      roomStateChanged = oldId !== jogadorId || oldName !== nomeLimpo;

      if (sala.hostId === oldId) {
        sala.hostId = jogadorId;
      }

      if (oldId !== jogadorId && sala.papeisDesignados) {
        const assignedPlayer = sala.papeisDesignados.find((player) => player.id === oldId);
        if (assignedPlayer) assignedPlayer.id = jogadorId;
        sala.papeisDesignados.forEach((player) => {
          if (player.alvoId === oldId) player.alvoId = jogadorId;
        });
      }

      if (oldId !== jogadorId) {
        sala.jogadores.forEach((player) => {
          if (Number.isInteger(player.danoComandante?.[oldId])) {
            player.danoComandante[jogadorId] = player.danoComandante[oldId];
            delete player.danoComandante[oldId];
          }

          const oldPartnerId = `${oldId}:partner`;
          if (Number.isInteger(player.danoComandante?.[oldPartnerId])) {
            player.danoComandante[`${jogadorId}:partner`] = player.danoComandante[oldPartnerId];
            delete player.danoComandante[oldPartnerId];
          }
        });
      }
    } else {
      if (sala.jogadores.length >= MAX_PLAYERS) {
        return emitSocketError(socket, `A sala '${codigoSala}' esta cheia.`);
      }

      sala.jogadores.push({ id: jogadorId, socketId: socket.id, nome: nomeLimpo, connected: true, vida: DEFAULT_LIFE, danoComandante: {} });
      roomStateChanged = true;
    }

    const assignedRole = updateAssignedRoleSocketId(sala, jogadorId, socket.id);
    socket.join(codigoSala);
    persistRoom(sala, { stateChanged: roomStateChanged });
    emitLobby(codigoSala, sala);
    socket.emit('entradaComSucesso', {
      codigo: codigoSala,
      status: sala.status,
    });
    if (salaFoiRecuperada) {
      socket.emit('salaRecuperada', {
        mensagem: 'A partida foi recuperada apos o servidor reiniciar.',
      });
    }

    if (sala.status === 'em_jogo') {
      emitAssignedRole(socket, assignedRole);
    }
  });

  socket.on('solicitarDadosSala', (codigo) => {
    const codigoSala = normalizeRoomCode(codigo);
    const sala = saloes[codigoSala];

    if (!sala) {
      return emitSocketError(socket, 'Sala nao encontrada.');
    }

    socket.join(codigoSala);
    socket.emit('atualizarLobby', getLobbyPayload(sala));

    const jogador = sala.jogadores.find((player) => player.socketId === socket.id);
    const assignedRole = sala.papeisDesignados?.find((papel) => papel.id === jogador?.id);
    if (sala.status === 'em_jogo') {
      emitAssignedRole(socket, assignedRole);
    }
  });

  socket.on('mudarModoDeJogo', ({ codigo, novoModo }) => {
    const codigoSala = normalizeRoomCode(codigo);
    const sala = saloes[codigoSala];

    const jogador = sala?.jogadores.find((player) => player.socketId === socket.id);
    const modosPermitidos = new Set(['aleatorio', 'convencional', 'personalizado', 'magic-war']);
    if (sala && jogador?.id === sala.hostId && sala.status !== 'em_jogo' && modosPermitidos.has(novoModo)) {
      sala.modoDeJogo = novoModo;
      persistRoom(sala);
      emitLobby(codigoSala, sala);
    }
  });

  socket.on('selecionarCorMagicWar', ({ codigo, corId }) => {
    const codigoSala = normalizeRoomCode(codigo);
    const sala = saloes[codigoSala];
    const jogador = sala?.jogadores.find((player) => player.socketId === socket.id);

    if (!sala || !jogador || sala.modoDeJogo !== 'magic-war' || sala.status === 'em_jogo') {
      return emitSocketError(socket, 'Nao e possivel escolher uma cor agora.');
    }

    if (!setMagicWarColor(sala, jogador.id, String(corId || ''))) {
      return emitSocketError(socket, 'Essa cor nao esta mais disponivel.');
    }

    persistRoom(sala);
    emitLobby(codigoSala, sala);
  });

  socket.on('removerJogador', ({ codigo, idJogadorARemover }) => {
    const codigoSala = normalizeRoomCode(codigo);
    const sala = saloes[codigoSala];

    const host = sala?.jogadores.find((player) => player.socketId === socket.id);
    if (!sala || host?.id !== sala.hostId) return;

    const jogadorRemovido = sala.jogadores.find((player) => player.id === idJogadorARemover);
    const jogadorRemovidoSocket = jogadorRemovido?.socketId ? io.sockets.sockets.get(jogadorRemovido.socketId) : null;
    if (jogadorRemovidoSocket) {
      jogadorRemovidoSocket.emit('voceFoiRemovido', { mensagem: 'Voce foi removido da sala pelo host.' });
      jogadorRemovidoSocket.leave(codigoSala);
    }

    clearDisconnectTimer(sala, idJogadorARemover);
    sala.jogadores = sala.jogadores.filter((player) => player.id !== idJogadorARemover);
    ensureRoomHasHost(sala);
    persistRoom(sala);
    emitLobby(codigoSala, sala);
  });

  socket.on('distribuirPapeis', ({ codigo, papeisPersonalizados = [] }) => {
    const codigoSala = normalizeRoomCode(codigo);
    const sala = saloes[codigoSala];
    if (!sala) return;

    const numeroDeJogadores = sala.jogadores.length;

    const host = sala.jogadores.find((player) => player.socketId === socket.id);
    if (host?.id !== sala.hostId || !canStartGame(numeroDeJogadores, sala.modoDeJogo, papeisPersonalizados)) {
      return emitSocketError(socket, 'Condicoes para iniciar a partida nao foram atendidas.');
    }

    const jogadoresDesconectados = sala.jogadores.filter((player) => !player.connected);
    if (jogadoresDesconectados.length > 0) {
      return emitSocketError(socket, 'Aguarde todos reconectarem antes de distribuir os papeis.');
    }

    sala.historicoMortes = [];
    sala.status = 'em_jogo';
    sala.resultado = null;
    initializeCombatState(sala);

    if (sala.modoDeJogo === 'magic-war') {
      ensureMagicWarColors(sala);
      sala.papeisDesignados = createMagicWarAssignments(sala.jogadores);
    } else {
      const papeis = getRoles(numeroDeJogadores, sala.modoDeJogo, papeisPersonalizados);
      const papeisEmbaralhados = shuffle(papeis);

      sala.papeisDesignados = sala.jogadores.map((jogador, index) => ({
        id: jogador.id,
        socketId: jogador.socketId,
        nome: jogador.nome,
        papel: normalizeRole(papeisEmbaralhados[index]),
        vivo: true,
        abates: 0,
      }));
    }

    persistRoom(sala);
    emitLobby(codigoSala, sala);

    sala.papeisDesignados.forEach((jogador) => {
      io.to(jogador.socketId).emit('seuPapel', getAssignedRolePayload(jogador));
    });
  });

  socket.on('alterarVida', ({ codigo, delta }) => {
    const codigoSala = normalizeRoomCode(codigo);
    const sala = saloes[codigoSala];
    const jogador = sala?.jogadores.find((player) => player.socketId === socket.id);
    const papel = sala?.papeisDesignados?.find((player) => player.id === jogador?.id);

    if (!sala || sala.status !== 'em_jogo' || !jogador || papel?.vivo === false) {
      return emitSocketError(socket, 'Nao e possivel alterar a vida agora.');
    }

    const beforeLife = Number.isInteger(jogador.vida) ? jogador.vida : DEFAULT_LIFE;
    if (!adjustPlayerLife(jogador, Number(delta))) {
      return emitSocketError(socket, 'Alteracao de vida invalida.');
    }

    if (jogador.vida !== beforeLife) {
      recordCombatChange(sala, {
        type: 'life',
        playerId: jogador.id,
        beforeLife,
        afterLife: jogador.vida,
      });
    }

    persistRoom(sala);
    emitLobby(codigoSala, sala);
  });

  socket.on('alterarDanoComandante', ({ codigo, comandanteId, delta }) => {
    const codigoSala = normalizeRoomCode(codigo);
    const sala = saloes[codigoSala];
    const jogador = sala?.jogadores.find((player) => player.socketId === socket.id);
    const papel = sala?.papeisDesignados?.find((player) => player.id === jogador?.id);

    if (!sala || sala.status !== 'em_jogo' || !jogador || papel?.vivo === false) {
      return emitSocketError(socket, 'Nao e possivel alterar o dano de comandante agora.');
    }

    const comandanteIdLimpo = String(comandanteId || '').trim().slice(0, 100);
    const beforeLife = Number.isInteger(jogador.vida) ? jogador.vida : DEFAULT_LIFE;
    const beforeDamage = Number.isInteger(jogador.danoComandante?.[comandanteIdLimpo])
      ? jogador.danoComandante[comandanteIdLimpo]
      : 0;
    if (!adjustCommanderDamage(jogador, comandanteIdLimpo, Number(delta), sala.jogadores)) {
      return emitSocketError(socket, 'Alteracao de dano de comandante invalida.');
    }

    const afterDamage = jogador.danoComandante[comandanteIdLimpo];
    if (jogador.vida !== beforeLife || afterDamage !== beforeDamage) {
      recordCombatChange(sala, {
        type: 'commander',
        playerId: jogador.id,
        commanderId: comandanteIdLimpo,
        beforeLife,
        afterLife: jogador.vida,
        beforeDamage,
        afterDamage,
      });
    }

    persistRoom(sala);
    emitLobby(codigoSala, sala);
  });

  socket.on('desfazerUltimaAlteracaoCombate', ({ codigo }) => {
    const codigoSala = normalizeRoomCode(codigo);
    const sala = saloes[codigoSala];
    const jogador = sala?.jogadores.find((player) => player.socketId === socket.id);
    const papel = sala?.papeisDesignados?.find((player) => player.id === jogador?.id);

    if (!sala || sala.status !== 'em_jogo' || !jogador || papel?.vivo === false) {
      return emitSocketError(socket, 'Nao e possivel desfazer uma alteracao agora.');
    }

    const change = undoLastCombatChange(sala, jogador.id);
    if (!change) {
      return emitSocketError(socket, 'Nao ha alteracoes para desfazer.');
    }

    persistRoom(sala);
    emitLobby(codigoSala, sala);
    socket.emit('alteracaoCombateDesfeita', {
      mensagem: change.type === 'commander'
        ? 'Dano de comandante desfeito.'
        : 'Alteracao de vida desfeita.',
    });
  });

  socket.on('adicionarSegundoComandante', ({ codigo }) => {
    const codigoSala = normalizeRoomCode(codigo);
    const sala = saloes[codigoSala];
    const jogador = sala?.jogadores.find((player) => player.socketId === socket.id);

    if (!sala || sala.status !== 'em_jogo' || !jogador) {
      return emitSocketError(socket, 'Nao e possivel adicionar um comandante agora.');
    }

    if (!addPartnerCommander(sala, jogador.id)) {
      return emitSocketError(socket, 'Nao foi possivel adicionar o segundo comandante.');
    }

    persistRoom(sala);
    emitLobby(codigoSala, sala);
  });

  socket.on('jogadorEliminado', ({ codigo, vitimaPlayerId, assassinoId, assassinoNome }) => {
    const codigoSala = normalizeRoomCode(codigo);
    const sala = saloes[codigoSala];
    if (!sala || !sala.papeisDesignados) return;

    if (sala.status === 'finalizado') {
      return socket.emit('fimDeJogo', sala.resultado);
    }

    const jogadorReportando = sala.jogadores.find((player) => player.socketId === socket.id);
    const vitimaId = normalizePlayerId(vitimaPlayerId);
    const podeRegistrarEliminacao = jogadorReportando && (
      jogadorReportando.id === vitimaId || jogadorReportando.id === sala.hostId
    );
    if (!podeRegistrarEliminacao) {
      return emitSocketError(socket, 'Apenas a vitima ou o host podem registrar a eliminacao.');
    }

    const vitima = sala.papeisDesignados.find((player) => player.id === vitimaId);
    const assassinoIdLimpo = normalizePlayerId(assassinoId);
    const nomeAssassino = normalizePlayerName(assassinoNome);
    const assassino = sala.papeisDesignados.find((player) => (
      player.id === assassinoIdLimpo || (nomeAssassino && player.nome === nomeAssassino)
    ));

    if (!validateElimination(sala, vitima, assassino)) {
      return emitSocketError(socket, 'Eliminacao invalida.');
    }

    vitima.vivo = false;
    assassino.abates += 1;
    sala.historicoMortes = sala.historicoMortes || [];
    sala.historicoMortes.push({ vitima: vitima.nome, assassino: assassino.nome });
    persistRoom(sala);

    if (sala.modoDeJogo === 'magic-war') {
      if (!assassino.objetivoSobrevivencia && assassino.alvoId === vitima.id) {
        return finishGame(
          codigoSala,
          sala,
          assassino.nome,
          `${assassino.nome} eliminou a cor ${vitima.cor.nome} e cumpriu sua missao!`
        );
      }

      const cacadoresDoAlvo = setMagicWarSurvivalObjective(sala.papeisDesignados, vitima);

      cacadoresDoAlvo.forEach((cacador) => {
        if (cacador.socketId) {
          io.to(cacador.socketId).emit('seuPapel', getAssignedRolePayload(cacador));
          io.to(cacador.socketId).emit('mensagemSistema', {
            mensagem: 'Seu alvo foi eliminado por outro jogador. Agora voce precisa ser o ultimo sobrevivente.',
          });
        }
      });

      const sobreviventes = sala.papeisDesignados.filter((player) => player.vivo);
      persistRoom(sala);
      if (sobreviventes.length === 1) {
        return finishGame(codigoSala, sala, sobreviventes[0].nome, `${sobreviventes[0].nome} foi o ultimo sobrevivente!`);
      }

      emitLobby(codigoSala, sala);
      if (vitima.socketId) io.to(vitima.socketId).emit('morteConfirmada');
      return;
    }

    if (vitima.papel === 'Coringa' && sala.historicoMortes.length === 1) {
      return finishGame(codigoSala, sala, 'Coringa', 'O Coringa foi o primeiro a ser eliminado e venceu o jogo!');
    }

    if (assassino.papel === 'Coringa') {
      assassino.papel = vitima.papel;
      persistRoom(sala);
      io.to(assassino.socketId).emit('seuPapel', { papel: getRoleLabel(assassino.papel), objetivo: getObjective(assassino.papel) });
      io.to(assassino.socketId).emit('mensagemSistema', { mensagem: `Voce roubou o papel de ${vitima.papel}!` });
    }

    if (assassino.papel === 'Cacador') {
      if (assassino.abates === 2) {
        return finishGame(codigoSala, sala, 'Cacador', 'O Cacador conseguiu sua segunda presa e venceu o jogo!');
      }
      if (vitima.papel === 'Rei' && assassino.abates === 1) {
        return finishGame(codigoSala, sala, 'Assassinos', 'O Cacador foi apressado e matou o Rei como primeira vitima. Os Assassinos vencem!');
      }
    }

    if (vitima.papel === 'Rei') {
      if (assassino.papel === 'Usurpador') {
        assassino.papel = 'Rei';
        persistRoom(sala);
        io.to(assassino.socketId).emit('seuPapel', { papel: getRoleLabel('Rei'), objetivo: getObjective('Rei') });
        io.to(codigoSala).emit('mensagemSistema', { mensagem: 'O Rei caiu! Vida longa ao novo Rei (Usurpador)!' });
      } else {
        return finishGame(codigoSala, sala, 'Assassinos', 'O Rei foi eliminado! Os Assassinos vencem a partida!');
      }
    }

    const assassinosMortos = sala.papeisDesignados.filter((player) => player.papel === 'Assassino' && !player.vivo).length;
    if (assassinosMortos >= 2) {
      return finishGame(codigoSala, sala, 'Rei', 'Dois Assassinos foram eliminados! A coroa esta a salvo, o Rei vence!');
    }

    emitLobby(codigoSala, sala);
    if (vitima.socketId) io.to(vitima.socketId).emit('morteConfirmada');
  });

  socket.on('sairDaSala', ({ codigo }) => {
    const codigoSala = normalizeRoomCode(codigo);
    const sala = saloes[codigoSala];

    if (sala) {
      const jogador = sala.jogadores.find((player) => player.socketId === socket.id);
      if (jogador) {
        clearDisconnectTimer(sala, jogador.id);
        sala.jogadores = sala.jogadores.filter((player) => player.id !== jogador.id);
      }

      if (sala.jogadores.length === 0) {
        removeRoom(codigoSala);
      } else {
        ensureRoomHasHost(sala);
        persistRoom(sala);
        emitLobby(codigoSala, sala);
      }
    }

    socket.leave(codigoSala);
  });

  socket.on('voltarAoLobby', ({ codigo }) => {
    const codigoSala = normalizeRoomCode(codigo);
    const sala = saloes[codigoSala];
    const jogador = sala?.jogadores.find((player) => player.socketId === socket.id);

    if (!sala || !jogador) return;
    if (sala.status !== 'finalizado' && sala.status !== 'lobby') {
      return emitSocketError(socket, 'A partida ainda nao terminou.');
    }

    if (sala.status === 'finalizado') resetRoomForLobby(sala);
    persistRoom(sala);
    io.to(codigoSala).emit('lobbyReaberto');
    emitLobby(codigoSala, sala);
  });

  socket.on('disconnect', () => {
    const found = findRoomBySocket(socket.id);
    if (!found) return;

    const { codigo, sala, jogador } = found;
    jogador.connected = false;
    schedulePlayerRemoval(codigo, sala, jogador);
    persistRoom(sala, { stateChanged: false });
    emitLobby(codigo, sala);
  });
});

async function startServer() {
  const storedRooms = await roomStore.initialize();
  saloes = Object.fromEntries(
    Object.entries(storedRooms).map(([codigo, sala]) => [codigo, restoreRoom(sala)])
  );

  server.listen(PORT, () => {
    diagnostics.reportEvent('server_started', {
      storageMode: roomStore.getStatus().mode,
    });
  });
}

async function shutdown() {
  await roomStore.close();
  server.close(() => process.exit(0));
  setTimeout(() => process.exit(0), 2000).unref();
}

process.once('SIGTERM', shutdown);
process.once('SIGINT', shutdown);

startServer().catch((error) => {
  diagnostics.reportSystemError('Nao foi possivel iniciar o servidor.', error, {
    storageMode: roomStore.getStatus().mode,
  });
  process.exit(1);
});
