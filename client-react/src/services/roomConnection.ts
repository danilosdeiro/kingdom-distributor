import { socket } from './socket';

export type RoomConnectionState =
  | 'ready'
  | 'connecting'
  | 'offline'
  | 'syncing'
  | 'room-error';

type Listener = (state: RoomConnectionState) => void;

const listeners = new Set<Listener>();
let state: RoomConnectionState = socket.connected ? 'ready' : 'connecting';
let joinedRoomCode: string | null = null;
let joinedSocketId: string | null = null;
let syncTimeout: ReturnType<typeof setTimeout> | null = null;

function isOnline() {
  return typeof navigator === 'undefined' || navigator.onLine;
}

function clearSyncTimeout() {
  if (!syncTimeout) return;
  clearTimeout(syncTimeout);
  syncTimeout = null;
}

function setState(nextState: RoomConnectionState) {
  if (state === nextState) return;
  state = nextState;
  listeners.forEach((listener) => listener(state));
}

function markRoomReady(codigo?: string) {
  clearSyncTimeout();
  joinedRoomCode = (codigo || localStorage.getItem('salaAtual') || '').toUpperCase() || null;
  joinedSocketId = socket.id || null;
  setState('ready');
}

export function beginRoomSync(codigo?: string) {
  joinedRoomCode = codigo?.toUpperCase() || null;
  joinedSocketId = null;
  clearSyncTimeout();

  if (!socket.connected) {
    setState(isOnline() ? 'connecting' : 'offline');
    return;
  }

  setState('syncing');
  syncTimeout = setTimeout(() => setState('room-error'), 12000);
}

export function markRoomConnectionError() {
  clearSyncTimeout();
  joinedRoomCode = null;
  joinedSocketId = null;
  setState('room-error');
}

export function markRoomConnectionLeft() {
  clearSyncTimeout();
  joinedRoomCode = null;
  joinedSocketId = null;
  setState(socket.connected ? 'ready' : (isOnline() ? 'connecting' : 'offline'));
}

export function isRoomReady(codigo: string) {
  return socket.connected
    && joinedSocketId === socket.id
    && joinedRoomCode === codigo.toUpperCase();
}

export function isRoomSyncing(codigo: string) {
  return socket.connected
    && state === 'syncing'
    && joinedRoomCode === codigo.toUpperCase();
}

export function getRoomConnectionState() {
  return state;
}

export function subscribeToRoomConnection(listener: Listener) {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

socket.on('connect', () => {
  joinedRoomCode = null;
  joinedSocketId = null;
  setState('ready');
});

socket.on('disconnect', () => {
  clearSyncTimeout();
  joinedRoomCode = null;
  joinedSocketId = null;
  setState(isOnline() ? 'connecting' : 'offline');
});

socket.on('entradaComSucesso', (data?: { codigo?: string }) => markRoomReady(data?.codigo));
socket.on('salaCriada', (data: { codigo?: string }) => markRoomReady(data.codigo));
socket.on('atualizarLobby', () => {
  if (state === 'syncing') markRoomReady();
});
socket.on('erro', () => {
  if (state === 'syncing') {
    clearSyncTimeout();
    setState('room-error');
  }
});
