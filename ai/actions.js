/**
 * Atoumoulin AI
 * action.js
 *
 * Représentation canonique des ACTIONS COMPLÈTES de l'IA.
 *
 * Une action complète contient tout ce qui est nécessaire pour
 * déterminer un résultat de simulation.
 *
 * Exemples :
 *
 *   13 -> joueur 2 -> carte table 7
 *
 *   21 -> -20 -> joueur 1
 *
 *   Joker -> échange de scores -> joueur 3
 *
 *   Double13 -> joueur 2 -> cartes 4 et 8
 *
 * Ce module NE choisit jamais la meilleure action.
 */

export const ACTION_TYPES = Object.freeze({
    PLAY_CARD: "play_card",
    PLAY_DOUBLE: "play_double",

    TARGET: "target",
    TABLE_CARD: "table_card",
    TABLE_CARDS: "table_cards",

    EFFECT: "effect",
    CONTINUE: "continue",
    TERMINATE: "terminate"
});


/* ============================================================
 * UTILITAIRES
 * ========================================================== */

function clone(value) {
    if (value === null || value === undefined) {
        return value;
    }

    if (typeof structuredClone === "function") {
        try {
            return structuredClone(value);
        } catch {}
    }

    if (Array.isArray(value)) {
        return value.map(clone);
    }

    if (typeof value === "object") {
        const result = {};

        for (const [key, item] of Object.entries(value)) {
            result[key] = clone(item);
        }

        return result;
    }

    return value;
}


function normalizeNumber(value) {
    const number = Number(value);

    return Number.isFinite(number)
        ? number
        : null;
}


function cardValue(card) {
    if (
        card &&
        typeof card === "object"
    ) {
        if ("valeur" in card) {
            return card.valeur;
        }

        if ("value" in card) {
            return card.value;
        }
    }

    return card;
}


function sameCard(a, b) {
    return String(cardValue(a)) === String(cardValue(b));
}


function getPlayer(state, playerIndex) {
    return state?.players?.find(
        player =>
            Number(player.id) === Number(playerIndex)
    ) ?? state?.players?.[playerIndex] ?? null;
}


function getOpponentPlayers(state, botIndex) {
    return (state?.players ?? []).filter(
        player =>
            Number(player.id) !== Number(botIndex)
    );
}


function getPlayerName(state, playerIndex) {
    return getPlayer(state, playerIndex)?.name ?? null;
}


function getCardOwner(card) {
    if (!card || typeof card !== "object") {
        return null;
    }

    return (
        card.proprietaire ??
        card.owner ??
        null
    );
}


function getTableCardValue(card) {
    if (!card || typeof card !== "object") {
        return null;
    }

    return normalizeNumber(
        card.valeur ?? card.value
    );
}


function isPointCard(card) {
    const value = getTableCardValue(card);

    return (
        value !== null &&
        value !== 0
    );
}


/* ============================================================
 * DOUBLES
 * ========================================================== */

/**
 * Retourne les valeurs pouvant former un double.
 *
 * Trois exemplaires d'une carte donnent toujours UN seul
 * double. Le troisième exemplaire reste disponible pour
 * les tours futurs.
 */
export function findDoubles(hand = []) {
    const counts = new Map();

    for (const rawCard of hand) {
        const card = cardValue(rawCard);
        const key = String(card);

        counts.set(
            key,
            {
                value: card,
                count: (counts.get(key)?.count ?? 0) + 1
            }
        );
    }

    return Array.from(counts.values())
        .filter(entry => entry.count >= 2)
        .map(entry => entry.value);
}


/**
 * Retourne exactement deux indices d'une valeur.
 */
export function getDoubleIndices(
    hand = [],
    value
) {
    const indices = [];

    for (let index = 0; index < hand.length; index++) {
        if (sameCard(hand[index], value)) {
            indices.push(index);

            if (indices.length === 2) {
                break;
            }
        }
    }

    return indices;
}


/* ============================================================
 * CONSTRUCTEURS
 * ========================================================== */

