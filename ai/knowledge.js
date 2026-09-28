/**
 * Atoumoulin - KnowledgeState
 *
 * Cette classe représente UNIQUEMENT les informations auxquelles
 * l'IA a le droit d'avoir accès.
 *
 * GameState = état connu par le moteur.
 * KnowledgeState = état observable par le bot.
 *
 * RÈGLE ABSOLUE :
 *
 * Une information absente ou masquée ne doit jamais être
 * reconstruite artificiellement.
 */

export class KnowledgeState {
  constructor(gameState, botIndex) {
    if (!gameState) {
      throw new Error(
        "KnowledgeState nécessite un GameState."
      );
    }

    this.state = gameState;

    this.botIndex =
      Number(botIndex);

    if (
      !Number.isInteger(
        this.botIndex
      )
    ) {
      throw new Error(
        "Index du bot invalide."
      );
    }

    if (
      !this.state.getPlayer(
        this.botIndex
      )
    ) {
      throw new Error(
        `Le joueur ${this.botIndex} n'existe pas.`
      );
    }

    /*
     * Informations temporairement révélées.
     *
     * Elles sont stockées ici plutôt que dans GameState,
     * car elles représentent ce que le bot sait à un instant
     * donné, et non une modification du jeu réel.
     */
    this.revealedCards =
      new Map();

    /*
     * Informations révélées concernant les mains.
     *
     * Exemple :
     *
     * joueur 2 → carte 13 connue
     */
    this.revealedHands =
      new Map();

    /*
     * Informations obtenues par des effets de cartes.
     */
    this.revelations =
      [];

    /*
     * Historique local des informations connues.
     */
    this.knowledgeHistory =
      [];
  }

  /**
   * ----------------------------------------------------------
   * COPIE
   * ----------------------------------------------------------
   */

  clone() {
    const knowledge =
      new KnowledgeState(
        this.state.clone(),
        this.botIndex
      );

    knowledge.revealedCards =
      cloneMap(
        this.revealedCards
      );

    knowledge.revealedHands =
      cloneMap(
        this.revealedHands
      );

    knowledge.revelations =
      cloneArray(
        this.revelations
      );

    knowledge.knowledgeHistory =
      cloneArray(
        this.knowledgeHistory
      );

    return knowledge;
  }

  /**
   * ----------------------------------------------------------
   * JOUEUR DU BOT
   * ----------------------------------------------------------
   */

  getSelf() {
    return this.state.getPlayer(
      this.botIndex
    );
  }

  getOwnHand() {
    return this.state.getOwnHand();
  }

  getOwnScore() {
    return this.state.getOwnScore();
  }

  /**
   * ----------------------------------------------------------
   * ADVERSAIRES
   * ----------------------------------------------------------
   */

  getOpponents() {
    return this.state.getOpponents();
  }

  getOpponent(index) {
    return this.state.getOpponent(
      index
    );
  }

  /**
   * ----------------------------------------------------------
   * INFORMATIONS PUBLIQUES
   * ----------------------------------------------------------
   *
   * Certaines informations sont connues indépendamment
   * du contenu des mains :
   *
   * - score
   * - nombre de cartes
   * - joueur actuel
   * - cartes de la table
   * - défausse
   * - historique
   * - état des effets
   */

  getPublicState() {
    return {
      currentPlayer:
        this.state.currentPlayer,

      targetScore:
        this.state.targetScore,

      progression:
        this.state.progression,

      deckCount:
        this.state.deckCount,

      table:
        cloneArray(
          this.state.table
        ),

      discard:
        cloneArray(
          this.state.discard
        ),

      history:
        this.state.history,

      action:
        this.state.action,

      target:
        this.state.target,

      selection:
        cloneValue(
          this.state.selection
        ),

      toursJoker:
        cloneValue(
          this.state.toursJoker
        ),

      player17:
        this.state.player17,

      card17Pending:
        cloneValue(
          this.state.card17Pending
        ),

      double17Cards:
        cloneArray(
          this.state.double17Cards
        ),

      double17Active:
        this.state.double17Active,

      player19:
        this.state.player19,

      roundEnded:
        this.state.roundEnded,

      roundWinner:
        this.state.roundWinner,

      winner:
        this.state.winner,

      modeJeu:
        this.state.modeJeu
    };
  }

  /**
   * ----------------------------------------------------------
   * INFORMATIONS SUR UN JOUEUR
   * ----------------------------------------------------------
   */

