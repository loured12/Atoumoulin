/**
 * Atoumoulin - AI Actions
 *
 * Une Action représente toujours une ACTION COMPLÈTE.
 *
 * Exemple :
 *
 * {
 *   type: "card",
 *   card: 13,
 *   cardIndex: 2,
 *   target: 1,
 *   tableCardIndex: 7
 * }
 *
 * Le moteur stratégique pourra ensuite :
 *
 *   action
 *      ↓
 *   simulation
 *      ↓
 *   évaluation
 *
 * IMPORTANT :
 *
 * Ce fichier ne décide PAS quelle action est meilleure.
 *
 * Son rôle est uniquement :
 *
 * 1. déterminer ce qui est légal ;
 * 2. construire les possibilités complètes ;
 * 3. fournir les paramètres permettant au moteur réel
 *    d'exécuter l'action.
 */

export const ACTION_TYPES = Object.freeze({
  PLAY_CARD: "play_card",
  PLAY_DOUBLE: "play_double",

  CHOOSE_TARGET: "choose_target",
  CHOOSE_TABLE_CARD: "choose_table_card",
  CHOOSE_TABLE_CARDS: "choose_table_cards",

  CHOOSE_21_EFFECT: "choose_21_effect",
  CHOOSE_JOKER_EFFECT: "choose_joker_effect",

  CONTINUE: "continue",
  TERMINATE: "terminate"
});


/* ============================================================
 * UTILITAIRES
 * ========================================================== */

function clone(value) {
  if (
    value === null ||
    value === undefined
  ) {
    return value;
  }

  if (
    typeof structuredClone === "function"
  ) {
    try {
      return structuredClone(value);
    } catch {}
  }

  if (Array.isArray(value)) {
    return value.map(clone);
  }

  if (
    typeof value === "object"
  ) {
    const result = {};

    for (
      const [key, item]
      of Object.entries(value)
    ) {
      result[key] = clone(item);
    }

    return result;
  }

  return value;
}


function sameCard(a, b) {
  return a === b;
}


function isNumberCard(card) {
  return (
    typeof card === "number" &&
    Number.isFinite(card)
  );
}


function isOpponent(
  state,
  index,
  botIndex
) {
  return (
    Number(index) !==
    Number(botIndex)
  );
}


/* ============================================================
 * DOUBLES
 * ========================================================== */

/**
 * Retourne les valeurs pouvant former un double.
 *
 * Une valeur présente 3 fois ou plus ne produit qu'un seul
 * double.
 */
export function findDoubles(hand) {
  const counts = new Map();

  for (const card of hand) {
    counts.set(
      card,
      (counts.get(card) ?? 0) + 1
    );
  }

  const doubles = [];

  for (
    const [card, count]
    of counts.entries()
  ) {
    if (count >= 2) {
      doubles.push(card);
    }
  }

  return doubles;
}


/**
 * Retourne exactement deux indices pour chaque double.
 *
 * Trois 7 donnent donc :
 *
 * [index7a, index7b]
 *
 * et le troisième 7 reste en main.
 */
export function getDoubleIndices(
  hand,
  value
) {
  const result = [];

  for (
    let i = 0;
    i < hand.length;
    i++
  ) {
    if (
      sameCard(
        hand[i],
        value
      )
    ) {
      result.push(i);

      if (result.length === 2) {
        break;
      }
    }
  }

  return result;
}


/* ============================================================
 * PRIORITÉ DES ACTIONS
 * ========================================================== */

/**
 * Détermine les actions de base légalement disponibles.
 *
 * PRIORITÉ EXACTE :
 *
 * 1. Double 7
 * 2. 7 simple
 * 3. Double X
 * 4. Carte simple
 *
 * Une fois qu'une priorité supérieure existe, les catégories
 * inférieures ne sont PAS générées.
 */
