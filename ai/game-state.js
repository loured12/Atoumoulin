/**
 * Atoumoulin - nouvel état de jeu pour l'IA
 *
 * Ce fichier ne modifie PAS le moteur actuel.
 *
 * Il fournit une représentation indépendante de l'état du jeu
 * destinée à :
 *
 *   - l'IA
 *   - la simulation
 *   - la recherche
 *   - l'évaluation
 *
 * Il peut être construit directement à partir de l'état exposé
 * par script.js / engine.js.
 */

export class GameState {
  constructor(data = {}) {
    this.players = normalizePlayers(data.players);

    this.deckCount = toNonNegativeInteger(
      data.deckCount ?? 0
    );

    this.table = cloneArray(
      data.table
    );

    this.discard = cloneArray(
      data.discard
    );

    this.history =
      typeof data.history === "string"
        ? data.history
        : "";

    this.currentPlayer =
      normalizeIndex(
        data.currentPlayer,
        this.players.length
      );

    this.action =
      data.action ?? null;

    this.target =
      data.target == null
        ? null
        : Number(data.target);

    this.selection =
      cloneValue(data.selection);

    this.toursJoker =
      cloneValue(data.toursJoker ?? {});

    this.winner =
      data.winner ?? null;

    this.roundWinner =
      data.roundWinner ?? null;

    this.roundEnded =
      Boolean(data.roundEnded);

    this.player17 =
      data.player17 == null
        ? null
        : Number(data.player17);

    this.card17Pending =
      cloneValue(data.card17Pending);

    this.double17Cards =
      cloneArray(data.double17Cards);

    this.double17Active =
      Boolean(data.double17Active);

    this.player19 =
      data.player19 == null
        ? null
        : Number(data.player19);

    this.victories =
      cloneValue(data.victories ?? []);

    this.modeJeu =
      Number(data.modeJeu ?? 1);

    /*
     * Informations complémentaires utiles à l'IA.
     */
    this.botIndex =
      data.botIndex == null
        ? null
        : Number(data.botIndex);

    this.targetScore =
      data.targetScore ??
      calculateTargetScore(
        this.players.length
      );

    this.totalCards =
      data.totalCards ??
      calculateTotalCards(
        this.players.length
      );

    this.cardsPlayed =
      data.cardsPlayed ??
      calculateVisibleProgressCards(this);

    this.progression =
      this.totalCards > 0
        ? clamp(
            this.cardsPlayed /
              this.totalCards,
            0,
            1
          )
        : 0;

    this.roundFinished =
      Boolean(
        data.roundFinished ??
        data.roundEnded
      );
  }

  /**
   * Création depuis l'état renvoyé par
   * __atoumoulinGetState().
   *
   * Le format réel de script.js est accepté directement.
   */
  static fromRaw(raw, botIndex = null) {
    if (!raw) {
      throw new Error(
        "GameState.fromRaw : état absent."
      );
    }

    const players =
      Array.isArray(raw.joueurs)
        ? raw.joueurs.map(
            (player, index) => ({
              id: index,
              name:
                player.nom ??
                `Joueur ${index + 1}`,

              score:
                Number(player.score ?? 0),

              bot:
                Boolean(player.bot),

              /*
               * Une main peut contenir des null lorsque
               * l'information est masquée.
               */
              main:
                Array.isArray(player.main)
                  ? player.main.slice()
                  : [],

              cardCount:
                player.cardCount != null
                  ? Number(player.cardCount)
                  : Array.isArray(player.main)
                    ? player.main.length
                    : 0
            })
          )
        : [];

    const state = new GameState({
      players,

      deckCount:
        Array.isArray(raw.paquet)
          ? raw.paquet.length
          : Number(raw.deckCount ?? 0),

      table:
        raw.cartesTable ??
        raw.table ??
        [],

      discard:
        raw.defaussePouvoirs ??
        raw.discard ??
        [],

      history:
        String(
          raw.historique ??
          raw.history ??
          ""
        ),

      currentPlayer:
        raw.joueurActuel,

      action:
        raw.actionEnCours,

      target:
        raw.cibleChoisie,

      selection:
        raw.selection,

      toursJoker:
        raw.toursJoker,

      winner:
        normalizeWinner(
          raw.gagnantPartie,
          players
        ),

      roundWinner:
        normalizeRoundWinner(
          raw.gagnantManche,
          players
        ),

      roundEnded:
        Boolean(
          raw.mancheTerminee
        ),

      player17:
        raw.joueur17,

      card17Pending:
        raw.carte17EnAttente,

      double17Cards:
        raw.cartesDouble17,

      double17Active:
        Boolean(
          raw.double17EnCours
        ),

      player19:
        raw.joueur19,

      victories:
        raw.victoires,

      modeJeu:
        raw.modeJeu,

      botIndex
    });

    return state;
  }

