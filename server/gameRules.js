const crypto = require('crypto');

const ROOM_CODE_SIZE = 4;
const MIN_PLAYERS = 5;
const MAX_PLAYERS = 7;
const MAGIC_WAR_MIN_PLAYERS = 3;
const DEFAULT_LIFE = 40;
const KING_LIFE = 50;
const COMMANDER_DAMAGE_LIMIT = 21;
const MAX_COMBAT_HISTORY = 30;
const MAX_PUBLIC_COMBAT_LOG = 8;
const PARTNER_COMMANDER_SUFFIX = ':partner';

const MAGIC_WAR_COLORS = [
  { id: 'white', nome: 'Branco', hex: '#f4efd8', textColor: '#171717' },
  { id: 'blue', nome: 'Azul', hex: '#4b9fe8', textColor: '#ffffff' },
  { id: 'black', nome: 'Preto', hex: '#000000', textColor: '#ffffff' },
  { id: 'red', nome: 'Vermelho', hex: '#df4c4c', textColor: '#ffffff' },
  { id: 'green', nome: 'Verde', hex: '#48a868', textColor: '#ffffff' },
  { id: 'colorless', nome: 'Incolor', hex: '#aeb4b8', textColor: '#171717' },
  { id: 'gold', nome: 'Dourado', hex: '#d4a83f', textColor: '#171717' },
];

