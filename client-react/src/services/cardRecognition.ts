const DEFAULT_COLLECTOR_VISION_URL = 'https://hanclinto.github.io/CollectorVision';
const COLLECTOR_VISION_URL = (
  import.meta.env.VITE_COLLECTOR_VISION_URL || DEFAULT_COLLECTOR_VISION_URL
).replace(/\/$/, '');
const COLLECTOR_VISION_APPLET_PATH = '/card-scanner/collectorvision-scanner-applet.mjs?v=1.26';

export const MIN_CAPTURE_ZOOM = 1;
export const MAX_CAPTURE_ZOOM = 2.5;
export const DEFAULT_CAPTURE_ZOOM = 1.25;

export interface CardRecognitionCandidate {
  cardId: string;
  oracleId?: string | null;
  score: number;
  confidence?: number;
}

export interface RecognitionProgress {
  stage: string;
  ratio: number;
  cached: boolean;
}

export interface CardRecognitionCallbacks {
  onProgress?: (progress: RecognitionProgress) => void;
  onReady?: () => void;
  onFrame?: (cardPresent: boolean) => void;
  onCardDetected?: (candidate: CardRecognitionCandidate) => void;
  onError?: (error: Error) => void;
}

interface CollectorVisionResult {
  cardPresent?: boolean;
}

interface CollectorVisionDetection {
  cardId: string;
  oracleId?: string | null;
  score: number;
  confidence?: number;
}

interface CollectorVisionApplet {
  start(): Promise<void>;
  stop(): void;
  dispose(): void;
  updateConfig(config: Record<string, unknown>): void;
}

interface CollectorVisionModule {
  createCollectorVisionScannerApplet(config: Record<string, unknown>): Promise<CollectorVisionApplet>;
}

export interface CameraOption {
  deviceId: string;
  label: string;
}

export class RecognitionDeduplicator {
  private lastCardId: string | null = null;
  private absentFrames = 0;

  observeFrame(cardPresent: boolean) {
    if (cardPresent) {
      this.absentFrames = 0;
      return;
    }
    this.absentFrames += 1;
    if (this.absentFrames >= 3) this.lastCardId = null;
  }

  accept(cardId: string) {
    if (!cardId || cardId === this.lastCardId) return false;
    this.lastCardId = cardId;
    this.absentFrames = 0;
    return true;
  }

  reset() {
    this.lastCardId = null;
    this.absentFrames = 0;
  }
}

export class CollectorVisionRecognitionService {
  private scanner: CollectorVisionApplet | null = null;
  private target: HTMLElement | null = null;
  private callbacks: CardRecognitionCallbacks = {};
  private activeDeviceId: string | null = null;
  private captureZoom = DEFAULT_CAPTURE_ZOOM;
  private deduplicator = new RecognitionDeduplicator();

  async start(target: HTMLElement, callbacks: CardRecognitionCallbacks, deviceId?: string) {
    if (this.scanner) return;
    if (!navigator.mediaDevices?.getUserMedia) {
      throw new Error('A câmera não está disponível neste navegador.');
    }

    this.target = target;
    this.callbacks = callbacks;
    this.activeDeviceId = deviceId || null;
    const appletUrl = new URL(COLLECTOR_VISION_APPLET_PATH, window.location.origin).href;
    const module = await import(
      /* @vite-ignore */ appletUrl
    ) as CollectorVisionModule;
    const debug = import.meta.env.VITE_CARD_SCANNER_DEBUG === 'true';

    this.scanner = await module.createCollectorVisionScannerApplet({
      target,
      manifestUrl: `${COLLECTOR_VISION_URL}/assets/manifest.json`,
      assetBasePath: `${COLLECTOR_VISION_URL}/assets`,
      workerUrl: new URL('/card-scanner/collectorvision-worker.mjs', window.location.origin).href,
      autoStart: true,
      enableWebGpu: false,
      scanIntervalMs: 900,
      matchThreshold: 0.5,
      consecutiveMatches: 2,
      cooldownMs: 5000,
      groupBySecondaryId: true,
      showFpsOverlay: debug,
      overlay: true,
      captureZoom: this.captureZoom,
      camera: this.cameraConstraints(deviceId),
      onProgress: (data: { stage?: string; ratio?: number; cached?: boolean }) => {
        callbacks.onProgress?.({
          stage: data.stage || 'models',
          ratio: Number.isFinite(data.ratio) ? Number(data.ratio) : 0,
          cached: data.cached === true,
        });
      },
      onReady: () => callbacks.onReady?.(),
      onResult: (result: CollectorVisionResult) => this.handleFrame(result),
      onCardDetected: (detection: CollectorVisionDetection) => this.handleDetection(detection),
      onError: ({ error, message }: { error?: unknown; message?: string }) => {
        callbacks.onError?.(error instanceof Error ? error : new Error(message || 'Falha no reconhecimento.'));
      },
    });
  }