  /**
   * Création depuis l'état déjà filtré renvoyé par
   * AtoumoulinEngine.stateFor().
   */
  static fromView(view, botIndex = null) {
    if (!view) {
      throw new Error(
        "GameState.fromView : vue absente."
      );
    }

    return new GameState({
      ...view,
      botIndex
    });
  }

  /**
   * Copie indépendante complète.
   *
   * Cette méthode est essentielle pour la simulation.
   *
   * Une simulation ne doit JAMAIS modifier l'état réel.
   */
  clone() {
    return new GameState({
      players:
        this.players.map(
          player => ({
            ...player,
            main:
              player.main.slice()
          })
        ),

      deckCount:
        this.deckCount,

      table:
        cloneArray(this.table),

      discard:
        cloneArray(this.discard),

      history:
        this.history,

      currentPlayer:
        this.currentPlayer,

      action:
        this.action,

      target:
        this.target,

      selection:
        cloneValue(this.selection),

      toursJoker:
        cloneValue(this.toursJoker),

      winner:
        cloneValue(this.winner),

      roundWinner:
        cloneValue(this.roundWinner),

      roundEnded:
        this.roundEnded,

      player17:
        this.player17,

      card17Pending:
        cloneValue(
          this.card17Pending
        ),

      double17Cards:
        cloneArray(
          this.double17Cards
        ),

      double17Active:
        this.double17Active,

      player19:
        this.player19,

      victories:
        cloneValue(
          this.victories
        ),

      modeJeu:
        this.modeJeu,

      botIndex:
        this.botIndex,

      targetScore:
        this.targetScore,

      totalCards:
        this.totalCards,

      cardsPlayed:
        this.cardsPlayed,

      progression:
        this.progression,

      roundFinished:
        this.roundFinished
    });
  }

  /**
   * ----------------------------------------------------------
   * JOUEURS
   * ----------------------------------------------------------
   */

  getPlayer(index) {
    const i = Number(index);

    if (!Number.isInteger(i)) {
      return null;
    }

    return this.players[i] ?? null;
  }

  getSelf() {
    if (this.botIndex == null) {
      return null;
    }

    return this.getPlayer(
      this.botIndex
    );
  }

  getOpponents() {
    if (this.botIndex == null) {
      return this.players.slice();
    }

    return this.players.filter(
      player =>
        player.id !== this.botIndex
    );
  }

  getOpponent(index) {
    if (
      Number(index) ===
      Number(this.botIndex)
    ) {
      return null;
    }

    return this.getPlayer(index);
  }

  /**
   * ----------------------------------------------------------
   * MAINS
   * ----------------------------------------------------------
   */

  getOwnHand() {
    const player =
      this.getSelf();

    if (!player) {
      return [];
    }

    return player.main.filter(
      card => card !== null
    );
  }

  getHand(index) {
    const player =
      this.getPlayer(index);

    if (!player) {
      return [];
    }

    return player.main.slice();
  }

  getCardCount(index) {
    const player =
      this.getPlayer(index);

    if (!player) {
      return 0;
    }

    return Number(
      player.cardCount ??
      player.main.length
    );
  }

  /**
   * Nombre de cartes inconnues dans une main.
   */
  getUnknownCardCount(index) {
    const player =
      this.getPlayer(index);

    if (!player) {
      return 0;
    }

    return player.main.filter(
      card => card === null
    ).length;
  }