  getPlayerKnowledge(index) {
    const player =
      this.state.getPlayer(
        index
      );

    if (!player) {
      return null;
    }

    const isSelf =
      Number(index) ===
      this.botIndex;

    return {
      id:
        player.id,

      name:
        player.name,

      score:
        player.score,

      bot:
        player.bot,

      cardCount:
        player.cardCount,

      /*
       * Notre propre main est entièrement connue.
       *
       * Pour un adversaire, seules les cartes explicitement
       * connues sont exposées.
       */
      main:
        isSelf
          ? player.main.slice()
          : this.getKnownOpponentCards(
              player.id
            ),

      /*
       * Nombre de cartes dont le contenu reste inconnu.
       */
      unknownCardCount:
        isSelf
          ? 0
          : this.getUnknownCardCount(
              player.id
            ),

      /*
       * Permet au moteur stratégique de savoir à quel point
       * l'information sur ce joueur est complète.
       */
      informationCompleteness:
        this.getInformationCompleteness(
          player.id
        )
    };
  }

  /**
   * Vue de tous les joueurs.
   */
  getPlayersKnowledge() {
    return this.state.players.map(
      player =>
        this.getPlayerKnowledge(
          player.id
        )
    );
  }

  /**
   * ----------------------------------------------------------
   * CARTES CONNUES DES ADVERSAIRES
   * ----------------------------------------------------------
   */

  getKnownOpponentCards(
    playerIndex
  ) {
    const index =
      Number(playerIndex);

    if (
      index ===
      this.botIndex
    ) {
      return this.getOwnHand();
    }

    const player =
      this.state.getPlayer(
        index
      );

    if (!player) {
      return [];
    }

    /*
     * 1. Cartes visibles directement dans l'état.
     */
    const known =
      player.main.filter(
        card =>
          card !== null
      );

    /*
     * 2. Cartes explicitement révélées
     *    par un effet précédent.
     */
    const revealed =
      this.revealedHands.get(
        index
      ) ?? [];

    for (const card of revealed) {
      if (
        card !== null &&
        !known.includes(card)
      ) {
        known.push(card);
      }
    }

    return known.slice();
  }

  /**
   * Nombre de cartes inconnues.
   */
  getUnknownCardCount(
    playerIndex
  ) {
    const player =
      this.state.getPlayer(
        playerIndex
      );

    if (!player) {
      return 0;
    }

    if (
      Number(playerIndex) ===
      this.botIndex
    ) {
      return 0;
    }

    const known =
      this.getKnownOpponentCards(
        playerIndex
      );

    return Math.max(
      0,
      player.cardCount -
        known.length
    );
  }

  /**
   * Pourcentage d'information connue.
   */
  getInformationCompleteness(
    playerIndex
  ) {
    const player =
      this.state.getPlayer(
        playerIndex
      );

    if (!player) {
      return 0;
    }

    if (
      Number(playerIndex) ===
      this.botIndex
    ) {
      return 100;
    }

    if (
      player.cardCount <= 0
    ) {
      return 100;
    }

    const known =
      this.getKnownOpponentCards(
        playerIndex
      );

    return (
      known.length /
      player.cardCount
    ) * 100;
  }

  /**
   * ----------------------------------------------------------
   * CARTE CONNUE
   * ----------------------------------------------------------
   */

  knowsCard(
    playerIndex,
    card
  ) {
    if (
      Number(playerIndex) ===
      this.botIndex
    ) {
      return this.getOwnHand()
        .includes(card);
    }

    return this.getKnownOpponentCards(
      playerIndex
    ).includes(card);
  }

  /**
   * Une carte peut être connue comme sortie sans que
   * sa localisation exacte soit forcément utile.
   */
  isCardKnownOut(card) {
    return this.state.isCardKnownOut(
      card
    );
  }

  /**
   * Toutes les cartes dont le bot connaît l'existence
   * et la localisation.
   */
  getKnownCards() {
    const result = [];

    /*
     * Mains visibles.
     */
    for (
      const player
      of this.state.players
    ) {
      const cards =
        player.id ===
        this.botIndex
          ? player.main
          : this.getKnownOpponentCards(
              player.id
            );

      for (const card of cards) {
        result.push({
          card,
          location: "hand",
          playerIndex:
            player.id
        });
      }
    }

    /*
     * Table.
     */
    for (
      const card
      of this.state.table
    ) {
      result.push({
        card:
          card?.valeur ??
          card?.card ??
          card,

        location:
          "table",

        playerIndex:
          card?.proprietaire != null
            ? this.state
                .findPlayerIndexByName(
                  card.proprietaire
                )
            : null
      });
    }

    /*
     * Défausse.
     */
    for (
      const card
      of this.state.discard
    ) {
      result.push({
        card:
          card?.valeur ??
          card?.card ??
          card,

        location:
          "discard",

        playerIndex:
          null
      });
    }

    return result;
  }

  /**
   * ----------------------------------------------------------
   * RÉVÉLATIONS
   * ----------------------------------------------------------
   */

