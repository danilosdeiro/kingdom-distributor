const PLAYER_ID_KEY = 'meuKingdomPlayerId';

function createPlayerId() {
  if (crypto.randomUUID) {
    return crypto.randomUUID();
  }

  return `${Date.now()}-${Math.random().toString(36).slice(2)}`;
}

export function getPlayerId() {
  const savedPlayerId = localStorage.getItem(PLAYER_ID_KEY);
  if (savedPlayerId) return savedPlayerId;

  const playerId = createPlayerId();
  localStorage.setItem(PLAYER_ID_KEY, playerId);
  return playerId;
}
