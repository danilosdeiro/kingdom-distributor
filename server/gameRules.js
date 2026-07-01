const crypto = require('crypto');

const ROOM_CODE_SIZE = 4;
const MIN_PLAYERS = 5;
const MAX_PLAYERS = 7;

const OBJECTIVES = {
  Rei: 'Sobreviver a todo custo! Voce vence se for o ultimo jogador vivo ou junto ao cavaleiro.',
  Cavaleiro: 'Proteger o Rei. O seu unico objetivo e garantir que o Rei venca. Se o Rei vencer, voce vence tambem.',
  Assassino: 'Matar o Rei! Assim que o Rei for eliminado, contanto que nao tenha sido morto pelo usurpador, todos os Assassinos vencem imediatamente!',
  Usurpador: 'Matar o Rei com as suas proprias maos. Se conseguir, voce se torna o novo Rei e assume o objetivo dele e ganha + 10 de vida.',
  Cacador: 'Eliminar dois jogadores quaisquer, exceto o Rei.',
  Coringa: 'Ser o primeiro jogador a ser eliminado. Se nao conseguir, seu novo objetivo e eliminar um jogador qualquer para roubar o papel e o objetivo dele. (Exceto o Rei)',
};

const FIXED_ROLES = ['Rei', 'Cavaleiro', 'Assassino', 'Assassino'];
const DRAWABLE_ROLES = ['Usurpador', 'Cacador', 'Coringa'];
const ROLE_ALIASES = {
  Caçador: 'Cacador',
  Cacador: 'Cacador',
};

const ROLE_LABELS = {
  Cacador: 'Caçador',
};

function normalizeRole(role) {
  return ROLE_ALIASES[role] || role;
}

function getObjective(role) {
  return OBJECTIVES[normalizeRole(role)] || 'Nenhum objetivo especifico.';
}

function getRoleLabel(role) {
  const normalizedRole = normalizeRole(role);
  return ROLE_LABELS[normalizedRole] || normalizedRole;
}

function normalizeRoomCode(code) {
  return String(code || '').trim().toUpperCase();
}

function normalizePlayerName(name) {
  return String(name || '').trim().slice(0, 40);
}

function generateRoomCode(roomExists) {
  let code;

  do {
    code = crypto.randomBytes(3).toString('hex').slice(0, ROOM_CODE_SIZE).toUpperCase();
  } while (roomExists(code));

  return code;
}

function shuffle(list, randomInt = crypto.randomInt) {
  const shuffled = [...list];

  for (let i = shuffled.length - 1; i > 0; i--) {
    const j = randomInt(i + 1);
    [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
  }

  return shuffled;
}

function getRoles(playerCount, gameMode, customRoles = []) {
  const normalizedCustomRoles = customRoles.map(normalizeRole);

  if (gameMode === 'personalizado') {
    return [...FIXED_ROLES, ...normalizedCustomRoles];
  }

  if (gameMode === 'convencional') {
    return [...FIXED_ROLES, 'Usurpador'];
  }

  const extraRolesNeeded = playerCount - FIXED_ROLES.length;
  return [...FIXED_ROLES, ...shuffle(DRAWABLE_ROLES).slice(0, extraRolesNeeded)];
}

function canStartGame(playerCount, gameMode, customRoles = []) {
  if (playerCount < MIN_PLAYERS || playerCount > MAX_PLAYERS) return false;
  if (gameMode === 'convencional') return playerCount === MIN_PLAYERS;
  if (gameMode === 'personalizado') return customRoles.length === playerCount - FIXED_ROLES.length;
  return true;
}

function validateElimination(room, victim, killer) {
  if (!room || !room.papeisDesignados) return false;
  if (!victim || !killer) return false;
  if (!victim.vivo || !killer.vivo) return false;
  if (victim.id === killer.id) return false;

  const playersInGame = new Set(room.papeisDesignados.map((player) => player.id));
  return playersInGame.has(victim.id) && playersInGame.has(killer.id);
}

function getLobbyPayload(room) {
  return {
    jogadores: room.jogadores,
    hostId: room.hostId,
    modoDeJogo: room.modoDeJogo,
  };
}

module.exports = {
  DRAWABLE_ROLES,
  MAX_PLAYERS,
  MIN_PLAYERS,
  OBJECTIVES,
  canStartGame,
  generateRoomCode,
  getLobbyPayload,
  getObjective,
  getRoleLabel,
  getRoles,
  normalizePlayerName,
  normalizeRole,
  normalizeRoomCode,
  shuffle,
  validateElimination,
};