export function createCardAction({
    card,
    cardIndex,
    target = null,
    effect = null,
    value = null,
    tableCardIndex = null,
    tableCardIndices = [],
    ownTableCardIndex = null,
    targetTableCardIndex = null,
    metadata = {}
} = {}) {
    const normalizedCard = cardValue(card);

    return {
        id: buildActionId({
            type: ACTION_TYPES.PLAY_CARD,
            card: normalizedCard,
            cardIndex,
            target,
            effect,
            value,
            tableCardIndex,
            tableCardIndices,
            ownTableCardIndex,
            targetTableCardIndex
        }),

        type: ACTION_TYPES.PLAY_CARD,

        card: normalizedCard,
        cardIndex,

        target,

        effect,
        value,

        tableCardIndex,
        tableCardIndices: Array.isArray(tableCardIndices)
            ? tableCardIndices.slice()
            : [],

        ownTableCardIndex,
        targetTableCardIndex,

        complete: true,

        metadata: clone(metadata)
    };
}


export function createDoubleAction({
    card,
    indices,
    target = null,
    effect = null,
    value = null,
    tableCardIndex = null,
    tableCardIndices = [],
    ownTableCardIndex = null,
    targetTableCardIndex = null,
    metadata = {}
} = {}) {
    const normalizedCard = cardValue(card);
    const normalizedIndices = Array.isArray(indices)
        ? indices.slice(0, 2)
        : [];

    return {
        id: buildActionId({
            type: ACTION_TYPES.PLAY_DOUBLE,
            card: normalizedCard,
            indices: normalizedIndices,
            target,
            effect,
            value,
            tableCardIndex,
            tableCardIndices,
            ownTableCardIndex,
            targetTableCardIndex
        }),

        type: ACTION_TYPES.PLAY_DOUBLE,

        card: normalizedCard,
        cardIndex: null,
        indices: normalizedIndices,

        target,

        effect,
        value,

        tableCardIndex,
        tableCardIndices: Array.isArray(tableCardIndices)
            ? tableCardIndices.slice()
            : [],

        ownTableCardIndex,
        targetTableCardIndex,

        complete: true,

        metadata: clone(metadata)
    };
}


export function createTargetAction({
    card = null,
    cardIndex = null,
    target,
    effect = null,
    value = null,
    metadata = {}
} = {}) {
    return {
        id: buildActionId({
            type: ACTION_TYPES.TARGET,
            card,
            cardIndex,
            target,
            effect,
            value
        }),

        type: ACTION_TYPES.TARGET,

        card,
        cardIndex,

        target,

        effect,
        value,

        complete: true,

        metadata: clone(metadata)
    };
}


export function createTableCardAction({
    card = null,
    cardIndex = null,
    target = null,
    tableCardIndex,
    effect = null,
    value = null,
    metadata = {}
} = {}) {
    return {
        id: buildActionId({
            type: ACTION_TYPES.TABLE_CARD,
            card,
            cardIndex,
            target,
            tableCardIndex,
            effect,
            value
        }),

        type: ACTION_TYPES.TABLE_CARD,

        card,
        cardIndex,

        target,

        tableCardIndex,

        effect,
        value,

        complete: true,

        metadata: clone(metadata)
    };
}


export function createTableCardsAction({
    card = null,
    cardIndex = null,
    target = null,
    tableCardIndices = [],
    effect = null,
    value = null,
    metadata = {}
} = {}) {
    const indices = Array.isArray(tableCardIndices)
        ? tableCardIndices.slice()
        : [];

    return {
        id: buildActionId({
            type: ACTION_TYPES.TABLE_CARDS,
            card,
            cardIndex,
            target,
            tableCardIndices: indices,
            effect,
            value
        }),

        type: ACTION_TYPES.TABLE_CARDS,

        card,
        cardIndex,

        target,

        tableCardIndices: indices,

        effect,
        value,

        complete: true,

        metadata: clone(metadata)
    };
}


export function createEffectAction({
    card = null,
    cardIndex = null,
    effect,
    value = null,
    target = null,
    metadata = {}
} = {}) {
    return {
        id: buildActionId({
            type: ACTION_TYPES.EFFECT,
            card,
            cardIndex,
            effect,
            value,
            target
        }),

        type: ACTION_TYPES.EFFECT,

        card,
        cardIndex,

        effect,
        value,
        target,

        complete: true,

        metadata: clone(metadata)
    };
}


export function createContinueAction({
    card = null,
    cardIndex = null,
    target = null,
    effect = "continue",
    metadata = {}
} = {}) {
    return {
        id: buildActionId({
            type: ACTION_TYPES.CONTINUE,
            card,
            cardIndex,
            target,
            effect
        }),

        type: ACTION_TYPES.CONTINUE,

        card,
        cardIndex,
        target,

        effect,

        complete: true,

        metadata: clone(metadata)
    };
}


