import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => {
  const handlers = new Map<string, Array<(data?: unknown) => void>>();
  return {
    handlers,
    socket: {
      connected: false,
      id: undefined as string | undefined,
      on: vi.fn((event: string, handler: (data?: unknown) => void) => {
        handlers.set(event, [...(handlers.get(event) || []), handler]);
      }),
    },
  };
});

vi.mock('./socket', () => ({ socket: mocks.socket }));

function emitSocketEvent(event: string, data?: unknown) {
  mocks.handlers.get(event)?.forEach((handler) => handler(data));
}

describe('room connection status', () => {
  beforeEach(() => {
    vi.resetModules();
    vi.useFakeTimers();
    mocks.handlers.clear();
    mocks.socket.connected = false;
    mocks.socket.id = undefined;
    vi.stubGlobal('navigator', { onLine: true });
    vi.stubGlobal('localStorage', { getItem: () => null });
  });

  it('does not show reconnection while the app starts without an active room', async () => {
    const connection = await import('./roomConnection');

    expect(connection.getRoomConnectionState()).toBe('ready');
    emitSocketEvent('disconnect');
    expect(connection.getRoomConnectionState()).toBe('ready');
  });

  it('shows reconnection only after a room sync has started', async () => {
    const connection = await import('./roomConnection');

    connection.beginRoomSync('ABCD');
    expect(connection.getRoomConnectionState()).toBe('connecting');

    emitSocketEvent('disconnect');
    expect(connection.getRoomConnectionState()).toBe('connecting');
  });

  it('returns to a neutral state after leaving or clearing the room', async () => {
    const connection = await import('./roomConnection');

    connection.beginRoomSync('ABCD');
    connection.markRoomConnectionLeft();
    emitSocketEvent('disconnect');

    expect(connection.getRoomConnectionState()).toBe('ready');
  });
});
