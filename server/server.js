// server/server.js

const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const cors = require('cors');
const {
  MAX_PLAYERS,
  canStartGame,
  generateRoomCode,
  getLobbyPayload,
  getObjective,
  getRoleLabel,
  getRoles,
  normalizePlayerName,
  normalizeRole,
  normalizeRoomCode,
  shuffle,
  validateElimination,
} = require('./gameRules');

const app = express();

const CLIENT_ORIGINS = (process.env.CLIENT_ORIGINS || 'http://localhost:5173,https://meukingdom.vercel.app')
  .split(',')
  .map((origin) => origin.trim())
  .filter(Boolean);

const PORT = process.env.PORT || 3000;
const RECONNECT_GRACE_MS = Number(process.env.RECONNECT_GRACE_MS || 120000);

app.use(cors({ origin: CLIENT_ORIGINS }));
app.get('/health', (_req, res) => res.json({ ok: true }));

const server = http.createServer(app);
const io = new Server(server, {
  cors: {
    origin: CLIENT_ORIGINS,
    methods: ['GET', 'POST'],
  },
});

const saloes = {};

function roomExists(codigo) {
  return Boolean(saloes[codigo]);
}

function emitLobby(codigo, sala) {
  io.to(codigo).emit('atualizarLobby', getLobbyPayload(sala));
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

    const jogadorAtual = salaAtual.jogadores.find((player) => player.nome === jogador.nome);
    if (!jogadorAtual || jogadorAtual.connected) return;

    if (salaAtual.hostId === jogadorAtual.id) {
      io.to(codigo).emit('salaFechada', { mensagem: 'O host desconectou e a sala foi encerrada.' });
      delete saloes[codigo];
      return;
    }

    salaAtual.jogadores = salaAtual.jogadores.filter((player) => player.nome !== jogadorAtual.nome);

    if (salaAtual.jogadores.length === 0) {
      delete saloes[codigo];
      return;
    }

    emitLobby(codigo, salaAtual);
  }, RECONNECT_GRACE_MS);
}

function updateAssignedRoleSocketId(sala, nome, socketId) {
  if (!sala.papeisDesignados) return;

  const papelDoJogador = sala.papeisDesignados.find((papel) => papel.nome === nome);
  if (papelDoJogador) {
    papelDoJogador.id = socketId;
  }
}

function findRoomBySocket(socketId) {
  for (const [codigo, sala] of Object.entries(saloes)) {
    const jogador = sala.jogadores.find((player) => player.id === socketId);
    if (jogador) return { codigo, sala, jogador };
  }

  return null;
}