  /**
   * Vérifie si une carte précise est connue
   * dans la main d'un joueur.
   */
  knowsCard(index, card) {
    const player =
      this.getPlayer(index);

    if (!player) {
      return false;
    }

    return player.main.some(
      knownCard =>
        knownCard !== null &&
        knownCard === card
    );
  }

  /**
   * Retourne uniquement les cartes effectivement connues.
   */
  getKnownCards(index) {
    const player =
      this.getPlayer(index);

    if (!player) {
      return [];
    }

    return player.main.filter(
      card => card !== null
    );
  }

  /**
   * ----------------------------------------------------------
   * TABLE
   * ----------------------------------------------------------
   */

  getTableCards() {
    return this.table.slice();
  }

  getTableCardsOfPlayer(playerIndex) {
    const player =
      this.getPlayer(playerIndex);

    if (!player) {
      return [];
    }

    return this.table.filter(
      card =>
        card &&
        (
          card.playerIndex ===
          playerIndex ||

          card.proprietaire ===
          player.name
        )
    );
  }

  getPointCardsOfPlayer(playerIndex) {
    return this.getTableCardsOfPlayer(
      playerIndex
    ).filter(
      card =>
        Number(card?.valeur ?? 0) !== 0
    );
  }

  /**
   * Dernière carte à points connue d'un joueur.
   */
  getLastPointCard(playerIndex) {
    const cards =
      this.getPointCardsOfPlayer(
        playerIndex
      );

    return cards.length > 0
      ? cards[cards.length - 1]
      : null;
  }

  /**
   * Les cartes à points sont ordonnées selon leur présence
   * dans cartesTable, comme dans le moteur réel.
   */
  getLastPointCards(
    playerIndex,
    count = 2
  ) {
    const result = [];

    for (
      let i = this.table.length - 1;
      i >= 0 &&
      result.length < count;
      i--
    ) {
      const card =
        this.table[i];

      const player =
        this.getPlayer(playerIndex);

      if (
        card &&
        player &&
        card.proprietaire ===
          player.name &&
        Number(card.valeur ?? 0) !== 0
      ) {
        result.push(card);
      }
    }

    return result;
  }

  /**
   * ----------------------------------------------------------
   * CARTES CONNUES
   * ----------------------------------------------------------
   */

  getAllKnownCards() {
    const result = [];

    /*
     * Cartes des mains visibles.
     */
    for (const player of this.players) {
      for (const card of player.main) {
        if (card !== null) {
          result.push({
            card,
            location: "hand",
            playerIndex: player.id
          });
        }
      }
    }

    /*
     * Cartes de la table.
     */
    for (const card of this.table) {
      if (!card) {
        continue;
      }

      result.push({
        card:
          card.valeur ??
          card.card ??
          card,
        location: "table",
        playerIndex:
          this.findPlayerIndexByName(
            card.proprietaire
          )
      });
    }

    /*
     * Pouvoirs défaussés.
     */
    for (const card of this.discard) {
      if (!card) {
        continue;
      }

      result.push({
        card:
          card.valeur ??
          card.card ??
          card,
        location: "discard",
        playerIndex:
          this.findPlayerIndexByName(
            card.joueur
          )
      });
    }

    return result;
  }

  isCardKnownOut(card) {
    return this.getAllKnownCards()
      .some(
        entry =>
          entry.card === card
      );
  }

  /**
   * ----------------------------------------------------------
   * SCORES
   * ----------------------------------------------------------
   */

  getScore(index) {
    const player =
      this.getPlayer(index);

    return player
      ? Number(player.score ?? 0)
      : 0;
  }

  getOwnScore() {
    return this.getScore(
      this.botIndex
    );
  }

  getDistanceToTarget(index) {
    return (
      this.targetScore -
      this.getScore(index)
    );
  }

  getAbsoluteDistanceToTarget(index) {
    return Math.abs(
      this.getDistanceToTarget(index)
    );
  }

  isExactTarget(index) {
    return (
      this.getScore(index) ===
      this.targetScore
    );
  }

  isAboveTarget(index) {
    return (
      this.getScore(index) >
      this.targetScore
    );
  }

