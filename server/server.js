// server/server.js

const express = require('express');
const http = require('http');
const { Server } = require("socket.io");
const cors = require('cors');

const app = express();
app.use(cors());
const server = http.createServer(app);

const io = new Server(server, {
  cors: {
    origin: ["http://localhost:5173", "https://meukingdom.vercel.app"],
    methods: ["GET", "POST"]
  }
});

const PORT = process.env.PORT || 3000;
const LIMITE_MAXIMO_JOGADORES = 7;

const OBJETIVOS = {
  'Rei': 'Sobreviver a todo custo! Você vence se for o último jogador vivo ou junto ao cavaleiro.',
  'Cavaleiro': 'Proteger o Rei. O seu único objetivo é garantir que o Rei vença. Se o Rei vencer, você vence também.',
  'Assassino': 'Matar o Rei! Assim que o Rei for eliminado, contanto que não tenha sido morto pelo usurpador, todos os Assassinos vencem imediatamente.',
  'Usurpador': 'Matar o Rei com as suas próprias mãos. Se conseguir, você se torna o novo Rei e assume o objetivo dele e ganha + 10 de vida.',
  'Caçador': 'Eliminar dois jogadores quaisquer, exceto o Rei.',
  'Coringa': 'Ser o primeiro jogador a ser eliminado. Se não conseguir, seu novo objetivo é eliminar um jogador qualquer para roubar o papel e o objetivo dele. (Exceto o Rei)'
};

let saloes = {};


function getPapeis(numJogadores, modoDeJogo, papeisPersonalizados = []) {
  const PAPEIS_FIXOS = ['Rei', 'Cavaleiro', 'Assassino', 'Assassino'];

  if (modoDeJogo === 'personalizado') {

    return [...PAPEIS_FIXOS, ...papeisPersonalizados];
  }
  if (modoDeJogo === 'convencional') { 
    return [...PAPEIS_FIXOS, 'Usurpador']; 
  }
  
  const PAPEIS_SORTEAVEIS = ['Usurpador', 'Caçador', 'Coringa'];
  const sorteaveisEmbaralhados = [...PAPEIS_SORTEAVEIS].sort(() => Math.random() - 0.5);
  let papeisDaPartida = [...PAPEIS_FIXOS];
  const numeroDePapeisSorteados = numJogadores - PAPEIS_FIXOS.length;
  for (let i = 0; i < numeroDePapeisSorteados; i++) {
    papeisDaPartida.push(sorteaveisEmbaralhados[i]);
  }
  return papeisDaPartida;
}

io.on('connection', (socket) => {
  socket.on('criarSala', ({ nome }) => {
    const codigoSala = Math.random().toString(36).substring(2, 6).toUpperCase();
    saloes[codigoSala] = { 
      hostId: socket.id, 
      jogadores: [{ id: socket.id, nome: nome }],
      modoDeJogo: 'aleatorio'
    };
    socket.join(codigoSala);
    socket.emit('salaCriada', { codigo: codigoSala, jogadores: saloes[codigoSala].jogadores });
  });

  socket.on('entrarSala', ({ codigo, nome }) => {
    const sala = saloes[codigo];
    if (sala) {
      if (sala.jogadores.length >= LIMITE_MAXIMO_JOGADORES) {
        return socket.emit('erro', { mensagem: `A sala '${codigo}' está cheia!` });
      }
      sala.jogadores.push({ id: socket.id, nome: nome });
      socket.join(codigo);
      io.to(codigo).emit('atualizarLobby', { jogadores: sala.jogadores, hostId: sala.hostId, modoDeJogo: sala.modoDeJogo });
      socket.emit('entradaComSucesso');
    } else {
      socket.emit('erro', { mensagem: 'Sala não encontrada!' });
    }
  });

  socket.on('solicitarDadosSala', (codigo) => {
    const sala = saloes[codigo];
    if (sala) {
      socket.emit('atualizarLobby', { 
        jogadores: sala.jogadores, 
        hostId: sala.hostId,
        modoDeJogo: sala.modoDeJogo
      });
    }
  });

  socket.on('mudarModoDeJogo', ({ codigo, novoModo }) => {
    const sala = saloes[codigo];
    if (sala && socket.id === sala.hostId) {
      sala.modoDeJogo = novoModo;
      io.to(codigo).emit('atualizarLobby', { 
        jogadores: sala.jogadores, 
        hostId: sala.hostId,
        modoDeJogo: sala.modoDeJogo
      });
    }
  });
  
  socket.on('removerJogador', ({ codigo, idJogadorARemover }) => {
    const sala = saloes[codigo];
    if (sala && socket.id === sala.hostId) {
      const jogadorRemovidoSocket = io.sockets.sockets.get(idJogadorARemover);
      sala.jogadores = sala.jogadores.filter(jogador => jogador.id !== idJogadorARemover);
      if (jogadorRemovidoSocket) {
        jogadorRemovidoSocket.emit('voceFoiRemovido', { mensagem: 'Você foi removido da sala pelo host.' });
        jogadorRemovidoSocket.leave(codigo);
      }
      io.to(codigo).emit('atualizarLobby', { 
        jogadores: sala.jogadores, 
        hostId: sala.hostId,
        modoDeJogo: sala.modoDeJogo
      });
    }
  });

  socket.on('distribuirPapeis', ({ codigo, papeisPersonalizados }) => {
    const sala = saloes[codigo];
    const numeroDeJogadores = sala.jogadores.length;

    if (sala && sala.hostId === socket.id && [5, 6, 7].includes(numeroDeJogadores)) {
      const jogadores = sala.jogadores;
      const papeis = getPapeis(numeroDeJogadores, sala.modoDeJogo, papeisPersonalizados);
      
      const papeisEmbaralhados = [...papeis].sort(() => Math.random() - 0.5);
      jogadores.forEach((jogador, index) => {
        const papel = papeisEmbaralhados[index];
        const objetivo = OBJETIVOS[papel] || 'Nenhum objetivo específico.';
        io.to(jogador.id).emit('seuPapel', { papel: papel, objetivo: objetivo });
      });
      sala.papeisDesignados = jogadores.map((j, i) => ({ nome: j.nome, papel: papeisEmbaralhados[i] }));
    } else {
      socket.emit('erro', { mensagem: 'Condições para iniciar a partida não foram atendidas.' });
    }
  });

  socket.on('disconnect', () => { console.log(`Usuário desconectado: ${socket.id}`); });
});

server.listen(PORT, () => {
  console.log(`Servidor rodando na porta ${PORT}`);
});