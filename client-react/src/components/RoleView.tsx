// src/components/RoleView.tsx

import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { gameState } from '../services/gameState';
import './RoleView.css';

export function RoleView() {
  const [meuPapel, setMeuPapel] = useState<{ papel: string; objetivo: string } | null>(null);
  const navigate = useNavigate();

  useEffect(() => {
    // Tenta obter o papel do estado temporário (fluxo normal)
    let papelInfo = gameState.getMeuPapel();

    // Se não encontrar, tenta obter do localStorage (fluxo de recuperação)
    if (!papelInfo) {
      const papelSalvoString = localStorage.getItem('ultimoPapel');
      if (papelSalvoString) {
        try {
          papelInfo = JSON.parse(papelSalvoString);
        } catch (error) {
          console.error("Erro ao ler o papel salvo:", error);
          navigate('/'); // Se houver erro, volta para a home
          return;
        }
      }
    }
    
    if (papelInfo) {
      setMeuPapel(papelInfo);
      // Sincroniza o gameState caso tenhamos vindo do localStorage
      gameState.setMeuPapel(papelInfo);
    } else {
      // Se não houver papel em nenhum dos locais, volta para a home
      navigate('/');
    }
  }, [navigate]);

  const handleVoltar = () => {
    navigate('/');
  };

  if (!meuPapel) {
    return <div className="role-container loading">A carregar...</div>;
  }

  return (
    <div className="role-container">
      <div className="role-card">
        <p>Seu Papel Secreto é:</p>
        <h1>{meuPapel.papel}</h1>
        <div className="objetivo">
          <h3>Seu Objetivo:</h3>
          <p>{meuPapel.objetivo}</p>
        </div>
        <p className="warning">Não revele seu papel a ninguém!</p>
        <button className="back-button" onClick={handleVoltar}>
          Voltar à Página Principal
        </button>
      </div>
    </div>
  );
}