  isBelowTarget(index) {
    return (
      this.getScore(index) <
      this.targetScore
    );
  }

  /**
   * ----------------------------------------------------------
   * PROGRESSION
   * ----------------------------------------------------------
   */

  getProgression() {
    return clamp(
      this.progression,
      0,
      1
    );
  }

  getProgressionPercent() {
    return (
      this.getProgression() * 100
    );
  }

  /**
   * ----------------------------------------------------------
   * TOUR
   * ----------------------------------------------------------
   */

  isMyTurn(index = this.botIndex) {
    return (
      Number(this.currentPlayer) ===
      Number(index)
    );
  }

  isDecisionPhase() {
    return (
      !this.roundEnded &&
      this.action === null
    );
  }

  isValidForDecision(index = this.botIndex) {
    const player =
      this.getPlayer(index);

    if (!player) {
      return false;
    }

    if (this.roundEnded) {
      return false;
    }

    if (
      this.currentPlayer !==
      Number(index)
    ) {
      return false;
    }

    if (
      this.winner !== null
    ) {
      return false;
    }

    return true;
  }

  /**
   * ----------------------------------------------------------
   * ACTIONS EN COURS
   * ----------------------------------------------------------
   */

  hasPendingAction() {
    return (
      this.action !== null
    );
  }

  isAction(action) {
    return (
      this.action === action
    );
  }

  isDouble9() {
    return (
      this.action ===
      "double9"
    );
  }

  isDouble17() {
    return (
      this.action ===
      "double17"
    );
  }

  isDouble19() {
    return (
      this.action ===
      "double19"
    );
  }

  isDouble13() {
    return (
      this.action ===
      "double13"
    );
  }

  /**
   * ----------------------------------------------------------
   * JOUEUR 17
   * ----------------------------------------------------------
   */

  getPlayer17() {
    return this.player17;
  }

  getPending17Card() {
    return cloneValue(
      this.card17Pending
    );
  }

  getDouble17Cards() {
    return this.double17Cards.slice();
  }

  isDouble17Active() {
    return (
      this.double17Active
    );
  }

  /**
   * ----------------------------------------------------------
   * JOUEUR 19
   * ----------------------------------------------------------
   */

  getPlayer19() {
    return this.player19;
  }

  /**
   * ----------------------------------------------------------
   * JOKER
   * ----------------------------------------------------------
   */

  getJokerTurns(playerIndex) {
    return Number(
      this.toursJoker?.[
        playerIndex
      ] ?? 0
    );
  }

  /**
   * ----------------------------------------------------------
   * CARTES
   * ----------------------------------------------------------
   */

  getCardsInHand(value, playerIndex = this.botIndex) {
    return this.getHand(playerIndex)
      .filter(
        card => card === value
      );
  }

  countCard(
    value,
    playerIndex = this.botIndex
  ) {
    return this.getCardsInHand(
      value,
      playerIndex
    ).length;
  }

  hasCard(
    value,
    playerIndex = this.botIndex
  ) {
    return (
      this.countCard(
        value,
        playerIndex
      ) > 0
    );
  }

  hasDouble(
    value,
    playerIndex = this.botIndex
  ) {
    return (
      this.countCard(
        value,
        playerIndex
      ) >= 2
    );
  }

  getDoubles(
    playerIndex = this.botIndex
  ) {
    const hand =
      this.getHand(playerIndex);

    const counts =
      new Map();

    for (const card of hand) {
      if (card === null) {
        continue;
      }

      const count =
        counts.get(card) ?? 0;

      counts.set(
        card,
        count + 1
      );
    }

    return [...counts.entries()]
      .filter(
        ([, count]) =>
          count >= 2
      )
      .map(
        ([card, count]) => ({
          card,
          count
        })
      );
  }

  /**
   * Le moteur utilise une paire même lorsqu'il y a
   * 3 exemplaires ou plus.
   */
  getPlayableDoubleCards(
    playerIndex = this.botIndex
  ) {
    return this.getDoubles(
      playerIndex
    ).map(
      ({ card }) => card
    );
  }

