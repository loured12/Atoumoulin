
/**
 * Atoumoulin AI
 * knowledge.js
 *
 * Gestion des informations accessibles au bot.
 *
 * Principe :
 *
 *   INFORMATION CERTAINE
 *        ↓
 *   CARTES INCONNUES
 *        ↓
 *   CONTRAINTES CONNUES
 *        ↓
 *   SCÉNARIOS PLAUSIBLES
 *
 * IMPORTANT :
 * Ce module ne révèle jamais une carte cachée.
 *
 * Une carte inconnue reste inconnue.
 * Les scénarios produits ici sont des hypothèses utilisées
 * uniquement pour l'évaluation stratégique.
 */

import {
    normalizeCard
} from "./game-state.js";


/* ============================================================
 * CONSTANTES
 * ========================================================== */

export const CARD_VALUES =
    Object.freeze([
        1, 2, 3, 4, 5, 6, 7,
        8, 9, 10, 11, 12, 13,
        14, 15, 16, 17, 18,
        19, 20, 21
    ]);


/*
 * Le Joker est représenté séparément car ce n'est pas une
 * valeur numérique classique.
 */
export const JOKER =
    "Joker";


export const ALL_CARD_TYPES =
    Object.freeze([
        ...CARD_VALUES,
        JOKER
    ]);


/*
 * Nombre total théorique de cartes utilisé par le jeu.
 *
 * Les valeurs viennent des règles fournies pour l'IA.
 */
