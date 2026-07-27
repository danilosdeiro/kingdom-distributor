const ROOM_RECOVERY_KEY = 'roomRecovery';

interface RoomRecoveryData {
  codigo: string;
  token: string;
}

export function saveRoomRecovery(data: RoomRecoveryData) {
  if (!data.codigo || !data.token) return;
  localStorage.setItem(ROOM_RECOVERY_KEY, JSON.stringify(data));
}

export function getRoomRecoveryToken(codigo: string) {
  try {
    const rawData = localStorage.getItem(ROOM_RECOVERY_KEY);
    if (!rawData) return undefined;

    const data = JSON.parse(rawData) as RoomRecoveryData;
    return data.codigo === codigo && typeof data.token === 'string'
      ? data.token
      : undefined;
  } catch {
    localStorage.removeItem(ROOM_RECOVERY_KEY);
    return undefined;
  }
}

export function clearRoomRecovery() {
  localStorage.removeItem(ROOM_RECOVERY_KEY);
}
