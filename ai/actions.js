/**
 * Génération des actions légalement disponibles pour le nouveau bot.
 *
 * IMPORTANT :
 * Ce module ne choisit PAS la meilleure action.
 *
 * Son rôle est uniquement de transformer :
 *
 *   état + connaissances
 *          ↓
 *   actions légalement possibles
 *
 * Une action représente toujours une opération complète.
 *
 * Exemple :
 *
 *   13 → cible joueur 2 → carte 40
 *
 * n'est pas simplement :
 *
 *   13
 *
 * Le moteur stratégique évaluera ensuite chaque action complète.
 */

export const ACTION_TYPES = Object.freeze({
  SIMPLE: "simple",
  DOUBLE: "double",
  EFFECT: "effect"
});

export const CARD_TYPES = Object.freeze({
  NORMAL: "normal",
  JOKER: "joker"
});

/**
 * Priorité générale des possibilités.
 *
 * Cette priorité sert uniquement à déterminer les catégories
 * légales à considérer.
 *
 * Elle ne signifie PAS :
 *
 *   "Double 7 est toujours meilleur."
 *
 * La stratégie choisira ensuite entre les possibilités du
 * niveau autorisé.
 */
export const ACTION_PRIORITY = Object.freeze([
  "double7",
  "simple7",
  "doubleX",
  "simple"
]);

/**
 * Représentation d'une action complète.
 */
export class BotAction {
  constructor(data = {}) {
    this.id =
      data.id ??
      createActionId();

    this.type =
      data.type ??
      ACTION_TYPES.SIMPLE;

    this.card =
      data.card ?? null;

    this.cards =
      Array.isArray(data.cards)
        ? data.cards.slice()
        : [];

    this.playerIndex =
      data.playerIndex == null
        ? null
        : Number(data.playerIndex);

    this.targetPlayer =
      data.targetPlayer == null
        ? null
        : Number(data.targetPlayer);

    this.targetCard =
      data.targetCard ?? null;

    this.effect =
      data.effect ?? null;

    this.args =
      Array.isArray(data.args)
        ? data.args.slice()
        : [];

    this.priority =
      data.priority ?? "simple";

    this.metadata =
      data.metadata
        ? cloneValue(data.metadata)
        : {};
  }

  /**
   * Copie indépendante.
   */
  clone() {
    return new BotAction({
      id: this.id,
      type: this.type,
      card: this.card,
      cards: this.cards,
      playerIndex: this.playerIndex,
      targetPlayer: this.targetPlayer,
      targetCard: this.targetCard,
      effect: this.effect,
      args: this.args,
      priority: this.priority,
      metadata: this.metadata
    });
  }

  /**
   * Retourne une description lisible.
   */
  describe() {
    const parts = [];

    if (this.card !== null) {
      parts.push(`carte ${this.card}`);
    }

    if (this.cards.length > 0) {
      parts.push(
        `cartes [${this.cards.join(", ")}]`
      );
    }

    if (this.targetPlayer !== null) {
      parts.push(
        `joueur ${this.targetPlayer}`
      );
    }

    if (this.targetCard !== null) {
      parts.push(
        `carte ${this.targetCard}`
      );
    }

    if (this.effect) {
      parts.push(
        `effet ${this.effect}`
      );
    }

    return parts.join(" → ");
  }
}

/**
 * Générateur principal.
 */
export class ActionGenerator {
  constructor(gameState, knowledge) {
    if (!gameState) {
      throw new Error(
        "ActionGenerator nécessite un GameState."
      );
    }

    if (!knowledge) {
      throw new Error(
        "ActionGenerator nécessite un KnowledgeState."
      );
    }

    this.state = gameState;
    this.knowledge = knowledge;

    this.botIndex =
      Number(knowledge.botIndex);
  }