  /**
   * ----------------------------------------------------------
   * RECHERCHE DE JOUEUR
   * ----------------------------------------------------------
   */

  findPlayerIndexByName(name) {
    if (
      name === null ||
      name === undefined
    ) {
      return null;
    }

    const index =
      this.players.findIndex(
        player =>
          player.name === name
      );

    return index === -1
      ? null
      : index;
  }

  /**
   * ----------------------------------------------------------
   * FIN DE MANCHE / PARTIE
   * ----------------------------------------------------------
   */

  hasWinner() {
    return (
      this.winner !== null
    );
  }

  hasRoundWinner() {
    return (
      this.roundWinner !== null
    );
  }

  isRoundOver() {
    return (
      this.roundEnded ||
      this.roundFinished
    );
  }

  /**
   * ----------------------------------------------------------
   * RÉSUMÉ POUR DEBUG / TESTS
   * ----------------------------------------------------------
   */

  summary() {
    return {
      botIndex:
        this.botIndex,

      currentPlayer:
        this.currentPlayer,

      action:
        this.action,

      target:
        this.target,

      targetScore:
        this.targetScore,

      progression:
        this.progression,

      deckCount:
        this.deckCount,

      tableCount:
        this.table.length,

      discardCount:
        this.discard.length,

      players:
        this.players.map(
          player => ({
            id: player.id,
            name: player.name,
            score: player.score,
            bot: player.bot,
            cardCount:
              player.cardCount,
            visibleCards:
              player.main.filter(
                card => card !== null
              )
          })
        )
    };
  }

  /**
   * Sérialisation sans référence mutable.
   */
  toJSON() {
    return {
      players:
        this.players.map(
          player => ({
            ...player,
            main:
              player.main.slice()
          })
        ),

      deckCount:
        this.deckCount,

      table:
        cloneArray(this.table),

      discard:
        cloneArray(this.discard),

      history:
        this.history,

      currentPlayer:
        this.currentPlayer,

      action:
        this.action,

      target:
        this.target,

      selection:
        cloneValue(this.selection),

      toursJoker:
        cloneValue(this.toursJoker),

      winner:
        cloneValue(this.winner),

      roundWinner:
        cloneValue(this.roundWinner),

      roundEnded:
        this.roundEnded,

      player17:
        this.player17,

      card17Pending:
        cloneValue(
          this.card17Pending
        ),

      double17Cards:
        cloneArray(
          this.double17Cards
        ),

      double17Active:
        this.double17Active,

      player19:
        this.player19,

      victories:
        cloneValue(
          this.victories
        ),

      modeJeu:
        this.modeJeu,

      botIndex:
        this.botIndex,

      targetScore:
        this.targetScore,

      totalCards:
        this.totalCards,

      cardsPlayed:
        this.cardsPlayed,

      progression:
        this.progression,

      roundFinished:
        this.roundFinished
    };
  }
}

/**
 * ------------------------------------------------------------
 * UTILITAIRES
 * ------------------------------------------------------------
 */

function normalizePlayers(players) {
  if (!Array.isArray(players)) {
    return [];
  }

  return players.map(
    (player, index) => {
      const main =
        Array.isArray(player.main)
          ? player.main.slice()
          : [];

      return {
        id:
          player.id ??
          index,

        name:
          player.name ??
          player.nom ??
          `Joueur ${index + 1}`,

        score:
          Number(
            player.score ?? 0
          ),

        bot:
          Boolean(
            player.bot
          ),

        main,

        /*
         * cardCount est séparé de main.length
         * car une vue distante peut cacher le contenu
         * tout en révélant le nombre de cartes.
         */
        cardCount:
          player.cardCount != null
            ? Number(
                player.cardCount
              )
            : main.length
      };
    }
  );
}

function normalizeIndex(
  value,
  playerCount
) {
  if (
    playerCount <= 0
  ) {
    return 0;
  }

  const index =
    Number(value);

  if (
    !Number.isInteger(index) ||
    index < 0 ||
    index >= playerCount
  ) {
    return 0;
  }

  return index;
}

