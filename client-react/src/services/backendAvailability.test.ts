import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  socket: {
    connected: false,
    connect: vi.fn(),
  },
}));

vi.mock('./socket', () => ({
  BACKEND_URL: 'https://backend.example.com',
  socket: mocks.socket,
}));

describe('backend availability', () => {
  beforeEach(() => {
    vi.resetModules();
    vi.clearAllMocks();
    mocks.socket.connected = false;
    vi.stubGlobal('navigator', { onLine: true });
  });

  it('checks health once when simultaneous actions wake the backend', async () => {
    const fetchMock = vi.fn().mockResolvedValue({ ok: true });
    vi.stubGlobal('fetch', fetchMock);
    const { ensureBackendReady } = await import('./backendAvailability');

    const first = ensureBackendReady();
    const second = ensureBackendReady();
    await Promise.all([first, second]);

    expect(first).toBe(second);
    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(fetchMock).toHaveBeenCalledWith(
      'https://backend.example.com/health',
      expect.objectContaining({ cache: 'no-store' }),
    );
    expect(mocks.socket.connect).toHaveBeenCalledTimes(1);
  });

  it('does not request health when Socket.io is already connected', async () => {
    mocks.socket.connected = true;
    const fetchMock = vi.fn();
    vi.stubGlobal('fetch', fetchMock);
    const { ensureBackendReady } = await import('./backendAvailability');

    await ensureBackendReady();

    expect(fetchMock).not.toHaveBeenCalled();
    expect(mocks.socket.connect).not.toHaveBeenCalled();
  });

  it('reports an offline device without waiting for further retries', async () => {
    vi.stubGlobal('navigator', { onLine: false });
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new Error('network error')));
    const { ensureBackendReady } = await import('./backendAvailability');

    await expect(ensureBackendReady()).rejects.toThrow('offline');
  });
});