  /**
   * Enregistre une carte révélée.
   *
   * Cette méthode ne modifie PAS la main réelle du joueur.
   */
  revealCard(
    playerIndex,
    card,
    reason = "unknown"
  ) {
    const index =
      Number(playerIndex);

    if (
      index ===
      this.botIndex
    ) {
      return;
    }

    if (
      card === null ||
      card === undefined
    ) {
      return;
    }

    let cards =
      this.revealedHands.get(
        index
      );

    if (!cards) {
      cards = [];
      this.revealedHands.set(
        index,
        cards
      );
    }

    if (
      !cards.includes(card)
    ) {
      cards.push(card);
    }

    const revelation = {
      type:
        "card",

      playerIndex:
        index,

      card,

      reason
    };

    this.revelations.push(
      revelation
    );

    this.knowledgeHistory.push(
      revelation
    );
  }

  /**
   * Enregistre plusieurs cartes révélées.
   */
  revealCards(
    playerIndex,
    cards,
    reason = "unknown"
  ) {
    if (!Array.isArray(cards)) {
      return;
    }

    for (const card of cards) {
      this.revealCard(
        playerIndex,
        card,
        reason
      );
    }
  }

  /**
   * Efface une information devenue invalide.
   *
   * Exemple : une carte connue vient d'être jouée.
   */
  forgetCard(
    playerIndex,
    card
  ) {
    const index =
      Number(playerIndex);

    const cards =
      this.revealedHands.get(
        index
      );

    if (!cards) {
      return;
    }

    const filtered =
      cards.filter(
        knownCard =>
          knownCard !== card
      );

    if (
      filtered.length === 0
    ) {
      this.revealedHands.delete(
        index
      );
    } else {
      this.revealedHands.set(
        index,
        filtered
      );
    }
  }

  /**
   * Efface toutes les informations relatives à une carte
   * d'un joueur.
   */
  forgetPlayerCard(
    playerIndex,
    card
  ) {
    this.forgetCard(
      playerIndex,
      card
    );
  }

  /**
   * Réinitialise toutes les révélations temporaires.
   */
  clearRevelations() {
    this.revealedCards.clear();
    this.revealedHands.clear();
    this.revelations = [];
  }

  /**
   * ----------------------------------------------------------
   * CAS PARTICULIER DU DOUBLE 9
   * ----------------------------------------------------------
   *
   * Le Double 9 permet une connaissance supplémentaire.
   *
   * On ne donne cependant pas automatiquement toutes les mains
   * aux autres joueurs.
   *
   * C'est le bot qui a déclenché le Double 9 qui reçoit
   * l'information autorisée.
   */

  canSeeFullHand(
    playerIndex
  ) {
    const index =
      Number(playerIndex);

    if (
      index ===
      this.botIndex
    ) {
      return true;
    }

    /*
     * Si le Double 9 est en cours et que le bot est le joueur
     * concerné, le moteur a ouvert une fenêtre d'information.
     */
    if (
      this.state.isDouble9() &&
      this.state.currentPlayer ===
        this.botIndex
    ) {
      return true;
    }

    return false;
  }

  getDouble9VisibleHand(
    playerIndex
  ) {
    if (
      !this.canSeeFullHand(
        playerIndex
      )
    ) {
      return null;
    }

    const player =
      this.state.getPlayer(
        playerIndex
      );

    if (!player) {
      return null;
    }

    return player.main.slice();
  }

  /**
   * ----------------------------------------------------------
   * CARTE 17
   * ----------------------------------------------------------
   *
   * Avant le vol :
   * la carte choisie dans la main adverse est inconnue.
   *
   * Après révélation :
   * la carte tirée devient connue.
   */

  is17CardKnown() {
    return (
      this.state.card17Pending !==
      undefined &&
      this.state.card17Pending !==
      null
    );
  }

  get17Information() {
    return {
      player17:
        this.state.player17,

      pendingCard:
        this.is17CardKnown()
          ? cloneValue(
              this.state.card17Pending
            )
          : null,

      double17Cards:
        this.state.double17Cards
          .slice(),

      active:
        this.state.double17Active
    };
  }

  /**
   * ----------------------------------------------------------
   * CARTE 19
   * ----------------------------------------------------------
   *
   * Les cartes concernées par le 19 sont publiques si elles
   * sont déjà présentes sur la table.
   */

  get19Information() {
    const playerIndex =
      this.state.player19;

    if (
      playerIndex == null
    ) {
      return {
        player19:
          null,

        cards:
          []
      };
    }

    return {
      player19:
        playerIndex,

      cards:
        this.state.getLastPointCards(
          playerIndex,
          2
        )
    };
  }

  /**
   * ----------------------------------------------------------
   * ESTIMATION D'UN ADVERSAIRE
   * ----------------------------------------------------------
   *
   * IMPORTANT :
   * ceci ne fabrique pas une main.
   *
   * Cela décrit uniquement :
   *
   * - ce que le bot sait ;
   * - ce qu'il ignore ;
   * - le nombre de cartes inconnues.
   */