export function getBaseActions(
  state,
  botIndex
) {
  const player =
    state.players?.[botIndex];

  if (!player) {
    return [];
  }

  const hand =
    Array.isArray(player.main)
      ? player.main
      : [];

  if (hand.length === 0) {
    return [];
  }


  /* ----------------------------------------------------------
   * 1. DOUBLE 7
   * -------------------------------------------------------- */

  const sevenIndices =
    getDoubleIndices(
      hand,
      7
    );

  if (
    sevenIndices.length >= 2
  ) {
    return [
      createDoubleAction(
        7,
        sevenIndices
      )
    ];
  }


  /* ----------------------------------------------------------
   * 2. 7 SIMPLE
   * -------------------------------------------------------- */

  const sevenIndex =
    hand.findIndex(
      card => card === 7
    );

  if (sevenIndex !== -1) {
    return [
      createCardAction(
        7,
        sevenIndex
      )
    ];
  }


  /* ----------------------------------------------------------
   * 3. DOUBLES
   * -------------------------------------------------------- */

  const doubles =
    findDoubles(hand);

  if (doubles.length > 0) {
    return doubles.map(
      value => {
        const indices =
          getDoubleIndices(
            hand,
            value
          );

        return createDoubleAction(
          value,
          indices
        );
      }
    );
  }


  /* ----------------------------------------------------------
   * 4. CARTES SIMPLES
   * -------------------------------------------------------- */

  return hand.map(
    (card, index) =>
      createCardAction(
        card,
        index
      )
  );
}


/* ============================================================
 * CRÉATION DES ACTIONS
 * ========================================================== */

function createCardAction(
  card,
  cardIndex
) {
  return {
    id:
      `card:${card}:${cardIndex}`,

    type:
      ACTION_TYPES.PLAY_CARD,

    card,

    cardIndex,

    indices: [
      cardIndex
    ],

    complete: true
  };
}


function createDoubleAction(
  card,
  indices
) {
  return {
    id:
      `double:${String(card)}:${indices.join(",")}`,

    type:
      ACTION_TYPES.PLAY_DOUBLE,

    card,

    cardIndex: null,

    indices:
      indices.slice(),

    complete: true
  };
}


/* ============================================================
 * ACTIONS SECONDAIRES
 * ========================================================== */

/**
 * Génère les cibles légales.
 */
export function getAvailableTargets(
  state,
  botIndex,
  predicate = null
) {
  const players =
    state.players ?? [];

  return players
    .filter(
      player =>
        isOpponent(
          state,
          player.id,
          botIndex
        )
    )
    .filter(
      player =>
        !predicate ||
        predicate(player)
    )
    .map(
      player => ({
        id:
          `target:${player.id}`,

        type:
          ACTION_TYPES.CHOOSE_TARGET,

        target:
          player.id,

        complete:
          true
      })
    );
}


/**
 * Cibles possédant au moins une carte à points sur la table.
 *
 * Utilisé notamment par :
 *
 * - 1
 * - Double 1
 * - 13
 * - Double 13
 * - 19
 * - Double 19
 */
export function getPlayersWithPointCards(
  state,
  botIndex
) {
  const table =
    state.table ?? [];

  const players =
    state.players ?? [];

  const result = [];

  for (const player of players) {
    if (
      Number(player.id) ===
      Number(botIndex)
    ) {
      continue;
    }

    const hasCard =
      table.some(
        card =>
          card?.proprietaire ===
            player.name &&
          Number(card?.valeur) !== 0
      );

    if (hasCard) {
      result.push(player.id);
    }
  }

  return result;
}


/**
 * Cibles possédant au moins une carte en main.
 *
 * Utilisé notamment par le 17.
 */
export function getPlayersWithCards(
  state,
  botIndex
) {
  return (
    state.players ?? []
  )
    .filter(
      player =>
        Number(player.id) !==
        Number(botIndex)
    )
    .filter(
      player =>
        Number(player.cardCount) > 0
    )
    .map(
      player =>
        player.id
    );
}


/* ============================================================
 * CARTES DE TABLE
 * ========================================================== */

export function getPointCardsOfPlayer(
  state,
  playerId
) {
  const player =
    state.players?.[playerId];

  if (!player) {
    return [];
  }

  return (
    state.table ?? []
  )
    .map(
      (card, index) => ({
        card,
        index
      })
    )
    .filter(
      ({ card }) =>
        card?.proprietaire ===
          player.name &&
        Number(card?.valeur) !== 0
    );
}


export function getLastPointCardOfPlayer(
  state,
  playerId
) {
  const cards =
    getPointCardsOfPlayer(
      state,
      playerId
    );

  if (cards.length === 0) {
    return null;
  }

  return cards[
    cards.length - 1
  ];
}


/**
 * Le 13 peut choisir une carte adverse.
 */
export function getStealableCards13(
  state,
  targetId
) {
  return getPointCardsOfPlayer(
    state,
    targetId
  ).map(
    ({ card, index }) => ({
      id:
        `card13:${targetId}:${index}`,

      type:
        ACTION_TYPES.CHOOSE_TABLE_CARD,

      target:
        targetId,

      tableCardIndex:
        index,

      value:
        card.valeur,

      complete:
        true
    })
  );
}


