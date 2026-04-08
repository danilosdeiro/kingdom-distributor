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
  'Assassino': 'Matar o Rei! Assim que o Rei for eliminado, contanto que não tenha sido morto pelo usurpador, todos os Assassinos vencem imediatamente!',
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
      // 1. O Porteiro: Verifica se o jogador já está na lista (pelo nome ou pelo ID antigo)
      const jogadorIndex = sala.jogadores.findIndex(j => j.nome === nome || j.id === socket.id);

      if (jogadorIndex > -1) {
        // Se ele já existe, nós NÃO criamos um clone. Apenas atualizamos o ID dele 
        // (Isso é crucial se ele tiver desconectado pelo celular e voltado com um ID novo)
        sala.jogadores[jogadorIndex].id = socket.id;
        sala.jogadores[jogadorIndex].nome = nome;
      } else {
        // Se ele não existe, aí sim é um jogador novo entrando normalmente
        if (sala.jogadores.length >= LIMITE_MAXIMO_JOGADORES) {
          return socket.emit('erro', { mensagem: `A sala '${codigo}' está cheia!` });
        }
        sala.jogadores.push({ id: socket.id, nome: nome });
      }

      // 2. A Mágica da Reconexão no meio do jogo:
      // Se a partida já começou (os papéis foram distribuídos), atualizamos o ID dele lá 
      // também, para que ele possa continuar clicando nos botões e jogando!
      if (sala.papeisDesignados) {
        const papelDoJogador = sala.papeisDesignados.find(p => p.nome === nome);
        if (papelDoJogador) {
          papelDoJogador.id = socket.id;
        }
      }

      socket.join(codigo);
      io.to(codigo).emit('atualizarLobby', { 
        jogadores: sala.jogadores, 
        hostId: sala.hostId, 
        modoDeJogo: sala.modoDeJogo 
      });
      socket.emit('entradaComSucesso');
    } else {
      socket.emit('erro', { mensagem: 'Sala não encontrada!' });
    }
  });

  socket.on('solicitarDadosSala', (codigo) => {
    const sala = saloes[codigo];
    if (sala) {
      socket.join(codigo);
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
      if (jogadorRemovidoSocket) {
        jogadorRemovidoSocket.emit('voceFoiRemovido', { mensagem: 'Você foi removido da sala pelo host.' });
        jogadorRemovidoSocket.leave(codigo);
      }
      
      const jogadorIndex = sala.jogadores.findIndex(j => j.id === idJogadorARemover);
      if (jogadorIndex > -1) {
        sala.jogadores.splice(jogadorIndex, 1);
        console.log(`Jogador com ID ${idJogadorARemover} foi removido da sala ${codigo} pelo host.`);
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
    if (!sala) return;
    const numeroDeJogadores = sala.jogadores.length;

    if (sala.hostId === socket.id && [5, 6, 7].includes(numeroDeJogadores)) {
      
      // Limpa o histórico de mortes caso estejam jogando novamente na mesma sala
      sala.historicoMortes = []; 

      const jogadores = sala.jogadores;
      const papeis = getPapeis(numeroDeJogadores, sala.modoDeJogo, papeisPersonalizados);
      
      const papeisEmbaralhados = [...papeis].sort(() => Math.random() - 0.5);
      jogadores.forEach((jogador, index) => {
        const papel = papeisEmbaralhados[index];
        const objetivo = OBJETIVOS[papel] || 'Nenhum objetivo específico.';
        io.to(jogador.id).emit('seuPapel', { papel: papel, objetivo: objetivo });
      });
      
      // Salva os dados completos com a vida e os abates
      sala.papeisDesignados = jogadores.map((j, i) => ({ 
        id: j.id, 
        nome: j.nome, 
        papel: papeisEmbaralhados[i],
        vivo: true,
        abates: 0
      }));

    } else {
      socket.emit('erro', { mensagem: 'Condições para iniciar a partida não foram atendidas.' });
    }
  });

  socket.on('jogadorEliminado', ({ codigo, assassinoId }) => {
    const sala = saloes[codigo];
    if (!sala || !sala.papeisDesignados) return;

    const vitima = sala.papeisDesignados.find(p => p.id === socket.id);
    const assassino = sala.papeisDesignados.find(p => p.id === assassinoId);

    if (!vitima || !assassino || !vitima.vivo) return;

    vitima.vivo = false;
    assassino.abates += 1;
    sala.historicoMortes = sala.historicoMortes || [];
    sala.historicoMortes.push({ vitima: vitima.nome, assassino: assassino.nome });

    // Regra do Coringa: Primeiro a morrer
    if (vitima.papel === 'Coringa' && sala.historicoMortes.length === 1) {
      return io.to(codigo).emit('fimDeJogo', { vencedor: 'Coringa', mensagem: 'O Coringa foi o primeiro a ser eliminado e venceu o jogo!' });
    }

    // Regra do Coringa: Roubar papel
    if (assassino.papel === 'Coringa') {
      assassino.papel = vitima.papel;
      io.to(assassino.id).emit('seuPapel', { papel: assassino.papel, objetivo: OBJETIVOS[assassino.papel] });
      io.to(assassino.id).emit('mensagemSistema', { mensagem: `Você roubou o papel de ${vitima.papel}!` });
    }

    // Regra do Caçador
    if (assassino.papel === 'Caçador') {
      if (assassino.abates === 2) {
        return io.to(codigo).emit('fimDeJogo', { vencedor: 'Caçador', mensagem: 'O Caçador conseguiu sua segunda presa e venceu o jogo!' });
      }
      if (vitima.papel === 'Rei' && assassino.abates === 1) {
        return io.to(codigo).emit('fimDeJogo', { vencedor: 'Assassinos', mensagem: 'O Caçador foi apressado e matou o Rei como primeira vítima. Os Assassinos vencem!' });
      }
    }

    // Regra do Usurpador e Rei
    if (vitima.papel === 'Rei') {
      if (assassino.papel === 'Usurpador') {
        assassino.papel = 'Rei';
        io.to(assassino.id).emit('seuPapel', { papel: 'Rei', objetivo: OBJETIVOS['Rei'] });
        io.to(codigo).emit('mensagemSistema', { mensagem: 'O Rei caiu! Vida longa ao novo Rei (Usurpador)!' });
      } else {
        return io.to(codigo).emit('fimDeJogo', { vencedor: 'Assassinos', mensagem: 'O Rei foi eliminado! Os Assassinos vencem a partida!' });
      }
    }

    // Regra dos Assassinos
    const assassinosMortos = sala.papeisDesignados.filter(p => p.papel === 'Assassino' && !p.vivo).length;
    if (assassinosMortos >= 2) {
      return io.to(codigo).emit('fimDeJogo', { vencedor: 'Rei', mensagem: 'Dois Assassinos foram eliminados! A coroa está a salvo, o Rei vence!' });
    }

    // Confirma a morte para a tela do jogador que morreu
    socket.emit('morteConfirmada');
  });

  socket.on('sairDaSala', ({ codigo }) => {
    const sala = saloes[codigo];
    if (sala) {
      const jogadorIndex = sala.jogadores.findIndex(j => j.id === socket.id);
      if (jogadorIndex > -1) {
        console.log(`Jogador ${sala.jogadores[jogadorIndex].nome} saiu da sala ${codigo}.`);
        sala.jogadores.splice(jogadorIndex, 1);

        if (sala.jogadores.length === 0) {
            delete saloes[codigo];
            console.log(`Sala ${codigo} vazia e deletada.`);
        } else {
            io.to(codigo).emit('atualizarLobby', {
                jogadores: sala.jogadores,
                hostId: sala.hostId,
                modoDeJogo: sala.modoDeJogo
            });
        }
      }
    }
    socket.leave(codigo);
  });

  socket.on('disconnect', () => {
    console.log(`Usuário desconectado: ${socket.id}`);
    for (const codigo in saloes) {
      const sala = saloes[codigo];
      const jogadorIndex = sala.jogadores.findIndex(j => j.id === socket.id);

      if (jogadorIndex > -1) {
        if (sala.hostId === socket.id) {
          console.log(`Host da sala ${codigo} desconectou. Destruindo a sala.`);
          io.to(codigo).emit('salaFechada', { mensagem: 'O host desconectou e a sala foi encerrada.' });
          delete saloes[codigo];
        } 
        else {
          console.log(`Jogador ${sala.jogadores[jogadorIndex].nome} desconectou da sala ${codigo}.`);
          sala.jogadores.splice(jogadorIndex, 1);
          
          if (sala.jogadores.length === 0) {
            delete saloes[codigo];
            console.log(`Sala ${codigo} vazia e deletada.`);
          } else {
            io.to(codigo).emit('atualizarLobby', {
                jogadores: sala.jogadores,
                hostId: sala.hostId,
                modoDeJogo: sala.modoDeJogo
            });
          }
        }
        break; 
      }
    }
  });
});

server.listen(PORT, () => {
  console.log(`Servidor rodando na porta ${PORT}`);
});