  /**
   * Retourne toutes les actions actuellement légales.
   */
  generate() {
    if (
      !this.state.isValidForDecision(
        this.botIndex
      )
    ) {
      return [];
    }

    /*
     * Si une action intermédiaire est déjà en cours,
     * on génère les choix nécessaires pour terminer
     * cette action.
     *
     * Les actions intermédiaires seront complétées
     * progressivement avec les règles précises des cartes.
     */
    if (this.state.action !== null) {
      return this.generateContinuationActions();
    }

    const hand =
      this.knowledge.getOwnHand();

    if (!hand.length) {
      return [];
    }

    /*
     * ---------------------------------------------------------
     * 1. DOUBLE 7
     * ---------------------------------------------------------
     *
     * S'il existe au moins deux 7 :
     * la priorité Double 7 est disponible.
     *
     * Avec trois 7 ou plus, UNE SEULE paire est utilisée.
     */
    const sevens =
      hand.filter(card => isCard(card, 7));

    if (sevens.length >= 2) {
      return this.generateDouble7Actions();
    }

    /*
     * ---------------------------------------------------------
     * 2. 7 SIMPLE
     * ---------------------------------------------------------
     */
    if (sevens.length >= 1) {
      return this.generateSimple7Actions();
    }

    /*
     * ---------------------------------------------------------
     * 3. DOUBLE X
     * ---------------------------------------------------------
     *
     * Toutes les paires restantes sont candidates.
     */
    const doubles =
      this.findDoubles(hand);

    if (doubles.length > 0) {
      return this.generateDoubleActions(
        doubles
      );
    }

    /*
     * ---------------------------------------------------------
     * 4. CARTE SIMPLE
     * ---------------------------------------------------------
     */
    return this.generateSimpleActions(hand);
  }

  /**
   * Génération du Double 7.
   *
   * Trois 7 ne produisent pas trois cartes :
   * une seule paire est utilisée.
   */
  generateDouble7Actions() {
    const sevenCount =
      this.knowledge
        .getOwnHand()
        .filter(card => isCard(card, 7))
        .length;

    if (sevenCount < 2) {
      return [];
    }

    return [
      new BotAction({
        type: ACTION_TYPES.DOUBLE,
        card: 7,
        cards: [7, 7],
        playerIndex: this.botIndex,
        priority: "double7",
        effect: "double7",
        metadata: {
          countInHand: sevenCount,
          consumes: 2
        }
      })
    ];
  }

  /**
   * 7 simple.
   */
  generateSimple7Actions() {
    return [
      new BotAction({
        type: ACTION_TYPES.SIMPLE,
        card: 7,
        playerIndex: this.botIndex,
        priority: "simple7",
        effect: "simple7"
      })
    ];
  }

  /**
   * Doubles normales.
   */
  generateDoubleActions(doubles) {
    const actions = [];

    for (const pair of doubles) {
      const card = pair.card;

      /*
       * Une paire correspond toujours à une seule
       * possibilité de base.
       *
       * Les cibles/choix supplémentaires seront développés
       * dans generateCompleteActions().
       */
      actions.push(
        new BotAction({
          type: ACTION_TYPES.DOUBLE,
          card,
          cards: [card, card],
          playerIndex: this.botIndex,
          priority: "doubleX",
          effect: `double${card}`,
          metadata: {
            countInHand: pair.count,
            consumes: 2
          }
        })
      );
    }

    return actions;
  }

  /**
   * Cartes simples.
   */
  generateSimpleActions(hand) {
    const actions = [];

    /*
     * Chaque carte individuelle devient une possibilité
     * de départ.
     *
     * Les effets nécessitant une cible ou un choix seront
     * transformés en actions complètes plus bas.
     */
    for (const card of hand) {
      actions.push(
        new BotAction({
          type: ACTION_TYPES.SIMPLE,
          card,
          playerIndex: this.botIndex,
          priority: "simple"
        })
      );
    }

    return actions;
  }

