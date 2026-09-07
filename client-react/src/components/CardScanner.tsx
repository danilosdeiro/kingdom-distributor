import { useEffect, useMemo, useRef, useState } from 'react';
import { ArrowLeft, Camera, CameraOff, ExternalLink, RefreshCw, Search, SwitchCamera, X } from 'lucide-react';
import { Link } from 'react-router-dom';
import { toast } from 'react-hot-toast';
import {
  CollectorVisionRecognitionService,
  describeRecognitionError,
  type CameraOption,
  type RecognitionProgress,
} from '../services/cardRecognition';
import {
  getCardImage,
  getCardOracleText,
  getCardPrice,
  getLigaMagicUrl,
  getScryfallCard,
  getScryfallCardByName,
  searchScryfallNames,
  type ScryfallCard,
} from '../services/scryfall';
import './CardScanner.css';

type ScannerStatus = 'off' | 'loading' | 'searching' | 'detected' | 'identifying' | 'found' | 'error';

const STATUS_LABELS: Record<ScannerStatus, string> = {
  off: 'Câmera desligada',
  loading: 'Preparando scanner...',
  searching: 'Aponte para uma carta',
  detected: 'Carta detectada. Mantenha firme...',
  identifying: 'Identificando carta...',
  found: 'Carta encontrada',
  error: 'Scanner indisponível',
};

const PROGRESS_LABELS: Record<string, string> = {
  detector: 'Carregando detector',
  embedder: 'Carregando reconhecimento',
  milo: 'Carregando reconhecimento',
  catalog: 'Preparando catálogo de cartas',
  webgpu: 'Preparando processamento',
  dewarp: 'Preparando câmera',
};

