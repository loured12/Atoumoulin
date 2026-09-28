/**
 * Atoumoulin AI
 * simulation.js
 *
 * Simulation virtuelle des ACTIONS COMPLÈTES.
 *
 * Principe :
 *
 *   état réel
 *      ↓
 *   action complète
 *      ↓
 *   copie virtuelle
 *      ↓
 *   application des conséquences
 *      ↓
 *   état résultant
 *
 * Règles importantes :
 * - ne modifie jamais l'état réel ;
 * - ne révèle jamais une main adverse cachée ;
 * - respecte cardIndex / indices ;
 * - respecte les choix de cartes de table ;
 * - conserve les informations inconnues ;
 * - permet au search.js de simuler plusieurs tours.
 */

import {
    cloneState,
    getVictoryTarget,
    hasExactTarget
} from "./state.js";


/* =========================================================
 * TYPES
 * ========================================================= */

export const ACTION_TYPES = {
    CARD: "card",
    DOUBLE: "double",
    TARGET: "target",
    TABLE_CARD: "table_card",
    TABLE_CARDS: "table_cards",
    EFFECT: "effect",
    CONTINUE: "continue",
    TERMINATE: "terminate",
    COMBINATION: "combination"
};


/* =========================================================
 * UTILITAIRES
 * ========================================================= */

function toNumber(value) {
    const n = Number(value);

    return Number.isFinite(n)
        ? n
        : null;
}


function cardValue(card) {
    if (
        card === null ||
        card === undefined
    ) {
        return null;
    }

    if (
        typeof card === "number"
    ) {
        return card;
    }

    if (
        typeof card === "string"
    ) {
        if (
            card.toLowerCase() === "joker"
        ) {
            return "Joker";
        }

        const n =
            Number(card);

        return Number.isFinite(n)
            ? n
            : card;
    }

    if (
        typeof card === "object"
    ) {
        return (
            card.value ??
            card.valeur ??
            card.cardValue ??
            null
        );
    }

    return null;
}


function sameCardValue(
    a,
    b
) {
    return (
        cardValue(a) ===
        cardValue(b)
    );
}


function cloneCard(card) {
    if (
        card === null ||
        card === undefined
    ) {
        return card;
    }

    if (
        typeof card !== "object"
    ) {
        return card;
    }

    return {
        ...card,

        historiqueCarte:
            Array.isArray(
                card.historiqueCarte
            )
                ? [...card.historiqueCarte]
                : card.historiqueCarte,

        history:
            Array.isArray(
                card.history
            )
                ? [...card.history]
                : card.history
    };
}


function getCardOwner(card) {
    if (
        !card ||
        typeof card !== "object"
    ) {
        return null;
    }

    return (
        card.owner ??
        card.proprietaire ??
        card.playerId ??
        null
    );
}


function setCardOwner(
    card,
    owner
) {
    if (
        !card ||
        typeof card !== "object"
    ) {
        return;
    }

    if (
        "owner" in card
    ) {
        card.owner = owner;
        return;
    }

    if (
        "proprietaire" in card
    ) {
        card.proprietaire = owner;
        return;
    }

    card.owner = owner;
}


function isPointCard(card) {
    const value =
        toNumber(
            cardValue(card)
        );

    return (
        value !== null &&
        value !== 0
    );
}


function ensureArray(value) {
    return Array.isArray(value)
        ? value
        : [];
}


/* =========================================================
 * ÉTAT VIRTUEL
 * ========================================================= */

export class VirtualGameState {

    constructor(source) {

        const raw =
            source instanceof VirtualGameState
                ? source.toMutableObject()
                : typeof source?.toMutableObject ===
                    "function"
                    ? source.toMutableObject()
                    : source;

        this.data =
            cloneState(
                raw || {}
            ) || {};

        this.players =
            this.data.players ??
            this.data.joueurs ??
            [];

        this.table =
            this.data.table ??
            this.data.cartesTable ??
            [];

        this.discard =
            this.data.discard ??
            this.data.defausse ??
            this.data.defaussePouvoirs ??
            [];

        this.deckCount =
            Number(
                this.data.deckCount ??
                this.data.paquet?.length ??
                0
            );

        this.currentPlayer =
            Number(
                this.data.currentPlayer ??
                this.data.joueurActuel ??
                0
            );

        this.action =
            this.data.action ??
            this.data.actionEnCours ??
            null;

        this.target =
            this.data.target ??
            this.data.cibleChoisie ??
            null;

        this.roundEnded =
            Boolean(
                this.data.roundEnded ??
                this.data.mancheTerminee
            );

        this.winner =
            this.data.winner ??
            this.data.gagnantManche ??
            null;

        this.revealedInformation = [];

        this.events = [];

        this.scoreDelta = {};

        for (
            let i = 0;
            i < this.players.length;
            i += 1
        ) {
            this.scoreDelta[i] = 0;
        }
    }


    get playerList() {
        return this.players;
    }


    getPlayer(index) {
        return (
            this.players[index] ??
            null
        );
    }


    getScore(index) {
        return Number(
            this.getPlayer(index)?.score ??
            0
        );
    }


    setScore(
        index,
        score
    ) {
        const player =
            this.getPlayer(index);

        if (!player) {
            return;
        }

        const oldScore =
            Number(
                player.score ?? 0
            );

        const next =
            Number(
                score ?? 0
            );

        player.score =
            next;

        this.scoreDelta[index] =
            next - oldScore;
    }


    addScore(
        index,
        amount
    ) {
        this.setScore(
            index,
            this.getScore(index) +
                Number(amount || 0)
        );
    }


    getHand(index) {
        const player =
            this.getPlayer(index);

        if (!player) {
            return [];
        }

        return (
            player.main ??
            player.hand ??
            []
        );
    }