const OBJECTIVES = {
  Rei: 'Voce comeca com 50 de vida. Sua equipe vence quando os dois Assassinos forem eliminados.',
  Cavaleiro: 'Mantenha o Rei vivo. Se a equipe do Rei vencer, voce vence junto.',
  Assassino: 'Elimine o Rei ao lado do outro Assassino. Se o Usurpador der o golpe final, a partida continua.',
  Usurpador: 'De o golpe final no Rei. Voce ganha 10 de vida, assume a coroa e passa a jogar como o novo Rei.',
  Cacador: 'De o golpe final em dois jogadores que nao sejam o Rei.',
  Coringa: 'Tente ser o primeiro eliminado. Se nao conseguir, elimine alguem para assumir o papel e o objetivo dessa pessoa, exceto o Rei.',
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

function setMagicWarColor(room, playerId, colorId) {
  const player = room.jogadores.find((item) => item.id === playerId);
  const color = MAGIC_WAR_COLORS.find((item) => item.id === colorId);
  if (!player || !color) return false;

  const colorInUse = room.jogadores.some((item) => (
    item.id !== playerId && item.cor?.id === colorId
  ));
  if (colorInUse) return false;

  player.cor = color;
  return true;
}

function setMagicWarSurvivalObjective(assignments, victim) {
  const affectedPlayers = assignments.filter((player) => (
    player.vivo && player.alvoId === victim.id
  ));

  affectedPlayers.forEach((player) => {
    player.alvoId = null;
    player.alvoNome = null;
    player.alvoCor = null;
    player.objetivoSobrevivencia = true;
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
      objetivoSobrevivencia: false,
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

function initializeCombatState(room) {
  const assignedRoles = new Map(
    (room.papeisDesignados || []).map((assignedRole) => [assignedRole.id, assignedRole.papel])
  );

  room.jogadores.forEach((player) => {
    player.vida = assignedRoles.get(player.id) === 'Rei' ? KING_LIFE : DEFAULT_LIFE;
    player.danoComandante = {};
    player.commanderCount = 1;
  });
  room.combatHistory = [];
  room.combatSequence = 0;
}

function applyLifeBonus(player, amount) {
  if (!player || !Number.isInteger(amount) || amount <= 0) return false;

  const currentLife = Number.isInteger(player.vida) ? player.vida : DEFAULT_LIFE;
  player.vida = Math.min(999, currentLife + amount);
  return true;
}

function adjustPlayerLife(player, delta) {
  if (!player || ![-5, -1, 1, 5].includes(delta)) return false;

  const currentLife = Number.isInteger(player.vida) ? player.vida : DEFAULT_LIFE;
  player.vida = Math.max(-999, Math.min(999, currentLife + delta));
  return true;
}

function getCommanderOwnerId(commanderId) {
  return commanderId.endsWith(PARTNER_COMMANDER_SUFFIX)
    ? commanderId.slice(0, -PARTNER_COMMANDER_SUFFIX.length)
    : commanderId;
}

function adjustCommanderDamage(player, commanderId, delta, players) {
  if (!player || !commanderId || ![-1, 1].includes(delta)) return false;

  const commanderOwnerId = getCommanderOwnerId(commanderId);
  const commanderOwner = players.find((item) => item.id === commanderOwnerId);
  const isPartnerCommander = commanderId.endsWith(PARTNER_COMMANDER_SUFFIX);
  if (!commanderOwner || (isPartnerCommander && commanderOwner.commanderCount !== 2)) return false;

  player.danoComandante = player.danoComandante || {};
  const currentDamage = Number.isInteger(player.danoComandante[commanderId])
    ? player.danoComandante[commanderId]
    : 0;
  const nextDamage = Math.max(0, Math.min(999, currentDamage + delta));
  const appliedDelta = nextDamage - currentDamage;
  player.danoComandante[commanderId] = nextDamage;

  const currentLife = Number.isInteger(player.vida) ? player.vida : DEFAULT_LIFE;
  player.vida = Math.max(-999, Math.min(999, currentLife - appliedDelta));
  return true;
}

function addPartnerCommander(room, playerId) {
  const player = room?.jogadores?.find((item) => item.id === playerId);
  if (!player) return false;

  player.commanderCount = 2;
  return true;
}

function recordCombatChange(room, change) {
  if (!room || !change?.playerId || !['life', 'commander'].includes(change.type)) return false;

  room.combatHistory = Array.isArray(room.combatHistory) ? room.combatHistory : [];
  room.combatSequence = Number.isInteger(room.combatSequence) ? room.combatSequence + 1 : 1;
  room.combatHistory.push({
    ...change,
    id: String(room.combatSequence),
    createdAt: Date.now(),
  });
  if (room.combatHistory.length > MAX_COMBAT_HISTORY) {
    room.combatHistory.splice(0, room.combatHistory.length - MAX_COMBAT_HISTORY);
  }
  return true;
}

function undoLastCombatChange(room, playerId) {
  if (!room || !playerId || !Array.isArray(room.combatHistory)) return null;

  const historyIndex = room.combatHistory.findLastIndex((change) => change.playerId === playerId);
  if (historyIndex === -1) return null;

  const change = room.combatHistory[historyIndex];
  const player = room.jogadores.find((item) => item.id === playerId);
  if (!player) return null;

  player.vida = change.beforeLife;
  if (change.type === 'commander') {
    player.danoComandante = player.danoComandante || {};
    player.danoComandante[change.commanderId] = change.beforeDamage;
  }

  room.combatHistory.splice(historyIndex, 1);
  return change;
}

function resetRoomForLobby(room) {
  if (!room) return false;

  room.status = 'lobby';
  room.resultado = null;
  room.papeisDesignados = null;
  room.historicoMortes = [];
  initializeCombatState(room);
  return true;
}

function getPublicCombatLog(room) {
  if (!Array.isArray(room.combatHistory)) return [];

  const playersById = new Map(room.jogadores.map((player) => [player.id, player]));
  return room.combatHistory.slice(-MAX_PUBLIC_COMBAT_LOG).map((change, index) => {
    const player = playersById.get(change.playerId);
    const baseEntry = {
      id: change.id || `${change.createdAt}-${index}-${change.playerId}`,
      type: change.type,
      playerId: change.playerId,
      playerName: player?.nome || 'Jogador',
      lifeAfter: change.afterLife,
      createdAt: change.createdAt,
    };

    if (change.type === 'life') {
      return {
        ...baseEntry,
        delta: change.afterLife - change.beforeLife,
      };
    }

    const commanderOwnerId = getCommanderOwnerId(change.commanderId);
    const commanderOwner = playersById.get(commanderOwnerId);
    const isPartner = change.commanderId.endsWith(PARTNER_COMMANDER_SUFFIX);
    return {
      ...baseEntry,
      delta: change.afterDamage - change.beforeDamage,
      commanderName: commanderOwner
        ? `${commanderOwner.nome}${isPartner ? ' (Parceiro)' : ''}`
        : 'Comandante',
      commanderDamageAfter: change.afterDamage,
    };
  }).reverse();
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
      vida: Number.isInteger(player.vida) ? player.vida : DEFAULT_LIFE,
      danoComandante: player.danoComandante || {},
      commanderCount: player.commanderCount === 2 ? 2 : 1,
      canUndoCombat: Array.isArray(room.combatHistory)
        && room.combatHistory.some((change) => change.playerId === player.id),
      cor: room.modoDeJogo === 'magic-war'
        ? player.cor || assignedRolesByPlayerId.get(player.id)?.cor || null
        : null,
    })),
    hostId: room.hostId,
    modoDeJogo: room.modoDeJogo,
    status: room.status,
    resultado: room.resultado,
    coresMagicWar: room.modoDeJogo === 'magic-war' ? MAGIC_WAR_COLORS : [],
    combatLog: getPublicCombatLog(room),
  };
}

module.exports = {
  COMMANDER_DAMAGE_LIMIT,
  DEFAULT_LIFE,
  KING_LIFE,
  DRAWABLE_ROLES,
  MAGIC_WAR_COLORS,
  MAGIC_WAR_MIN_PLAYERS,
  MAX_PLAYERS,
  MIN_PLAYERS,
  OBJECTIVES,
  addPartnerCommander,
  applyLifeBonus,
  canStartGame,
  adjustCommanderDamage,
  adjustPlayerLife,
  createMagicWarAssignments,
  ensureMagicWarColors,
  generateRoomCode,
  getLobbyPayload,
  getObjective,
  getRoleLabel,
  getRoles,
  initializeCombatState,
  normalizePlayerName,
  normalizePlayerId,
  normalizeRole,
  normalizeRoomCode,
  resetRoomForLobby,
  recordCombatChange,
  shuffle,
  setMagicWarColor,
  setMagicWarSurvivalObjective,
  undoLastCombatChange,
  validateElimination,
};
