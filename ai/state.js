// ai/state.js

/**
 * État interne utilisé par la nouvelle IA Atoumoulin.
 *
 * IMPORTANT :
 * - Ce fichier ne modifie jamais l'état réel du jeu.
 * - Il ne révèle aucune information masquée.
 * - Il fonctionne à partir de l'état fourni par AtoumoulinEngine.stateFor().
 */

export const AI_STATE_VERSION = 1;

/**
 * Crée une copie profonde simple d'une valeur JSON-compatible.
 */
export function clone(value) {
  if (value === undefined || value === null) {
    return value;
  }

  return JSON.parse(JSON.stringify(value));
}

/**
 * Retourne l'index numérique d'un joueur.
 */
export function normalizePlayerIndex(value) {
  const index = Number(value);

  if (!Number.isInteger(index) || index < 0) {
    throw new Error(`Index joueur invalide : ${value}`);
  }

  return index;
}

/**
 * Vérifie qu'un état possède la structure minimale attendue.
 */
export function assertValidState(state) {
  if (!state || typeof state !== "object") {
    throw new Error("État IA invalide.");
  }

  if (!Array.isArray(state.players)) {
    throw new Error("État IA invalide : players manquant.");
  }

  if (!Number.isInteger(Number(state.currentPlayer))) {
    throw new Error("État IA invalide : currentPlayer manquant.");
  }

  if (!Array.isArray(state.table)) {
    throw new Error("État IA invalide : table manquante.");
  }

  if (!Array.isArray(state.discard)) {
    throw new Error("État IA invalide : discard manquant.");
  }
}

/**
 * Retourne le joueur demandé.
 */
export function getPlayer(state, playerIndex) {
  assertValidState(state);

  const index = normalizePlayerIndex(playerIndex);
  const player = state.players[index];

  if (!player) {
    throw new Error(`Joueur introuvable : ${index}`);
  }

  return player;
}

/**
 * Retourne le joueur contrôlé par l'IA.
 */
export function getSelf(state, playerIndex) {
  return getPlayer(state, playerIndex);
}

/**
 * Retourne tous les adversaires.
 */
export function getOpponents(state, playerIndex) {
  assertValidState(state);

  const selfIndex = normalizePlayerIndex(playerIndex);

  return state.players.filter(
    (_, index) => index !== selfIndex
  );
}

/**
 * Retourne les adversaires pouvant être ciblés.
 */
export function getTargetableOpponents(state, playerIndex) {
  return getOpponents(state, playerIndex).filter(
    player => player.id !== playerIndex
  );
}

/**
 * Retourne les cartes connues de la main du joueur.
 *
 * Une carte null représente une carte inconnue.
 */
export function getKnownHand(player) {
  if (!player || !Array.isArray(player.main)) {
    return [];
  }

  return player.main.filter(card => card !== null);
}

/**
 * Indique si le contenu complet de la main est connu.
 */
export function isHandKnown(player) {
  if (!player || !Array.isArray(player.main)) {
    return false;
  }

  return !player.main.some(card => card === null);
}

/**
 * Nombre de cartes connues dans une main.
 */
export function knownCardCount(player) {
  return getKnownHand(player).length;
}

/**
 * Retourne les indices connus d'une valeur de carte.
 */
export function findKnownCardIndices(player, value) {
  if (!player || !Array.isArray(player.main)) {
    return [];
  }

  const indices = [];

  for (let i = 0; i < player.main.length; i++) {
    if (player.main[i] === value) {
      indices.push(i);
    }
  }

  return indices;
}

/**
 * Retourne les valeurs possédées au moins deux fois.
 *
 * Les cartes inconnues ne sont jamais prises en compte.
 */
export function findKnownDoubles(player) {
  const counts = new Map();

  for (const card of getKnownHand(player)) {
    const key = String(card);
    counts.set(key, (counts.get(key) || 0) + 1);
  }

  const doubles = [];

  for (const [key, count] of counts.entries()) {
    if (count >= 2) {
      doubles.push(parseCardValue(key));
    }
  }

  return doubles;
}