export function CardScanner() {
  const cameraTargetRef = useRef<HTMLDivElement>(null);
  const recognitionRef = useRef<CollectorVisionRecognitionService | null>(null);
  const searchTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [status, setStatus] = useState<ScannerStatus>('off');
  const [cameraActive, setCameraActive] = useState(false);
  const [progress, setProgress] = useState<RecognitionProgress | null>(null);
  const [error, setError] = useState('');
  const [card, setCard] = useState<ScryfallCard | null>(null);
  const [confidence, setConfidence] = useState<number | null>(null);
  const [history, setHistory] = useState<ScryfallCard[]>([]);
  const [cameras, setCameras] = useState<CameraOption[]>([]);
  const [cameraIndex, setCameraIndex] = useState(0);
  const [manualOpen, setManualOpen] = useState(false);
  const [query, setQuery] = useState('');
  const [suggestions, setSuggestions] = useState<string[]>([]);
  const [manualLoading, setManualLoading] = useState(false);
  const [suggestionsLoading, setSuggestionsLoading] = useState(false);

  const progressPercent = Math.round(Math.max(0, Math.min(1, progress?.ratio || 0)) * 100);
  const progressLabel = progress?.cached
    ? 'Abrindo arquivos salvos'
    : PROGRESS_LABELS[progress?.stage || ''] || 'Preparando scanner';

  const showCard = (nextCard: ScryfallCard, nextConfidence: number | null) => {
    setCard(nextCard);
    setConfidence(nextConfidence);
    setStatus('found');
    setHistory((current) => [nextCard, ...current.filter((item) => item.id !== nextCard.id)].slice(0, 10));
  };

  const handleRecognitionError = (reason: unknown) => {
    recognitionRef.current?.stop();
    recognitionRef.current = null;
    setCameraActive(false);
    setError(describeRecognitionError(reason));
    setStatus('error');
  };

  const startScanner = async () => {
    if (!cameraTargetRef.current || cameraActive) return;
    setError('');
    setProgress(null);
    setStatus('loading');
    const service = new CollectorVisionRecognitionService();
    recognitionRef.current = service;
    setCameraActive(true);

    try {
      await service.start(cameraTargetRef.current, {
        onProgress: setProgress,
        onReady: () => setStatus('searching'),
        onFrame: (cardPresent) => {
          setStatus((current) => {
            if (current === 'identifying' || current === 'found' || current === 'loading') return current;
            return cardPresent ? 'detected' : 'searching';
          });
        },
        onCardDetected: async (candidate) => {
          setError('');
          setStatus('identifying');
          try {
            showCard(await getScryfallCard(candidate.cardId), candidate.score);
          } catch {
            setStatus('searching');
            setError('A carta foi detectada, mas os detalhes não puderam ser consultados. Tente a busca pelo nome.');
          }
        },
        onError: handleRecognitionError,
      });
      const availableCameras = await service.listCameras();
      setCameras(availableCameras);
      const activeIndex = availableCameras.findIndex((item) => item.deviceId === service.getActiveDeviceId());
      if (activeIndex >= 0) setCameraIndex(activeIndex);
    } catch (reason) {
      service.stop();
      recognitionRef.current = null;
      setCameraActive(false);
      handleRecognitionError(reason);
    }
  };

  const stopScanner = () => {
    recognitionRef.current?.stop();
    recognitionRef.current = null;
    setCameraActive(false);
    setStatus('off');
    setProgress(null);
  };

  const switchCamera = async () => {
    const service = recognitionRef.current;
    if (!service || cameras.length < 2) return;
    const nextIndex = (cameraIndex + 1) % cameras.length;
    try {
      setStatus('loading');
      await service.switchCamera(cameras[nextIndex].deviceId);
      setCameraIndex(nextIndex);
      setStatus('searching');
    } catch (reason) {
      handleRecognitionError(reason);
    }
  };

  useEffect(() => () => {
    recognitionRef.current?.stop();
    if (searchTimerRef.current) clearTimeout(searchTimerRef.current);
  }, []);

  useEffect(() => {
    if (searchTimerRef.current) clearTimeout(searchTimerRef.current);
    let active = true;
    if (query.trim().length < 2) {
      setSuggestions([]);
      setSuggestionsLoading(false);
      return;
    }
    searchTimerRef.current = setTimeout(() => {
      setSuggestionsLoading(true);
      void searchScryfallNames(query)
        .then((names) => { if (active) setSuggestions(names); })
        .catch(() => { if (active) setSuggestions([]); })
        .finally(() => { if (active) setSuggestionsLoading(false); });
    }, 400);
    return () => {
      active = false;
      if (searchTimerRef.current) clearTimeout(searchTimerRef.current);
    };
  }, [query]);

  const chooseManualCard = async (name: string) => {
    setManualLoading(true);
    try {
      const selectedCard = await getScryfallCardByName(name);
      showCard(selectedCard, null);
      setManualOpen(false);
      setQuery('');
      setSuggestions([]);
    } catch {
      toast.error('Não foi possível consultar essa carta.');
    } finally {
      setManualLoading(false);
    }
  };

  const cardImage = useMemo(() => card ? getCardImage(card) : '', [card]);
  const oracleText = useMemo(() => card ? getCardOracleText(card) : '', [card]);
  const price = useMemo(() => card ? getCardPrice(card) : null, [card]);

  return (
    <div className="scanner-page">
      <header className="scanner-header">
        <Link to="/" className="scanner-back" aria-label="Voltar para o início" title="Voltar">
          <ArrowLeft size={22} aria-hidden="true" />
        </Link>
        <div><span className="scanner-eyebrow">MeuKingdom</span><h1>Scanner de Cartas</h1></div>
      </header>

      <main className="scanner-content">
        <section className={`scanner-camera-shell status-${status}`} aria-label="Câmera do scanner">
          <div ref={cameraTargetRef} className="scanner-camera-target">
            {!cameraActive && <div className="scanner-camera-empty"><CameraOff size={42} /><span>Câmera desligada</span></div>}
          </div>
          <div className="scanner-status" role="status" aria-live="polite">
            <span className="scanner-status-dot" /><span>{STATUS_LABELS[status]}</span>
          </div>
        </section>

        {status === 'loading' && (
          <div className="scanner-load-progress">
            <div className="scanner-progress-copy"><span>{progressLabel}</span><strong>{progressPercent}%</strong></div>
            <div className="scanner-progress-track"><span style={{ width: `${progressPercent}%` }} /></div>
            <small>Na primeira vez, o catálogo pode levar alguns minutos para ficar pronto.</small>
          </div>
        )}
        {error && <p className="scanner-error">{error}</p>}

        <div className="scanner-controls">
          {!cameraActive ? (
            <button type="button" className="scanner-primary-action" onClick={() => void startScanner()}><Camera size={20} />Iniciar câmera</button>
          ) : (
            <button type="button" className="scanner-stop-action" onClick={stopScanner}><CameraOff size={20} />Parar câmera</button>
          )}
          {cameraActive && cameras.length > 1 && (
            <button type="button" className="scanner-icon-action" onClick={() => void switchCamera()} aria-label="Trocar câmera" title="Trocar câmera"><SwitchCamera size={22} /></button>
          )}
          <button type="button" className="scanner-manual-action" onClick={() => setManualOpen(true)}><Search size={19} />Buscar pelo nome</button>
        </div>

        {card && (
          <section className="recognized-card" aria-live="polite">
            {cardImage && <img src={cardImage} alt={`Carta ${card.name}`} />}
            <div className="recognized-card-details">
              <div className="recognized-card-heading">
                <div><span>{card.mana_cost || card.card_faces?.[0]?.mana_cost}</span><h2>{card.name}</h2></div>
                {confidence !== null && <strong>{Math.round(confidence * 100)}%</strong>}
              </div>
              <p className="recognized-card-type">{card.type_line}</p>
              {oracleText && <p className="recognized-card-text">{oracleText}</p>}
              <dl className="recognized-card-meta">
                <div><dt>Edição</dt><dd>{card.set_name}</dd></div>
                <div><dt>Coleção</dt><dd>{card.set.toUpperCase()} #{card.collector_number}</dd></div>
                {price && <div><dt>Preço</dt><dd>{price}</dd></div>}
              </dl>
              <div className="recognized-card-actions">
                <a href={card.scryfall_uri} target="_blank" rel="noreferrer"><ExternalLink size={17} />Ver no Scryfall</a>
                <a href={getLigaMagicUrl(card.name)} target="_blank" rel="noreferrer"><ExternalLink size={17} />Ver na LigaMagic</a>
                <button type="button" onClick={() => setManualOpen(true)}>Não é essa carta?</button>
              </div>
            </div>
          </section>
        )}

        {history.length > 0 && (
          <section className="scanner-history">
            <div className="scanner-section-title"><h2>Vistas nesta sessão</h2><button type="button" onClick={() => setHistory([])} aria-label="Limpar histórico" title="Limpar histórico"><X size={18} /></button></div>
            <div className="scanner-history-list">
              {history.map((item) => (
                <button key={item.id} type="button" onClick={() => showCard(item, null)}>
                  {getCardImage(item) && <img src={getCardImage(item)} alt="" />}
                  <span><strong>{item.name}</strong><small>{item.set_name}</small></span>
                </button>
              ))}
            </div>
          </section>
        )}

        <p className="scanner-attribution">Reconhecimento por <a href="https://github.com/HanClinto/CollectorVision" target="_blank" rel="noreferrer">CollectorVision</a> · Dados por Scryfall</p>
      </main>

      {manualOpen && (
        <div className="scanner-search-overlay" role="dialog" aria-modal="true" aria-labelledby="scanner-search-title">
          <button type="button" className="scanner-search-backdrop" onClick={() => setManualOpen(false)} aria-label="Fechar busca" />
          <div className="scanner-search-dialog">
            <div className="scanner-section-title">
              <div><span className="scanner-eyebrow">Correção manual</span><h2 id="scanner-search-title">Buscar carta</h2></div>
              <button type="button" onClick={() => setManualOpen(false)} aria-label="Fechar" title="Fechar"><X size={21} /></button>
            </div>
            <label htmlFor="card-search">Nome da carta</label>
            <div className="scanner-search-input">
              <Search size={19} />
              <input id="card-search" value={query} onChange={(event) => setQuery(event.target.value)} autoFocus autoComplete="off" placeholder="Ex: Sol Ring" />
              {(manualLoading || suggestionsLoading) && <RefreshCw size={18} className="scanner-search-spinner" />}
            </div>
            <div className="scanner-suggestions">
              {suggestions.map((name) => <button key={name} type="button" onClick={() => void chooseManualCard(name)} disabled={manualLoading}>{name}</button>)}
              {query.trim().length >= 2 && suggestions.length === 0 && !manualLoading && !suggestionsLoading && <p>Nenhuma sugestão encontrada.</p>}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
