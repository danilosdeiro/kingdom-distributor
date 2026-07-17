const crypto = require('crypto');

const ROOM_CODE_SIZE = 4;
const MIN_PLAYERS = 5;
const MAX_PLAYERS = 7;
const MAGIC_WAR_MIN_PLAYERS = 3;

const MAGIC_WAR_COLORS = [
  { id: 'white', nome: 'Branco', hex: '#f4efd8', textColor: '#171717' },
  { id: 'blue', nome: 'Azul', hex: '#4b9fe8', textColor: '#ffffff' },
  { id: 'black', nome: 'Preto', hex: '#34313a', textColor: '#ffffff' },
  { id: 'red', nome: 'Vermelho', hex: '#df4c4c', textColor: '#ffffff' },
  { id: 'green', nome: 'Verde', hex: '#48a868', textColor: '#ffffff' },
  { id: 'colorless', nome: 'Incolor', hex: '#aeb4b8', textColor: '#171717' },
  { id: 'gold', nome: 'Dourado', hex: '#d4a83f', textColor: '#171717' },
];

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

function normalizePlayerId(playerId) {
  return String(playerId || '').trim().slice(0, 80);
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
  if (gameMode === 'magic-war') {
    return playerCount >= MAGIC_WAR_MIN_PLAYERS && playerCount <= MAX_PLAYERS;
  }

  if (playerCount < MIN_PLAYERS || playerCount > MAX_PLAYERS) return false;
  if (gameMode === 'convencional') return playerCount === MIN_PLAYERS;
  if (gameMode === 'personalizado') return customRoles.length === playerCount - FIXED_ROLES.length;
  return true;
}

function ensureMagicWarColors(room, randomInt = crypto.randomInt) {
  const usedColorIds = new Set();

  room.jogadores.forEach((player) => {
    const colorExists = MAGIC_WAR_COLORS.some((color) => color.id === player.cor?.id);
    if (!colorExists || usedColorIds.has(player.cor.id)) {
      delete player.cor;
      return;
    }

    usedColorIds.add(player.cor.id);
  });

  const availableColors = shuffle(
    MAGIC_WAR_COLORS.filter((color) => !usedColorIds.has(color.id)),
    randomInt
  );
  room.jogadores.forEach((player) => {
    if (!player.cor) {
      player.cor = availableColors.shift();
    }
  });

  return room.jogadores;
}

function transferMagicWarTargets(assignments, victim, killer) {
  const affectedPlayers = assignments.filter((player) => (
    player.vivo && player.alvoId === victim.id
  ));

  affectedPlayers.forEach((player) => {
    player.alvoId = killer.id;
    player.alvoNome = killer.nome;
    player.alvoCor = killer.cor;
  });

  return affectedPlayers;
}

function createMagicWarAssignments(players, randomInt = crypto.randomInt) {
  if (players.length < MAGIC_WAR_MIN_PLAYERS || players.length > MAGIC_WAR_COLORS.length) {
    return [];
  }

  const orderedPlayers = shuffle(players, randomInt);
  return orderedPlayers.map((player, index) => {
    const target = orderedPlayers[(index + 1) % orderedPlayers.length];
    return {
      id: player.id,
      socketId: player.socketId,
      nome: player.nome,
      papel: 'MagicWar',
      cor: player.cor,
      alvoId: target.id,
      alvoNome: target.nome,
      alvoCor: target.cor,
      vivo: true,
      abates: 0,
    };
  });
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
  const assignedRolesByPlayerId = new Map(
    (room.papeisDesignados || []).map((player) => [player.id, player])
  );

  return {
    jogadores: room.jogadores.map((player) => ({
      id: player.id,
      nome: player.nome,
      connected: player.connected,
      vivo: assignedRolesByPlayerId.get(player.id)?.vivo ?? true,
      cor: room.modoDeJogo === 'magic-war'
        ? player.cor || assignedRolesByPlayerId.get(player.id)?.cor || null
        : null,
    })),
    hostId: room.hostId,
    modoDeJogo: room.modoDeJogo,
    status: room.status,
    resultado: room.resultado,
  };
}

module.exports = {
  DRAWABLE_ROLES,
  MAGIC_WAR_COLORS,
  MAGIC_WAR_MIN_PLAYERS,
  MAX_PLAYERS,
  MIN_PLAYERS,
  OBJECTIVES,
  canStartGame,
  createMagicWarAssignments,
  ensureMagicWarColors,
  generateRoomCode,
  getLobbyPayload,
  getObjective,
  getRoleLabel,
  getRoles,
  normalizePlayerName,
  normalizePlayerId,
  normalizeRole,
  normalizeRoomCode,
  shuffle,
  transferMagicWarTargets,
  validateElimination,
};