  /**
   * Doubles présentes dans la main.
   */
  findDoubles(hand) {
    const counts = new Map();

    for (const card of hand) {
      /*
       * Joker n'est pas considéré comme un double
       * automatiquement.
       */
      if (card === null || isJoker(card)) {
        continue;
      }

      const current =
        counts.get(card) ?? 0;

      counts.set(
        card,
        current + 1
      );
    }

    const result = [];

    for (const [card, count] of counts) {
      if (count >= 2) {
        result.push({
          card,
          count
        });
      }
    }

    return result;
  }

  /**
   * Transforme les actions de base en actions complètes.
   *
   * Cette méthode sera progressivement enrichie avec toutes
   * les règles de ciblage et de sélection.
   */
  generateCompleteActions() {
    const baseActions =
      this.generate();

    const result = [];

    for (const action of baseActions) {
      const complete =
        this.expandAction(action);

      result.push(...complete);
    }

    return deduplicateActions(result);
  }

  /**
   * Expansion d'une action selon son effet.
   */
  expandAction(action) {
    const card = action.card;

    /*
     * Cartes nécessitant une cible.
     */
    if (
      card === 13 ||
      card === 17 ||
      card === 19
    ) {
      return this.expandTargetedAction(
        action
      );
    }

    /*
     * 21 possède plusieurs choix d'effet.
     */
    if (card === 21) {
      return this.expand21Action(
        action
      );
    }

    /*
     * Joker.
     */
    if (isJoker(card)) {
      return this.expandJokerAction(
        action
      );
    }

    /*
     * 1 peut nécessiter une sélection
     * d'adversaire dans certains cas.
     */
    if (card === 1) {
      return this.expandOneAction(
        action
      );
    }

    /*
     * Les autres cartes sont pour l'instant
     * directement exécutables.
     */
    return [action];
  }

  /**
   * Cartes 13 / 17 / 19.
   */
  expandTargetedAction(action) {
    const opponents =
      this.knowledge
        .getOpponents();

    /*
     * Si aucune cible n'est nécessaire,
     * l'action de base reste valable.
     */
    if (!opponents.length) {
      return [action];
    }

    const result = [];

    for (const opponent of opponents) {
      result.push(
        new BotAction({
          ...action,
          id: createActionId(),

          targetPlayer:
            opponent.id,

          metadata: {
            ...action.metadata,
            expanded: true,
            targetRequired: true
          }
        })
      );
    }

    return result;
  }

  /**
   * Carte 21.
   *
   * Les deux grandes possibilités décrites dans la conception :
   *
   *   +20
   *   -20
   *
   * sont représentées séparément.
   */
  expand21Action(action) {
    const result = [];

    /*
     * +20 pour soi.
     */
    result.push(
      new BotAction({
        ...action,
        id: createActionId(),

        effect: "plus20",

        args: [20],

        metadata: {
          ...action.metadata,
          expanded: true,
          targetType: "self"
        }
      })
    );

    /*
     * -20 sur chaque adversaire.
     */
    for (const opponent of this.knowledge.getOpponents()) {
      result.push(
        new BotAction({
          ...action,
          id: createActionId(),

          targetPlayer:
            opponent.id,

          effect: "moins20",

          args: [-20],

          metadata: {
            ...action.metadata,
            expanded: true,
            targetType: "opponent"
          }
        })
      );
    }

    return result;
  }

  /**
   * Carte 1.
   *
   * Les possibilités exactes dépendront des règles de
   * sélection des scores déjà exposées par le moteur.
   *
   * On conserve donc une action générique pour l'instant.
   */
  expandOneAction(action) {
    return [
      new BotAction({
        ...action,
        id: createActionId(),

        metadata: {
          ...action.metadata,
          expanded: true
        }
      })
    ];
  }

  /**
   * Joker.
   */
  expandJokerAction(action) {
    const result = [];

    const opponents =
      this.knowledge
        .getOpponents();

    /*
     * Chaque cible devient une possibilité complète.
     */
    for (const opponent of opponents) {
      result.push(
        new BotAction({
          ...action,
          id: createActionId(),

          targetPlayer:
            opponent.id,

          effect:
            "echangeScores",

          metadata: {
            ...action.metadata,
            expanded: true,
            targetRequired: true
          }
        })
      );
    }

    /*
     * Si aucune cible n'est nécessaire ou possible,
     * conserver également l'action de base.
     */
    if (result.length === 0) {
      result.push(action);
    }

    return result;
  }

