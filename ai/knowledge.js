/**
 * Atoumoulin AI
 * knowledge.js
 *
 * Gestion des informations connues / inconnues.
 *
 * Principes :
 * - ne jamais révéler artificiellement une main adverse ;
 * - distinguer les copies d'une même carte ;
 * - conserver les cartes réellement observées ;
 * - calculer les possibilités restantes ;
 * - produire des scénarios pondérés pour la recherche ;
 * - exploiter les informations spéciales de 9, 17, 19, etc.
 */

import {
    normalizeCard
} from "./game-state.js";

import {
    getSelf,
    getOpponents,
    getPlayer,
    getPlayerTableCards,
    getPlayerPointCards,
    getLatestPointCard,
    getLatestPointCards,
    getCardsInHandsCount,
    getTotalDeckSize
} from "./state.js";


/* =========================================================
 * CONSTANTES
 * ========================================================= */

export const CARD_VALUES = [
    1, 2, 3, 4, 5, 6, 7,
    8, 9, 10, 11, 12, 13,
    14, 15, 16, 17, 18,
    19, 20, 21,
    "Joker"
];

export const COPIES_PER_DECK = 2;

export const DECK_COUNT_BY_PLAYERS = {
    2: 2,
    3: 2,
    4: 3,
    5: 4,
    6: 5,
    7: 6,
    8: 7
};


/* =========================================================
 * UTILITAIRES
 * ========================================================= */

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
        } catch {
            // fallback ci-dessous
        }
    }

    if (
        typeof value === "object"
    ) {
        if (Array.isArray(value)) {
            return value.map(clone);
        }

        const result = {};

        for (
            const [key, item] of
            Object.entries(value)
        ) {
            result[key] =
                clone(item);
        }

        return result;
    }

    return value;
}

function cardValue(card) {
    if (card == null) {
        return null;
    }

    if (
        typeof card === "number" ||
        typeof card === "string"
    ) {
        return card;
    }

    return (
        card.value ??
        card.valeur ??
        card.cardValue ??
        null
    );
}

function cardKey(card) {
    const value =
        cardValue(card);

    return String(value);
}

function normalizeValue(value) {
    if (
        typeof value === "string" &&
        value.toLowerCase() === "joker"
    ) {
        return "Joker";
    }

    const number =
        Number(value);

    if (
        Number.isFinite(number)
    ) {
        return number;
    }

    return value;
}

function isKnownCard(card) {
    if (!card) {
        return false;
    }

    if (
        card.unknown === true
    ) {
        return false;
    }

    return (
        cardValue(card) != null
    );
}

function getPlayers(state) {
    if (
        Array.isArray(
            state?.players
        )
    ) {
        return state.players;
    }

    if (
        Array.isArray(
            state?.joueurs
        )
    ) {
        return state.joueurs;
    }

    return [];
}

function getPlayerCount(state) {
    return getPlayers(state).length;
}

function getPlayerHand(state, index) {
    const player =
        getPlayers(state)[index];

    if (!player) {
        return [];
    }

    return (
        player.main ??
        player.hand ??
        []
    );
}

function getTable(state) {
    return (
        state?.table ??
        state?.cartesTable ??
        []
    );
}

function getDiscard(state) {
    return (
        state?.discard ??
        state?.defausse ??
        state?.defaussePouvoirs ??
        []
    );
}

function getCardOwner(card) {
    return (
        card?.owner ??
        card?.proprietaire ??
        card?.playerId ??
        null
    );
}

function isPointCard(card) {
    const value =
        Number(
            cardValue(card)
        );

    return (
        Number.isFinite(value) &&
        value !== 0
    );
}

