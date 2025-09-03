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

const OBJETIVOS = {
  'Rei': 'Sobreviver a todo custo! Você vence se for o último jogador vivo ou junto ao cavaleiro.',
  'Cavaleiro': 'Proteger o Rei. O seu único objetivo é garantir que o Rei vença. Se o Rei vencer, você vence também.',
// 'Bandido': 'Matar o Rei! Assim que o Rei for eliminado, todos os Bandidos vencem imediatamente.', // Mantido para referência futura
  'Assassino': 'Matar o Rei! Assim que o Rei for eliminado, contanto que não tenha sido morto pelo usurpador, todos os Assassinos vencem imediatamente.',
  'Usurpador': 'Matar o Rei com as suas próprias mãos. Se conseguir, você se torna o novo Rei e assume o objetivo dele e ganha + 10 de vida.',
  'Caçador': 'Eliminar dois jogadores quaisquer, exceto o Rei.',
  'Coringa': 'Ser o primeiro jogador a ser eliminado. Se não conseguir, seu novo objetivo é eliminar um jogador qualquer para roubar o papel e o objetivo dele. (Exceto o Rei)'
};

let saloes = {};

function getPapeis(numJogadores) {
  const PAPEIS_FIXOS = ['Rei', 'Cavaleiro', 'Assassino', 'Assassino'];
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
  console.log(`Usuário conectado: ${socket.id}`);

  socket.on('criarSala', ({ nome, numeroDeJogadores }) => {
    const codigoSala = Math.random().toString(36).substring(2, 6).toUpperCase();
    saloes[codigoSala] = {
      hostId: socket.id,
      jogadores: [{ id: socket.id, nome: nome }],
      numeroDeJogadores: numeroDeJogadores
    };
    socket.join(codigoSala);
    socket.emit('salaCriada', { codigo: codigoSala, jogadores: saloes[codigoSala].jogadores });
  });

  socket.on('entrarSala', ({ codigo, nome }) => {
    const sala = saloes[codigo];
    if (sala) {
      sala.jogadores.push({ id: socket.id, nome: nome });
      socket.join(codigo);
      
      // CORREÇÃO DO BUG "ENTRAR NA SALA":
      // 1. Notifica os jogadores que JÁ ESTAVAM na sala sobre o novo jogador.
      socket.to(codigo).emit('atualizarLobby', { jogadores: sala.jogadores, hostId: sala.hostId });
      
      // 2. Envia um evento de confirmação de volta para o jogador que acabou de entrar,
      //    para que o seu componente Home possa navegar para o lobby.
      socket.emit('atualizarLobby'); // Esta é a linha crucial que foi restaurada.

    } else {
      socket.emit('erro', { mensagem: 'Sala não encontrada!' });
    }
  });

  socket.on('solicitarDadosSala', (codigo) => {
    const sala = saloes[codigo];
    if (sala) {
      socket.emit('atualizarLobby', { jogadores: sala.jogadores, hostId: sala.hostId });
    }
  });

  socket.on('distribuirPapeis', ({ codigo }) => {
    const sala = saloes[codigo];
    if (sala && sala.hostId === socket.id && sala.jogadores.length === sala.numeroDeJogadores) {
      const jogadores = sala.jogadores;
      const papeis = getPapeis(sala.numeroDeJogadores);
      const papeisEmbaralhados = [...papeis].sort(() => Math.random() - 0.5);

      jogadores.forEach((jogador, index) => {
        const papel = papeisEmbaralhados[index];
        const objetivo = OBJETIVOS[papel] || 'Nenhum objetivo específico.';
        io.to(jogador.id).emit('seuPapel', { papel: papel, objetivo: objetivo });
      });

      sala.papeisDesignados = jogadores.map((j, i) => ({ nome: j.nome, papel: papeisEmbaralhados[i] }));
    } else {
      socket.emit('erro', { mensagem: 'O número de jogadores na sala não corresponde ao número configurado para a partida!' });
    }
  });

  socket.on('disconnect', () => {
    console.log(`Usuário desconectado: ${socket.id}`);
  });
});

server.listen(PORT, () => {
  console.log(`Servidor rodando na porta ${PORT}`);
});