io.on('connection', (socket) => {
  socket.on('criarSala', ({ nome }) => {
    const nomeLimpo = normalizePlayerName(nome);
    if (!nomeLimpo) {
      return socket.emit('erro', { mensagem: 'Digite seu nome primeiro.' });
    }

    const codigoSala = generateRoomCode(roomExists);
    saloes[codigoSala] = {
      hostId: socket.id,
      jogadores: [{ id: socket.id, nome: nomeLimpo, connected: true }],
      modoDeJogo: 'aleatorio',
      disconnectTimers: {},
    };

    socket.join(codigoSala);
    socket.emit('salaCriada', { codigo: codigoSala, jogadores: saloes[codigoSala].jogadores });
  });

  socket.on('entrarSala', ({ codigo, nome }) => {
    const codigoSala = normalizeRoomCode(codigo);
    const nomeLimpo = normalizePlayerName(nome);
    const sala = saloes[codigoSala];

    if (!sala) {
      return socket.emit('erro', { mensagem: 'Sala nao encontrada.' });
    }

    if (!nomeLimpo) {
      return socket.emit('erro', { mensagem: 'Digite seu nome primeiro.' });
    }

    const jogadorIndex = sala.jogadores.findIndex((player) => player.nome === nomeLimpo || player.id === socket.id);

    if (jogadorIndex > -1) {
      const oldId = sala.jogadores[jogadorIndex].id;
      clearDisconnectTimer(sala, oldId);
      sala.jogadores[jogadorIndex] = {
        ...sala.jogadores[jogadorIndex],
        id: socket.id,
        nome: nomeLimpo,
        connected: true,
      };

      if (sala.hostId === oldId) {
        sala.hostId = socket.id;
      }
    } else {
      if (sala.jogadores.length >= MAX_PLAYERS) {
        return socket.emit('erro', { mensagem: `A sala '${codigoSala}' esta cheia.` });
      }

      sala.jogadores.push({ id: socket.id, nome: nomeLimpo, connected: true });
    }

    updateAssignedRoleSocketId(sala, nomeLimpo, socket.id);
    socket.join(codigoSala);
    emitLobby(codigoSala, sala);
    socket.emit('entradaComSucesso');
  });

  socket.on('solicitarDadosSala', (codigo) => {
    const codigoSala = normalizeRoomCode(codigo);
    const sala = saloes[codigoSala];

    if (!sala) {
      return socket.emit('erro', { mensagem: 'Sala nao encontrada.' });
    }

    socket.join(codigoSala);
    socket.emit('atualizarLobby', getLobbyPayload(sala));
  });

  socket.on('mudarModoDeJogo', ({ codigo, novoModo }) => {
    const codigoSala = normalizeRoomCode(codigo);
    const sala = saloes[codigoSala];

    if (sala && socket.id === sala.hostId) {
      sala.modoDeJogo = novoModo;
      emitLobby(codigoSala, sala);
    }
  });

  socket.on('removerJogador', ({ codigo, idJogadorARemover }) => {
    const codigoSala = normalizeRoomCode(codigo);
    const sala = saloes[codigoSala];

    if (!sala || socket.id !== sala.hostId) return;

    const jogadorRemovidoSocket = io.sockets.sockets.get(idJogadorARemover);
    if (jogadorRemovidoSocket) {
      jogadorRemovidoSocket.emit('voceFoiRemovido', { mensagem: 'Voce foi removido da sala pelo host.' });
      jogadorRemovidoSocket.leave(codigoSala);
    }

    clearDisconnectTimer(sala, idJogadorARemover);
    sala.jogadores = sala.jogadores.filter((player) => player.id !== idJogadorARemover);
    emitLobby(codigoSala, sala);
  });

  socket.on('distribuirPapeis', ({ codigo, papeisPersonalizados = [] }) => {
    const codigoSala = normalizeRoomCode(codigo);
    const sala = saloes[codigoSala];
    if (!sala) return;

    const numeroDeJogadores = sala.jogadores.length;

    if (sala.hostId !== socket.id || !canStartGame(numeroDeJogadores, sala.modoDeJogo, papeisPersonalizados)) {
      return socket.emit('erro', { mensagem: 'Condicoes para iniciar a partida nao foram atendidas.' });
    }

    sala.historicoMortes = [];

    const jogadores = sala.jogadores;
    const papeis = getRoles(numeroDeJogadores, sala.modoDeJogo, papeisPersonalizados);
    const papeisEmbaralhados = shuffle(papeis);

    jogadores.forEach((jogador, index) => {
      const papel = normalizeRole(papeisEmbaralhados[index]);
      io.to(jogador.id).emit('seuPapel', { papel: getRoleLabel(papel), objetivo: getObjective(papel) });
    });

    sala.papeisDesignados = jogadores.map((jogador, index) => ({
      id: jogador.id,
      nome: jogador.nome,
      papel: normalizeRole(papeisEmbaralhados[index]),
      vivo: true,
      abates: 0,
    }));
  });

  socket.on('jogadorEliminado', ({ codigo, assassinoId, assassinoNome }) => {
    const codigoSala = normalizeRoomCode(codigo);
    const sala = saloes[codigoSala];
    if (!sala || !sala.papeisDesignados) return;

    const vitima = sala.papeisDesignados.find((player) => player.id === socket.id);
    const nomeAssassino = normalizePlayerName(assassinoNome);
    const assassino = sala.papeisDesignados.find((player) => (
      player.id === assassinoId || (nomeAssassino && player.nome === nomeAssassino)
    ));

    if (!validateElimination(sala, vitima, assassino)) {
      return socket.emit('erro', { mensagem: 'Eliminacao invalida.' });
    }

    vitima.vivo = false;
    assassino.abates += 1;
    sala.historicoMortes = sala.historicoMortes || [];
    sala.historicoMortes.push({ vitima: vitima.nome, assassino: assassino.nome });

    if (vitima.papel === 'Coringa' && sala.historicoMortes.length === 1) {
      return io.to(codigoSala).emit('fimDeJogo', { vencedor: 'Coringa', mensagem: 'O Coringa foi o primeiro a ser eliminado e venceu o jogo!' });
    }

    if (assassino.papel === 'Coringa') {
      assassino.papel = vitima.papel;
      io.to(assassino.id).emit('seuPapel', { papel: getRoleLabel(assassino.papel), objetivo: getObjective(assassino.papel) });
      io.to(assassino.id).emit('mensagemSistema', { mensagem: `Voce roubou o papel de ${vitima.papel}!` });
    }

    if (assassino.papel === 'Cacador') {
      if (assassino.abates === 2) {
        return io.to(codigoSala).emit('fimDeJogo', { vencedor: 'Cacador', mensagem: 'O Cacador conseguiu sua segunda presa e venceu o jogo!' });
      }
      if (vitima.papel === 'Rei' && assassino.abates === 1) {
        return io.to(codigoSala).emit('fimDeJogo', { vencedor: 'Assassinos', mensagem: 'O Cacador foi apressado e matou o Rei como primeira vitima. Os Assassinos vencem!' });
      }
    }

    if (vitima.papel === 'Rei') {
      if (assassino.papel === 'Usurpador') {
        assassino.papel = 'Rei';
        io.to(assassino.id).emit('seuPapel', { papel: getRoleLabel('Rei'), objetivo: getObjective('Rei') });
        io.to(codigoSala).emit('mensagemSistema', { mensagem: 'O Rei caiu! Vida longa ao novo Rei (Usurpador)!' });
      } else {
        return io.to(codigoSala).emit('fimDeJogo', { vencedor: 'Assassinos', mensagem: 'O Rei foi eliminado! Os Assassinos vencem a partida!' });
      }
    }

    const assassinosMortos = sala.papeisDesignados.filter((player) => player.papel === 'Assassino' && !player.vivo).length;
    if (assassinosMortos >= 2) {
      return io.to(codigoSala).emit('fimDeJogo', { vencedor: 'Rei', mensagem: 'Dois Assassinos foram eliminados! A coroa esta a salvo, o Rei vence!' });
    }

    socket.emit('morteConfirmada');
  });

  socket.on('sairDaSala', ({ codigo }) => {
    const codigoSala = normalizeRoomCode(codigo);
    const sala = saloes[codigoSala];

    if (sala) {
      clearDisconnectTimer(sala, socket.id);
      sala.jogadores = sala.jogadores.filter((player) => player.id !== socket.id);

      if (sala.jogadores.length === 0) {
        delete saloes[codigoSala];
      } else {
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
    emitLobby(codigo, sala);
  });
});

server.listen(PORT, () => {
  console.log(`Servidor rodando na porta ${PORT}`);
});
