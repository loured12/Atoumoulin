/**
 * Gestion des informations réellement accessibles au bot.
 *
 * Principe :
 * - GameState peut contenir des informations masquées par null.
 * - KnowledgeState détermine ce que le bot peut réellement utiliser.
 * - Aucune carte inconnue d'un adversaire n'est reconstruite artificiellement.
 */

export class KnowledgeState {
  constructor(gameState, botIndex) {
    if (!gameState) {
      throw new Error(
        "KnowledgeState nécessite un GameState."
      );
    }

    this.state = gameState;
    this.botIndex = Number(botIndex);

    const bot = gameState.getPlayer(this.botIndex);

    if (!bot) {
      throw new Error(
        `Joueur IA introuvable : ${this.botIndex}`
      );
    }
  }

  /**
   * Joueur contrôlé par l'IA.
   */
  getSelf() {
    return this.state.getPlayer(this.botIndex);
  }

  /**
   * Adversaires.
   */
  getOpponents() {
    return this.state.getOpponents(this.botIndex);
  }

  /**
   * Main réellement connue du bot.
   *
   * Pour lui-même, toutes les cartes sont accessibles.
   */
  getOwnHand() {
    return this.getSelf().main.filter(
      card => card !== null
    );
  }

  /**
   * Cartes connues d'un adversaire.
   *
   * Une carte inconnue reste inconnue.
   */
  getKnownOpponentCards(playerIndex) {
    if (Number(playerIndex) === this.botIndex) {
      return this.getOwnHand();
    }

    return this.state.getKnownCards(playerIndex);
  }

  /**
   * Nombre de cartes d'un adversaire.
   *
   * Le nombre est connu même lorsque leur contenu ne l'est pas.
   */
  getOpponentCardCount(playerIndex) {
    const player = this.state.getPlayer(playerIndex);

    return player ? player.cardCount : 0;
  }

  /**
   * Indique si le bot connaît une carte précise.
   */
  knowsCard(playerIndex, card) {
    return this.state.knowsCard(playerIndex, card);
  }

  /**
   * Retourne uniquement les informations accessibles concernant
   * un joueur.
   */
  getPlayerKnowledge(playerIndex) {
    const player = this.state.getPlayer(playerIndex);

    if (!player) {
      return null;
    }

    const own = Number(playerIndex) === this.botIndex;

    return {
      id: player.id,
      name: player.name,
      score: player.score,
      bot: player.bot,
      cardCount: player.cardCount,

      main: own
        ? player.main.slice()
        : player.main.map(card =>
            card === null ? null : card
          ),

      knownCards: own
        ? player.main.filter(card => card !== null)
        : player.main.filter(card => card !== null)
    };
  }

  /**
   * Vue complète autorisée au bot.
   *
   * Les mains adverses restent masquées.
   */
  getView() {
    return {
      self: this.getPlayerKnowledge(this.botIndex),

      opponents: this.getOpponents().map(
        player => this.getPlayerKnowledge(player.id)
      ),

      deckCount: this.state.deckCount,

      table: this.state.table.slice(),

      discard: this.state.discard.slice(),

      history: this.state.history,

      currentPlayer: this.state.currentPlayer,

      action: this.state.action,

      target: this.state.target,

      selection: cloneValue(
        this.state.selection
      ),

      toursJoker: this.state.toursJoker,

      player17: this.state.player17,

      card17Pending: cloneValue(
        this.state.card17Pending
      ),

      double17Cards:
        this.state.double17Cards.slice(),

      double17Active:
        this.state.double17Active,

      player19:
        this.state.player19,

      victories:
        cloneValue(this.state.victories),

      modeJeu:
        this.state.modeJeu
    };
  }

  /**
   * Informations connues sur les cartes déjà visibles.
   */
  getKnownCards() {
    const result = [];

    for (const player of this.state.players) {
      for (const card of player.main) {
        if (card !== null) {
          result.push({
            card,
            location: "hand",
            player: player.id
          });
        }
      }
    }

    for (const card of this.state.table) {
      result.push({
        card,
        location: "table",
        player: null
      });
    }

    for (const card of this.state.discard) {
      result.push({
        card,
        location: "discard",
        player: null
      });
    }

    return result;
  }

  /**
   * Vérifie si une carte est connue comme étant sortie.
   *
   * Important :
   * "inconnue" ne signifie PAS "dans la pioche".
   */
  isKnownCardOut(card) {
    return this.getKnownCards()
      .some(entry => entry.card === card);
  }

  /**
   * Retourne les cartes explicitement connues comme étant
   * encore dans une main.
   */
  getKnownCardsInHands() {
    return this.getKnownCards()
      .filter(entry => entry.location === "hand");
  }

  /**
   * Retourne le nombre de cartes inconnues dans la main
   * d'un adversaire.
   */
  getUnknownCardCount(playerIndex) {
    const player = this.state.getPlayer(playerIndex);

    if (!player) {
      return 0;
    }

    if (Number(playerIndex) === this.botIndex) {
      return 0;
    }

    return player.main.filter(
      card => card === null
    ).length;
  }

  /**
   * Vérifie si le bot est autorisé à connaître la main complète
   * d'un joueur dans la situation actuelle.
   *
   * Certaines cartes du jeu peuvent révéler une main.
   * Cette méthode est volontairement centralisée afin que ces
   * règles soient ajoutées ici plutôt que dispersées dans le bot.
   */
  canSeeFullHand(playerIndex) {
    if (Number(playerIndex) === this.botIndex) {
      return true;
    }

    /*
     * Pour l'instant, aucune révélation supplémentaire n'est
     * inventée ici.
     *
     * Les effets comme Double 9 pourront modifier cette capacité
     * lorsqu'ils seront représentés explicitement par l'état.
     */
    return false;
  }

  /**
   * Vue d'un adversaire adaptée aux évaluations probabilistes.
   *
   * Le bot connaît :
   * - son score ;
   * - son nombre de cartes ;
   * - les cartes éventuellement révélées ;
   *
   * mais pas les cartes cachées.
   */
  getOpponentEstimate(playerIndex) {
    const player = this.state.getPlayer(playerIndex);

    if (!player) {
      return null;
    }

    const knownCards =
      this.getKnownOpponentCards(playerIndex);

    const unknownCount =
      this.getUnknownCardCount(playerIndex);

    return {
      id: player.id,
      score: player.score,
      cardCount: player.cardCount,

      knownCards: knownCards.slice(),

      unknownCardCount: unknownCount,

      informationCompleteness:
        player.cardCount === 0
          ? 100
          : (
              knownCards.length /
              player.cardCount
            ) * 100
    };
  }

  /**
   * Estimation de l'ensemble des adversaires.
   *
   * Ceci ne crée aucune main cachée.
   */
  getOpponentEstimates() {
    return this.getOpponents().map(
      player => this.getOpponentEstimate(player.id)
    );
  }

  /**
   * Crée une nouvelle connaissance basée sur une copie de l'état.
   */
  clone() {
    return new KnowledgeState(
      this.state.clone(),
      this.botIndex
    );
  }
}

function cloneValue(value) {
  if (
    value === null ||
    value === undefined
  ) {
    return value;
  }

  if (Array.isArray(value)) {
    return value.map(item => cloneValue(item));
  }

  if (typeof value === "object") {
    const result = {};

    for (const [key, item] of Object.entries(value)) {
      result[key] = cloneValue(item);
    }

    return result;
  }

  return value;
}