    setHand(
        index,
        hand
    ) {
        const player =
            this.getPlayer(index);

        if (!player) {
            return;
        }

        if (
            "main" in player
        ) {
            player.main =
                hand;
        } else {
            player.hand =
                hand;
        }

        player.cardCount =
            hand.length;
    }


    removeHandCard(
        playerIndex,
        index
    ) {
        const hand =
            this.getHand(
                playerIndex
            );

        if (
            !Number.isInteger(index) ||
            index < 0 ||
            index >= hand.length
        ) {
            return null;
        }

        const removed =
            hand.splice(
                index,
                1
            )[0];

        this.setHand(
            playerIndex,
            hand
        );

        return removed;
    }


    addHandCard(
        playerIndex,
        card
    ) {
        const hand =
            this.getHand(
                playerIndex
            );

        hand.push(
            card
        );

        this.setHand(
            playerIndex,
            hand
        );
    }


    addTableCard(card) {
        this.table.push(
            card
        );
    }


    removeTableCard(index) {
        if (
            !Number.isInteger(index) ||
            index < 0 ||
            index >= this.table.length
        ) {
            return null;
        }

        return this.table.splice(
            index,
            1
        )[0];
    }


    addDiscardCard(card) {
        this.discard.push(
            card
        );
    }


    drawUnknownCard() {
        if (
            this.deckCount <= 0
        ) {
            return null;
        }

        this.deckCount -= 1;

        /*
         * La carte n'est volontairement
         * pas ajoutée à une main :
         *
         * sa valeur est inconnue.
         */
        return {
            value: null,
            unknown: true
        };
    }


    revealInformation(info) {
        this.revealedInformation.push(
            info
        );
    }


    event(
        type,
        data = {}
    ) {
        this.events.push({
            type,
            ...data
        });
    }


    setAction(action) {
        this.action =
            action;
    }


    setTarget(target) {
        this.target =
            target;
    }


    advanceTurn() {
        if (
            !this.players.length
        ) {
            return;
        }

        this.currentPlayer =
            (
                this.currentPlayer + 1
            ) %
            this.players.length;

        this.action = null;
        this.target = null;
    }


    checkEndConditions() {
        const target =
            getVictoryTarget(
                this
            );

        for (
            let i = 0;
            i < this.players.length;
            i += 1
        ) {
            if (
                this.getScore(i) ===
                target
            ) {
                this.roundEnded =
                    true;

                this.winner =
                    i;

                this.event(
                    "round-ended",
                    {
                        winner: i,
                        exact: true
                    }
                );

                return true;
            }
        }

        return false;
    }


    signature() {
        return JSON.stringify({
            players:
                this.players.map(
                    player => ({
                        score:
                            player.score,

                        cardCount:
                            player.cardCount ??
                            player.main?.length ??
                            player.hand?.length ??
                            0,

                        main:
                            Array.isArray(
                                player.main
                            )
                                ? player.main.map(
                                    card =>
                                        card?.unknown
                                            ? null
                                            : cardValue(card)
                                )
                                : null
                    })
                ),

            table:
                this.table.map(
                    card => ({
                        value:
                            cardValue(card),

                        owner:
                            getCardOwner(card)
                    })
                ),

            discard:
                this.discard.map(
                    cardValue
                ),

            deckCount:
                this.deckCount,

            currentPlayer:
                this.currentPlayer,

            action:
                this.action,

            target:
                this.target,

            roundEnded:
                this.roundEnded,

            winner:
                this.winner
        });
    }


    toMutableObject() {
        return {
            ...this.data,

            players:
                this.players,

            table:
                this.table,

            discard:
                this.discard,

            deckCount:
                this.deckCount,

            currentPlayer:
                this.currentPlayer,

            action:
                this.action,

            target:
                this.target,

            roundEnded:
                this.roundEnded,

            winner:
                this.winner
        };
    }
}


/* =========================================================
 * NORMALISATION DES ACTIONS
 * ========================================================= */

function normalizeAction(
    action
) {
    if (!action) {
        return null;
    }

    return {
        ...action,

        type:
            action.type ??
            action.kind ??
            ACTION_TYPES.EFFECT,

        card:
            action.card ??
            null,

        cardIndex:
            action.cardIndex ??
            null,

        indices:
            Array.isArray(
                action.indices
            )
                ? [...action.indices]
                : [],

        target:
            action.target ??
            null,

        effect:
            action.effect ??
            null,

        value:
            action.value ??
            null,

        tableCardIndex:
            action.tableCardIndex ??
            null,

        tableCardIndices:
            Array.isArray(
                action.tableCardIndices
            )
                ? [...action.tableCardIndices]
                : [],

        ownTableCardIndex:
            action.ownTableCardIndex ??
            null,

        targetTableCardIndex:
            action.targetTableCardIndex ??
            null,

        ownTableCardIndices:
            Array.isArray(
                action.ownTableCardIndices
            )
                ? [...action.ownTableCardIndices]
                : [],

        targetTableCardIndices:
            Array.isArray(
                action.targetTableCardIndices
            )
                ? [...action.targetTableCardIndices]
                : [],

        metadata:
            action.metadata ??
            {}
    };
}


/* =========================================================
 * CARTES DE TABLE
 * ========================================================= */

function getOwnedPointCards(
    state,
    playerIndex
) {
    const result = [];

    for (
        let i = 0;
        i < state.table.length;
        i += 1
    ) {
        const card =
            state.table[i];

        if (
            Number(
                getCardOwner(card)
            ) !==
            Number(playerIndex)
        ) {
            continue;
        }

        if (
            !isPointCard(card)
        ) {
            continue;
        }

        result.push({
            index: i,
            card
        });
    }

    return result;
}