/**
 * Le Double 13 peut prendre jusqu'à deux cartes.
 */
export function getStealableCardsDouble13(
  state,
  targetId
) {
  const cards =
    getPointCardsOfPlayer(
      state,
      targetId
    );

  /*
   * Si une seule carte existe,
   * le moteur autorise une seule carte.
   */
  if (cards.length <= 2) {
    return [
      cards.map(
        ({ index }) => index
      )
    ];
  }

  /*
   * Toutes les combinaisons de deux cartes
   * constituent des possibilités distinctes.
   */
  const result = [];

  for (
    let i = 0;
    i < cards.length;
    i++
  ) {
    for (
      let j = i + 1;
      j < cards.length;
      j++
    ) {
      result.push([
        cards[i].index,
        cards[j].index
      ]);
    }
  }

  return result;
}


/* ============================================================
 * 15
 * ========================================================== */

/**
 * Le 15 normal double une carte à points appartenant au bot.
 */
export function getDouble15Targets(
  state,
  botIndex
) {
  return getPointCardsOfPlayer(
    state,
    botIndex
  ).map(
    ({ card, index }) => ({
      id:
        `15:${index}`,

      type:
        ACTION_TYPES.CHOOSE_TABLE_CARD,

      tableCardIndex:
        index,

      value:
        card.valeur,

      complete:
        true
    })
  );
}


/**
 * Double 15 triple une carte appartenant au bot.
 */
export function getDouble15Targets(
  state,
  botIndex
) {
  return getPointCardsOfPlayer(
    state,
    botIndex
  ).map(
    ({ card, index }) => ({
      id:
        `double15:${index}`,

      type:
        ACTION_TYPES.CHOOSE_TABLE_CARD,

      tableCardIndex:
        index,

      value:
        card.valeur,

      complete:
        true
    })
  );
}


/* ============================================================
 * 19
 * ========================================================== */

/**
 * Le 19 échange la dernière carte à points du bot avec
 * la dernière carte à points d'un adversaire.
 */
export function get19Targets(
  state,
  botIndex
) {
  const own =
    getLastPointCardOfPlayer(
      state,
      botIndex
    );

  if (!own) {
    return [];
  }

  const result = [];

  for (
    const player
    of state.players ?? []
  ) {
    if (
      Number(player.id) ===
      Number(botIndex)
    ) {
      continue;
    }

    const target =
      getLastPointCardOfPlayer(
        state,
        player.id
      );

    if (!target) {
      continue;
    }

    result.push({
      id:
        `19:${player.id}`,

      type:
        ACTION_TYPES.CHOOSE_TARGET,

      target:
        player.id,

      ownTableCardIndex:
        own.index,

      targetTableCardIndex:
        target.index,

      complete:
        true
    });
  }

  return result;
}


/* ============================================================
 * 21
 * ========================================================== */

/**
 * Les deux effets possibles du 21 normal.
 */
export function get21Effects() {
  return [
    {
      id:
        "21:+20",

      type:
        ACTION_TYPES.CHOOSE_21_EFFECT,

      value:
        20,

      complete:
        true
    },

    {
      id:
        "21:-20",

      type:
        ACTION_TYPES.CHOOSE_21_EFFECT,

      value:
        -20,

      complete:
        false
    }
  ];
}


/**
 * Cibles nécessaires au -20.
 */
export function get21Targets(
  state,
  botIndex
) {
  return getAvailableTargets(
    state,
    botIndex
  ).map(
    action => ({
      ...action,

      id:
        `21:-20:${action.target}`,

      value:
        -20,

      complete:
        true
    })
  );
}


/**
 * Double 21.
 */
export function getDouble21Effects() {
  return [
    {
      id:
        "double21:+40",

      type:
        ACTION_TYPES.CHOOSE_21_EFFECT,

      value:
        40,

      complete:
        true
    },

    {
      id:
        "double21:-40",

      type:
        ACTION_TYPES.CHOOSE_21_EFFECT,

      value:
        -40,

      complete:
        false
    }
  ];
}


export function getDouble21Targets(
  state,
  botIndex
) {
  return getAvailableTargets(
    state,
    botIndex
  ).map(
    action => ({
      ...action,

      id:
        `double21:-40:${action.target}`,

      value:
        -40,

      complete:
        true
    })
  );
}


/* ============================================================
 * JOKER
 * ========================================================== */