export function createTerminateAction({
    card = null,
    cardIndex = null,
    target = null,
    effect = "terminate",
    metadata = {}
} = {}) {
    return {
        id: buildActionId({
            type: ACTION_TYPES.TERMINATE,
            card,
            cardIndex,
            target,

            effect
        }),

        type: ACTION_TYPES.TERMINATE,

        card,
        cardIndex,
        target,

        effect,

        complete: true,

        metadata: clone(metadata)
    };
}


/* ============================================================
 * IDENTIFIANTS
 * ========================================================== */

export function buildActionId(data = {}) {
    const parts = [
        data.type,
        data.card,
        data.cardIndex,
        Array.isArray(data.indices)
            ? data.indices.join(",")
            : null,
        data.target,
        data.effect,
        data.value,
        data.tableCardIndex,
        Array.isArray(data.tableCardIndices)
            ? data.tableCardIndices.join(",")
            : null,
        data.ownTableCardIndex,
        data.targetTableCardIndex
    ];

    return parts
        .filter(
            value =>
                value !== null &&
                value !== undefined &&
                value !== ""
        )
        .map(String)
        .join(":");
}


/* ============================================================
 * ACTIONS DE BASE
 * ========================================================== */

/**
 * Priorité obligatoire :
 *
 * 1. Double 7
 * 2. 7 simple
 * 3. Double X
 * 4. Carte simple
 */
export function getBaseActions(
    state,
    botIndex
) {
    const player =
        getPlayer(state, botIndex);

    if (!player) {
        return [];
    }

    const hand =
        Array.isArray(player.main)
            ? player.main
            : [];

    if (!hand.length) {
        return [];
    }


    /* --------------------------------------------------------
     * DOUBLE 7
     * ------------------------------------------------------ */

    const doubleSeven =
        getDoubleIndices(hand, 7);

    if (doubleSeven.length === 2) {
        return [
            createDoubleAction({
                card: 7,
                indices: doubleSeven
            })
        ];
    }


    /* --------------------------------------------------------
     * 7 SIMPLE
     * ------------------------------------------------------ */

    const sevenIndex =
        hand.findIndex(
            card => sameCard(card, 7)
        );

    if (sevenIndex !== -1) {
        return [
            createCardAction({
                card: 7,
                cardIndex: sevenIndex
            })
        ];
    }


    /* --------------------------------------------------------
     * DOUBLE X
     * ------------------------------------------------------ */

    const doubles =
        findDoubles(hand);

    if (doubles.length) {
        return doubles.map(
            value =>
                createDoubleAction({
                    card: value,
                    indices:
                        getDoubleIndices(
                            hand,
                            value
                        )
                })
        );
    }


    /* --------------------------------------------------------
     * CARTES SIMPLES
     * ------------------------------------------------------ */

    return hand.map(
        (card, index) =>
            createCardAction({
                card: cardValue(card),
                cardIndex: index
            })
    );
}


/* ============================================================
 * CIBLES
 * ========================================================== */

export function getAvailableTargets(
    state,
    botIndex,
    predicate = null
) {
    return getOpponentPlayers(
        state,
        botIndex
    )
        .filter(
            player =>
                !predicate ||
                predicate(player)
        )
        .map(
            player =>
                createTargetAction({
                    target: player.id
                })
        );
}