/**
 * Retourne le nombre d'occurrences connues d'une carte.
 */
export function knownCardOccurrences(player, value) {
  return findKnownCardIndices(player, value).length;
}

/**
 * Convertit une valeur de carte sérialisée en valeur utilisable.
 */
function parseCardValue(value) {
  if (value === "Joker") {
    return "Joker";
  }

  const number = Number(value);

  return Number.isNaN(number)
    ? value
    : number;
}

/**
 * Retourne les cartes de table appartenant à un joueur.
 */
export function getPlayerTableCards(state, playerIndex) {
  assertValidState(state);

  const player = getPlayer(state, playerIndex);

  return state.table
    .map((card, index) => ({
      ...card,
      __tableIndex: index
    }))
    .filter(card => {
      return (
        card.proprietaire === player.name ||
        card.playerId === player.id
      );
    });
}

/**
 * Retourne uniquement les cartes de points.
 *
 * Dans le moteur actuel, les effets 13/15/19 utilisent les cartes
 * dont la valeur n'est pas 0 comme cartes de points éligibles.
 */
export function getPlayerPointCards(state, playerIndex) {
  return getPlayerTableCards(state, playerIndex).filter(
    card => Number(card.valeur) !== 0
  );
}

/**
 * Retourne les cartes de points d'un adversaire.
 */
export function getOpponentPointCards(state, playerIndex) {
  return getOpponents(state, playerIndex).map(player => ({
    player,
    cards: getPlayerPointCards(state, player.id)
  }));
}

/**
 * Retourne la dernière carte de points connue d'un joueur.
 */
export function getLatestPointCard(state, playerIndex) {
  const cards = getPlayerPointCards(state, playerIndex);

  if (cards.length === 0) {
    return null;
  }

  return cards[cards.length - 1];
}

/**
 * Retourne les deux dernières cartes de points connues.
 */
export function getLatestPointCards(state, playerIndex, count = 2) {
  const cards = getPlayerPointCards(state, playerIndex);

  return cards.slice(Math.max(0, cards.length - count));
}

/**
 * Retourne les cartes de points que l'IA peut réellement choisir.
 */
export function getSelectablePointCards(state, playerIndex) {
  return getPlayerPointCards(state, playerIndex)
    .filter(card => card.__tableIndex !== undefined);
}

/**
 * Retourne une copie propre de l'état.
 */
export function cloneState(state) {
  assertValidState(state);

  return clone(state);
}

/**
 * Crée un état de simulation indépendant.
 */
export function createSimulationState(state) {
  const simulation = cloneState(state);

  simulation.__simulation = true;
  simulation.__parentState = undefined;

  return simulation;
}

/**
 * Marque l'état comme étant observé par un joueur précis.
 */
export function createKnowledgeState(state, playerIndex) {
  assertValidState(state);

  const knowledge = cloneState(state);

  knowledge.observer = normalizePlayerIndex(playerIndex);

  return knowledge;
}

/**
 * Retourne les informations visibles par l'IA.
 *
 * Cette fonction ne tente jamais de reconstruire les cartes cachées.
 */
export function getVisibleState(state, playerIndex) {
  assertValidState(state);

  const observer = normalizePlayerIndex(playerIndex);
  const visible = cloneState(state);

  visible.observer = observer;

  visible.players = visible.players.map(player => {
    if (player.id === observer) {
      return player;
    }

    /*
     * Les cartes null sont déjà masquées par AtoumoulinEngine.
     *
     * On conserve volontairement cette information telle quelle.
     * L'IA connaît la quantité de cartes, pas leur contenu.
     */
    player.main = Array.isArray(player.main)
      ? player.main.map(card => card === null ? null : card)
      : [];

    return player;
  });

  return visible;
}

/**
 * Retourne le nombre total de cartes actuellement détenues
 * par les joueurs.
 */
export function getCardsInHandsCount(state) {
  assertValidState(state);

  return state.players.reduce(
    (total, player) => total + Number(player.cardCount || 0),
    0
  );
}