  /**
   * Actions de continuation lorsqu'un effet est déjà en cours.
   *
   * Cette méthode sera complétée lorsque toutes les étapes
   * interactives des cartes auront été modélisées.
   */
  generateContinuationActions() {
    switch (this.state.action) {
      case "double9":
        return this.generateDouble9Continuation();

      case "double13":
        return this.generateDouble13Continuation();

      case "double17":
        return this.generateDouble17Continuation();

      case "double19":
        return this.generateDouble19Continuation();

      default:
        return [];
    }
  }

  generateDouble9Continuation() {
    /*
     * Double 9 est particulier :
     * il peut permettre de choisir un adversaire et d'obtenir
     * des informations supplémentaires.
     */
    return this.knowledge
      .getOpponents()
      .map(opponent =>
        new BotAction({
          type: ACTION_TYPES.EFFECT,
          card: 9,
          playerIndex: this.botIndex,
          targetPlayer: opponent.id,
          effect: "choisirAdversaireDouble9",
          priority: "doubleX",
          metadata: {
            continuation: true
          }
        })
      );
  }

  generateDouble13Continuation() {
    return this.knowledge
      .getOpponents()
      .map(opponent =>
        new BotAction({
          type: ACTION_TYPES.EFFECT,
          card: 13,
          playerIndex: this.botIndex,
          targetPlayer: opponent.id,
          effect: "choisirAdversaireDouble13",
          priority: "doubleX",
          metadata: {
            continuation: true
          }
        })
      );
  }

  generateDouble17Continuation() {
    return this.knowledge
      .getOpponents()
      .map(opponent =>
        new BotAction({
          type: ACTION_TYPES.EFFECT,
          card: 17,
          playerIndex: this.botIndex,
          targetPlayer: opponent.id,
          effect: "choisirAdversaireDouble17",
          priority: "doubleX",
          metadata: {
            continuation: true
          }
        })
      );
  }

  generateDouble19Continuation() {
    return this.knowledge
      .getOpponents()
      .map(opponent =>
        new BotAction({
          type: ACTION_TYPES.EFFECT,
          card: 19,
          playerIndex: this.botIndex,
          targetPlayer: opponent.id,
          effect: "choisirAdversaireDouble19",
          priority: "doubleX",
          metadata: {
            continuation: true
          }
        })
      );
  }
}

/**
 * Vérifie une carte.
 */
function isCard(card, value) {
  return Number(card) === Number(value);
}

/**
 * Détection du Joker.
 *
 * Le moteur peut utiliser "joker", "Joker" ou une représentation
 * différente. Cette fonction sera centralisée ici afin de pouvoir
 * l'adapter facilement.
 */
function isJoker(card) {
  return (
    card === "joker" ||
    card === "Joker" ||
    card === "JOKER"
  );
}

/**
 * Supprime les actions strictement identiques.
 */
function deduplicateActions(actions) {
  const seen = new Set();
  const result = [];

  for (const action of actions) {
    const key = JSON.stringify({
      type: action.type,
      card: action.card,
      cards: action.cards,
      targetPlayer: action.targetPlayer,
      targetCard: action.targetCard,
      effect: action.effect,
      args: action.args
    });

    if (seen.has(key)) {
      continue;
    }

    seen.add(key);
    result.push(action);
  }

  return result;
}

/**
 * Générateur d'identifiant local.
 */
let actionCounter = 0;

function createActionId() {
  actionCounter += 1;

  return `bot-action-${actionCounter}`;
}

/**
 * Copie profonde simple.
 */
function cloneValue(value) {
  if (
    value === null ||
    value === undefined
  ) {
    return value;
  }

  if (Array.isArray(value)) {
    return value.map(
      item => cloneValue(item)
    );
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
