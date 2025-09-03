// src/components/Home.tsx

import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { socket } from '../services/socket';
import { toast } from 'react-hot-toast';
import './Home.css';

export function Home() {
  const [nome, setNome] = useState('');
  const [codigoSala, setCodigoSala] = useState('');
  const [temPapelSalvo, setTemPapelSalvo] = useState(false);
  const navigate = useNavigate();

  useEffect(() => {
    const papelSalvo = localStorage.getItem('ultimoPapel');
    if (papelSalvo) setTemPapelSalvo(true);

    socket.on('salaCriada', ({ codigo, jogadores }) => {
      // Navegação de CRIAR SALA (já estava correta)
      navigate(`/lobby/${codigo}`, { state: { jogadoresIniciais: jogadores } });
    });
    
    // --- INÍCIO DA ALTERAÇÃO ---
    socket.on('entradaComSucesso', () => {
      // Adicionamos o { state: ... } para passar na verificação do Lobby
      navigate(`/lobby/${codigoSala.toUpperCase()}`, { state: { entrouNaSala: true } });
    });
    // --- FIM DA ALTERAÇÃO ---
    
    socket.on('erro', ({ mensagem }) => { 
      toast.error(mensagem); 
    });

    return () => {
      socket.off('salaCriada');
      socket.off('entradaComSucesso');
      socket.off('erro');
    };
  }, [navigate, codigoSala]);

  const handleCriarSala = () => {
    localStorage.removeItem('ultimoPapel');
    setTemPapelSalvo(false);
    socket.emit('criarSala', { nome: nome.trim() });
  };

  const handleEntrarSala = () => {
    localStorage.removeItem('ultimoPapel');
    setTemPapelSalvo(false);
    socket.emit('entrarSala', { 
      codigo: codigoSala.trim().toUpperCase(), 
      nome: nome.trim() 
    });
  };

  const handleVerUltimoPapel = () => { navigate('/role'); };

  return (
    <div className="home-container">
      <div className="title-container">
        <h1>Meu Kingdom</h1>
        <p className="subtitle">Distribuidor de Papéis</p>
      </div>
      <div className="content-container">
        {temPapelSalvo && (<div className="card"><button className="last-role-button" onClick={handleVerUltimoPapel}>Ver Meu Último Papel</button></div>)}
        <div className="card">
          <label htmlFor="nome">Seu Nome</label>
          <input id="nome" type="text" value={nome} onChange={(e) => setNome(e.target.value)} placeholder="Ex: Jace Beleren" />
        </div>
        <div className="card">
          <h2>Criar um Novo Salão</h2>
          <button onClick={handleCriarSala} disabled={!nome.trim()}>
            Criar Salão
          </button>
        </div>
        <div className="card">
          <h2>Entrar em um Salão</h2>
          <label htmlFor="codigo">Código do Salão</label>
          <input id="codigo" type="text" value={codigoSala} onChange={(e) => setCodigoSala(e.target.value)} placeholder="Ex: ABCD" />
          <button onClick={handleEntrarSala} disabled={!nome.trim() || !codigoSala.trim()}>Entrar</button>
        </div>
      </div>
    </div>
  );
}