function getLatestOwnedPointCards(
    state,
    playerIndex,
    count = 1
) {
    const all =
        getOwnedPointCards(
            state,
            playerIndex
        );

    return all
        .slice(
            Math.max(
                0,
                all.length - count
            )
        )
        .reverse();
}


function removeTableIndices(
    state,
    indices
) {
    const sorted =
        [...new Set(
            indices.filter(
                Number.isInteger
            )
        )]
            .sort(
                (a, b) => b - a
            );

    const removed = [];

    for (
        const index of sorted
    ) {
        const card =
            state.removeTableCard(
                index
            );

        if (card != null) {
            removed.push({
                index,
                card
            });
        }
    }

    return removed;
}


function addOwnedTableCard(
    state,
    playerIndex,
    card
) {
    const copy =
        cloneCard(card);

    setCardOwner(
        copy,
        playerIndex
    );

    state.addTableCard(
        copy
    );
}


/* =========================================================
 * ACTION CARD INDICES
 * ========================================================= */

function getSingleCardIndex(
    state,
    action
) {
    const index =
        Number(
            action.cardIndex
        );

    if (
        Number.isInteger(index) &&
        index >= 0
    ) {
        return index;
    }

    const card =
        cardValue(
            action.card
        );

    if (card == null) {
        return -1;
    }

    const hand =
        state.getHand(
            state.currentPlayer
        );

    return hand.findIndex(
        item =>
            sameCardValue(
                item,
                card
            )
    );
}


function getDoubleCardIndices(
    state,
    action
) {
    if (
        Array.isArray(
            action.indices
        ) &&
        action.indices.length >= 2
    ) {
        return [
            Number(
                action.indices[0]
            ),
            Number(
                action.indices[1]
            )
        ];
    }

    const card =
        cardValue(
            action.card
        );

    const hand =
        state.getHand(
            state.currentPlayer
        );

    const result = [];

    for (
        let i = 0;
        i < hand.length &&
        result.length < 2;
        i += 1
    ) {
        if (
            sameCardValue(
                hand[i],
                card
            )
        ) {
            result.push(i);
        }
    }

    return result;
}


/* =========================================================
 * 1
 * ========================================================= */

function apply1(
    state,
    action
) {
    const target =
        Number(action.target);

    if (
        !Number.isInteger(target)
    ) {
        return;
    }

    const candidates =
        getLatestOwnedPointCards(
            state,
            target,
            1
        );

    if (!candidates.length) {
        state.event(
            "card-1-no-card",
            { target }
        );

        state.drawUnknownCard();

        return;
    }

    const index =
        candidates[0].index;

    const card =
        state.removeTableCard(
            index
        );

    if (!card) {
        return;
    }

    state.addHandCard(
        state.currentPlayer,
        cloneCard(card)
    );

    state.addDiscardCard(
        cloneCard(card)
    );

    state.event(
        "card-1-steal",
        {
            player:
                state.currentPlayer,

            target,

            card:
                cardValue(card)
        }
    );

    state.drawUnknownCard();
}


function applyDouble1(
    state,
    action
) {
    const target =
        Number(action.target);

    if (
        !Number.isInteger(target)
    ) {
        return;
    }

    const cards =
        getLatestOwnedPointCards(
            state,
            target,
            2
        );

    const indices =
        cards.map(
            item => item.index
        );

    const removed =
        removeTableIndices(
            state,
            indices
        );

    for (
        const item of removed
    ) {
        state.addHandCard(
            state.currentPlayer,
            cloneCard(item.card)
        );

        state.addDiscardCard(
            cloneCard(item.card)
        );
    }

    state.event(
        "double-1-steal",
        {
            player:
                state.currentPlayer,

            target,

            count:
                removed.length
        }
    );

    state.drawUnknownCard();
}


/* =========================================================
 * 3
 * ========================================================= */

function apply3(
    state,
    action,
    amount = -20
) {
    const target =
        Number(action.target);

    if (
        !Number.isInteger(target)
    ) {
        return;
    }

    const delta =
        Number(
            action.value ??
            amount
        );

    state.addScore(
        target,
        delta
    );

    state.addTableCard({
        value: delta,
        owner: target,
        linked: true,
        sourceCard: 3
    });

    state.event(
        "card-3",
        {
            player:
                state.currentPlayer,

            target,

            amount: delta
        }
    );

    state.drawUnknownCard();
}


/* =========================================================
 * 9
 * ========================================================= */

function swapHands(
    state,
    playerA,
    playerB
) {
    const handA =
        state.getHand(
            playerA
        ).map(
            cloneCard
        );

    const handB =
        state.getHand(
            playerB
        ).map(
            cloneCard
        );

    state.setHand(
        playerA,
        handB
    );

    state.setHand(
        playerB,
        handA
    );
}


function apply9(
    state,
    action
) {
    const target =
        Number(action.target);

    if (
        !Number.isInteger(target)
    ) {
        return;
    }

    swapHands(
        state,
        state.currentPlayer,
        target
    );

    state.event(
        "card-9-swap",
        {
            player:
                state.currentPlayer,

            target
        }
    );

    /*
     * Double9 révèle les mains concernées
     * au joueur qui possède le Double9.
     */
    if (
        action.metadata?.double9Reveal
    ) {
        state.revealInformation({
            type: "double9",
            player:
                state.currentPlayer,
            target
        });
    }

    state.drawUnknownCard();
}


/* =========================================================
 * 11
 * ========================================================= */

function apply11(
    state,
    action,
    amount = 10
) {
    const delta =
        Number(
            action.value ??
            amount
        );

    state.addScore(
        state.currentPlayer,
        delta
    );

    state.addTableCard({
        value: delta,
        owner:
            state.currentPlayer,
        linked: true,
        sourceCard: 11
    });

    state.event(
        "card-11",
        {
            player:
                state.currentPlayer,

            amount: delta
        }
    );

    state.drawUnknownCard();
}