function shuffle(array, random = Math.random) {
    const result =
        [...array];

    for (
        let i = result.length - 1;
        i > 0;
        i -= 1
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


/* =========================================================
 * DECK / COPIES
 * ========================================================= */

export function getDeckCountForPlayers(
    playerCount
) {
    return (
        DECK_COUNT_BY_PLAYERS[
            Number(playerCount)
        ] ??
        (
            Number(playerCount) <= 3
                ? 2
                : Number(playerCount) - 1
        )
    );
}

export function getTotalCopies(
    playerCount
) {
    return (
        getDeckCountForPlayers(
            playerCount
        ) *
        COPIES_PER_DECK
    );
}

/*
 * Important :
 *
 * Le jeu contient deux exemplaires de chaque valeur
 * dans chaque paquet.
 *
 * Exemple avec 2 paquets :
 *
 * 7 → 4 exemplaires
 *
 * On ne considère donc jamais :
 *
 *   "7 vu = tous les 7 connus"
 *
 * mais :
 *
 *   "1 exemplaire de 7 observé,
 *    X exemplaires encore possibles."
 */

export function getInitialCardCounts(
    playerCount
) {
    const copies =
        getDeckCountForPlayers(
            playerCount
        ) *
        COPIES_PER_DECK;

    const result =
        new Map();

    for (
        const value of CARD_VALUES
    ) {
        result.set(
            cardKey(value),
            copies
        );
    }

    return result;
}


/* =========================================================
 * CARD KNOWLEDGE
 * ========================================================= */

export class CardKnowledge {
    constructor({
        value = null,
        owner = null,
        location = "unknown",
        certainty = 0,
        source = null,
        copyId = null
    } = {}) {
        this.value =
            normalizeValue(value);

        this.owner =
            owner;

        this.location =
            location;

        this.certainty =
            Number(certainty) || 0;

        this.source =
            source;

        this.copyId =
            copyId;
    }

    clone() {
        return new CardKnowledge(
            clone(this)
        );
    }
}


/* =========================================================
 * KNOWLEDGE STATE
 * ========================================================= */

export class KnowledgeState {
    constructor({
        playerIndex = 0,
        playerCount = 0
    } = {}) {
        this.playerIndex =
            Number(playerIndex);

        this.playerCount =
            Number(playerCount);

        /*
         * Copies observées :
         *
         * "7" => 3 copies connues,
         * si elles ont réellement été vues.
         */
        this.knownCopies =
            new Map();

        /*
         * Copies impossibles pour un joueur.
         *
         * playerIndex ->
         *   Map(cardKey, count)
         */
        this.impossibleCopies =
            new Map();

        /*
         * Nombre d'emplacements inconnus
         * par joueur.
         */
        this.unknownSlots =
            new Map();

        /*
         * Contraintes par joueur.
         */
        this.opponentConstraints =
            new Map();

        /*
         * Distribution probabiliste.
         */
        this.distributions =
            new Map();

        /*
         * Informations révélées pendant
         * les actions précédentes.
         */
        this.events = [];

        /*
         * Cartes vues avec leur emplacement.
         */
        this.observedCards = [];

        /*
         * Informations spéciales.
         */
        this.special = {
            double9: [],
            card17: [],
            double17: [],
            card19: [],
            double19: []
        };
    }

    /* =====================================================
     * COPIES
     * ===================================================== */

    getKnownCount(value) {
        return (
            this.knownCopies.get(
                cardKey(value)
            ) || 0
        );
    }

    addKnownCopy(
        value,
        {
            owner = null,
            location = "unknown",
            source = "observation",
            certainty = 100
        } = {}
    ) {
        const key =
            cardKey(value);

        const count =
            this.getKnownCount(
                value
            );

        this.knownCopies.set(
            key,
            count + 1
        );

        this.observedCards.push(
            new CardKnowledge({
                value,
                owner,
                location,
                source,
                certainty,
                copyId:
                    `${key}:${count + 1}`
            })
        );
    }

    getRemainingCopies(
        value
    ) {
        const total =
            getDeckCountForPlayers(
                this.playerCount
            ) *
            COPIES_PER_DECK;

        return Math.max(
            0,
            total -
            this.getKnownCount(value)
        );
    }

    /* =====================================================
     * IMPOSSIBILITÉS
     * ===================================================== */

    getImpossibleCount(
        playerIndex,
        value
    ) {
        const map =
            this.impossibleCopies.get(
                Number(playerIndex)
            );

        if (!map) {
            return 0;
        }

        return (
            map.get(
                cardKey(value)
            ) || 0
        );
    }

    setImpossibleCount(
        playerIndex,
        value,
        count
    ) {
        const index =
            Number(playerIndex);

        if (
            !this.impossibleCopies.has(
                index
            )
        ) {
            this.impossibleCopies.set(
                index,
                new Map()
            );
        }

        this.impossibleCopies
            .get(index)
            .set(
                cardKey(value),
                Math.max(
                    0,
                    Number(count) || 0
                )
            );
    }

    addImpossibleCopy(
        playerIndex,
        value,
        count = 1
    ) {
        const current =
            this.getImpossibleCount(
                playerIndex,
                value
            );

        this.setImpossibleCount(
            playerIndex,
            value,
            current + count
        );
    }

    /* =====================================================
     * SLOTS INCONNUS
     * ===================================================== */

    setUnknownSlots(
        playerIndex,
        count
    ) {
        this.unknownSlots.set(
            Number(playerIndex),
            Math.max(
                0,
                Number(count) || 0
            )
        );
    }

    getUnknownSlots(
        playerIndex
    ) {
        return (
            this.unknownSlots.get(
                Number(playerIndex)
            ) || 0
        );
    }

    /* =====================================================
     * OBSERVATION DES MAINS
     * ===================================================== */

    registerOwnHand(
        state
    ) {
        const hand =
            getPlayerHand(
                state,
                this.playerIndex
            );

        for (
            const card of hand
        ) {
            if (
                !isKnownCard(card)
            ) {
                continue;
            }

            this.addKnownCopy(
                cardValue(card),
                {
                    owner:
                        this.playerIndex,
                    location:
                        "hand",
                    source:
                        "own-hand",
                    certainty: 100
                }
            );
        }
    }

    registerOpponentHands(
        state
    ) {
        for (
            let i = 0;
            i < this.playerCount;
            i += 1
        ) {
            if (
                i === this.playerIndex
            ) {
                continue;
            }

            const hand =
                getPlayerHand(
                    state,
                    i
                );

            const known =
                hand.filter(
                    isKnownCard
                );

            const unknown =
                Math.max(
                    0,
                    hand.length -
                    known.length
                );

            this.setUnknownSlots(
                i,
                unknown
            );

            /*
             * Les cartes connues d'un adversaire
             * sont enregistrées uniquement lorsqu'elles
             * ont réellement été révélées.
             */
            for (
                const card of known
            ) {
                this.addKnownCopy(
                    cardValue(card),
                    {
                        owner: i,
                        location:
                            "opponent-hand",
                        source:
                            "revealed-opponent-hand",
                        certainty: 100
                    }
                );
            }

            this.opponentConstraints.set(
                i,
                {
                    playerIndex: i,
                    cardCount:
                        hand.length,
                    knownCards:
                        known.map(
                            cardValue
                        ),
                    unknownSlots:
                        unknown,
                    certainty:
                        unknown === 0
                            ? 100
                            : 0
                }
            );
        }
    }


    /* =====================================================
     * TABLE
     * ===================================================== */

    registerTable(
        state
    ) {
        const table =
            getTable(state);

        for (
            const card of table
        ) {
            if (
                !isKnownCard(card)
            ) {
                continue;
            }

            this.addKnownCopy(
                cardValue(card),
                {
                    owner:
                        getCardOwner(card),
                    location:
                        "table",
                    source:
                        "visible-table",
                    certainty: 100
                }
            );
        }
    }


    /* =====================================================
     * DÉFAUSSE
     * ===================================================== */

    registerDiscard(
        state
    ) {
        const discard =
            getDiscard(state);

        for (
            const card of discard
        ) {
            if (
                !isKnownCard(card)
            ) {
                continue;
            }

            this.addKnownCopy(
                cardValue(card),
                {
                    owner: null,
                    location:
                        "discard",
                    source:
                        "visible-discard",
                    certainty: 100
                }
            );
        }
    }


    /* =====================================================
     * CONTRAINTES SPÉCIALES
     * ===================================================== */

    registerSpecialInformation(
        state
    ) {
        if (
            state.double9Active ||
            state.action === "double9"
        ) {
            this.special.double9.push({
                player:
                    state.currentPlayer,
                target:
                    state.target,
                visible:
                    true
            });
        }

        if (
            state.player17 != null ||
            state.card17Pending
        ) {
            this.special.card17.push({
                player:
                    state.player17 ??
                    state.currentPlayer,
                pending:
                    !!state.card17Pending
            });
        }

        if (
            state.double17Active ||
            state.action === "double17"
        ) {
            this.special.double17.push({
                player:
                    state.currentPlayer,
                target:
                    state.target,
                revealed:
                    Array.isArray(
                        state.double17Cards
                    )
                        ? clone(
                            state.double17Cards
                        )
                        : []
            });
        }

        if (
            state.player19 != null ||
            state.action === "19"
        ) {
            this.special.card19.push({
                player:
                    state.player19 ??
                    state.currentPlayer
            });
        }
    }


    /* =====================================================
     * HISTORIQUE
     * ===================================================== */

    registerHistory(
        state
    ) {
        const history =
            String(
                state.history || ""
            );

        if (!history) {
            return;
        }

        this.events.push({
            type: "history",
            value: history
        });
    }


    /* =====================================================
     * CONSTRUCTION
     * ===================================================== */

    build(
        state
    ) {
        this.playerCount =
            getPlayerCount(state);

        this.knownCopies.clear();
        this.impossibleCopies.clear();
        this.unknownSlots.clear();
        this.opponentConstraints.clear();
        this.distributions.clear();
        this.events = [];
        this.observedCards = [];

        this.registerOwnHand(
            state
        );

        this.registerOpponentHands(
            state
        );

        this.registerTable(
            state
        );

        this.registerDiscard(
            state
        );

        this.registerSpecialInformation(
            state
        );

        this.registerHistory(
            state
        );

        this.buildImpossibleCopies(
            state
        );

        this.buildDistributions(
            state
        );

        return this;
    }


    /* =====================================================
     * CARTES POSSIBLES
     * ===================================================== */

    getPossibleCopies(
        playerIndex
    ) {
        const index =
            Number(playerIndex);

        const result = [];

        const slots =
            this.getUnknownSlots(
                index
            );

        if (slots <= 0) {
            return result;
        }

        for (
            const value of CARD_VALUES
        ) {
            const remaining =
                this.getRemainingCopies(
                    value
                );

            const impossible =
                this.getImpossibleCount(
                    index,
                    value
                );

            const available =
                Math.max(
                    0,
                    remaining -
                    impossible
                );

            for (
                let i = 0;
                i < available;
                i += 1
            ) {
                result.push(
                    value
                );
            }
        }

        return result;
    }

    getPossibleUnknownCards(
        playerIndex
    ) {
        return this.getPossibleCopies(
            playerIndex
        );
    }


    /* =====================================================
     * CARTES IMPOSSIBLES
     * ===================================================== */

    buildImpossibleCopies(
        state
    ) {
        /*
         * Les cartes connues comme étant dans notre main
         * ne peuvent évidemment pas être dans une main
         * adverse.
         *
         * Même logique pour les cartes visibles sur la table.
         */
        for (
            let player = 0;
            player < this.playerCount;
            player += 1
        ) {
            if (
                player ===
                this.playerIndex
            ) {
                continue;
            }

            for (
                const value of CARD_VALUES
            ) {
                const known =
                    this.getKnownCount(
                        value
                    );

                /*
                 * On ne peut pas simplement mettre
                 * "copies connues" en impossibles :
                 * certaines copies connues peuvent être
                 * précisément chez cet adversaire.
                 */
                const knownForPlayer =
                    this.observedCards.filter(
                        card =>
                            Number(
                                card.owner
                            ) === player &&
                            cardKey(
                                card.value
                            ) ===
                            cardKey(value)
                    ).length;

                const impossible =
                    Math.max(
                        0,
                        known -
                        knownForPlayer
                    );

                this.setImpossibleCount(
                    player,
                    value,
                    impossible
                );
            }
        }

        /*
         * Une main adverse avec zéro slot inconnu
         * n'a plus de distribution cachée.
         */
        for (
            let player = 0;
            player < this.playerCount;
            player += 1
        ) {
            if (
                player ===
                this.playerIndex
            ) {
                continue;
            }

            const slots =
                this.getUnknownSlots(
                    player
                );

            if (
                slots === 0
            ) {
                continue;
            }

            /*
             * Si une carte a été explicitement révélée
             * comme absente de cette main, on peut renforcer
             * la contrainte.
             */
            const constraint =
                this.opponentConstraints.get(
                    player
                );

            if (
                constraint?.impossibleCards
            ) {
                for (
                    const value of
                    constraint.impossibleCards
                ) {
                    this.addImpossibleCopy(
                        player,
                        value
                    );
                }
            }
        }
    }


    /* =====================================================
     * DISTRIBUTION
     * ===================================================== */

    baseProbability(
        playerIndex,
        value
    ) {
        const slots =
            this.getUnknownSlots(
                playerIndex
            );

        if (slots <= 0) {
            return 0;
        }

        const possible =
            this.getPossibleCopies(
                playerIndex
            );

        if (!possible.length) {
            return 0;
        }

        const count =
            possible.filter(
                candidate =>
                    cardKey(candidate) ===
                    cardKey(value)
            ).length;

        return (
            count /
            possible.length
        );
    }

    getCardDistribution(
        playerIndex
    ) {
        const index =
            Number(playerIndex);

        if (
            this.distributions.has(
                index
            )
        ) {
            return clone(
                this.distributions.get(
                    index
                )
            );
        }

        const possible =
            this.getPossibleCopies(
                index
            );

        const distribution =
            {};

        if (!possible.length) {
            this.distributions.set(
                index,
                distribution
            );

            return distribution;
        }

        const counts =
            new Map();

        for (
            const value of possible
        ) {
            const key =
                cardKey(value);

            counts.set(
                key,
                (
                    counts.get(key) ||
                    0
                ) + 1
            );
        }

        for (
            const [
                key,
                count
            ] of counts
        ) {
            distribution[key] =
                count /
                possible.length;
        }

        this.distributions.set(
            index,
            distribution
        );

        return clone(
            distribution
        );
    }


    /* =====================================================
     * PROBABILITÉ D'UNE CARTE
     * ===================================================== */

    probability(
        playerIndex,
        value
    ) {
        return this.baseProbability(
            playerIndex,
            value
        );
    }

    probabilityHasCard(
        playerIndex,
        value
    ) {
        const slots =
            this.getUnknownSlots(
                playerIndex
            );

        if (slots <= 0) {
            return 0;
        }

        const distribution =
            this.getCardDistribution(
                playerIndex
            );

        const p =
            Number(
                distribution[
                    cardKey(value)
                ] || 0
            );

        /*
         * Approximation sans remise :
         * P(au moins une occurrence)
         *
         * 1 - (1-p)^slots
         *
         * Ici p représente la proportion
         * de cartes candidates de ce type.
         */
        return Math.max(
            0,
            Math.min(
                1,
                1 -
                Math.pow(
                    1 - p,
                    slots
                )
            )
        );
    }


    /* =====================================================
     * SCÉNARIOS
     * ===================================================== */

    generateScenarios(
        state,
        playerIndex = this.playerIndex,
        {
            limit = 12,
            random = Math.random
        } = {}
    ) {
        const opponents =
            getOpponents(
                state,
                playerIndex
            );

        const scenarios = [];

        /*
         * Scénario neutre :
         * aucune hypothèse particulière.
         */
        scenarios.push({
            id: "neutral",
            type: "neutral",
            probability: 0.20,
            assumptions: []
        });

        for (
            const opponent of opponents
        ) {
            const opponentIndex =
                Number(
                    opponent.id
                );

            const distribution =
                this.getCardDistribution(
                    opponentIndex
                );

            /*
             * Scénario "finition".
             *
             * On cherche les cartes susceptibles
             * de permettre rapidement une évolution
             * de score ou une combinaison utile.
             */
            const finishCandidates =
                Object.entries(
                    distribution
                )
                .sort(
                    (a, b) =>
                        b[1] - a[1]
                )
                .slice(0, 4)
                .map(
                    ([value, probability]) => ({
                        value:
                            normalizeValue(
                                value
                            ),
                        probability
                    })
                );

            scenarios.push({
                id:
                    `finish-${opponentIndex}`,
                type: "opponent-finish",
                opponent:
                    opponentIndex,
                probability: 0.12,
                assumptions:
                    finishCandidates
            });

            /*
             * Scénario manipulation :
             * l'adversaire possède potentiellement
             * une carte permettant de modifier fortement
             * l'état.
             */
            const manipulationValues = [
                1,
                3,
                9,
                13,
                17,
                19,
                21,
                "Joker"
            ];

            const manipulation =
                manipulationValues
                    .map(
                        value => ({
                            value,
                            probability:
                                this.probability(
                                    opponentIndex,
                                    value
                                )
                        })
                    )
                    .filter(
                        item =>
                            item.probability > 0
                    )
                    .sort(
                        (a, b) =>
                            b.probability -
                            a.probability
                    )
                    .slice(0, 5);

            scenarios.push({
                id:
                    `manipulation-${opponentIndex}`,
                type:
                    "opponent-manipulation",
                opponent:
                    opponentIndex,
                probability: 0.10,
                assumptions:
                    manipulation
            });

            /*
             * Scénario récupération :
             * main contenant des cartes moins
             * directement dangereuses.
             */
            scenarios.push({
                id:
                    `recovery-${opponentIndex}`,
                type:
                    "opponent-recovery",
                opponent:
                    opponentIndex,
                probability: 0.08,
                assumptions: []
            });
        }

        /*
         * On normalise les probabilités.
         */
        const selected =
            shuffle(
                scenarios,
                random
            ).slice(
                0,
                Math.max(
                    1,
                    Number(limit) || 12
                )
            );

        const total =
            selected.reduce(
                (sum, scenario) =>
                    sum +
                    Number(
                        scenario.probability ||
                        0
                    ),
                0
            );

        if (total <= 0) {
            return selected;
        }

        return selected.map(
            scenario => ({
                ...scenario,
                probability:
                    scenario.probability /
                    total
            })
        );
    }


    /* =====================================================
     * INCERTITUDE
     * ===================================================== */

    getUncertainty(
        playerIndex
    ) {
        const slots =
            this.getUnknownSlots(
                playerIndex
            );

        if (slots <= 0) {
            return 0;
        }

        const possible =
            this.getPossibleCopies(
                playerIndex
            );

        if (!possible.length) {
            return 0;
        }

        /*
         * Plus les cartes possibles sont nombreuses,
         * plus l'incertitude est importante.
         */
        const distinct =
            new Set(
                possible.map(
                    cardKey
                )
            ).size;

        return Math.max(
            0,
            Math.min(
                100,
                (
                    distinct /
                    CARD_VALUES.length
                ) *
                100
            )
        );
    }


    /* =====================================================
     * CERTITUDE
     * ===================================================== */

    getCertainty(
        playerIndex,
        value
    ) {
        const known =
            this.observedCards.filter(
                card =>
                    Number(
                        card.owner
                    ) ===
                    Number(playerIndex) &&
                    cardKey(
                        card.value
                    ) ===
                    cardKey(value)
            ).length;

        if (known > 0) {
            return 100;
        }

        const probability =
            this.probability(
                playerIndex,
                value
            );

        if (
            probability >= 0.80
        ) {
            return 80;
        }

        if (
            probability >= 0.50
        ) {
            return 55;
        }

        if (
            probability > 0
        ) {
            return 30;
        }

        return 0;
    }


    /* =====================================================
     * COPIE
     * ===================================================== */

    clone() {
        const result =
            new KnowledgeState({
                playerIndex:
                    this.playerIndex,
                playerCount:
                    this.playerCount
            });

        result.knownCopies =
            new Map(
                this.knownCopies
            );

        result.impossibleCopies =
            new Map(
                [...this.impossibleCopies]
                    .map(
                        ([player, map]) =>
                            [
                                player,
                                new Map(map)
                            ]
                    )
            );

        result.unknownSlots =
            new Map(
                this.unknownSlots
            );

        result.opponentConstraints =
            new Map(
                [...this.opponentConstraints]
                    .map(
                        ([player, value]) =>
                            [
                                player,
                                clone(value)
                            ]
                    )
            );

        result.distributions =
            new Map(
                [...this.distributions]
                    .map(
                        ([player, value]) =>
                            [
                                player,
                                clone(value)
                            ]
                    )
            );

        result.events =
            clone(this.events);

        result.observedCards =
            this.observedCards.map(
                card =>
                    card.clone()
            );

        result.special =
            clone(this.special);

        return result;
    }


    /* =====================================================
     * RÉSUMÉ
     * ===================================================== */

    summary() {
        const known = {};

        for (
            const [
                key,
                count
            ] of this.knownCopies
        ) {
            known[key] =
                count;
        }

        const unknown = {};

        for (
            const [
                player,
                count
            ] of this.unknownSlots
        ) {
            unknown[player] =
                count;
        }

        return {
            playerIndex:
                this.playerIndex,

            playerCount:
                this.playerCount,

            knownCopies:
                known,

            unknownSlots:
                unknown,

            uncertainties:
                Object.fromEntries(
                    [...this.unknownSlots.keys()]
                        .map(
                            player => [
                                player,
                                this.getUncertainty(
                                    player
                                )
                            ]
                        )
                ),

            special:
                clone(
                    this.special
                )
        };
    }
}


/* =========================================================
 * CONSTRUCTION
 * ========================================================= */

export function createKnowledgeState(
    state,
    playerIndex = 0
) {
    const knowledge =
        new KnowledgeState({
            playerIndex:
                Number(playerIndex),
            playerCount:
                getPlayerCount(state)
        });

    return knowledge.build(
        state
    );
}


/* =========================================================
 * MISE À JOUR APRÈS RÉVÉLATION
 * ========================================================= */

export function updateKnowledge(
    knowledge,
    {
        value,
        owner = null,
        location = "unknown",
        source = "reveal",
        certainty = 100
    } = {}
) {
    if (
        !knowledge ||
        value == null
    ) {
        return knowledge;
    }

    knowledge.addKnownCopy(
        value,
        {
            owner,
            location,
            source,
            certainty
        }
    );

    /*
     * Une nouvelle observation invalide
     * les distributions mises en cache.
     */
    knowledge.distributions.clear();

    return knowledge;
}


/* =========================================================
 * SCÉNARIOS APRÈS ACTION
 * ========================================================= */

export function generateKnowledgeScenarios(
    state,
    playerIndex = 0,
    options = {}
) {
    const knowledge =
        createKnowledgeState(
            state,
            playerIndex
        );

    return knowledge.generateScenarios(
        state,
        playerIndex,
        options
    );
}


/* =========================================================
 * EXPORT
 * ========================================================= */

export default {
    CARD_VALUES,
    COPIES_PER_DECK,
    DECK_COUNT_BY_PLAYERS,
    CardKnowledge,
    KnowledgeState,
    createKnowledgeState,
    updateKnowledge,
    generateKnowledgeScenarios,
    getDeckCountForPlayers,
    getTotalCopies,
    getInitialCardCounts
};
