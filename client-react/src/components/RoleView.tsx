// src/components/RoleView.tsx

import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom'; // Importe useNavigate
import { gameState } from '../services/gameState';
import './RoleView.css';

export function RoleView() {
  const [meuPapel, setMeuPapel] = useState<{ papel: string; objetivo: string } | null>(null);
  const navigate = useNavigate(); // Hook para navegação

  useEffect(() => {
    const papelInfo = gameState.getMeuPapel();
    if (papelInfo) {
      setMeuPapel(papelInfo);
    } else {
      // Se não houver papel, talvez o jogador tenha atualizado a página. Redireciona para a home.
      navigate('/');
    }
  }, [navigate]);

  // Função para voltar à página principal
  const handleVoltar = () => {
    navigate('/');
  };

  if (!meuPapel) {
    return <div className="role-container loading">A redirecionar...</div>;
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
        
        {/* BOTÃO ADICIONADO AQUI */}
        <button className="back-button" onClick={handleVoltar}>
          Voltar à Página Principal
        </button>
      </div>
    </div>
  );
}