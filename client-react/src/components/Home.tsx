// src/components/Home.tsx

import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { socket } from '../services/socket';
import './Home.css';

export function Home() {
  const [nome, setNome] = useState('');
  const [codigoSala, setCodigoSala] = useState('');
  const [numJogadores, setNumJogadores] = useState(5); 
  const navigate = useNavigate();

  useEffect(() => {
    socket.on('salaCriada', ({ codigo, jogadores }) => {
      navigate(`/lobby/${codigo}`, { state: { jogadoresIniciais: jogadores } });
    });
    socket.on('atualizarLobby', () => {
      navigate(`/lobby/${codigoSala.toUpperCase()}`);
    });
    socket.on('erro', ({ mensagem }) => { alert(`Erro: ${mensagem}`); });

    return () => {
      socket.off('salaCriada');
      socket.off('atualizarLobby');
      socket.off('erro');
    };
  }, [navigate, codigoSala]);

  const handleCriarSala = () => {
    socket.emit('criarSala', { nome: nome.trim(), numeroDeJogadores: numJogadores });
  };

  const handleEntrarSala = () => {
    socket.emit('entrarSala', { 
      codigo: codigoSala.trim().toUpperCase(), 
      nome: nome.trim() 
    });
  };

  return (
    <div className="home-container">
      {/* Título e subtítulo agrupados para estilização */}
      <div className="title-container">
        <h1>Kingdom Commander</h1>
        <p className="subtitle">Distribuidor de Papéis</p>
      </div>

      <div className="content-container">
        <div className="card">
          <label htmlFor="nome">Seu Nome</label>
          <input 
            id="nome" 
            type="text" 
            value={nome}
            onChange={(e) => setNome(e.target.value)}
            placeholder="Ex: Jace Beleren" 
          />
        </div>
        <div className="card">
          <h2>Criar um Novo Salão</h2>
          <label htmlFor="num-jogadores">Número de Jogadores na Mesa</label>
          <select 
            id="num-jogadores"
            value={numJogadores}
            onChange={(e) => setNumJogadores(Number(e.target.value))}
            className='player-select'
          >
            <option value={5}>5 Jogadores</option>
            <option value={6}>6 Jogadores</option>
            <option value={7}>7 Jogadores</option>
          </select>
          <button onClick={handleCriarSala} disabled={!nome.trim()}>
            Criar Salão
          </button>
        </div>
        <div className="card">
          <h2>Entrar em um Salão</h2>
          <label htmlFor="codigo">Código do Salão</label>
          <input 
            id="codigo" 
            type="text" 
            value={codigoSala}
            onChange={(e) => setCodigoSala(e.target.value)}
            placeholder="Ex: ABCD" 
          />
          <button onClick={handleEntrarSala} disabled={!nome.trim() || !codigoSala.trim()}>
            Entrar
          </button>
        </div>
      </div>
    </div>
  );
}