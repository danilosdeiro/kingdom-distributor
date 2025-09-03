// server/server.js

// ===============================================
//          CONFIGURAÇÃO INICIAL
// ===============================================
const express = require('express');
const http = require('http');
const { Server } = require("socket.io");
const cors = require('cors');

const app = express();
app.use(cors()); // Habilita o CORS

const server = http.createServer(app);

// Configuração do Socket.IO para permitir conexões do nosso app React (Vite)
const io = new Server(server, {
  cors: {
    // A CORREÇÃO ESTÁ AQUI:
    // Permitimos tanto o nosso ambiente local (para desenvolvimento)
    // como o nosso site publicado na Vercel.
    origin: [
      "http://localhost:5173",
      "https://kingdom-distributor.vercel.app" 
    ],
    methods: ["GET", "POST"]
  }
});

const PORT = process.env.PORT || 3000;

// ===============================================
//              DADOS DO JOGO
// ===============================================

// Dicionário com a descrição de cada papel
const OBJETIVOS = {
  'Rei': 'Sobreviver a todo custo! Você vence se for o último jogador vivo.',
  'Cavaleiro': 'Proteger o Rei. O seu único objetivo é garantir que o Rei vença. Se o Rei vencer, você vence também.',
// 'Bandido': 'Matar o Rei! Assim que o Rei for eliminado, todos os Bandidos vencem imediatamente.', // Mantido para referência futura
  'Assassino': 'Matar o Rei! Assim que o Rei for eliminado, contanto que não tenha sido morto pelo usurpador, todos os Assassinos vencem imediatamente.',
  'Usurpador': 'Matar o Rei com as suas próprias mãos. Se conseguir, você se torna o novo Rei e assume o objetivo dele.',
  'Caçador': 'Eliminar dois jogadores quaisquer, exceto o Rei. Após cumprir seu objetivo, você se torna um Assassino com o objetivo de ser o último vivo.',
  'Coringa': 'Ser o primeiro jogador a ser eliminado. Se não conseguir, seu novo objetivo é eliminar um jogador qualquer para roubar o papel e o objetivo dele. (Exceto o Rei)'
};

// Objeto para guardar os salões em memória
let saloes = {};

// ===============================================
//              LÓGICA DO JOGO
// ===============================================

// Nova função para gerar os papéis baseada nas regras customizadas
function getPapeis(numJogadores) {
  console.log(`Gerando papéis para ${numJogadores} jogadores.`);
  
  const PAPEIS_FIXOS = ['Rei', 'Cavaleiro', 'Assassino', 'Assassino'];
  const PAPEIS_SORTEAVEIS = ['Usurpador', 'Caçador', 'Coringa'];

  // Embaralha a lista de papéis sorteáveis para garantir aleatoriedade
  const sorteaveisEmbaralhados = [...PAPEIS_SORTEAVEIS].sort(() => Math.random() - 0.5);

  let papeisDaPartida = [...PAPEIS_FIXOS];

  // Calcula quantos papéis extras precisamos (numJogadores - 4)
  const numeroDePapeisSorteados = numJogadores - PAPEIS_FIXOS.length;

  // Adiciona os papéis sorteados à lista final
  for (let i = 0; i < numeroDePapeisSorteados; i++) {
    papeisDaPartida.push(sorteaveisEmbaralhados[i]);
  }
  
  console.log('Papéis gerados:', papeisDaPartida);
  return papeisDaPartida;
}


// ===============================================
//          GERENCIAMENTO DOS SOCKETS
// ===============================================

// Escuta por novas conexões de clientes
io.on('connection', (socket) => {
  console.log(`Usuário conectado: ${socket.id}`);

  // Evento para criar um novo salão
  socket.on('criarSala', ({ nome, numeroDeJogadores }) => {
  const codigoSala = Math.random().toString(36).substring(2, 6).toUpperCase();
  saloes[codigoSala] = {
    hostId: socket.id,
    jogadores: [{ id: socket.id, nome: nome }],
    numeroDeJogadores: numeroDeJogadores
  };
  socket.join(codigoSala);
  console.log(`Sala ${codigoSala} criada por ${nome} para ${numeroDeJogadores} jogadores.`);
  socket.emit('salaCriada', { codigo: codigoSala, jogadores: saloes[codigoSala].jogadores });
});

  // Evento para entrar em um salão existente
  socket.on('entrarSala', ({ codigo, nome }) => {
    if (saloes[codigo]) {
      saloes[codigo].jogadores.push({ id: socket.id, nome: nome });
      socket.join(codigo);
      console.log(`${nome} entrou na sala ${codigo}`);
      // Avisa a todos na sala que um novo jogador entrou
      io.to(codigo).emit('atualizarLobby', { jogadores: saloes[codigo].jogadores, hostId: saloes[codigo].hostId });
    } else {
      socket.emit('erro', { mensagem: 'Sala não encontrada!' });
    }
  });

  // Evento para o host iniciar a distribuição
  socket.on('distribuirPapeis', ({ codigo }) => {
    const sala = saloes[codigo];
    // Verificamos se o número de jogadores na sala corresponde ao configurado
    if (sala && sala.hostId === socket.id && sala.jogadores.length === sala.numeroDeJogadores) {
      const jogadores = sala.jogadores;
      const papeis = getPapeis(sala.numeroDeJogadores);

      const papeisEmbaralhados = [...papeis].sort(() => Math.random() - 0.5);

      jogadores.forEach((jogador, index) => {
        const papel = papeisEmbaralhados[index];
        const objetivo = OBJETIVOS[papel] || 'Nenhum objetivo específico.';
        io.to(jogador.id).emit('seuPapel', { papel: papel, objetivo: objetivo });
      });

      console.log(`Papéis distribuídos para a sala ${codigo}`);
      sala.papeisDesignados = jogadores.map((j, i) => ({ nome: j.nome, papel: papeisEmbaralhados[i] }));
    } else {
      socket.emit('erro', { mensagem: 'O número de jogadores na sala não corresponde ao número configurado para a partida!' });
    }
  });

  // Evento para revelar todos os papéis no final
  socket.on('revelarPapeis', ({ codigo }) => {
    const sala = saloes[codigo];
    if (sala) {
      io.to(codigo).emit('papeisRevelados', sala.papeisDesignados);
    }
  });
  
  // Lida com a desconexão de um usuário
  socket.on('disconnect', () => {
    console.log(`Usuário desconectado: ${socket.id}`);
    // Opcional: Adicionar lógica para remover jogador do salão se ele desconectar
  });
});


// ===============================================
//              INICIAR SERVIDOR
// ===============================================
server.listen(PORT, () => {
  console.log(`Servidor rodando na porta ${PORT}`);
});