export const TOTAL_CARDS_BY_PLAYERS =
    Object.freeze({
        2: 44,
        3: 44,
        4: 66,
        5: 88,
        6: 110,
        7: 132,
        8: 154
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

    if (typeof value === "object") {

        const result = {};

        for (
            const [key, item]
            of Object.entries(value)
        ) {
            result[key] =
                clone(item);
        }

        return result;
    }

    return value;
}


function clamp(
    value,
    min = 0,
    max = 100
) {

    return Math.max(
        min,
        Math.min(
            max,
            Number(value) || 0
        )
    );
}


function cardKey(card) {

    const normalized =
        normalizeCard(card);

    if (!normalized) {
        return null;
    }

    return String(
        normalized.value
    );
}


function shuffle(array, random = Math.random) {

    const result =
        array.slice();

    for (
        let i = result.length - 1;
        i > 0;
        i--
    ) {

        const j =
            Math.floor(
                random() * (i + 1)
            );

        [
            result[i],
            result[j]
        ] = [
            result[j],
            result[i]
        ];
    }

    return result;
}


/* ============================================================
 * CARTE / INFORMATION
 * ========================================================== */

export class CardKnowledge {

    constructor({
        card,
        source = "unknown",
        certainty = 0,
        owner = null,
        location = null
    } = {}) {

        this.card =
            card;

        this.source =
            source;

        this.certainty =
            clamp(
                certainty,
                0,
                100
            );

        this.owner =
            owner;

        this.location =
            location;
    }


    isCertain() {

        return (
            this.certainty >= 100
        );
    }


    isUnknown() {

        return (
            this.certainty <= 0
        );
    }


    clone() {

        return new CardKnowledge({
            card:
                clone(this.card),

            source:
                this.source,

            certainty:
                this.certainty,

            owner:
                this.owner,

            location:
                this.location
        });
    }
}


/* ============================================================
 * BASE DE CONNAISSANCE
 * ========================================================== */

export class KnowledgeState {

    constructor(gameState) {

        if (!gameState) {

            throw new Error(
                "KnowledgeState nécessite un GameState."
            );
        }

        this.game =
            gameState;

        this.botIndex =
            gameState.botIndex;

        /*
         * Cartes dont le bot connaît réellement la valeur.
         */
        this.knownCards = [];

        /*
         * Cartes dont le bot sait qu'elles ne peuvent pas
         * être dans une main adverse.
         */
        this.impossibleCards =
            new Map();

        /*
         * Cartes vues / sorties du jeu.
         */
        this.seenCards =
            new Map();

        /*
         * Contraintes sur chaque adversaire.
         */
        this.opponentConstraints =
            new Map();

        /*
         * Historique des informations.
         */
        this.events = [];

        this.build();
    }


    /* ========================================================
     * CONSTRUCTION
     * ====================================================== */

    build() {

        this.registerOwnHand();

        this.registerTable();

        this.registerDiscard();

        this.registerOpponentInformation();

        this.registerSpecialInformation();

        this.registerHistory();

        return this;
    }


    /* ========================================================
     * MAIN DU BOT
     * ====================================================== */

    registerOwnHand() {

        const hand =
            this.game.getOwnHand();

        for (
            let index = 0;
            index < hand.length;
            index++
        ) {

            const card =
                normalizeCard(
                    hand[index]
                );

            if (!card) {
                continue;
            }

            const key =
                cardKey(card);

            this.knownCards.push(
                new CardKnowledge({
                    card,
                    source:
                        "own-hand",
                    certainty:
                        100,
                    owner:
                        this.botIndex,
                    location:
                        "hand"
                })
            );

            this.markSeen(
                key,
                {
                    owner:
                        this.botIndex,

                    location:
                        "hand",

                    certainty:
                        100
                }
            );
        }
    }


    /* ========================================================
     * TABLE
     * ====================================================== */

    registerTable() {

        const table =
            this.game.getTableCards();

        for (
            let index = 0;
            index < table.length;
            index++
        ) {

            const card =
                normalizeCard(
                    table[index]
                );

            if (!card) {
                continue;
            }

            const key =
                cardKey(card);

            this.knownCards.push(
                new CardKnowledge({
                    card,
                    source:
                        "table",

                    certainty:
                        100,

                    owner:
                        card.owner,

                    location:
                        "table"
                })
            );

            this.markSeen(
                key,
                {
                    owner:
                        card.owner,

                    location:
                        "table",

                    certainty:
                        100
                }
            );
        }
    }


    /* ========================================================
     * DÉFAUSSE
     * ====================================================== */

    registerDiscard() {

        const discard =
            this.game.discard;

        if (!Array.isArray(discard)) {
            return;
        }

        for (
            const item of discard
        ) {

            const card =
                normalizeCard(item);

            /*
             * Certaines versions du jeu peuvent stocker
             * directement la valeur de la carte.
             */
            const key =
                cardKey(card ?? item);

            if (!key) {
                continue;
            }

            this.markSeen(
                key,
                {
                    owner:
                        null,

                    location:
                        "discard",

                    certainty:
                        100
                }
            );
        }
    }


    /* ========================================================
     * ADVERSAIRES
     * ====================================================== */

    registerOpponentInformation() {

        const opponents =
            this.game.getOpponents();

        for (
            const opponent
            of opponents
        ) {

            const constraints = {

                playerId:
                    opponent.id,

                cardCount:
                    opponent.cardCount,

                knownCards: [],

                unknownCards:
                    opponent.cardCount,

                possibleCards: [],

                impossibleCards: [],

                certainty:
                    "unknown"
            };

            /*
             * Normalement les cartes adverses sont masquées.
             *
             * Si exceptionnellement une carte est réellement
             * connue par le moteur, on la conserve.
             */
            if (
                opponent.handKnown
            ) {

                for (
                    const card
                    of opponent.main
                ) {

                    if (
                        card === null ||
                        card === undefined
                    ) {
                        continue;
                    }

                    constraints
                        .knownCards
                        .push(
                            clone(card)
                        );
                }

                constraints.unknownCards =
                    Math.max(
                        0,
                        opponent.cardCount -
                        constraints.knownCards.length
                    );

                constraints.certainty =
                    "partial";
            }


            /*
             * Par défaut, toutes les cartes non vues sont
             * candidates.
             */
            constraints.possibleCards =
                this.getPossibleUnknownCards();


            constraints.impossibleCards =
                this.getImpossibleCards();


            this.opponentConstraints.set(
                opponent.id,
                constraints
            );
        }
    }


    /* ========================================================
     * INFORMATIONS SPÉCIALES
     * ====================================================== */

    registerSpecialInformation() {

        /*
         * Double 9 :
         *
         * Lorsque le bot utilise lui-même Double 9,
         * le moteur peut temporairement révéler les mains.
         *
         * On ne considère cette information comme certaine
         * que lorsqu'elle est effectivement fournie dans la
         * vue du moteur.
         */
        if (
            this.game.isDouble9()
        ) {

            this.events.push({
                type:
                    "double9-active",

                player:
                    this.game.currentPlayer
            });
        }


        /*
         * 17 :
         *
         * Une carte volée avec 17 n'est pas connue avant
         * sa révélation effective.
         */
        if (
            this.game.isCard17()
        ) {

            this.events.push({
                type:
                    "card17-active",

                player:
                    this.game.player17,

                pending:
                    clone(
                        this.game.card17Pending
                    )
            });
        }


        /*
         * Double 17.
         */
        if (
            this.game.isDouble17()
        ) {

            this.events.push({
                type:
                    "double17-active",

                player:
                    this.game.currentPlayer,

                cards:
                    clone(
                        this.game.double17Cards
                    )
            });
        }


        /*
         * 19.
         */
        if (
            this.game.isCard19()
        ) {

            this.events.push({
                type:
                    "card19-active",

                player:
                    this.game.player19
            });
        }


        /*
         * Double 19.
         */
        if (
            this.game.isDouble19()
        ) {

            this.events.push({
                type:
                    "double19-active",

                player:
                    this.game.currentPlayer
            });
        }
    }


    /* ========================================================
     * HISTORIQUE
     * ====================================================== */

    registerHistory() {

        if (!this.game.history) {
            return;
        }

        this.events.push({
            type:
                "history",

            value:
                this.game.history
        });
    }


    /* ========================================================
     * CARTES VUES
     * ====================================================== */

    markSeen(
        key,
        information
    ) {

        if (!key) {
            return;
        }

        const existing =
            this.seenCards.get(
                key
            );

        if (
            !existing ||
            information.certainty >
                existing.certainty
        ) {

            this.seenCards.set(
                key,
                {
                    ...information
                }
            );
        }
    }


    hasSeen(card) {

        const key =
            cardKey(card);

        return (
            !!key &&
            this.seenCards.has(key)
        );
    }


    getSeenCards() {

        return Array.from(
            this.seenCards.entries()
        ).map(
            ([card, information]) => ({
                card,
                ...clone(information)
            })
        );
    }


    /* ========================================================
     * CARTES INCONNUES
     * ====================================================== */

    getPossibleUnknownCards() {

        return ALL_CARD_TYPES.filter(
            card =>
                !this.hasSeen(card)
        );
    }


    getImpossibleCards() {

        return Array.from(
            this.seenCards.keys()
        );
    }


    getUnknownCardPool() {

        return this
            .getPossibleUnknownCards()
            .slice();
    }


    /* ========================================================
     * PROBABILITÉS
     * ====================================================== */

    /**
     * Probabilité de base qu'une carte inconnue appartienne
     * à un adversaire donné.
     *
     * Cette valeur n'est PAS une reconstruction de sa main.
     *
     * Elle sert uniquement de distribution initiale.
     */
    baseProbability(
        playerIndex,
        card
    ) {

        const opponent =
            this.game.getOpponent(
                playerIndex
            );

        if (!opponent) {
            return 0;
        }

        if (
            this.hasSeen(card)
        ) {
            return 0;
        }

        const opponents =
            this.game.getOpponents();

        const totalUnknownSlots =
            opponents.reduce(
                (
                    total,
                    player
                ) =>
                    total +
                    player.cardCount,
                0
            );

        if (
            totalUnknownSlots <= 0
        ) {
            return 0;
        }

        return (
            opponent.cardCount /
            totalUnknownSlots
        );
    }


    /* ========================================================
     * DISTRIBUTION PAR ADVERSAIRE
     * ====================================================== */

    getCardDistribution(
        playerIndex
    ) {

        const possible =
            this.getPossibleUnknownCards();

        const result = [];

        for (
            const card
            of possible
        ) {

            result.push({
                card,

                probability:
                    this.baseProbability(
                        playerIndex,
                        card
                    )
            });
        }

        return result;
    }


    /* ========================================================
     * SCÉNARIOS
     * ====================================================== */

    /**
     * Construit quelques scénarios stratégiquement pertinents.
     *
     * Il ne s'agit PAS de prétendre connaître la main adverse.
     *
     * Chaque scénario est une hypothèse.
     */
    generateScenarios(
        playerIndex
    ) {

        const opponent =
            this.game.getOpponent(
                playerIndex
            );

        if (!opponent) {
            return [];
        }

        const pool =
            this.getUnknownCardPool();

        const handSize =
            opponent.cardCount;

        if (
            handSize <= 0
        ) {
            return [
                {
                    type:
                        "empty",

                    probability:
                        1,

                    cards: []
                }
            ];
        }


        const scenarios = [];


        /*
         * ----------------------------------------------------
         * Scénario neutre
         * ----------------------------------------------------
         *
         * Tirage selon la distribution disponible.
         */
        scenarios.push(
            this.createScenario(
                "neutral",
                pool,
                handSize
            )
        );


        /*
         * ----------------------------------------------------
         * Scénario finition
         * ----------------------------------------------------
         *
         * Favorise les cartes proches de la cible et les
         * valeurs permettant potentiellement une finition.
         */
        scenarios.push(
            this.createWeightedScenario(
                "finishing",
                pool,
                handSize,
                card =>
                    this.finishingWeight(
                        playerIndex,
                        card
                    )
            )
        );


        /*
         * ----------------------------------------------------
         * Scénario progression
         * ----------------------------------------------------
         */
        scenarios.push(
            this.createWeightedScenario(
                "progression",
                pool,
                handSize,
                card =>
                    this.progressionWeight(
                        playerIndex,
                        card
                    )
            )
        );


        /*
         * ----------------------------------------------------
         * Scénario manipulation
         * ----------------------------------------------------
         */
        scenarios.push(
            this.createWeightedScenario(
                "manipulation",
                pool,
                handSize,
                card =>
                    this.manipulationWeight(
                        card
                    )
            )
        );


        /*
         * ----------------------------------------------------
         * Scénario récupération
         * ----------------------------------------------------
         */
        scenarios.push(
            this.createWeightedScenario(
                "recovery",
                pool,
                handSize,
                card =>
                    this.recoveryWeight(
                        playerIndex,
                        card
                    )
            )
        );


        return this.normalizeScenarioProbabilities(
            scenarios
        );
    }


    /* ========================================================
     * SCÉNARIO NEUTRE
     * ====================================================== */

    createScenario(
        type,
        pool,
        handSize
    ) {

        const cards =
            pool.slice(
                0,
                Math.min(
                    handSize,
                    pool.length
                )
            );

        return {
            type,

            probability:
                1,

            cards
        };
    }


    /* ========================================================
     * SCÉNARIO PONDÉRÉ
     * ====================================================== */

    createWeightedScenario(
        type,
        pool,
        handSize,
        weightFunction
    ) {

        const weighted =
            pool.map(
                card => ({
                    card,

                    weight:
                        Math.max(
                            0.001,
                            Number(
                                weightFunction(
                                    card
                                )
                            ) || 0.001
                        )
                })
            );


        weighted.sort(
            (
                a,
                b
            ) =>
                b.weight -
                a.weight
        );


        /*
         * On prend un ensemble limité de cartes plausibles
         * afin de ne pas transformer la connaissance en
         * recherche exhaustive.
         */
        const candidateCount =
            Math.min(
                weighted.length,
                Math.max(
                    handSize * 3,
                    8
                )
            );


        const candidates =
            weighted.slice(
                0,
                candidateCount
            );


        const cards =
            candidates
                .slice(
                    0,
                    Math.min(
                        handSize,
                        candidates.length
                    )
                )
                .map(
                    item =>
                        item.card
                );


        return {
            type,

            probability:
                1,

            cards
        };
    }


    /* ========================================================
     * POIDS STRATÉGIQUES
     * ====================================================== */

    finishingWeight(
        playerIndex,
        card
    ) {

        const player =
            this.game.getOpponent(
                playerIndex
            );

        if (!player) {
            return 1;
        }

        const value =
            typeof card === "number"
                ? card
                : 0;

        if (
            typeof value !== "number"
        ) {
            return 1;
        }

        const score =
            Math.abs(
                player.score -
                value
            );

        /*
         * Plus la carte peut être directement pertinente pour
         * la distance au score, plus le poids augmente.
         */
        return (
            1 +
            Math.max(
                0,
                30 -
                score
            )
        );
    }


    progressionWeight(
        playerIndex,
        card
    ) {

        const player =
            this.game.getOpponent(
                playerIndex
            );

        if (!player) {
            return 1;
        }

        if (
            typeof card !== "number"
        ) {
            return 8;
        }

        /*
         * Une valeur numérique constitue une ressource
         * potentielle de progression.
         */
        return (
            5 +
            Math.min(
                25,
                Math.abs(card)
            )
        );
    }


    manipulationWeight(card) {

        /*
         * On ne considère pas ici qu'une carte est
         * automatiquement bonne ou mauvaise.
         *
         * On indique simplement que certaines cartes sont
         * susceptibles de produire davantage d'options de
         * manipulation.
         */
        const manipulationCards =
            new Set([
                1,
                3,
                9,
                11,
                13,
                17,
                19,
                21,
                15,
                "Joker"
            ]);

        return manipulationCards.has(
            card
        )
            ? 20
            : 5;
    }


    recoveryWeight(
        playerIndex,
        card
    ) {

        const player =
            this.game.getOpponent(
                playerIndex
            );

        if (!player) {
            return 1;
        }

        if (
            typeof card !== "number"
        ) {
            return 8;
        }

        /*
         * Plus le score est éloigné de la cible, plus les
         * possibilités de récupération deviennent pertinentes.
         */
        const distance =
            Math.abs(
                player.score
            );

        return (
            5 +
            Math.min(
                30,
                distance / 5
            )
        );
    }


    /* ========================================================
     * PROBABILITÉS DES SCÉNARIOS
     * ====================================================== */

    normalizeScenarioProbabilities(
        scenarios
    ) {

        if (
            !scenarios.length
        ) {
            return [];
        }

        /*
         * Distribution volontairement équilibrée.
         *
         * Elle sera affinée plus tard lorsque le moteur
         * d'évaluation et la simulation seront disponibles.
         */
        const base =
            1 /
            scenarios.length;

        return scenarios.map(
            scenario => ({
                ...scenario,

                probability:
                    base
            })
        );
    }


    /* ========================================================
     * ÉVALUATION D'UNE CARTE CACHÉE
     * ====================================================== */

    estimateCardProbability(
        playerIndex,
        card
    ) {

        const distribution =
            this.getCardDistribution(
                playerIndex
            );

        const result =
            distribution.find(
                item =>
                    String(item.card) ===
                    String(card)
            );

        return result
            ? result.probability
            : 0;
    }


    /* ========================================================
     * DANGER INFORMATIONNEL
     * ====================================================== */

    /**
     * Mesure simplement le niveau d'incertitude sur un
     * adversaire.
     *
     * Ce n'est PAS son danger stratégique.
     */
    uncertainty(
        playerIndex
    ) {

        const opponent =
            this.game.getOpponent(
                playerIndex
            );

        if (!opponent) {
            return 100;
        }

        if (
            opponent.cardCount <= 0
        ) {
            return 0;
        }

        if (
            opponent.handKnown
        ) {
            return 0;
        }

        return 100;
    }


    /* ========================================================
     * RÉSUMÉ
     * ====================================================== */

    summary() {

        const opponents =
            this.game.getOpponents();

        return {
            botIndex:
                this.botIndex,

            knownCards:
                this.knownCards.length,

            seenCards:
                this.seenCards.size,

            unknownCards:
                this.getUnknownCardPool()
                    .length,

            opponents:
                opponents.map(
                    opponent => ({
                        player:
                            opponent.id,

                        cardCount:
                            opponent.cardCount,

                        uncertainty:
                            this.uncertainty(
                                opponent.id
                            )
                    })
                ),

            events:
                clone(
                    this.events
                )
        };
    }


    /* ========================================================
     * COPIE
     * ====================================================== */

    clone() {

        const copy =
            Object.create(
                Object.getPrototypeOf(
                    this
                )
            );

        copy.game =
            this.game;

        copy.botIndex =
            this.botIndex;

        copy.knownCards =
            this.knownCards.map(
                card =>
                    card.clone()
            );

        copy.impossibleCards =
            new Map(
                this.impossibleCards
            );

        copy.seenCards =
            new Map(
                Array.from(
                    this.seenCards.entries()
                ).map(
                    ([key, value]) => [
                        key,
                        clone(value)
                    ]
                )
            );

        copy.opponentConstraints =
            new Map(
                Array.from(
                    this.opponentConstraints.entries()
                ).map(
                    ([key, value]) => [
                        key,
                        clone(value)
                    ]
                )
            );

        copy.events =
            clone(
                this.events
            );

        return copy;
    }
}


/* ============================================================
 * FACTORY
 * ========================================================== */

export function createKnowledge(
    gameState
) {

    return new KnowledgeState(
        gameState
    );
}


/* ============================================================
 * OUTILS RAPIDES
 * ========================================================== */

export function getKnownCards(
    gameState
) {

    return new KnowledgeState(
        gameState
    ).knownCards;
}


export function getUnknownCards(
    gameState
) {

    return new KnowledgeState(
        gameState
    ).getUnknownCardPool();
}


export function getOpponentScenarios(
    gameState,
    playerIndex
) {

    const knowledge =
        new KnowledgeState(
            gameState
        );

    return knowledge.generateScenarios(
        playerIndex
    );
}
