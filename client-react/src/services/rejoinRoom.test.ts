import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => {
  const connectHandlers = new Set<() => void>();
  return {
    connectHandlers,
    socket: {
      connected: false,
      on: vi.fn(),
      off: vi.fn((_event: string, handler: () => void) => {
        connectHandlers.delete(handler);
      }),
      once: vi.fn((_event: string, handler: () => void) => {
        connectHandlers.add(handler);
      }),
      connect: vi.fn(),
      emit: vi.fn(),
    },
    beginRoomSync: vi.fn(),
    markRoomConnectionError: vi.fn(),
  };
});

vi.mock('./socket', () => ({ socket: mocks.socket }));
vi.mock('./playerIdentity', () => ({ getPlayerId: () => 'player-1' }));
vi.mock('./roomRecovery', () => ({ getRoomRecoveryToken: () => 'recovery-token' }));
vi.mock('./roomConnection', () => ({
  beginRoomSync: mocks.beginRoomSync,
  isRoomReady: () => false,
  isRoomSyncing: () => false,
  markRoomConnectionError: mocks.markRoomConnectionError,
}));

import { cancelSavedRoomRejoin, rejoinSavedRoom } from './rejoinRoom';

function createLocalStorage(values: Record<string, string>) {
  return {
    getItem: (key: string) => values[key] ?? null,
  } as Storage;
}

describe('saved room rejoin', () => {
  beforeEach(() => {
    cancelSavedRoomRejoin();
    vi.useFakeTimers();
    vi.clearAllMocks();
    mocks.connectHandlers.clear();
    mocks.socket.connected = false;
    vi.stubGlobal('localStorage', createLocalStorage({
      salaAtual: 'ABCD',
      meuNome: 'Dan',
    }));
  });

  it('waits for a sleeping server and joins after the socket connects', () => {
    expect(rejoinSavedRoom(true)).toBe(true);
    expect(mocks.beginRoomSync).toHaveBeenCalledWith('ABCD');
    expect(mocks.socket.connect).toHaveBeenCalledOnce();

    mocks.socket.connected = true;
    [...mocks.connectHandlers][0]?.();

    expect(mocks.socket.emit).toHaveBeenCalledWith('entrarSala', {
      codigo: 'ABCD',
      nome: 'Dan',
      playerId: 'player-1',
      recoveryToken: 'recovery-token',
    });
  });

  it('stops waiting when the server does not respond', () => {
    rejoinSavedRoom(true);
    vi.advanceTimersByTime(70000);

    expect(mocks.markRoomConnectionError).toHaveBeenCalledOnce();
    expect(mocks.connectHandlers).toHaveLength(0);
  });
});
