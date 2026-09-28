/**
 * Représentation indépendante de l'état d'une partie pour l'IA Atoumoulin.
 *
 * IMPORTANT :
 * - Ce fichier ne modifie jamais directement la partie réelle.
 * - Il sert de structure de données pour le raisonnement, les simulations
 *   et les recherches futures du bot.
 * - Les informations cachées seront traitées séparément par knowledge.js.
 */

export class GameState {
  constructor(data = {}) {
    this.players = Array.isArray(data.players)
      ? data.players.map(player => ({
          id: Number(player.id),
          name: player.name ?? "",
          score: Number(player.score) || 0,
          bot: !!player.bot,
          cardCount: Number(player.cardCount) || 0,

          // Copie de la main.
          // Les cartes inconnues peuvent être représentées par null.
          main: Array.isArray(player.main)
            ? player.main.slice()
            : []
        }))
      : [];

    this.deckCount = Number(data.deckCount) || 0;

    this.table = Array.isArray(data.table)
      ? data.table.slice()
      : [];

    this.discard = Array.isArray(data.discard)
      ? data.discard.slice()
      : [];

    this.history = String(data.history ?? "");

    this.currentPlayer =
      data.currentPlayer == null
        ? null
        : Number(data.currentPlayer);

    this.action = data.action ?? null;
    this.target = data.target ?? null;

    this.selection = data.selection ?? null;

    this.toursJoker =
      data.toursJoker == null
        ? null
        : Number(data.toursJoker);

    this.winner = data.winner ?? null;
    this.roundWinner = data.roundWinner ?? null;

    this.roundEnded = !!data.roundEnded;

    // État particulier de la carte 17.
    this.player17 =
      data.player17 == null
        ? null
        : Number(data.player17);

    this.card17Pending =
      data.card17Pending ?? null;

    this.double17Cards = Array.isArray(data.double17Cards)
      ? data.double17Cards.slice()
      : [];

    this.double17Active = !!data.double17Active;

    // État particulier de la carte 19.
    this.player19 =
      data.player19 == null
        ? null
        : Number(data.player19);

    this.victories = Array.isArray(data.victories)
      ? data.victories.slice()
      : data.victories ?? null;

    this.modeJeu = data.modeJeu ?? null;
  }

  /**
   * Création depuis l'objet retourné par l'engine.
   */
  static fromEngineState(data) {
    if (!data) {
      throw new Error(
        "Impossible de créer un GameState : état absent."
      );
    }

    return new GameState(data);
  }

  /**
   * Copie complète et indépendante.
   *
   * Utilisée par le moteur de simulation.
   */
  clone() {
    return new GameState({
      players: this.players.map(player => ({
        id: player.id,
        name: player.name,
        score: player.score,
        bot: player.bot,
        cardCount: player.cardCount,
        main: player.main.slice()
      })),

      deckCount: this.deckCount,
      table: this.table.slice(),
      discard: this.discard.slice(),
      history: this.history,

      currentPlayer: this.currentPlayer,
      action: this.action,
      target: this.target,

      selection: cloneValue(this.selection),

      toursJoker: this.toursJoker,

      winner: cloneValue(this.winner),
      roundWinner: cloneValue(this.roundWinner),
      roundEnded: this.roundEnded,

      player17: this.player17,
      card17Pending: cloneValue(this.card17Pending),
      double17Cards: this.double17Cards.slice(),
      double17Active: this.double17Active,

      player19: this.player19,

      victories: cloneValue(this.victories),
      modeJeu: this.modeJeu
    });
  }

  /**
   * Retourne le joueur correspondant à un index.
   */
  getPlayer(index) {
    const i = Number(index);

    return this.players.find(
      player => player.id === i
    ) ?? null;
  }

  /**
   * Retourne le joueur dont c'est actuellement le tour.
   */
  getCurrentPlayer() {
    if (this.currentPlayer == null) {
      return null;
    }

    return this.getPlayer(this.currentPlayer);
  }

  /**
   * Retourne tous les adversaires d'un joueur.
   */
  getOpponents(playerIndex) {
    const index = Number(playerIndex);

    return this.players.filter(
      player => player.id !== index
    );
  }

  /**
   * Indique si la manche est terminée.
   */
  isRoundOver() {
    return this.roundEnded === true;
  }

  /**
   * Indique si la partie possède déjà un vainqueur.
   */
  isGameOver() {
    return this.winner !== null;
  }

  /**
   * Nombre de joueurs.
   */
  getPlayerCount() {
    return this.players.length;
  }

  /**
   * Nombre total de cartes encore visibles dans les mains.
   *
   * ATTENTION :
   * cette fonction ne tente pas de deviner les cartes inconnues.
   */
  getTotalKnownCardsInHands() {
    return this.players.reduce(
      (total, player) => {
        return total +
          player.main.filter(card => card !== null).length;
      },
      0
    );
  }

  /**
   * Nombre total de cartes présentes dans les mains,
   * connues ou inconnues.
   */
  getTotalCardsInHands() {
    return this.players.reduce(
      (total, player) => total + player.cardCount,
      0
    );
  }

  /**
   * Retourne les cartes connues d'un joueur.
   */
  getKnownCards(playerIndex) {
    const player = this.getPlayer(playerIndex);

    if (!player) {
      return [];
    }

    return player.main.filter(
      card => card !== null
    );
  }

  /**
   * Indique si une carte précise est connue dans la main
   * d'un joueur.
   */
  knowsCard(playerIndex, card) {
    return this.getKnownCards(playerIndex)
      .includes(card);
  }

  /**
   * Retourne la cible actuellement sélectionnée.
   */
  getTarget() {
    if (this.target == null) {
      return null;
    }

    return this.getPlayer(this.target);
  }

  /**
   * Vérifie que l'état peut être utilisé pour une décision.
   */
  isValidForDecision(playerIndex) {
    const player = this.getPlayer(playerIndex);

    if (!player) {
      return false;
    }

    if (this.roundEnded || this.winner !== null) {
      return false;
    }

    return Number(this.currentPlayer) === Number(playerIndex);
  }

  /**
   * Version sérialisable de l'état.
   *
   * Pratique pour les logs et le débogage.
   */
  toJSON() {
    return {
      players: this.players.map(player => ({
        id: player.id,
        name: player.name,
        score: player.score,
        bot: player.bot,
        cardCount: player.cardCount,
        main: player.main.slice()
      })),

      deckCount: this.deckCount,
      table: this.table.slice(),
      discard: this.discard.slice(),
      history: this.history,

      currentPlayer: this.currentPlayer,
      action: this.action,
      target: this.target,
      selection: cloneValue(this.selection),

      toursJoker: this.toursJoker,

      winner: cloneValue(this.winner),
      roundWinner: cloneValue(this.roundWinner),
      roundEnded: this.roundEnded,

      player17: this.player17,
      card17Pending: cloneValue(this.card17Pending),
      double17Cards: this.double17Cards.slice(),
      double17Active: this.double17Active,

      player19: this.player19,

      victories: cloneValue(this.victories),
      modeJeu: this.modeJeu
    };
  }
}

/**
 * Copie sécurisée des valeurs simples/tableaux/objets.
 *
 * On évite structuredClone ici afin de conserver une compatibilité
 * avec les environnements navigateur plus anciens.
 */
function cloneValue(value) {
  if (value === null || value === undefined) {
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