  getOpponentEstimate(
    playerIndex
  ) {
    const player =
      this.state.getPlayer(
        playerIndex
      );

    if (!player) {
      return null;
    }

    const knownCards =
      this.getKnownOpponentCards(
        playerIndex
      );

    const unknownCount =
      this.getUnknownCardCount(
        playerIndex
      );

    return {
      id:
        player.id,

      name:
        player.name,

      score:
        player.score,

      cardCount:
        player.cardCount,

      knownCards:
        knownCards.slice(),

      unknownCardCount:
        unknownCount,

      informationCompleteness:
        this.getInformationCompleteness(
          playerIndex
        ),

      exactScoreDistance:
        this.state.getAbsoluteDistanceToTarget(
          playerIndex
        ),

      exactTarget:
        this.state.isExactTarget(
          playerIndex
        )
    };
  }

  getOpponentEstimates() {
    return this.getOpponents()
      .map(
        player =>
          this.getOpponentEstimate(
            player.id
          )
      );
  }

  /**
   * ----------------------------------------------------------
   * SCÉNARIOS D'INFORMATION
   * ----------------------------------------------------------
   *
   * Le futur moteur de recherche pourra créer plusieurs
   * scénarios sans transformer une hypothèse en vérité.
   */

  createScenario(
    overrides = {}
  ) {
    const state =
      this.state.clone();

    /*
     * Les overrides ne sont utilisés que pour une simulation
     * probabiliste explicite.
     */
    for (
      const [key, value]
      of Object.entries(
        overrides
      )
    ) {
      if (
        Object.prototype.hasOwnProperty.call(
          state,
          key
        )
      ) {
        state[key] =
          cloneValue(value);
      }
    }

    return new KnowledgeState(
      state,
      this.botIndex
    );
  }

  /**
   * ----------------------------------------------------------
   * VUE COMPLETE AUTORISÉE
   * ----------------------------------------------------------
   */

  getView() {
    return {
      botIndex:
        this.botIndex,

      self:
        this.getPlayerKnowledge(
          this.botIndex
        ),

      opponents:
        this.getOpponents()
          .map(
            player =>
              this.getPlayerKnowledge(
                player.id
              )
          ),

      public:
        this.getPublicState(),

      knownCards:
        this.getKnownCards(),

      opponentEstimates:
        this.getOpponentEstimates(),

      revelations:
        cloneArray(
          this.revelations
        )
    };
  }

  /**
   * ----------------------------------------------------------
   * VALIDATION ANTI-TRICHE
   * ----------------------------------------------------------
   *
   * Cette fonction sera utilisée par les tests du bot.
   *
   * Elle vérifie qu'une vue adversaire ne contient pas de carte
   * cachée.
   */

  validateNoHiddenInformation() {
    for (
      const player
      of this.state.players
    ) {
      if (
        player.id ===
        this.botIndex
      ) {
        continue;
      }

      const known =
        this.getKnownOpponentCards(
          player.id
        );

      /*
       * Toutes les cartes renvoyées doivent être réellement
       * présentes dans les informations accessibles.
       */
      for (const card of known) {
        const visible =
          player.main.includes(
            card
          );

        const revealed =
          (
            this.revealedHands
              .get(player.id) ??
            []
          ).includes(card);

        if (
          !visible &&
          !revealed
        ) {
          throw new Error(
            `Information cachée détectée : ` +
            `joueur ${player.id}, carte ${card}`
          );
        }
      }
    }

    return true;
  }

  /**
   * ----------------------------------------------------------
   * RÉSUMÉ
   * ----------------------------------------------------------
   */

  summary() {
    return {
      botIndex:
        this.botIndex,

      ownCards:
        this.getOwnHand(),

      ownScore:
        this.getOwnScore(),

      opponents:
        this.getOpponentEstimates(),

      currentPlayer:
        this.state.currentPlayer,

      action:
        this.state.action,

      knownCards:
        this.getKnownCards(),

      revelations:
        cloneArray(
          this.revelations
        )
    };
  }
}

/**
 * ------------------------------------------------------------
 * UTILITAIRES
 * ------------------------------------------------------------
 */

function cloneArray(value) {
  if (!Array.isArray(value)) {
    return [];
  }

  return value.map(
    item =>
      cloneValue(item)
  );
}

function cloneMap(map) {
  const result =
    new Map();

  for (
    const [key, value]
    of map.entries()
  ) {
    result.set(
      key,
      cloneValue(value)
    );
  }

  return result;
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
      // Fallback.
    }
  }

  if (Array.isArray(value)) {
    return value.map(
      item =>
        cloneValue(item)
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