  stop() {
    this.scanner?.dispose();
    this.scanner = null;
    this.target = null;
    this.deduplicator.reset();
  }

  async switchCamera(deviceId: string) {
    if (!this.scanner || !this.target) return;
    this.scanner.stop();
    this.activeDeviceId = deviceId;
    this.scanner.updateConfig({ camera: this.cameraConstraints(deviceId) });
    await this.scanner.start();
  }

  async listCameras(): Promise<CameraOption[]> {
    if (!navigator.mediaDevices?.enumerateDevices) return [];
    const devices = await navigator.mediaDevices.enumerateDevices();
    return devices
      .filter((device) => device.kind === 'videoinput')
      .map((device, index) => ({
        deviceId: device.deviceId,
        label: device.label || `Câmera ${index + 1}`,
      }));
  }

  getActiveDeviceId() {
    return this.activeDeviceId;
  }

  setZoom(value: number) {
    this.captureZoom = Math.max(MIN_CAPTURE_ZOOM, Math.min(MAX_CAPTURE_ZOOM, value));
    this.scanner?.updateConfig({ captureZoom: this.captureZoom });
    return this.captureZoom;
  }

  getZoom() {
    return this.captureZoom;
  }

  private cameraConstraints(deviceId?: string): MediaTrackConstraints {
    if (deviceId) {
      return {
        deviceId: { exact: deviceId },
        width: { ideal: 1920 },
        height: { ideal: 1080 },
      };
    }
    return {
      facingMode: { ideal: 'environment' },
      width: { ideal: 1920 },
      height: { ideal: 1080 },
    };
  }

  private handleFrame(result: CollectorVisionResult) {
    const cardPresent = result.cardPresent === true;
    this.callbacks.onFrame?.(cardPresent);
    this.deduplicator.observeFrame(cardPresent);
  }

  private handleDetection(detection: CollectorVisionDetection) {
    const dedupeId = detection.oracleId || detection.cardId;
    if (!dedupeId || !this.deduplicator.accept(dedupeId)) return;
    this.callbacks.onCardDetected?.({
      cardId: detection.cardId,
      oracleId: detection.oracleId,
      score: detection.score,
      confidence: detection.confidence,
    });
  }
}

export function describeRecognitionError(error: unknown) {
  const name = error instanceof DOMException ? error.name : '';
  if (name === 'NotAllowedError' || name === 'PermissionDeniedError') {
    return 'Permita o acesso à câmera nas configurações do navegador ou aplicativo.';
  }
  if (name === 'NotFoundError' || name === 'DevicesNotFoundError') {
    return 'Nenhuma câmera foi encontrada neste aparelho.';
  }
  if (!navigator.onLine) {
    return 'Conecte-se à internet para preparar o scanner pela primeira vez.';
  }
  return error instanceof Error ? error.message : 'Não foi possível iniciar o scanner.';
}