/* =========================================================
 * 13
 * ========================================================= */

function resolve13Index(
    state,
    action
) {
    const target =
        Number(action.target);

    if (
        !Number.isInteger(target)
    ) {
        return -1;
    }

    /*
     * Le générateur donne directement l'index.
     */
    if (
        Number.isInteger(
            Number(
                action.tableCardIndex
            )
        )
    ) {
        const index =
            Number(
                action.tableCardIndex
            );

        const card =
            state.table[index];

        if (
            card &&
            Number(
                getCardOwner(card)
            ) === target &&
            isPointCard(card)
        ) {
            return index;
        }
    }

    /*
     * Fallback uniquement pour compatibilité.
     */
    return (
        getLatestOwnedPointCards(
            state,
            target,
            1
        )[0]?.index ??
        -1
    );
}


function apply13(
    state,
    action
) {
    const target =
        Number(action.target);

    if (
        !Number.isInteger(target)
    ) {
        return;
    }

    const index =
        resolve13Index(
            state,
            action
        );

    if (
        index < 0
    ) {
        state.drawUnknownCard();

        return;
    }

    const card =
        state.removeTableCard(
            index
        );

    if (!card) {
        return;
    }

    addOwnedTableCard(
        state,
        state.currentPlayer,
        card
    );

    state.event(
        "card-13-steal",
        {
            player:
                state.currentPlayer,

            target,

            card:
                cardValue(card)
        }
    );

    state.drawUnknownCard();
}


function resolveDouble13Indices(
    state,
    action
) {
    const target =
        Number(action.target);

    if (
        !Number.isInteger(target)
    ) {
        return [];
    }

    /*
     * Le générateur donne les indices exacts.
     */
    const explicit =
        ensureArray(
            action.tableCardIndices
        )
            .map(Number)
            .filter(
                Number.isInteger
            );

    if (
        explicit.length
    ) {
        return explicit
            .filter(
                index => {
                    const card =
                        state.table[index];

                    return (
                        card &&
                        Number(
                            getCardOwner(card)
                        ) === target &&
                        isPointCard(card)
                    );
                }
            )
            .slice(0, 2);
    }

    /*
     * Compatibilité.
     */
    return getLatestOwnedPointCards(
        state,
        target,
        2
    ).map(
        item => item.index
    );
}


function applyDouble13(
    state,
    action
) {
    const target =
        Number(action.target);

    if (
        !Number.isInteger(target)
    ) {
        return;
    }

    const indices =
        resolveDouble13Indices(
            state,
            action
        );

    const removed =
        removeTableIndices(
            state,
            indices
        );

    for (
        const item of removed
    ) {
        addOwnedTableCard(
            state,
            state.currentPlayer,
            item.card
        );
    }

    state.event(
        "double-13-steal",
        {
            player:
                state.currentPlayer,

            target,

            count:
                removed.length
        }
    );

    state.drawUnknownCard();
}


/* =========================================================
 * 15
 * ========================================================= */

function resolve15Index(
    state,
    action
) {
    const index =
        Number(
            action.tableCardIndex
        );

    if (
        !Number.isInteger(index)
    ) {
        return -1;
    }

    const card =
        state.table[index];

    if (!card) {
        return -1;
    }

    if (
        Number(
            getCardOwner(card)
        ) !==
        Number(
            state.currentPlayer
        )
    ) {
        return -1;
    }

    if (
        !isPointCard(card)
    ) {
        return -1;
    }

    return index;
}


function updateTableCardValue(
    card,
    value
) {
    const copy =
        cloneCard(card);

    if (
        "value" in copy
    ) {
        copy.value =
            value;
    }

    if (
        "valeur" in copy
    ) {
        copy.valeur =
            value;
    }

    if (
        !("value" in copy) &&
        !("valeur" in copy)
    ) {
        copy.value =
            value;
    }

    return copy;
}


function apply15(
    state,
    action,
    multiplier = 2
) {
    const index =
        resolve15Index(
            state,
            action
        );

    if (
        index < 0
    ) {
        return;
    }

    const card =
        state.table[index];

    const oldValue =
        toNumber(
            cardValue(card)
        );

    if (
        oldValue === null ||
        oldValue === 0
    ) {
        return;
    }

    const newValue =
        oldValue *
        multiplier;

    state.table[index] =
        updateTableCardValue(
            card,
            newValue
        );

    /*
     * Seule la différence est ajoutée :
     *
     * 10 → 20 = +10
     * 10 → 30 = +20
     */
    state.addScore(
        state.currentPlayer,
        newValue - oldValue
    );

    state.event(
        multiplier === 3
            ? "double-15"
            : "card-15",
        {
            player:
                state.currentPlayer,

            tableCardIndex:
                index,

            oldValue,

            newValue
        }
    );

    state.drawUnknownCard();
}


/* =========================================================
 * 17
 * ========================================================= */

function apply17(
    state,
    action
) {
    const target =
        Number(action.target);

    if (
        !Number.isInteger(target)
    ) {
        return;
    }

    const hand =
        state.getHand(
            target
        );

    if (!hand.length) {
        state.event(
            "card-17-no-card",
            { target }
        );

        state.drawUnknownCard();

        return;
    }

    /*
     * L'index adverse n'est PAS exploité
     * lorsque la carte est encore inconnue.
     *
     * On choisit une carte abstraite parmi les
     * possibilités sans révéler sa valeur.
     */
    const stolen =
        state.removeHandCard(
            target,
            0
        );

    if (!stolen) {
        return;
    }

    const hiddenCard = {
        unknown: true,
        possibleValues: null,
        source: "card17",
        hiddenOriginal:
            cloneCard(stolen)
    };

    state.addHandCard(
        state.currentPlayer,
        hiddenCard
    );

    state.revealInformation({
        type: "hidden-card-stolen",
        source: 17,
        player:
            state.currentPlayer,
        target
    });

    state.event(
        "card-17-steal",
        {
            player:
                state.currentPlayer,

            target
        }
    );

    state.drawUnknownCard();
}


