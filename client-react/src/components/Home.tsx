import { useState, useEffect } from 'react';
import { useNavigate, Link, useParams } from 'react-router-dom'; // Adicionado useParams
import { socket } from '../services/socket';
import { toast } from 'react-hot-toast';
import './Home.css';

import logoMeuKingdom from '../assets/meuking.png';

export function Home() {
  const { codigoConvite } = useParams(); // 👇 Captura o código da URL (meukingdom.app/ABCD)
  const [nome, setNome] = useState('');
  const [codigoSala, setCodigoSala] = useState('');
  const [temPapelSalvo, setTemPapelSalvo] = useState(false);
  const [temSalaSalva, setTemSalaSalva] = useState(false);

  const navigate = useNavigate();

  // Checa localStorage ao abrir
  useEffect(() => {
    if(localStorage.getItem('salaAtual') && localStorage.getItem('meuNome')) {
        setTemSalaSalva(true);
    }
    const papelSalvo = localStorage.getItem('ultimoPapel');
    if (papelSalvo) setTemPapelSalvo(true);
  }, []);

  useEffect(() => {
    // 👇 NOVA LÓGICA DE CONVITE: Se houver código na URL, preenche o input
    if (codigoConvite && codigoConvite.toUpperCase() !== codigoSala) {
    const codigoLimpo = codigoConvite.toUpperCase();
    setCodigoSala(codigoLimpo);
    
    // Usamos um ID fixo no toast para ele não se repetir
    toast.success(`Sala ${codigoLimpo} detectada!`, { 
      icon: '🔗',
      id: 'convite-toast' // Isso impede que o React abra vários iguais
    });
  }

    socket.on('salaCriada', ({ codigo, jogadores }) => {
      localStorage.setItem('salaAtual', codigo);
      navigate(`/lobby/${codigo}`, { state: { jogadoresIniciais: jogadores } });
    });
    
    socket.on('entradaComSucesso', () => {
      // Usa o código da URL ou o que está no input
      const salaDestino = (codigoConvite || codigoSala).toUpperCase();
      navigate(`/lobby/${salaDestino}`, { state: { entrouNaSala: true } });
    });
    
    socket.on('erro', ({ mensagem }) => { 
      toast.error(mensagem); 
    });

    return () => {
      socket.off('salaCriada');
      socket.off('entradaComSucesso');
      socket.off('erro');
    };
  }, [navigate, codigoSala, codigoConvite]); // codigoConvite adicionado como dependência

  const handleReconectar = () => {
    const codigo = localStorage.getItem('salaAtual');
    const nomeSalvo = localStorage.getItem('meuNome');
    if(codigo && nomeSalvo) {
       setCodigoSala(codigo);
       setNome(nomeSalvo);
       socket.emit('entrarSala', { codigo, nome: nomeSalvo });
    }
  }

  const handleCriarSala = () => {
    if (!nome.trim()) {
      toast.error("Digite seu nome primeiro!");
      return;
    }
    localStorage.removeItem('ultimoPapel');
    setTemPapelSalvo(false);
    localStorage.setItem('meuNome', nome.trim()); 
    socket.emit('criarSala', { nome: nome.trim() });
  };

  const handleEntrarSala = () => {
    if (!nome.trim() || !codigoSala.trim()) {
      toast.error("Preencha nome e código!");
      return;
    }
    localStorage.removeItem('ultimoPapel');
    setTemPapelSalvo(false);
    
    localStorage.setItem('meuNome', nome.trim());
    localStorage.setItem('salaAtual', codigoSala.trim().toUpperCase());
    
    socket.emit('entrarSala', { 
      codigo: codigoSala.trim().toUpperCase(), 
      nome: nome.trim() 
    });
  };

  const handleVerUltimoPapel = () => { navigate('/role'); };

  return (
    <div className="home-container">
      <div className="title-container">
        <Link to="/" className="main-logo-link">
          <img 
            src={logoMeuKingdom} 
            alt="Meu Kingdom" 
            className="main-logo" 
          />
        </Link>
      </div>
      
      <div className="content-container">
        {temPapelSalvo && (
          <div className="card last-role-card" style={{ marginBottom: temSalaSalva ? '10px' : '20px' }}>
            <button className="last-role-button" onClick={handleVerUltimoPapel}>
              Ver Meu Último Papel
            </button>
          </div>
        )}

        {temSalaSalva && (
          <div className="card last-role-card" style={{ marginBottom: '20px' }}>
            <button className="last-role-button" onClick={handleReconectar} style={{ borderColor: '#34c759', color: '#34c759' }}>
              Reconectar à Última Sala
            </button>
          </div>
        )}

        <div className="card primary-card-group">
          <div className="form-group">
            <label htmlFor="nome">Seu Nome</label>
            <input 
              id="nome" 
              type="text" 
              value={nome} 
              onChange={(e) => setNome(e.target.value)} 
              placeholder="Digite seu nome de jogador" 
            />
          </div>
          <div className="form-group">
            <label htmlFor="codigo">Código da Sala</label>
            <input 
              id="codigo" 
              type="text" 
              value={codigoSala} 
              onChange={(e) => setCodigoSala(e.target.value)} 
              placeholder="Ex: ABCD" 
            />
          </div>
          <button 
            className="primary-button" 
            onClick={handleEntrarSala} 
            disabled={!nome.trim() || !codigoSala.trim()}
          >
            Entrar na Sala
          </button>
        </div>

        <div className="secondary-action">
          <p className="or-separator">ou</p>
          <button 
            className="secondary-button create-room-button"
            onClick={handleCriarSala} 
            disabled={!nome.trim()}
          >
            Crie uma Nova Sala
          </button>
        </div>
      </div>
    </div>
  );
}