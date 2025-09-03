import { useState, useEffect } from 'react';
import { gameState } from '../services/gameState';
import './RoleView.css'; // Vamos criar este estilo

export function RoleView() {
  const [meuPapel, setMeuPapel] = useState<{ papel: string; objetivo: string } | null>(null);

  useEffect(() => {
    // Quando a página carrega, pegamos o nosso papel do gerenciador de estado
    const papelInfo = gameState.getMeuPapel();
    setMeuPapel(papelInfo);
  }, []);

  if (!meuPapel) {
    return <div className="role-container">Carregando seu papel...</div>;
  }

  return (
    <div className="role-container">
      <div className="role-card">
        <p>Seu Papel Secreto é:</p>
        <h1>{meuPapel.papel}</h1>
        <div className="objetivo">
          <h3>Seu Objetivo:</h3>
          <p>{meuPapel.objetivo || 'Sobreviva e conquiste a vitória de acordo com as regras do seu papel!'}</p>
        </div>
        <p className="warning">Não revele seu papel a ninguém!</p>
      </div>
    </div>
  );
}