/* =========================================================
 * DOUBLE 17
 * ========================================================= */

function applyDouble17(
    state,
    action
) {
    const target =
        Number(action.target);

    if (
        !Number.isInteger(target)
    ) {
        return;
    }

    const hand =
        state.getHand(
            target
        );

    if (!hand.length) {
        return;
    }

    const count =
        Math.min(
            2,
            hand.length
        );

    const stolen = [];

    for (
        let i = 0;
        i < count;
        i += 1
    ) {
        const card =
            state.removeHandCard(
                target,
                0
            );

        if (!card) {
            continue;
        }

        const hidden = {
            unknown: true,
            possibleValues: null,
            source: "double17",
            hiddenOriginal:
                cloneCard(card)
        };

        state.addHandCard(
            state.currentPlayer,
            hidden
        );

        stolen.push(
            hidden
        );
    }

    state.revealInformation({
        type: "double17-cards-stolen",
        player:
            state.currentPlayer,
        target,
        count:
            stolen.length
    });

    state.event(
        "double-17-steal",
        {
            player:
                state.currentPlayer,

            target,

            count:
                stolen.length
        }
    );

    state.drawUnknownCard();
}


/* =========================================================
 * 19
 * ========================================================= */

function resolve19Pair(
    state,
    action
) {
    const ownIndex =
        Number(
            action.ownTableCardIndex
        );

    const targetIndex =
        Number(
            action.targetTableCardIndex
        );

    if (
        Number.isInteger(ownIndex) &&
        Number.isInteger(targetIndex)
    ) {
        const ownCard =
            state.table[ownIndex];

        const targetCard =
            state.table[targetIndex];

        if (
            ownCard &&
            targetCard &&
            Number(
                getCardOwner(ownCard)
            ) ===
                Number(
                    state.currentPlayer
                ) &&
            Number(
                getCardOwner(targetCard)
            ) ===
                Number(
                    action.target
                )
        ) {
            return {
                ownIndex,
                targetIndex
            };
        }
    }

    const own =
        getLatestOwnedPointCards(
            state,
            state.currentPlayer,
            1
        )[0];

    const target =
        getLatestOwnedPointCards(
            state,
            action.target,
            1
        )[0];

    if (
        !own ||
        !target
    ) {
        return null;
    }

    return {
        ownIndex:
            own.index,

        targetIndex:
            target.index
    };
}


function apply19(
    state,
    action
) {
    const target =
        Number(action.target);

    if (
        !Number.isInteger(target)
    ) {
        return;
    }

    const pair =
        resolve19Pair(
            state,
            action
        );

    if (!pair) {
        state.drawUnknownCard();

        return;
    }

    const {
        ownIndex,
        targetIndex
    } = pair;

    const ownCard =
        cloneCard(
            state.table[
                ownIndex
            ]
        );

    const targetCard =
        cloneCard(
            state.table[
                targetIndex
            ]
        );

    setCardOwner(
        ownCard,
        target
    );

    setCardOwner(
        targetCard,
        state.currentPlayer
    );

    state.table[
        ownIndex
    ] = targetCard;

    state.table[
        targetIndex
    ] = ownCard;

    state.event(
        "card-19-exchange",
        {
            player:
                state.currentPlayer,

            target,

            ownIndex,

            targetIndex
        }
    );

    state.drawUnknownCard();
}


function resolveDouble19Pairs(
    state,
    action
) {
    const ownIndices =
        ensureArray(
            action.ownTableCardIndices
        )
            .map(Number)
            .filter(
                Number.isInteger
            );

    const targetIndices =
        ensureArray(
            action.targetTableCardIndices
        )
            .map(Number)
            .filter(
                Number.isInteger
            );

    if (
        ownIndices.length &&
        targetIndices.length
    ) {
        const count =
            Math.min(
                2,
                ownIndices.length,
                targetIndices.length
            );

        const pairs = [];

        for (
            let i = 0;
            i < count;
            i += 1
        ) {
            pairs.push({
                ownIndex:
                    ownIndices[i],

                targetIndex:
                    targetIndices[i]
            });
        }

        return pairs;
    }

    const own =
        getLatestOwnedPointCards(
            state,
            state.currentPlayer,
            2
        );

    const target =
        getLatestOwnedPointCards(
            state,
            action.target,
            2
        );

    const count =
        Math.min(
            2,
            own.length,
            target.length
        );

    const pairs = [];

    for (
        let i = 0;
        i < count;
        i += 1
    ) {
        pairs.push({
            ownIndex:
                own[i].index,

            targetIndex:
                target[i].index
        });
    }

    return pairs;
}


function applyDouble19(
    state,
    action
) {
    const target =
        Number(action.target);

    if (
        !Number.isInteger(target)
    ) {
        return;
    }

    const pairs =
        resolveDouble19Pairs(
            state,
            action
        );

    /*
     * Il faut lire toutes les cartes AVANT
     * de modifier le tableau.
     */
    const exchanges = [];

    for (
        const pair of pairs
    ) {
        const ownCard =
            state.table[
                pair.ownIndex
            ];

        const targetCard =
            state.table[
                pair.targetIndex
            ];

        if (
            !ownCard ||
            !targetCard
        ) {
            continue;
        }

        if (
            Number(
                getCardOwner(
                    ownCard
                )
            ) !==
            Number(
                state.currentPlayer
            )
        ) {
            continue;
        }

        if (
            Number(
                getCardOwner(
                    targetCard
                )
            ) !==
            target
        ) {
            continue;
        }

        exchanges.push({
            ownIndex:
                pair.ownIndex,

            targetIndex:
                pair.targetIndex,

            ownCard:
                cloneCard(
                    ownCard
                ),

            targetCard:
                cloneCard(
                    targetCard
                )
        });
    }

    for (
        const exchange of exchanges
    ) {
        setCardOwner(
            exchange.ownCard,
            target
        );

        setCardOwner(
            exchange.targetCard,
            state.currentPlayer
        );

        state.table[
            exchange.ownIndex
        ] =
            exchange.targetCard;

        state.table[
            exchange.targetIndex
        ] =
            exchange.ownCard;
    }

    state.event(
        "double-19-exchange",
        {
            player:
                state.currentPlayer,

            target,

            count:
                exchanges.length
        }
    );

    state.drawUnknownCard();
}