export function getPlayersWithCards(
    state,
    botIndex
) {
    return getOpponentPlayers(
        state,
        botIndex
    )
        .filter(
            player =>
                Number(player.cardCount ?? 0) > 0
        )
        .map(
            player => player.id
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
        getPlayer(state, playerId);

    if (!player) {
        return [];
    }

    const playerName =
        player.name;

    return (state.table ?? [])
        .map(
            (card, index) => ({
                card,
                index
            })
        )
        .filter(
            ({ card }) => {
                const owner =
                    getCardOwner(card);

                return (
                    (
                        owner === playerName ||
                        String(owner) === String(playerId)
                    ) &&
                    isPointCard(card)
                );
            }
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

    return cards.length
        ? cards[cards.length - 1]
        : null;
}


export function getPlayersWithPointCards(
    state,
    botIndex
) {
    return getOpponentPlayers(
        state,
        botIndex
    )
        .filter(
            player =>
                getPointCardsOfPlayer(
                    state,
                    player.id
                ).length > 0
        )
        .map(
            player => player.id
        );
}


/* ============================================================
 * 13
 * ========================================================== */

export function getStealableCards13(
    state,
    targetId
) {
    return getPointCardsOfPlayer(
        state,
        targetId
    ).map(
        ({ card, index }) =>
            createTableCardAction({
                card: 13,
                target: targetId,
                tableCardIndex: index,
                value:
                    getTableCardValue(card),
                metadata: {
                    stolenValue:
                        getTableCardValue(card)
                }
            })
    );
}


/* ============================================================
 * DOUBLE 13
 * ========================================================== */

export function getStealableCardsDouble13(
    state,
    targetId
) {
    const cards =
        getPointCardsOfPlayer(
            state,
            targetId
        );

    if (!cards.length) {
        return [];
    }

    /*
     * Une seule carte : elle constitue la seule possibilité.
     */
    if (cards.length === 1) {
        return [
            createTableCardsAction({
                card: 13,
                target: targetId,
                tableCardIndices: [
                    cards[0].index
                ]
            })
        ];
    }

    const result = [];

    /*
     * Toutes les combinaisons de deux cartes.
     */
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
            result.push(
                createTableCardsAction({
                    card: 13,
                    target: targetId,
                    tableCardIndices: [
                        cards[i].index,
                        cards[j].index
                    ]
                })
            );
        }
    }

    return result;
}


/* ============================================================
 * 15
 * ========================================================== */

export function getDouble15Targets(
    state,
    botIndex
) {
    return getPointCardsOfPlayer(
        state,
        botIndex
    ).map(
        ({ card, index }) =>
            createTableCardAction({
                card: 15,
                tableCardIndex: index,
                value:
                    getTableCardValue(card)
            })
    );
}


/**
 * Double 15 = triplement de la carte ciblée.
 *
 * Le nom historique "getDouble15Targets" reste réservé
 * au 15 simple. Cette fonction décrit explicitement
 * le comportement du Double 15.
 */
export function getTriple15Targets(
    state,
    botIndex
) {
    return getPointCardsOfPlayer(
        state,
        botIndex
    ).map(
        ({ card, index }) =>
            createTableCardAction({
                card: 15,
                tableCardIndex: index,
                value:
                    getTableCardValue(card),
                metadata: {
                    multiplier: 3
                }
            })
    );
}


/* ============================================================
 * 19
 * ========================================================== */

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
        const opponent
        of getOpponentPlayers(
            state,
            botIndex
        )
    ) {
        const target =
            getLastPointCardOfPlayer(
                state,
                opponent.id
            );

        if (!target) {
            continue;
        }

        result.push(
            createTargetAction({
                card: 19,
                target: opponent.id,
                metadata: {
                    ownTableCardIndex:
                        own.index,

                    targetTableCardIndex:
                        target.index
                }
            })
        );
    }

    return result;
}


/* ============================================================
 * DOUBLE 19
 * ========================================================== */

/**
 * Le moteur actuel échange les dernières cartes de points.
 *
 * Si deux cartes sont disponibles des deux côtés, la simulation
 * pourra en traiter jusqu'à deux.
 */
export function getDouble19Targets(
    state,
    botIndex
) {
    const own =
        getPointCardsOfPlayer(
            state,
            botIndex
        );

    if (!own.length) {
        return [];
    }

    const result = [];

    for (
        const opponent
        of getOpponentPlayers(
            state,
            botIndex
        )
    ) {
        const target =
            getPointCardsOfPlayer(
                state,
                opponent.id
            );

        if (!target.length) {
            continue;
        }

        const ownIndices =
            own
                .slice(-2)
                .map(item => item.index);

        const targetIndices =
            target
                .slice(-2)
                .map(item => item.index);

        result.push(
            createTargetAction({
                card: 19,
                target: opponent.id,
                metadata: {
                    ownTableCardIndices:
                        ownIndices,

                    targetTableCardIndices:
                        targetIndices
                }
            })
        );
    }

    return result;
}


/* ============================================================
 * 21
 * ========================================================== */

