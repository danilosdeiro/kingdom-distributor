import { BACKEND_URL, socket } from './socket';

const READY_CACHE_MS = 30_000;
const WAKE_TIMEOUT_MS = 75_000;
const HEALTH_REQUEST_TIMEOUT_MS = 10_000;
const RETRY_DELAY_MS = 2_000;

let readyUntil = 0;
let wakeRequest: Promise<void> | null = null;

function delay(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function checkHealth() {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), HEALTH_REQUEST_TIMEOUT_MS);

  try {
    const response = await fetch(`${BACKEND_URL}/health`, {
      cache: 'no-store',
      signal: controller.signal,
    });

    if (!response.ok) throw new Error(`Health check failed: ${response.status}`);
  } finally {
    clearTimeout(timeout);
  }
}

async function wakeBackend() {
  const deadline = Date.now() + WAKE_TIMEOUT_MS;

  while (Date.now() < deadline) {
    if (socket.connected) {
      readyUntil = Date.now() + READY_CACHE_MS;
      return;
    }

    try {
      await checkHealth();
      readyUntil = Date.now() + READY_CACHE_MS;
      socket.connect();
      return;
    } catch {
      if (typeof navigator !== 'undefined' && !navigator.onLine) {
        throw new Error('offline');
      }
      await delay(RETRY_DELAY_MS);
    }
  }

  throw new Error('backend-timeout');
}

export function ensureBackendReady() {
  if (socket.connected || Date.now() < readyUntil) return Promise.resolve();
  if (wakeRequest) return wakeRequest;

  wakeRequest = wakeBackend().finally(() => {
    wakeRequest = null;
  });

  return wakeRequest;
}

export function warmBackend() {
  void ensureBackendReady().catch(() => {
    // Startup warming is best-effort; user actions display connection errors.
  });
}