/* =========================================================
 * 21
 * ========================================================= */

function apply21(
    state,
    action
) {
    const amount =
        Math.abs(
            Number(
                action.value ??
                20
            )
        );

    const target =
        action.target == null
            ? null
            : Number(
                action.target
            );

    if (
        target === null
    ) {
        state.addScore(
            state.currentPlayer,
            amount
        );

        state.addTableCard({
            value: amount,
            owner:
                state.currentPlayer,
            linked: true,
            sourceCard: 21
        });

        state.event(
            "card-21-self",
            {
                player:
                    state.currentPlayer,

                amount
            }
        );
    } else {
        const delta =
            -amount;

        state.addScore(
            target,
            delta
        );

        state.addTableCard({
            value: delta,
            owner: target,
            linked: true,
            sourceCard: 21
        });

        state.event(
            "card-21-target",
            {
                player:
                    state.currentPlayer,

                target,

                amount: delta
            }
        );
    }

    state.drawUnknownCard();
}


/* =========================================================
 * JOKER
 * ========================================================= */

function applyJoker(
    state,
    action
) {
    const effect =
        String(
            action.effect ?? ""
        ).toLowerCase();

    if (
        effect ===
            "exchange_scores" ||
        effect ===
            "exchange-scores" ||
        effect.includes(
            "exchange"
        )
    ) {
        const target =
            Number(action.target);

        if (
            !Number.isInteger(target)
        ) {
            return;
        }

        const ownScore =
            state.getScore(
                state.currentPlayer
            );

        const targetScore =
            state.getScore(
                target
            );

        state.setScore(
            state.currentPlayer,
            targetScore
        );

        state.setScore(
            target,
            ownScore
        );

        state.event(
            "joker-exchange",
            {
                player:
                    state.currentPlayer,

                target
            }
        );
    } else {
        const amount =
            Number(
                action.value ??
                10
            );

        state.addScore(
            state.currentPlayer,
            amount
        );

        state.addTableCard({
            value: amount,
            owner:
                state.currentPlayer,
            linked: true,
            sourceCard: "Joker"
        });

        state.event(
            "joker-score",
            {
                player:
                    state.currentPlayer,

                amount
            }
        );
    }

    state.drawUnknownCard();
}


/* =========================================================
 * CARTES SIMPLES
 * ========================================================= */

function applyOrdinaryCard(
    state,
    card
) {
    const value =
        toNumber(
            cardValue(card)
        );

    if (
        value === null
    ) {
        state.drawUnknownCard();

        return;
    }

    /*
     * Les cartes ordinaires sont ajoutées
     * comme cartes de score personnelles.
     */
    addOwnedTableCard(
        state,
        state.currentPlayer,
        card
    );

    state.addScore(
        state.currentPlayer,
        value
    );

    state.drawUnknownCard();
}


/* =========================================================
 * PLAY_CARD
 * ========================================================= */

function applyPlayCard(
    state,
    action
) {
    const index =
        getSingleCardIndex(
            state,
            action
        );

    if (
        index < 0
    ) {
        return false;
    }

    const card =
        state.removeHandCard(
            state.currentPlayer,
            index
        );

    if (!card) {
        return false;
    }

    const value =
        cardValue(card);

    state.event(
        "play-card",
        {
            player:
                state.currentPlayer,

            card:
                value,

            cardIndex:
                index
        }
    );

    switch (value) {

        case 1:
            apply1(
                state,
                action
            );
            break;

        case 3:
            apply3(
                state,
                action,
                -20
            );
            break;

        case 9:
            apply9(
                state,
                action
            );
            break;

        case 11:
            apply11(
                state,
                action,
                10
            );
            break;

        case 13:
            apply13(
                state,
                action
            );
            break;

        case 15:
            apply15(
                state,
                action,
                2
            );
            break;

        case 17:
            apply17(
                state,
                action
            );
            break;

        case 19:
            apply19(
                state,
                action
            );
            break;

        case 21:
            apply21(
                state,
                action
            );
            break;

        case "Joker":
            applyJoker(
                state,
                action
            );
            break;

        default:
            applyOrdinaryCard(
                state,
                card
            );
            break;
    }

    return true;
}


/* =========================================================
 * PLAY_DOUBLE
 * ========================================================= */

