import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { gameState } from '../services/gameState';
import { socket } from '../services/socket';
import { toast } from 'react-hot-toast';
import './RoleView.css';

interface Jogador {
  id: string;
  nome: string;
}

interface PapelInfo {
  papel: string;
  objetivo: string;
}

const papelStorage = {
  get: () => sessionStorage.getItem('ultimoPapel'),
  set: (papelInfo: PapelInfo) => sessionStorage.setItem('ultimoPapel', JSON.stringify(papelInfo)),
  clear: () => sessionStorage.removeItem('ultimoPapel'),
};

export function RoleView() {
  const [meuPapel, setMeuPapel] = useState<PapelInfo | null>(null);
  const [modalMorteAberto, setModalMorteAberto] = useState(false);
  const [quemMeMatouId, setQuemMeMatouId] = useState('');
  const [estouMorto, setEstouMorto] = useState(false);
  const [papelVisivel, setPapelVisivel] = useState(false);
  const [jogadoresVivos, setJogadoresVivos] = useState<Jogador[]>([]);
  const [meuId, setMeuId] = useState('');

  const navigate = useNavigate();

  useEffect(() => {
    const jogadoresSalvos = localStorage.getItem('jogadoresDaSala');
    if (jogadoresSalvos) {
      try {
        setJogadoresVivos(JSON.parse(jogadoresSalvos));
      } catch {
        setJogadoresVivos([]);
      }
    }

    if (socket.id) {
      setMeuId(socket.id);
    }

    let papelInfo = gameState.getMeuPapel();
    if (!papelInfo) {
      const papelSalvoString = papelStorage.get();
      if (papelSalvoString) {
        try {
          papelInfo = JSON.parse(papelSalvoString);
        } catch {
          navigate('/');
          return;
        }
      }
    }

    if (papelInfo) {
      setMeuPapel(papelInfo);
      gameState.setMeuPapel(papelInfo);
    } else {
      navigate('/');
    }

    const handleMorteConfirmada = () => setEstouMorto(true);

    const handleMensagemSistema = (data: { mensagem: string }) => {
      toast(data.mensagem, { icon: '👑', duration: 5000 });
    };

    const handleFimDeJogo = (data: { vencedor: string; mensagem: string }) => {
      toast.success(data.mensagem, { duration: 8000 });
      setTimeout(() => {
        papelStorage.clear();
        const codigoDaSala = localStorage.getItem('salaAtual');
        if (codigoDaSala) {
          navigate(`/lobby/${codigoDaSala}`, { state: { entrouNaSala: true } });
        } else {
          navigate('/');
        }
      }, 5000);
    };

    const handleSeuPapel = (novoPapelInfo: PapelInfo) => {
      setMeuPapel(novoPapelInfo);
      gameState.setMeuPapel(novoPapelInfo);
      papelStorage.set(novoPapelInfo);
    };

    socket.on('morteConfirmada', handleMorteConfirmada);
    socket.on('mensagemSistema', handleMensagemSistema);
    socket.on('fimDeJogo', handleFimDeJogo);
    socket.on('seuPapel', handleSeuPapel);

    return () => {
      socket.off('morteConfirmada', handleMorteConfirmada);
      socket.off('mensagemSistema', handleMensagemSistema);
      socket.off('fimDeJogo', handleFimDeJogo);
      socket.off('seuPapel', handleSeuPapel);
    };
  }, [navigate]);

  const confirmarEliminacao = () => {
    if (!quemMeMatouId) {
      toast.error('Selecione quem eliminou você.');
      return;
    }

    const codigoSala = localStorage.getItem('salaAtual');

    socket.emit('jogadorEliminado', {
      codigo: codigoSala,
      assassinoId: quemMeMatouId,
    });
    setModalMorteAberto(false);
  };

  if (!meuPapel) {
    return <div className="role-container loading">Carregando...</div>;
  }

  if (estouMorto) {
    return (
      <div className="role-container">
        <div className="role-card" style={{ border: '1px solid #d32f2f' }}>
          <h1 style={{ color: '#d32f2f' }}>ELIMINADO</h1>
          <p>Você está morto. Aguarde o fim da partida em silêncio.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="role-container">
      <div className="role-card">
        <p>Seu Papel Secreto é:</p>

        {papelVisivel ? (
          <>
            <h1>{meuPapel.papel}</h1>
            <div className="objetivo">
              <h3>Seu Objetivo:</h3>
              <p>{meuPapel.objetivo}</p>
            </div>
          </>
        ) : (
          <div style={{ height: '250px', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '20px 0', border: '2px dashed #555', borderRadius: '10px' }}>
            <p style={{ margin: 0, color: '#888' }}>Toque no botão abaixo para revelar o seu papel.</p>
          </div>
        )}

        <button
          className="back-button"
          style={{ marginBottom: '15px', backgroundColor: papelVisivel ? 'transparent' : '#B89B67', color: papelVisivel ? '#B89B67' : '#121212' }}
          onClick={() => setPapelVisivel(!papelVisivel)}
        >
          {papelVisivel ? 'Esconder Meu Papel' : 'Revelar Meu Papel'}
        </button>

        <p className="warning">Não revele seu papel a ninguém!</p>

        <button
          className="back-button"
          style={{ borderColor: '#d32f2f', color: '#d32f2f', marginTop: '30px' }}
          onClick={() => setModalMorteAberto(true)}
        >
          Fui Eliminado
        </button>

        {modalMorteAberto && (
          <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: 'rgba(0,0,0,0.8)', display: 'flex', justifyContent: 'center', alignItems: 'center', zIndex: 1000 }}>
            <div style={{ background: '#1c1c1e', padding: '25px', borderRadius: '10px', textAlign: 'center', width: '90%', maxWidth: '350px', border: '1px solid #444' }}>
              <h3 style={{ color: '#e0e0e0', marginTop: 0 }}>Quem te eliminou?</h3>
              <p style={{ fontSize: '0.9rem', color: '#888' }}>Selecione o jogador responsável pelo golpe final.</p>

              <select
                value={quemMeMatouId}
                onChange={(e) => setQuemMeMatouId(e.target.value)}
                style={{ width: '100%', padding: '12px', marginBottom: '20px', borderRadius: '5px', background: '#2a2a2a', color: '#fff', border: '1px solid #555' }}
              >
                <option value="">Selecione na lista...</option>
                {jogadoresVivos
                  .filter((jogador) => jogador.id !== meuId)
                  .map((jogador) => (
                    <option key={jogador.id} value={jogador.id}>
                      {jogador.nome}
                    </option>
                  ))}
              </select>

              <div style={{ display: 'flex', gap: '10px' }}>
                <button onClick={confirmarEliminacao} style={{ flex: 1, padding: '12px', background: '#d32f2f', color: '#fff', border: 'none', borderRadius: '5px', fontWeight: 'bold' }}>Confirmar</button>
                <button onClick={() => setModalMorteAberto(false)} style={{ flex: 1, padding: '12px', background: '#444', color: '#fff', border: 'none', borderRadius: '5px', fontWeight: 'bold' }}>Cancelar</button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