function normalizeWinner(
  winner,
  players
) {
  if (
    winner === null ||
    winner === undefined
  ) {
    return null;
  }

  if (
    typeof winner === "number"
  ) {
    return (
      players[winner]?.id ??
      winner
    );
  }

  if (
    typeof winner === "object"
  ) {
    if (
      winner.id !== undefined
    ) {
      return winner.id;
    }

    if (
      winner.nom !== undefined
    ) {
      const index =
        players.findIndex(
          player =>
            player.name ===
            winner.nom
        );

      return index === -1
        ? null
        : index;
    }
  }

  return winner;
}

function normalizeRoundWinner(
  winner,
  players
) {
  if (
    winner === null ||
    winner === undefined
  ) {
    return null;
  }

  if (
    typeof winner === "number"
  ) {
    return (
      players[winner]?.id ??
      winner
    );
  }

  if (
    typeof winner === "object"
  ) {
    if (
      winner.id !== undefined
    ) {
      return winner.id;
    }

    if (
      winner.nom !== undefined
    ) {
      const index =
        players.findIndex(
          player =>
            player.name ===
            winner.nom
        );

      return index === -1
        ? null
        : index;
    }
  }

  return winner;
}

/**
 * Cible réelle du jeu.
 *
 * Ces valeurs correspondent à obtenirScoreVictoire()
 * dans script.js.
 */
export function calculateTargetScore(
  playerCount
) {
  const count =
    Number(playerCount);

  if (
    count === 2 ||
    count === 3
  ) {
    return 120;
  }

  if (count === 4) {
    return 160;
  }

  if (count === 5) {
    return 200;
  }

  if (count === 6) {
    return 220;
  }

  if (count === 7) {
    return 240;
  }

  if (count === 8) {
    return 260;
  }

  /*
   * Le jeu actuel est prévu pour 2 à 8 joueurs.
   */
  return null;
}

/**
 * Nombre total de cartes correspondant au document
 * de conception du nouveau bot.
 *
 * Attention :
 * le paquet réel de script.js est constitué de :
 *
 *   2 paquets pour 2-3 joueurs
 *   joueurs - 1 paquets pour 4-8 joueurs
 *
 * Chaque paquet contient 22 cartes.
 */
export function calculateTotalCards(
  playerCount
) {
  const count =
    Number(playerCount);

  if (
    count < 2
  ) {
    return 0;
  }

  const packs =
    count <= 3
      ? 2
      : count - 1;

  return packs * 22;
}

/**
 * Les cartes "sorties" pour la progression stratégique
 * seront raffinées dans l'évaluation.
 *
 * Ici nous comptons uniquement les cartes dont la présence
 * est explicitement connue dans l'état.
 */
function calculateVisibleProgressCards(
  state
) {
  let count = 0;

  for (const player of state.players) {
    count += player.main.filter(
      card => card !== null
    ).length;
  }

  count += state.table.length;
  count += state.discard.length;

  /*
   * Une même carte ne doit normalement pas être présente
   * dans deux endroits simultanément.
   */
  return count;
}

function toNonNegativeInteger(value) {
  const number =
    Number(value);

  if (
    !Number.isFinite(number) ||
    number < 0
  ) {
    return 0;
  }

  return Math.floor(number);
}

function clamp(
  value,
  min,
  max
) {
  return Math.max(
    min,
    Math.min(max, value)
  );
}

function cloneArray(value) {
  if (!Array.isArray(value)) {
    return [];
  }

  return value.map(
    item => cloneValue(item)
  );
}

function cloneValue(value) {
  if (
    value === null ||
    value === undefined
  ) {
    return value;
  }

  if (
    typeof structuredClone ===
    "function"
  ) {
    try {
      return structuredClone(
        value
      );
    } catch {
      /*
       * Fallback ci-dessous.
       */
    }
  }

  if (Array.isArray(value)) {
    return value.map(
      item => cloneValue(item)
    );
  }

  if (
    typeof value === "object"
  ) {
    const result = {};

    for (
      const [key, item]
      of Object.entries(value)
    ) {
      result[key] =
        cloneValue(item);
    }

    return result;
  }

  return value;
}