function applyPlayDouble(
    state,
    action
) {
    const indices =
        getDoubleCardIndices(
            state,
            action
        );

    if (
        indices.length < 2
    ) {
        return false;
    }

    /*
     * Suppression en ordre décroissant :
     * les indices restent valides.
     */
    const sorted =
        [...indices]
            .sort(
                (a, b) => b - a
            );

    const cards = [];

    for (
        const index of sorted
    ) {
        const card =
            state.removeHandCard(
                state.currentPlayer,
                index
            );

        if (card) {
            cards.push(card);
        }
    }

    if (
        cards.length !== 2
    ) {
        return false;
    }

    const value =
        cardValue(
            cards[0]
        );

    state.event(
        "play-double",
        {
            player:
                state.currentPlayer,

            card:
                value,

            indices:
                [...indices]
        }
    );

    switch (value) {

        case 1:
            applyDouble1(
                state,
                action
            );
            break;

        case 3:
            apply3(
                state,
                action,
                -40
            );
            break;

        case 9:
            apply9(
                state,
                {
                    ...action,
                    metadata: {
                        ...(action.metadata || {}),
                        double9Reveal: true
                    }
                }
            );
            break;

        case 11:
            apply11(
                state,
                action,
                20
            );
            break;

        case 13:
            applyDouble13(
                state,
                action
            );
            break;

        case 15:
            apply15(
                state,
                action,
                3
            );
            break;

        case 17:
            applyDouble17(
                state,
                action
            );
            break;

        case 19:
            applyDouble19(
                state,
                action
            );
            break;

        case 21:
            apply21(
                state,
                action
            );
            break;

        default:
            /*
             * Double d'une carte ordinaire :
             * les deux cartes sont jouées ensemble.
             */
            for (
                const card of cards
            ) {
                applyOrdinaryCard(
                    state,
                    card
                );
            }

            break;
    }

    return true;
}


/* =========================================================
 * ACTIONS INTERMÉDIAIRES
 * ========================================================= */

function applyContinue(
    state,
    action
) {
    state.event(
        "continue",
        {
            player:
                state.currentPlayer,

            action
        }
    );
}


function applyTerminate(
    state,
    action
) {
    state.event(
        "terminate",
        {
            player:
                state.currentPlayer,

            action
        }
    );

    state.action =
        null;

    state.target =
        null;
}


/* =========================================================
 * APPLICATION D'UNE ACTION
 * ========================================================= */

export function applyAction(
    state,
    rawAction
) {
    const action =
        normalizeAction(
            rawAction
        );

    if (
        !action
    ) {
        return false;
    }

    const type =
        String(
            action.type
        ).toLowerCase();

    if (
        type === "card" ||
        type === "play_card" ||
        type === "play-card"
    ) {
        return applyPlayCard(
            state,
            action
        );
    }

    if (
        type === "double" ||
        type === "play_double" ||
        type === "play-double"
    ) {
        return applyPlayDouble(
            state,
            action
        );
    }

    /*
     * Compatibilité avec les actions intermédiaires.
     */
    if (
        type === "continue"
    ) {
        applyContinue(
            state,
            action
        );

        return true;
    }

    if (
        type === "terminate"
    ) {
        applyTerminate(
            state,
            action
        );

        return true;
    }

    /*
     * Une action EFFECT/TARGET/TABLE_CARD complète
     * peut encore être fournie par un ancien appel.
     */
    if (
        type === "effect" ||
        type === "target" ||
        type === "table_card" ||
        type === "table_cards" ||
        type === "combination"
    ) {
        return applyEffectAction(
            state,
            action
        );
    }

    return false;
}


/* =========================================================
 * ACTION EFFECT / COMPATIBILITÉ
 * ========================================================= */

function applyEffectAction(
    state,
    action
) {
    const card =
        cardValue(
            action.card
        );

    const double =
        Boolean(
            action.metadata?.double ||
            action.double
        );

    switch (card) {

        case 1:
            double
                ? applyDouble1(
                    state,
                    action
                )
                : apply1(
                    state,
                    action
                );
            return true;

        case 3:
            apply3(
                state,
                action,
                double
                    ? -40
                    : -20
            );
            return true;

        case 9:
            apply9(
                state,
                action
            );
            return true;

        case 11:
            apply11(
                state,
                action,
                double
                    ? 20
                    : 10
            );
            return true;

        case 13:
            double
                ? applyDouble13(
                    state,
                    action
                )
                : apply13(
                    state,
                    action
                );
            return true;

        case 15:
            apply15(
                state,
                action,
                double
                    ? 3
                    : 2
            );
            return true;

        case 17:
            double
                ? applyDouble17(
                    state,
                    action
                )
                : apply17(
                    state,
                    action
                );
            return true;

        case 19:
            double
                ? applyDouble19(
                    state,
                    action
                )
                : apply19(
                    state,
                    action
                );
            return true;

        case 21:
            apply21(
                state,
                action
            );
            return true;

        case "Joker":
            applyJoker(
                state,
                action
            );
            return true;

        default:
            return false;
    }
}


/* =========================================================
 * FIN D'ACTION
 * ========================================================= */

function shouldAdvanceTurn(
    action
) {
    const type =
        String(
            action?.type ?? ""
        ).toLowerCase();

    return (
        type !== "continue" &&
        type !== "terminate"
    );
}


/* =========================================================
 * RÉSULTAT
 * ========================================================= */

export class SimulationResult {

    constructor({
        state = null,
        action = null,
        legal = false,
        completed = false,
        error = null,
        events = [],
        revealedInformation = [],
        scoreDelta = {},
        metadata = {}
    } = {}) {
        this.state =
            state;

        this.action =
            action;

        this.legal =
            legal;

        this.completed =
            completed;

        this.error =
            error;

        this.events =
            events;

        this.revealedInformation =
            revealedInformation;

        this.scoreDelta =
            scoreDelta;

        this.metadata =
            metadata;
    }


    get isUsable() {
        return (
            this.legal &&
            this.completed &&
            !!this.state
        );
    }
}


/* =========================================================
 * SIMULATION D'UNE ACTION
 * ========================================================= */