export function getJokerEffects() {
  return [
    {
      id:
        "joker:+10",

      type:
        ACTION_TYPES.CHOOSE_JOKER_EFFECT,

      value:
        10,

      complete:
        true
    },

    {
      id:
        "joker:+22",

      type:
        ACTION_TYPES.CHOOSE_JOKER_EFFECT,

      value:
        22,

      complete:
        true
    },

    {
      id:
        "joker:exchange",

      type:
        ACTION_TYPES.CHOOSE_JOKER_EFFECT,

      value:
        "echange",

      complete:
        false
    }
  ];
}


/* ============================================================
 * ACTIONS EN COURS
 * ========================================================== */

/**
 * Transforme l'état actuel du moteur en possibilités complètes.
 *
 * Cette fonction est fondamentale :
 *
 * generateActions()
 *
 * est appelée :
 *
 * - au début du tour ;
 * - après une action intermédiaire ;
 * - dans les simulations futures.
 */
export function generateActions(
  state,
  botIndex
) {
  if (!state) {
    return [];
  }

  const action =
    state.action;

  /*
   * ----------------------------------------------------------
   * Début de tour
   * --------------------------------------------------------
   */

  if (
    action === null ||
    action === undefined
  ) {
    return getBaseActions(
      state,
      botIndex
    );
  }


  /*
   * ----------------------------------------------------------
   * 1 / Double 1
   * --------------------------------------------------------
   */

  if (
    action === "vol1" ||
    action === "double1"
  ) {
    const targets =
      getPlayersWithPointCards(
        state,
        botIndex
      );

    return targets.map(
      target => ({
        id:
          `${action}:${target}`,

        type:
          ACTION_TYPES.CHOOSE_TARGET,

        target,

        complete:
          true
      })
    );
  }


  /*
   * ----------------------------------------------------------
   * 3 / Double 3
   * --------------------------------------------------------
   */

  if (
    action === "carte3" ||
    action === "double3"
  ) {
    return getAvailableTargets(
      state,
      botIndex
    );
  }


  /*
   * ----------------------------------------------------------
   * 9
   * --------------------------------------------------------
   */

  if (
    action === "carte9" ||
    action === "double9"
  ) {
    return getAvailableTargets(
      state,
      botIndex
    );
  }


  /*
   * ----------------------------------------------------------
   * 13
   * --------------------------------------------------------
   */

  if (
    action === "carte13"
  ) {
    return getAvailableTargets(
      state,
      botIndex
    )
      .filter(
        target =>
          getStealableCards13(
            state,
            target.target
          ).length > 0
      )
      .map(
        target => ({
          ...target,

          id:
            `13:${target.target}`,

          type:
            ACTION_TYPES.CHOOSE_TARGET
        })
      );
  }


  /*
   * ----------------------------------------------------------
   * 13 : choix de carte
   * --------------------------------------------------------
   */

  if (
    action === "carte13choix"
  ) {
    /*
     * La cible est conservée dans l'état du moteur.
     */
    const target =
      state.target;

    if (
      target === null ||
      target === undefined
    ) {
      return [];
    }

    return getStealableCards13(
      state,
      target
    );
  }


  /*
   * ----------------------------------------------------------
   * Double 13
   * --------------------------------------------------------
   */

  if (
    action === "double13"
  ) {
    return getAvailableTargets(
      state,
      botIndex
    )
      .filter(
        target =>
          getStealableCards13(
            state,
            target.target
          ).length > 0
      )
      .map(
        target => ({
          ...target,

          id:
            `double13:${target.target}`
        })
      );
  }


  if (
    action === "double13choix"
  ) {
    const target =
      state.target;

    if (
      target === null ||
      target === undefined
    ) {
      return [];
    }

    return getStealableCardsDouble13(
      state,
      target
    ).map(
      indices => ({
        id:
          `double13:${target}:${indices.join(",")}`,

        type:
          ACTION_TYPES.CHOOSE_TABLE_CARDS,

        target,

        tableCardIndices:
          indices,

        complete:
          true
      })
    );
  }


  /*
   * ----------------------------------------------------------
   * 15
   * --------------------------------------------------------
   */

  if (
    action === "carte15"
  ) {
    return getDouble15Targets(
      state,
      botIndex
    );
  }


  /*
   * ----------------------------------------------------------
   * Double 15
   * --------------------------------------------------------
   */

  if (
    action === "double15"
  ) {
    return getDouble15Targets(
      state,
      botIndex
    );
  }


  /*
   * ----------------------------------------------------------
   * 17
   * --------------------------------------------------------
   */

  if (
    action === "carte17"
  ) {
    return getPlayersWithCards(
      state,
      botIndex
    ).map(
      target => ({
        id:
          `17:${target}`,

        type:
          ACTION_TYPES.CHOOSE_TARGET,

        target,

        complete:
          true
      })
    );
  }


  /*
   * ----------------------------------------------------------
   * 17 révélé
   * --------------------------------------------------------
   *
   * Aucune décision stratégique supplémentaire n'est nécessaire
   * ici : la carte volée doit être jouée.
   */

  if (
    action === "carte17revelee"
  ) {
    return [
      {
        id:
          "17:continue",

        type:
          ACTION_TYPES.CONTINUE,

        complete:
          true
      }
    ];
  }


  /*
   * ----------------------------------------------------------
   * Double 17
   * --------------------------------------------------------
   */

  if (
    action === "double17"
  ) {
    return getPlayersWithCards(
      state,
      botIndex
    ).map(
      target => ({
        id:
          `double17:${target}`,

        type:
          ACTION_TYPES.CHOOSE_TARGET,

        target,

        complete:
          true
      })
    );
  }


  /*
   * ----------------------------------------------------------
   * Double 17 : cartes révélées
   * --------------------------------------------------------
   */

  if (
    action === "double17revelee"
  ) {
    const cards =
      Array.isArray(
        state.double17Cards
      )
        ? state.double17Cards
        : [];

    return cards.map(
      (_, index) => ({
        id:
          `double17:card:${index}`,

        type:
          ACTION_TYPES.CHOOSE_TABLE_CARD,

        cardIndex:
          index,

        complete:
          true
      })
    );
  }


  /*
   * ----------------------------------------------------------
   * Double 17 : jouer
   * --------------------------------------------------------
   */

  if (
    action === "double17jouer"
  ) {
    return [
      {
        id:
          "double17:continue",

        type:
          ACTION_TYPES.CONTINUE,

        complete:
          true
      }
    ];
  }


  /*
   * ----------------------------------------------------------
   * 19
   * --------------------------------------------------------
   */

  if (
    action === "carte19"
  ) {
    return get19Targets(
      state,
      botIndex
    );
  }


  /*
   * ----------------------------------------------------------
   * Double 19
   * --------------------------------------------------------
   */

  if (
    action === "double19"
  ) {
    return getAvailableTargets(
      state,
      botIndex
    )
      .filter(
        target =>
          getPointCardsOfPlayer(
            state,
            target.target
          ).length > 0
      )
      .map(
        target => ({
          ...target,

          id:
            `double19:${target.target}`
        })
      );
  }


  /*
   * ----------------------------------------------------------
   * 21
   * --------------------------------------------------------
   */

  if (
    action === "carte21"
  ) {
    return get21Effects();
  }


  if (
    action === "carte21cible"
  ) {
    return get21Targets(
      state,
      botIndex
    );
  }


  /*
   * ----------------------------------------------------------
   * Double 21
   * --------------------------------------------------------
   */

  if (
    action === "double21"
  ) {
    return getDouble21Effects();
  }


  if (
    action === "double21cible"
  ) {
    return getDouble21Targets(
      state,
      botIndex
    );
  }


  /*
   * ----------------------------------------------------------
   * Joker
   * --------------------------------------------------------
   */

  if (
    action === "joker"
  ) {
    return getJokerEffects();
  }


  /*
   * ----------------------------------------------------------
   * Autres étapes
   * --------------------------------------------------------
   */

  if (
    action === "doubleJoker"
  ) {
    return [];
  }


  /*
   * Une action inconnue n'est jamais inventée.
   */
  return [];
}


/* ============================================================
 * VALIDATION
 * ========================================================== */

/**
 * Vérifie qu'une action générée appartient bien aux possibilités
 * produites par le générateur.
 *
 * Utile pour empêcher le moteur stratégique de fabriquer lui-même
 * une action illégale.
 */
export function isGeneratedActionLegal(
  state,
  botIndex,
  candidate
) {
  if (!candidate) {
    return false;
  }

  const actions =
    generateActions(
      state,
      botIndex
    );

  return actions.some(
    action =>
      action.id ===
      candidate.id
  );
}


/**
 * Toutes les possibilités doivent être complètes avant
 * d'être envoyées à l'évaluation stratégique.
 */
export function assertCompleteActions(
  actions
) {
  for (const action of actions) {
    if (!action.complete) {
      throw new Error(
        `Action incomplète détectée : ${action.id}`
      );
    }
  }

  return true;
}