/**
 * Nombre total de cartes de la partie selon le nombre de joueurs.
 */
export function getTotalDeckSize(playerCount) {
  const count = Number(playerCount);

  if (count <= 0) {
    throw new Error("Nombre de joueurs invalide.");
  }

  if (count <= 3) {
    return 44;
  }

  return (count - 1) * 22;
}

/**
 * Nombre de cartes déjà sorties du paquet.
 *
 * Cela inclut :
 * - cartes en main ;
 * - cartes sur la table ;
 * - cartes de défausse ;
 * - cartes éventuellement révélées par certains effets.
 */
export function getCardsOut(state) {
  assertValidState(state);

  return (
    getCardsInHandsCount(state) +
    state.table.length +
    state.discard.length
  );
}

/**
 * Progression globale de la partie.
 *
 * Valeur comprise entre 0 et 1.
 */
export function getGameProgress(state) {
  const total = getTotalDeckSize(state.players.length);
  const out = getCardsOut(state);

  if (total <= 0) {
    return 0;
  }

  return Math.min(1, Math.max(0, out / total));
}

/**
 * Phase approximative de la partie.
 */
export function getGamePhase(state) {
  const progress = getGameProgress(state);

  if (progress < 0.25) {
    return "debut";
  }

  if (progress < 0.55) {
    return "milieu";
  }

  if (progress < 0.80) {
    return "fin";
  }

  return "endgame";
}

/**
 * Distance au score cible.
 */
export function getTargetDistance(state, playerIndex) {
  const player = getPlayer(state, playerIndex);

  if (typeof player.score !== "number") {
    return Infinity;
  }

  const target = getVictoryTarget(state);

  return target - player.score;
}

/**
 * Détermine le score cible.
 *
 * Le moteur actuel utilise :
 * 2-3 joueurs : 120
 * 4 joueurs : 160
 * 5 joueurs : 200
 * 6 joueurs : 220
 * 7 joueurs : 240
 * 8 joueurs : 260
 */
export function getVictoryTarget(state) {
  const count = state.players.length;

  switch (count) {
    case 2:
    case 3:
      return 120;

    case 4:
      return 160;

    case 5:
      return 200;

    case 6:
      return 220;

    case 7:
      return 240;

    case 8:
      return 260;

    default:
      throw new Error(
        `Nombre de joueurs non supporté : ${count}`
      );
  }
}

/**
 * Indique si un joueur est exactement sur le score cible.
 */
export function hasExactTarget(state, playerIndex) {
  return (
    getPlayer(state, playerIndex).score ===
    getVictoryTarget(state)
  );
}

/**
 * Indique si un joueur a dépassé la cible.
 */
export function isAboveTarget(state, playerIndex) {
  return (
    getPlayer(state, playerIndex).score >
    getVictoryTarget(state)
  );
}

/**
 * Retourne un résumé minimal de l'état.
 *
 * Utile pour les logs et le debug de l'IA.
 */
export function summarizeState(state, playerIndex) {
  const self = getSelf(state, playerIndex);

  return {
    version: AI_STATE_VERSION,

    observer: Number(playerIndex),

    currentPlayer: Number(state.currentPlayer),

    targetScore: getVictoryTarget(state),

    gameProgress: getGameProgress(state),

    gamePhase: getGamePhase(state),

    self: {
      id: self.id,
      name: self.name,
      score: self.score,
      cardCount: self.cardCount,
      knownHand: getKnownHand(self),
      knownDoubles: findKnownDoubles(self)
    },

    opponents: getOpponents(state, playerIndex).map(
      player => ({
        id: player.id,
        name: player.name,
        score: player.score,
        cardCount: player.cardCount,
        handKnown: isHandKnown(player),
        knownHand: getKnownHand(player)
      })
    ),

    deckCount: state.deckCount,

    tableCount: state.table.length,

    discardCount: state.discard.length,

    action: state.action,

    roundEnded: !!state.roundEnded
  };
}