export function get21Actions(
    state,
    botIndex,
    card = 21
) {
    const multiplier =
        card === 21
            ? 1
            : 2;

    const positive =
        20 * multiplier;

    const negative =
        -20 * multiplier;

    const actions = [
        createEffectAction({
            card,
            effect: "score",
            value: positive
        })
    ];

    for (
        const opponent
        of getOpponentPlayers(
            state,
            botIndex
        )
    ) {
        actions.push(
            createEffectAction({
                card,
                effect: "score_target",
                value: negative,
                target: opponent.id
            })
        );
    }

    return actions;
}


/* ============================================================
 * JOKER
 * ========================================================== */

export function getJokerActions(
    state,
    botIndex
) {
    const actions = [
        createEffectAction({
            card: "Joker",
            effect: "score",
            value: 10
        }),

        createEffectAction({
            card: "Joker",
            effect: "score",
            value: 22
        })
    ];

    for (
        const opponent
        of getOpponentPlayers(
            state,
            botIndex
        )
    ) {
        actions.push(
            createEffectAction({
                card: "Joker",
                effect: "exchange_scores",
                target: opponent.id
            })
        );
    }

    return actions;
}


/* ============================================================
 * 17
 * ========================================================== */

export function get17Actions(
    state,
    botIndex,
    card = 17
) {
    return getPlayersWithCards(
        state,
        botIndex
    ).map(
        target =>
            createTargetAction({
                card,
                target,

                /*
                 * Le contenu de la carte volée reste inconnu.
                 */
                metadata: {
                    hiddenInformation: true,
                    stolenCardKnown: false,
                    revealRequired: true
                }
            })
    );
}


/* ============================================================
 * 9
 * ========================================================== */

export function get9Actions(
    state,
    botIndex,
    card = 9
) {
    return getAvailableTargets(
        state,
        botIndex
    ).map(
        action => ({
            ...action,

            id:
                `${card}:${action.target}`,

            type:
                ACTION_TYPES.TARGET,

            card,

            effect:
                "swap_hands",

            complete:
                true,

            metadata: {
                hiddenInformation:
                    card === 9
            }
        })
    );
}


/* ============================================================
 * 3
 * ========================================================== */

export function get3Actions(
    state,
    botIndex,
    card = 3
) {
    const value =
        card === 3
            ? -20
            : -40;

    return getAvailableTargets(
        state,
        botIndex
    ).map(
        action => ({
            ...action,

            id:
                `${card}:${action.target}`,

            card,

            effect:
                "score_target",

            value,

            complete:
                true
        })
    );
}


/* ============================================================
 * 1
 * ========================================================== */

export function get1Actions(
    state,
    botIndex,
    card = 1
) {
    return getPlayersWithPointCards(
        state,
        botIndex
    ).map(
        target =>
            createTargetAction({
                card,
                target,
                effect: "steal_latest_point",
                metadata: {
                    hiddenInformation: false
                }
            })
    );
}


/* ============================================================
 * VALIDATION
 * ========================================================== */

export function isCompleteAction(action) {
    return !!(
        action &&
        action.complete === true &&
        typeof action.type === "string" &&
        typeof action.id === "string"
    );
}


export function assertCompleteActions(
    actions
) {
    if (!Array.isArray(actions)) {
        throw new Error(
            "La liste d'actions doit être un tableau."
        );
    }

    for (const action of actions) {
        if (!isCompleteAction(action)) {
            throw new Error(
                `Action incomplète détectée : ${
                    action?.id ?? "sans identifiant"
                }`
            );
        }
    }

    return true;
}


/**
 * Signature stable utilisée par le moteur de recherche.
 */
export function actionSignature(action) {
    if (!action) {
        return "null";
    }

    return JSON.stringify({
        id: action.id,
        type: action.type,
        card: action.card,
        cardIndex: action.cardIndex,
        indices: action.indices,
        target: action.target,
        effect: action.effect,
        value: action.value,
        tableCardIndex:
            action.tableCardIndex,
        tableCardIndices:
            action.tableCardIndices,
        ownTableCardIndex:
            action.ownTableCardIndex,
        targetTableCardIndex:
            action.targetTableCardIndex
    });
}


/* ============================================================
 * VALIDATION PAR RAPPORT À L'ÉTAT
 * ========================================================== */

