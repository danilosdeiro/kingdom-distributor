// server/server.js

const express = require('express');
const http = require('http');
const fs = require('fs');
const path = require('path');
const { Server } = require('socket.io');
const cors = require('cors');
const {
  MAX_PLAYERS,
  canStartGame,
  createMagicWarAssignments,
  ensureMagicWarColors,
  generateRoomCode,
  getLobbyPayload,
  getObjective,
  getRoleLabel,
  getRoles,
  normalizePlayerId,
  normalizePlayerName,
  normalizeRole,
  normalizeRoomCode,
  shuffle,
  transferMagicWarTargets,
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

app.use(cors({ origin: CLIENT_ORIGINS }));
app.get('/health', (_req, res) => res.json({ ok: true }));

const server = http.createServer(app);
const io = new Server(server, {
  cors: {
    origin: CLIENT_ORIGINS,
    methods: ['GET', 'POST'],
  },
});

const saloes = loadRooms();

function serializeRoom(sala) {
  return {
    ...sala,
    disconnectTimers: {},
  };
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

function loadRooms() {
  try {
    if (!fs.existsSync(ROOM_STATE_FILE)) return {};

    const rawState = fs.readFileSync(ROOM_STATE_FILE, 'utf8');
    const parsedState = JSON.parse(rawState);
    const now = Date.now();

    return Object.fromEntries(
      Object.entries(parsedState)
        .filter(([, sala]) => now - (sala.updatedAt || 0) <= ROOM_STATE_TTL_MS)
        .map(([codigo, sala]) => [codigo, restoreRoom(sala)])
    );
  } catch (error) {
    console.error('Nao foi possivel carregar salas salvas:', error);
    return {};
  }
}

function saveRooms() {
  try {
    fs.mkdirSync(path.dirname(ROOM_STATE_FILE), { recursive: true });
    const serializableRooms = Object.fromEntries(
      Object.entries(saloes).map(([codigo, sala]) => [codigo, serializeRoom(sala)])
    );
    const tempFile = `${ROOM_STATE_FILE}.tmp`;
    fs.writeFileSync(tempFile, JSON.stringify(serializableRooms, null, 2));
    fs.renameSync(tempFile, ROOM_STATE_FILE);
  } catch (error) {
    console.error('Nao foi possivel salvar salas:', error);
  }
}

function touchRoom(sala) {
  sala.updatedAt = Date.now();
}

function persistRoom(sala) {
  touchRoom(sala);
  saveRooms();
}

function removeRoom(codigo) {
  delete saloes[codigo];
  saveRooms();
}

function roomExists(codigo) {
  return Boolean(saloes[codigo]);
}

function emitLobby(codigo, sala) {
  io.to(codigo).emit('atualizarLobby', getLobbyPayload(sala));
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
    return {
      modoDeJogo: 'magic-war',
      papel: 'Magic War',
      objetivo: `Elimine a cor ${assignedRole.alvoCor.nome}.`,
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
  io.to(codigo).emit('fimDeJogo', resultado);
  return resultado;
}

io.on('connection', (socket) => {
  socket.on('criarSala', ({ nome, playerId }) => {
    const nomeLimpo = normalizePlayerName(nome);
    const jogadorId = normalizePlayerId(playerId) || socket.id;
    if (!nomeLimpo) {
      return socket.emit('erro', { mensagem: 'Digite seu nome primeiro.' });
    }

    const codigoSala = generateRoomCode(roomExists);
    saloes[codigoSala] = {
      hostId: jogadorId,
      jogadores: [{ id: jogadorId, socketId: socket.id, nome: nomeLimpo, connected: true }],
      modoDeJogo: 'aleatorio',
      status: 'lobby',
      resultado: null,
      disconnectTimers: {},
      createdAt: Date.now(),
      updatedAt: Date.now(),
    };

    socket.join(codigoSala);
    saveRooms();
    socket.emit('salaCriada', { codigo: codigoSala, jogadores: saloes[codigoSala].jogadores });
  });

  socket.on('entrarSala', ({ codigo, nome, playerId }) => {
    const codigoSala = normalizeRoomCode(codigo);
    const nomeLimpo = normalizePlayerName(nome);
    const jogadorId = normalizePlayerId(playerId) || socket.id;
    const sala = saloes[codigoSala];

    if (!sala) {
      return socket.emit('erro', { mensagem: 'Sala nao encontrada.' });
    }

    if (!nomeLimpo) {
      return socket.emit('erro', { mensagem: 'Digite seu nome primeiro.' });
    }

    let jogadorIndex = sala.jogadores.findIndex((player) => player.id === jogadorId || player.socketId === socket.id);
    const jogadorComMesmoNomeIndex = sala.jogadores.findIndex((player) => player.nome.toLowerCase() === nomeLimpo.toLowerCase());

    if (jogadorIndex === -1 && jogadorComMesmoNomeIndex > -1) {
      const jogadorComMesmoNome = sala.jogadores[jogadorComMesmoNomeIndex];
      if (jogadorComMesmoNome.connected) {
        return socket.emit('erro', { mensagem: 'Esse nome ja esta em uso nessa sala.' });
      }

      jogadorIndex = jogadorComMesmoNomeIndex;
    }

    if (jogadorIndex === -1 && sala.status !== 'lobby') {
      return socket.emit('erro', { mensagem: 'A partida ja comecou. Apenas jogadores da sala podem reconectar.' });
    }

    if (jogadorIndex > -1) {
      const oldId = sala.jogadores[jogadorIndex].id;
      clearDisconnectTimer(sala, oldId);
      sala.jogadores[jogadorIndex] = {
        ...sala.jogadores[jogadorIndex],
        id: jogadorId,
        socketId: socket.id,
        nome: nomeLimpo,
        connected: true,
      };

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
    } else {
      if (sala.jogadores.length >= MAX_PLAYERS) {
        return socket.emit('erro', { mensagem: `A sala '${codigoSala}' esta cheia.` });
      }

      sala.jogadores.push({ id: jogadorId, socketId: socket.id, nome: nomeLimpo, connected: true });
    }

    if (sala.modoDeJogo === 'magic-war') {
      ensureMagicWarColors(sala);
    }

    const assignedRole = updateAssignedRoleSocketId(sala, jogadorId, socket.id);
    socket.join(codigoSala);
    persistRoom(sala);
    emitLobby(codigoSala, sala);
    socket.emit('entradaComSucesso');

    if (sala.status === 'em_jogo') {
      emitAssignedRole(socket, assignedRole);
    }
  });

  socket.on('solicitarDadosSala', (codigo) => {
    const codigoSala = normalizeRoomCode(codigo);
    const sala = saloes[codigoSala];

    if (!sala) {
      return socket.emit('erro', { mensagem: 'Sala nao encontrada.' });
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
      if (novoModo === 'magic-war') {
        ensureMagicWarColors(sala);
      }
      persistRoom(sala);
      emitLobby(codigoSala, sala);
    }
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
      return socket.emit('erro', { mensagem: 'Condicoes para iniciar a partida nao foram atendidas.' });
    }

    const jogadoresDesconectados = sala.jogadores.filter((player) => !player.connected);
    if (jogadoresDesconectados.length > 0) {
      return socket.emit('erro', { mensagem: 'Aguarde todos reconectarem antes de distribuir os papeis.' });
    }

    sala.historicoMortes = [];
    sala.status = 'em_jogo';
    sala.resultado = null;

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

  socket.on('jogadorEliminado', ({ codigo, vitimaPlayerId, assassinoId, assassinoNome }) => {
    const codigoSala = normalizeRoomCode(codigo);
    const sala = saloes[codigoSala];
    if (!sala || !sala.papeisDesignados) return;

    if (sala.status === 'finalizado') {
      return socket.emit('fimDeJogo', sala.resultado);
    }

    const jogadorReportando = sala.jogadores.find((player) => player.socketId === socket.id);
    const vitimaId = normalizePlayerId(vitimaPlayerId);
    if (!jogadorReportando || jogadorReportando.id !== vitimaId) {
      return socket.emit('erro', { mensagem: 'Voce so pode confirmar a sua propria eliminacao.' });
    }

    const vitima = sala.papeisDesignados.find((player) => player.id === vitimaId);
    const assassinoIdLimpo = normalizePlayerId(assassinoId);
    const nomeAssassino = normalizePlayerName(assassinoNome);
    const assassino = sala.papeisDesignados.find((player) => (
      player.id === assassinoIdLimpo || (nomeAssassino && player.nome === nomeAssassino)
    ));

    if (!validateElimination(sala, vitima, assassino)) {
      return socket.emit('erro', { mensagem: 'Eliminacao invalida.' });
    }

    vitima.vivo = false;
    assassino.abates += 1;
    sala.historicoMortes = sala.historicoMortes || [];
    sala.historicoMortes.push({ vitima: vitima.nome, assassino: assassino.nome });
    persistRoom(sala);

    if (sala.modoDeJogo === 'magic-war') {
      if (assassino.alvoId === vitima.id) {
        return finishGame(
          codigoSala,
          sala,
          assassino.nome,
          `${assassino.nome} eliminou a cor ${vitima.cor.nome} e cumpriu sua missao!`
        );
      }

      const cacadoresDoAlvo = transferMagicWarTargets(sala.papeisDesignados, vitima, assassino);

      cacadoresDoAlvo.forEach((cacador) => {
        if (cacador.socketId) {
          io.to(cacador.socketId).emit('seuPapel', getAssignedRolePayload(cacador));
          io.to(cacador.socketId).emit('mensagemSistema', {
            mensagem: `Seu alvo mudou. Agora voce deve eliminar a cor ${assassino.cor.nome}.`,
          });
        }
      });

      const sobreviventes = sala.papeisDesignados.filter((player) => player.vivo);
      persistRoom(sala);
      if (sobreviventes.length === 1) {
        return finishGame(codigoSala, sala, sobreviventes[0].nome, `${sobreviventes[0].nome} foi o ultimo sobrevivente!`);
      }

      emitLobby(codigoSala, sala);
      socket.emit('morteConfirmada');
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
    socket.emit('morteConfirmada');
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

  socket.on('disconnect', () => {
    const found = findRoomBySocket(socket.id);
    if (!found) return;

    const { codigo, sala, jogador } = found;
    jogador.connected = false;
    schedulePlayerRemoval(codigo, sala, jogador);
    persistRoom(sala);
    emitLobby(codigo, sala);
  });
});

server.listen(PORT, () => {
  console.log(`Servidor rodando na porta ${PORT}`);
});