export function simulateAction(
    sourceState,
    action
) {
    if (
        !sourceState
    ) {
        return new SimulationResult({
            action,
            error:
                "État source absent."
        });
    }

    const virtual =
        new VirtualGameState(
            sourceState
        );

    const before =
        virtual.toMutableObject();

    try {

        const applied =
            applyAction(
                virtual,
                action
            );

        if (!applied) {
            return new SimulationResult({
                state:
                    virtual,

                action,

                legal: false,

                completed: false,

                error:
                    "Action impossible à simuler.",

                events:
                    virtual.events,

                revealedInformation:
                    virtual.revealedInformation,

                scoreDelta:
                    virtual.scoreDelta
            });
        }

        /*
         * Vérification de victoire immédiate.
         */
        virtual.checkEndConditions();

        /*
         * Une action complète terminée fait avancer
         * la simulation au prochain joueur.
         *
         * Si elle vient d'atteindre exactement la cible,
         * on ne force pas de tour supplémentaire.
         */
        if (
            !virtual.roundEnded &&
            shouldAdvanceTurn(
                action
            )
        ) {
            virtual.advanceTurn();
        }

        return new SimulationResult({
            state:
                virtual,

            action,

            legal: true,

            completed: true,

            events:
                virtual.events,

            revealedInformation:
                virtual.revealedInformation,

            scoreDelta:
                virtual.scoreDelta,

            metadata: {
                before,

                after:
                    virtual.toMutableObject(),

                exactTarget:
                    hasExactTarget(
                        virtual,
                        virtual.currentPlayer
                    ),

                victoryTarget:
                    getVictoryTarget(
                        virtual
                    ),

                roundEnded:
                    virtual.roundEnded,

                winner:
                    virtual.winner
            }
        });

    } catch (error) {

        return new SimulationResult({
            state:
                virtual,

            action,

            legal: false,

            completed: false,

            error:
                error?.message ??
                String(error),

            events:
                virtual.events,

            revealedInformation:
                virtual.revealedInformation,

            scoreDelta:
                virtual.scoreDelta
        });
    }
}


/* =========================================================
 * SIMULER PLUSIEURS ACTIONS
 * ========================================================= */

export function simulateActions(
    sourceState,
    actions
) {
    const list =
        ensureArray(
            actions
        );

    let current =
        sourceState;

    const results = [];

    for (
        const action of list
    ) {
        const result =
            simulateAction(
                current,
                action
            );

        results.push(
            result
        );

        if (
            !result.isUsable
        ) {
            break;
        }

        current =
            result.state;

        if (
            current.roundEnded
        ) {
            break;
        }
    }

    return results;
}


export function simulateLine(
    sourceState,
    actions
) {
    const list =
        ensureArray(
            actions
        );

    const results =
        simulateActions(
            sourceState,
            list
        );

    const last =
        results[
            results.length - 1
        ];

    return {
        state:
            last?.state ??
            null,

        results,

        completed:
            results.length ===
                list.length &&
            results.every(
                result =>
                    result.isUsable
            ),

        events:
            results.flatMap(
                result =>
                    result.events ??
                    []
            ),

        revealedInformation:
            results.flatMap(
                result =>
                    result.revealedInformation ??
                    []
            )
    };
}


/* =========================================================
 * CLONAGE
 * ========================================================= */

export function cloneSimulationState(
    state
) {
    return new VirtualGameState(
        state
    );
}


/* =========================================================
 * COMPARAISON
 * ========================================================= */

export function statesEqual(
    a,
    b
) {
    if (
        !a ||
        !b
    ) {
        return false;
    }

    const signatureA =
        typeof a.signature ===
        "function"
            ? a.signature()
            : JSON.stringify(a);

    const signatureB =
        typeof b.signature ===
        "function"
            ? b.signature()
            : JSON.stringify(b);

    return (
        signatureA ===
        signatureB
    );
}


/* =========================================================
 * DIFFÉRENCE ENTRE DEUX ÉTATS
 * ========================================================= */

function getPlayers(
    state
) {
    return (
        state?.players ??
        state?.joueurs ??
        []
    );
}


export function stateDifference(
    before,
    after
) {
    if (
        !before ||
        !after
    ) {
        return null;
    }

    const beforePlayers =
        getPlayers(
            before
        );

    const afterPlayers =
        getPlayers(
            after
        );

    const count =
        Math.max(
            beforePlayers.length,
            afterPlayers.length
        );

    const scoreDelta = {};

    for (
        let i = 0;
        i < count;
        i += 1
    ) {
        scoreDelta[i] =
            Number(
                afterPlayers[i]?.score ??
                0
            ) -
            Number(
                beforePlayers[i]?.score ??
                0
            );
    }

    return {
        scoreDelta,

        deckDelta:
            Number(
                after.deckCount ??
                0
            ) -
            Number(
                before.deckCount ??
                0
            ),

        currentPlayerChanged:
            Number(
                after.currentPlayer ??
                after.joueurActuel ??
                0
            ) !==
            Number(
                before.currentPlayer ??
                before.joueurActuel ??
                0
            ),

        roundEndedChanged:
            Boolean(
                after.roundEnded ??
                after.mancheTerminee
            ) !==
            Boolean(
                before.roundEnded ??
                before.mancheTerminee
            ),

        actionChanged:
            (
                after.action ??
                after.actionEnCours ??
                null
            ) !==
            (
                before.action ??
                before.actionEnCours ??
                null
            ),

        targetChanged:
            (
                after.target ??
                after.cibleChoisie ??
                null
            ) !==
            (
                before.target ??
                before.cibleChoisie ??
                null
            )
    };
}


/* =========================================================
 * EXPORTS UTILITAIRES
 * ========================================================= */

export {
    normalizeAction,
    cardValue,
    isPointCard,
    getLatestOwnedPointCards
};


/* =========================================================
 * EXPORT PAR DÉFAUT
 * ========================================================= */

export default {
    ACTION_TYPES,

    VirtualGameState,

    SimulationResult,

    applyAction,

    simulateAction,

    simulateActions,

    simulateLine,

    cloneSimulationState,

    statesEqual,

    stateDifference
};