export function isActionApplicable(
    state,
    botIndex,
    action
) {
    if (!isCompleteAction(action)) {
        return false;
    }

    if (
        Number(state?.currentPlayer) !==
        Number(botIndex)
    ) {
        return false;
    }

    const player =
        getPlayer(state, botIndex);

    if (!player) {
        return false;
    }

    const hand =
        Array.isArray(player.main)
            ? player.main
            : [];

    /*
     * Vérification carte principale.
     */
    if (
        action.card !== null &&
        action.card !== undefined &&
        action.cardIndex !== null &&
        action.cardIndex !== undefined
    ) {
        if (
            action.cardIndex < 0 ||
            action.cardIndex >= hand.length
        ) {
            return false;
        }

        if (
            !sameCard(
                hand[action.cardIndex],
                action.card
            )
        ) {
            return false;
        }
    }

    /*
     * Vérification double.
     */
    if (
        action.type === ACTION_TYPES.PLAY_DOUBLE
    ) {
        if (
            !Array.isArray(action.indices) ||
            action.indices.length !== 2
        ) {
            return false;
        }

        for (const index of action.indices) {
            if (
                index < 0 ||
                index >= hand.length
            ) {
                return false;
            }

            if (
                !sameCard(
                    hand[index],
                    action.card
                )
            ) {
                return false;
            }
        }
    }

    /*
     * Vérification cible.
     */
    if (
        action.target !== null &&
        action.target !== undefined
    ) {
        const target =
            getPlayer(
                state,
                action.target
            );

        if (!target) {
            return false;
        }

        if (
            Number(target.id) ===
            Number(botIndex)
        ) {
            return false;
        }
    }

    /*
     * Vérification carte de table.
     */
    if (
        action.tableCardIndex !== null &&
        action.tableCardIndex !== undefined
    ) {
        if (
            !state.table?.[
                action.tableCardIndex
            ]
        ) {
            return false;
        }
    }

    /*
     * Vérification plusieurs cartes.
     */
    if (
        Array.isArray(
            action.tableCardIndices
        )
    ) {
        for (
            const index
            of action.tableCardIndices
        ) {
            if (
                !state.table?.[index]
            ) {
                return false;
            }
        }
    }

    return true;
}


/* ============================================================
 * DÉDUPLICATION / TRI
 * ========================================================== */

export function deduplicateActions(
    actions
) {
    const map = new Map();

    for (const action of actions ?? []) {
        if (!isCompleteAction(action)) {
            continue;
        }

        map.set(
            actionSignature(action),
            action
        );
    }

    return Array.from(
        map.values()
    );
}


export function actionPriority(action) {
    if (!action) {
        return Number.MAX_SAFE_INTEGER;
    }

    if (
        action.type === ACTION_TYPES.PLAY_DOUBLE &&
        Number(action.card) === 7
    ) {
        return 1;
    }

    if (
        action.type === ACTION_TYPES.PLAY_CARD &&
        Number(action.card) === 7
    ) {
        return 2;
    }

    if (
        action.type === ACTION_TYPES.PLAY_DOUBLE
    ) {
        return 3;
    }

    if (
        action.type === ACTION_TYPES.PLAY_CARD
    ) {
        return 4;
    }

    return 5;
}


export function sortActions(
    actions
) {
    return deduplicateActions(
        actions
    ).sort(
        (a, b) =>
            actionPriority(a) -
            actionPriority(b)
    );
}


/* ============================================================
 * VÉRIFICATION FINALE
 * ========================================================== */

export function validateActions(
    state,
    botIndex,
    actions
) {
    assertCompleteActions(actions);

    return actions.filter(
        action =>
            isActionApplicable(
                state,
                botIndex,
                action
            )
    );
}


/* ============================================================
 * EXPORT GLOBAL
 * ========================================================== */

export default {
    ACTION_TYPES,

    findDoubles,
    getDoubleIndices,

    createCardAction,
    createDoubleAction,
    createTargetAction,
    createTableCardAction,
    createTableCardsAction,
    createEffectAction,
    createContinueAction,
    createTerminateAction,

    getBaseActions,
    getAvailableTargets,
    getPlayersWithCards,
    getPlayersWithPointCards,

    getPointCardsOfPlayer,
    getLastPointCardOfPlayer,

    getStealableCards13,
    getStealableCardsDouble13,

    getDouble15Targets,
    getTriple15Targets,

    get19Targets,
    getDouble19Targets,

    get21Actions,
    getJokerActions,
    get17Actions,
    get9Actions,
    get3Actions,
    get1Actions,

    isCompleteAction,
    assertCompleteActions,
    actionSignature,
    isActionApplicable,

    deduplicateActions,
    actionPriority,
    sortActions,
    validateActions
};
