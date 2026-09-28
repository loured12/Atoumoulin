/**
 * Atoumoulin AI
 * simulation.js
 *
 * Simulation virtuelle des actions de l'IA.
 *
 * Principe :
 *
 *   état réel
 *       ↓
 *   action complète
 *       ↓
 *   copie virtuelle
 *       ↓
 *   application des règles
 *       ↓
 *   nouvel état
 *
 * La simulation :
 * - ne modifie jamais l'état réel ;
 * - respecte les informations cachées ;
 * - conserve l'incertitude ;
 * - applique les conséquences des cartes ;
 * - permet au search.js de prévoir plusieurs tours.
 */

import {
    cloneState,
    getSelf,
    getPlayer,
    getOpponents,
    getPlayerTableCards,
    getPlayerPointCards,
    getLatestPointCard,
    getLatestPointCards,
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

function number(value) {
    const n = Number(value);
    return Number.isFinite(n)
        ? n
        : null;
}

function cardValue(card) {
    if (card == null) {
        return null;
    }

    if (typeof card === "number") {
        return card;
    }

    if (typeof card === "string") {
        if (card.toLowerCase() === "joker") {
            return "Joker";
        }

        const n = Number(card);

        return Number.isFinite(n)
            ? n
            : card;
    }

    return (
        card.value ??
        card.valeur ??
        card.cardValue ??
        null
    );
}

function cardOwner(card) {
    if (!card || typeof card !== "object") {
        return null;
    }

    return (
        card.owner ??
        card.proprietaire ??
        card.playerId ??
        null
    );
}

function setCardOwner(card, owner) {
    if (!card || typeof card !== "object") {
        return;
    }

    if ("owner" in card) {
        card.owner = owner;
    }

    if ("proprietaire" in card) {
        card.proprietaire = owner;
    }

    if (
        !("owner" in card) &&
        !("proprietaire" in card)
    ) {
        card.owner = owner;
    }
}

function isPointCard(card) {
    const value = number(
        cardValue(card)
    );

    return (
        value !== null &&
        value !== 0
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
            Array.isArray(card.historiqueCarte)
                ? [...card.historiqueCarte]
                : card.historiqueCarte,

        history:
            Array.isArray(card.history)
                ? [...card.history]
                : card.history
    };
}

function ensureArray(value) {
    return Array.isArray(value)
        ? value
        : [];
}

function getPlayerMutable(state, index) {
    if (!state) {
        return null;
    }

    if (
        Array.isArray(state.players)
    ) {
        return state.players[index] || null;
    }

    if (
        Array.isArray(state.joueurs)
    ) {
        return state.joueurs[index] || null;
    }

    if (
        state.data &&
        Array.isArray(state.data.players)
    ) {
        return state.data.players[index] || null;
    }

    return null;
}

function getPlayersArray(state) {
    if (
        Array.isArray(state?.players)
    ) {
        return state.players;
    }

    if (
        Array.isArray(state?.joueurs)
    ) {
        return state.joueurs;
    }

    if (
        Array.isArray(state?.data?.players)
    ) {
        return state.data.players;
    }

    return [];
}


/* =========================================================
 * ÉTAT VIRTUEL
 * ========================================================= */

export class VirtualGameState {
    constructor(source) {
        const data =
            source instanceof VirtualGameState
                ? source.toMutableObject()
                : cloneState(
                    typeof source?.toMutableObject === "function"
                        ? source.toMutableObject()
                        : source
                );

        this.data =
            data || {};

        this.players =
            this.data.players ||
            this.data.joueurs ||
            [];

        this.table =
            this.data.table ||
            this.data.cartesTable ||
            [];

        this.discard =
            this.data.discard ||
            this.data.defausse ||
            this.data.defaussePouvoirs ||
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
            !!(
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

        for (let i = 0; i < this.players.length; i += 1) {
            this.scoreDelta[i] = 0;
        }
    }

    get playerList() {
        return this.players;
    }

    getPlayer(index) {
        return (
            this.players[index] ||
            null
        );
    }

    getScore(index) {
        const player =
            this.getPlayer(index);

        return Number(
            player?.score || 0
        );
    }

    setScore(index, score) {
        const player =
            this.getPlayer(index);

        if (!player) {
            return;
        }

        const oldScore =
            Number(player.score || 0);

        const next =
            Number(score || 0);

        player.score = next;

        this.scoreDelta[index] =
            next - oldScore;
    }

    addScore(index, amount) {
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

        return ensureArray(
            player.main ??
            player.hand
        );
    }

    setHand(index, hand) {
        const player =
            this.getPlayer(index);

        if (!player) {
            return;
        }

        if ("main" in player) {
            player.main = hand;
        } else {
            player.hand = hand;
        }

        player.cardCount =
            hand.length;
    }

    removeHandCard(
        playerIndex,
        cardIndex
    ) {
        const hand =
            this.getHand(
                playerIndex
            );

        if (
            cardIndex < 0 ||
            cardIndex >= hand.length
        ) {
            return null;
        }

        const [card] =
            hand.splice(
                cardIndex,
                1
            );

        this.setHand(
            playerIndex,
            hand
        );

        return card;
    }

    addHandCard(
        playerIndex,
        card
    ) {
        const hand =
            this.getHand(
                playerIndex
            );

        hand.push(card);

        this.setHand(
            playerIndex,
            hand
        );
    }

    addTableCard(card) {
        this.table.push(card);
    }

    removeTableCard(index) {
        if (
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
        this.discard.push(card);
    }

    drawUnknownCard() {
        /*
         * Nous ne révélons jamais une carte inconnue.
         *
         * Le nombre de cartes du paquet diminue,
         * mais aucune valeur n'est inventée.
         */
        if (this.deckCount <= 0) {
            return null;
        }

        this.deckCount -= 1;

        return {
            value: null,
            unknown: true,
            possibleValues: null
        };
    }

    revealInformation(info) {
        this.revealedInformation.push(
            info
        );
    }

    event(type, data = {}) {
        this.events.push({
            type,
            ...data
        });
    }

    advanceTurn() {
        if (!this.players.length) {
            return;
        }

        this.currentPlayer =
            (
                this.currentPlayer + 1
            ) % this.players.length;

        this.action = null;
        this.target = null;
    }

    setCurrentPlayer(index) {
        this.currentPlayer =
            Number(index);
    }

    setAction(action) {
        this.action = action;
    }

    setTarget(target) {
        this.target = target;
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
            const score =
                this.getScore(i);

            if (
                score === target
            ) {
                this.roundEnded = true;
                this.winner = i;

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

        /*
         * Au-dessus de la cible :
         * la manche n'est pas gagnée immédiatement.
         *
         * La règle de fin dépend de la partie réelle.
         * On conserve donc l'état sans inventer
         * de victoire automatique.
         */

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
                            cardOwner(card)
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
 * ACTION NORMALIZATION
 * ========================================================= */

function normalizeAction(action) {
    if (!action) {
        return null;
    }

    return {
        ...action,

        type:
            action.type ||
            action.kind ||
            ACTION_TYPES.EFFECT,

        cardIndex:
            action.cardIndex ?? null,

        card:
            action.card ?? null,

        cards:
            Array.isArray(action.cards)
                ? action.cards
                : [],

        target:
            action.target ?? null,

        effect:
            action.effect ?? null,

        value:
            action.value ?? null,

        tableCard:
            action.tableCard ?? null,

        tableCards:
            Array.isArray(
                action.tableCards
            )
                ? action.tableCards
                : [],

        metadata:
            action.metadata || {},

        parameters:
            action.parameters || {}
    };
}


/* =========================================================
 * CARTES EN MAIN
 * ========================================================= */

function resolveCardIndices(
    state,
    action
) {
    const index =
        Number(action.cardIndex);

    if (
        Number.isInteger(index) &&
        index >= 0
    ) {
        return [index];
    }

    const card =
        cardValue(
            action.card
        );

    if (card == null) {
        return [];
    }

    const hand =
        state.getHand(
            state.currentPlayer
        );

    const found = [];

    for (
        let i = 0;
        i < hand.length;
        i += 1
    ) {
        if (
            cardValue(hand[i]) === card
        ) {
            found.push(i);
        }
    }

    return found;
}

function removeCardsFromHand(
    state,
    playerIndex,
    indices
) {
    const sorted =
        [...indices]
            .filter(
                Number.isInteger
            )
            .sort(
                (a, b) => b - a
            );

    const removed = [];

    for (const index of sorted) {
        const card =
            state.removeHandCard(
                playerIndex,
                index
            );

        if (card != null) {
            removed.push(card);
        }
    }

    return removed;
}


/* =========================================================
 * TABLE / SCORE
 * ========================================================= */

function tableOwner(card) {
    return cardOwner(card);
}

function findTableCardIndex(
    state,
    playerIndex,
    value,
    fromLatest = true
) {
    const table =
        state.table;

    const indices = [];

    for (
        let i = 0;
        i < table.length;
        i += 1
    ) {
        const card =
            table[i];

        const owner =
            tableOwner(card);

        const cardValueNumber =
            number(
                cardValue(card)
            );

        if (
            Number(owner) ===
                Number(playerIndex) &&
            cardValueNumber ===
                Number(value)
        ) {
            indices.push(i);
        }
    }

    if (!indices.length) {
        return -1;
    }

    return fromLatest
        ? indices[indices.length - 1]
        : indices[0];
}

function getLatestOwnedPointCards(
    state,
    playerIndex,
    count = 1
) {
    const result = [];

    for (
        let i = state.table.length - 1;
        i >= 0 &&
        result.length < count;
        i -= 1
    ) {
        const card =
            state.table[i];

        if (
            Number(
                tableOwner(card)
            ) === Number(playerIndex) &&
            isPointCard(card)
        ) {
            result.push({
                card,
                index: i
            });
        }
    }

    return result;
}

function removeTableIndices(
    state,
    indices
) {
    const sorted =
        [...indices]
            .filter(
                Number.isInteger
            )
            .sort(
                (a, b) => b - a
            );

    const removed = [];

    for (const index of sorted) {
        const card =
            state.removeTableCard(
                index
            );

        if (card != null) {
            removed.push({
                card,
                index
            });
        }
    }

    return removed;
}

function addScoreCard(
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
 * 1
 * ========================================================= */

function applyCard1(
    state,
    action
) {
    const target =
        Number(action.target);

    if (!Number.isInteger(target)) {
        return;
    }

    const latest =
        getLatestOwnedPointCards(
            state,
            target,
            1
        );

    if (!latest.length) {
        state.event(
            "card-1-no-target-card",
            { target }
        );

        return;
    }

    const {
        card,
        index
    } = latest[0];

    state.removeTableCard(
        index
    );

    state.addDiscardCard(
        cloneCard(card)
    );

    state.addHandCard(
        state.currentPlayer,
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


/* =========================================================
 * DOUBLE 1
 * ========================================================= */

function applyDouble1(
    state,
    action
) {
    const target =
        Number(action.target);

    if (!Number.isInteger(target)) {
        return;
    }

    const latest =
        getLatestOwnedPointCards(
            state,
            target,
            2
        );

    if (!latest.length) {
        return;
    }

    const indices =
        latest.map(
            item => item.index
        );

    const removed =
        removeTableIndices(
            state,
            indices
        );

    for (const item of removed) {
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

function applyCard3(
    state,
    action
) {
    const target =
        Number(action.target);

    if (!Number.isInteger(target)) {
        return;
    }

    const amount =
        Number(
            action.value ??
            action.metadata?.amount ??
            -20
        );

    state.addScore(
        target,
        amount
    );

    state.addTableCard({
        value: amount,
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
            amount
        }
    );

    state.drawUnknownCard();
}


/* =========================================================
 * DOUBLE 3
 * ========================================================= */

function applyDouble3(
    state,
    action
) {
    const target =
        Number(action.target);

    if (!Number.isInteger(target)) {
        return;
    }

    const amount =
        Number(
            action.value ??
            action.metadata?.amount ??
            -40
        );

    state.addScore(
        target,
        amount
    );

    state.addTableCard({
        value: amount,
        owner: target,
        linked: true,
        sourceCard: 3,
        double: true
    });

    state.event(
        "double-3",
        {
            player:
                state.currentPlayer,
            target,
            amount
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
        state.getHand(playerA)
            .map(cloneCard);

    const handB =
        state.getHand(playerB)
            .map(cloneCard);

    state.setHand(
        playerA,
        handB
    );

    state.setHand(
        playerB,
        handA
    );
}

function applyCard9(
    state,
    action
) {
    const target =
        Number(action.target);

    if (!Number.isInteger(target)) {
        return;
    }

    swapHands(
        state,
        state.currentPlayer,
        target
    );

    state.event(
        "card-9-swap-hands",
        {
            player:
                state.currentPlayer,
            target
        }
    );

    state.drawUnknownCard();
}


/* =========================================================
 * DOUBLE 9
 * ========================================================= */

function applyDouble9(
    state,
    action
) {
    const target =
        Number(action.target);

    if (!Number.isInteger(target)) {
        return;
    }

    swapHands(
        state,
        state.currentPlayer,
        target
    );

    state.revealInformation({
        type: "double9",
        player:
            state.currentPlayer,
        target
    });

    state.event(
        "double-9-swap-hands",
        {
            player:
                state.currentPlayer,
            target
        }
    );

    state.drawUnknownCard();
}


/* =========================================================
 * 11
 * ========================================================= */

function applyCard11(
    state
) {
    state.addScore(
        state.currentPlayer,
        10
    );

    state.addTableCard({
        value: 10,
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
            amount: 10
        }
    );

    state.drawUnknownCard();
}


/* =========================================================
 * DOUBLE 11
 * ========================================================= */

function applyDouble11(
    state
) {
    state.addScore(
        state.currentPlayer,
        20
    );

    state.addTableCard({
        value: 20,
        owner:
            state.currentPlayer,
        linked: true,
        sourceCard: 11,
        double: true
    });

    state.event(
        "double-11",
        {
            player:
                state.currentPlayer,
            amount: 20
        }
    );

    state.drawUnknownCard();
}


/* =========================================================
 * 13
 * ========================================================= */

function applyCard13(
    state,
    action
) {
    const target =
        Number(action.target);

    if (!Number.isInteger(target)) {
        return;
    }

    /*
     * La carte 13 vole une carte de score
     * visible chez l'adversaire.
     */
    const candidates =
        getLatestOwnedPointCards(
            state,
            target,
            1
        );

    if (!candidates.length) {
        state.event(
            "card-13-no-card",
            { target }
        );

        state.drawUnknownCard();

        return;
    }

    const selected =
        action.tableCard != null
            ? findTableCardIndex(
                state,
                target,
                action.tableCard
            )
            : candidates[0].index;

    const index =
        selected >= 0
            ? selected
            : candidates[0].index;

    const removed =
        state.removeTableCard(
            index
        );

    if (!removed) {
        return;
    }

    addScoreCard(
        state,
        state.currentPlayer,
        removed
    );

    state.event(
        "card-13-steal",
        {
            player:
                state.currentPlayer,
            target,
            card:
                cardValue(removed)
        }
    );

    state.drawUnknownCard();
}


/* =========================================================
 * DOUBLE 13
 * ========================================================= */

function applyDouble13(
    state,
    action
) {
    const target =
        Number(action.target);

    if (!Number.isInteger(target)) {
        return;
    }

    let indices = [];

    if (
        Array.isArray(
            action.tableCards
        ) &&
        action.tableCards.length
    ) {
        for (const value of action.tableCards) {
            const index =
                findTableCardIndex(
                    state,
                    target,
                    value
                );

            if (index >= 0) {
                indices.push(index);
            }
        }
    } else {
        indices =
            getLatestOwnedPointCards(
                state,
                target,
                2
            ).map(
                item => item.index
            );
    }

    indices =
        [...new Set(indices)]
            .slice(0, 2);

    const removed =
        removeTableIndices(
            state,
            indices
        );

    for (const item of removed) {
        addScoreCard(
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

function applyCard15(
    state,
    action
) {
    const index =
        Number(
            action.tableCardIndex ??
            action.metadata?.tableCardIndex ??
            action.tableCard
        );

    if (!Number.isInteger(index)) {
        return;
    }

    const card =
        state.table[index];

    if (!card) {
        return;
    }

    if (
        Number(
            cardOwner(card)
        ) !==
        Number(state.currentPlayer)
    ) {
        return;
    }

    const value =
        number(
            cardValue(card)
        );

    if (
        value === null ||
        value === 0
    ) {
        return;
    }

    /*
     * Carte personnelle doublée :
     * valeur x2.
     */
    const next =
        value * 2;

    const updated =
        cloneCard(card);

    if ("value" in updated) {
        updated.value = next;
    }

    if ("valeur" in updated) {
        updated.valeur = next;
    }

    updated.linked =
        updated.linked ?? true;

    updated.sourceCard = 15;

    state.table[index] =
        updated;

    state.addScore(
        state.currentPlayer,
        value
    );

    state.event(
        "card-15",
        {
            player:
                state.currentPlayer,
            oldValue: value,
            newValue: next
        }
    );

    state.drawUnknownCard();
}


/* =========================================================
 * DOUBLE 15
 * ========================================================= */

function applyDouble15(
    state,
    action
) {
    const index =
        Number(
            action.tableCardIndex ??
            action.metadata?.tableCardIndex ??
            action.tableCard
        );

    if (!Number.isInteger(index)) {
        return;
    }

    const card =
        state.table[index];

    if (!card) {
        return;
    }

    if (
        Number(
            cardOwner(card)
        ) !==
        Number(state.currentPlayer)
    ) {
        return;
    }

    const value =
        number(
            cardValue(card)
        );

    if (
        value === null ||
        value === 0
    ) {
        return;
    }

    const next =
        value * 3;

    const updated =
        cloneCard(card);

    if ("value" in updated) {
        updated.value = next;
    }

    if ("valeur" in updated) {
        updated.valeur = next;
    }

    updated.linked =
        updated.linked ?? true;

    updated.sourceCard = 15;
    updated.double = true;

    state.table[index] =
        updated;

    state.addScore(
        state.currentPlayer,
        value * 2
    );

    state.event(
        "double-15",
        {
            player:
                state.currentPlayer,
            oldValue: value,
            newValue: next
        }
    );

    state.drawUnknownCard();
}


/* =========================================================
 * 17
 * ========================================================= */

function applyCard17(
    state,
    action
) {
    const target =
        Number(action.target);

    if (!Number.isInteger(target)) {
        return;
    }

    const hand =
        state.getHand(target);

    if (!hand.length) {
        state.event(
            "card-17-no-card",
            { target }
        );

        state.drawUnknownCard();

        return;
    }

    let selectedIndex =
        Number(
            action.cardIndex ??
            action.metadata?.stolenCardIndex
        );

    /*
     * Avant le vol, la carte est inconnue.
     *
     * Si aucune sélection n'est fournie,
     * la simulation conserve une carte inconnue
     * plutôt que de regarder la main adverse.
     */
    if (
        !Number.isInteger(
            selectedIndex
        )
    ) {
        selectedIndex = 0;

        const stolen =
            state.removeHandCard(
                target,
                selectedIndex
            );

        if (stolen) {
            const hidden =
                cloneCard(stolen);

            hidden.value = null;
            hidden.unknown = true;

            state.addHandCard(
                state.currentPlayer,
                hidden
            );

            state.revealInformation({
                type: "card17-hidden",
                target,
                player:
                    state.currentPlayer
            });
        }
    } else {
        const stolen =
            state.removeHandCard(
                target,
                selectedIndex
            );

        if (stolen) {
            state.addHandCard(
                state.currentPlayer,
                cloneCard(stolen)
            );

            state.revealInformation({
                type: "card17-revealed",
                target,
                card:
                    cardValue(stolen)
            });
        }
    }

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

    if (!Number.isInteger(target)) {
        return;
    }

    const hand =
        state.getHand(target);

    if (!hand.length) {
        return;
    }

    const requested =
        Array.isArray(
            action.cards
        )
            ? action.cards
            : [];

    const count =
        Math.min(
            2,
            hand.length,
            requested.length ||
                1
        );

    const stolen = [];

    for (
        let i = 0;
        i < count;
        i += 1
    ) {
        /*
         * La carte réellement choisie est inconnue
         * avant sa révélation.
         *
         * On retire une carte abstraite sans
         * regarder sa valeur.
         */
        const card =
            state.removeHandCard(
                target,
                0
            );

        if (!card) {
            continue;
        }

        stolen.push(
            cloneCard(card)
        );
    }

    /*
     * Si l'action contient explicitement les cartes
     * révélées, on les conserve.
     *
     * Sinon, elles restent marquées inconnues.
     */
    for (
        let i = 0;
        i < stolen.length;
        i += 1
    ) {
        const card =
            stolen[i];

        const requestedCard =
            requested[i];

        if (
            requestedCard != null
        ) {
            const value =
                cardValue(
                    requestedCard
                );

            if (value != null) {
                if ("value" in card) {
                    card.value = value;
                }

                if ("valeur" in card) {
                    card.valeur = value;
                }

                delete card.unknown;

                state.revealInformation({
                    type: "double17-reveal",
                    target,
                    index: i,
                    card: value
                });
            }
        }

        state.addHandCard(
            state.currentPlayer,
            card
        );
    }

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

function exchangeTableCards(
    state,
    playerA,
    playerB,
    count = 1
) {
    const own =
        getLatestOwnedPointCards(
            state,
            playerA,
            count
        );

    const target =
        getLatestOwnedPointCards(
            state,
            playerB,
            count
        );

    const amount =
        Math.min(
            own.length,
            target.length,
            count
        );

    for (
        let i = 0;
        i < amount;
        i += 1
    ) {
        const ownIndex =
            own[i].index;

        const targetIndex =
            target[i].index;

        /*
         * Les indices peuvent changer lorsqu'on
         * modifie le tableau.
         *
         * On récupère donc directement les cartes
         * avant toute suppression.
         */
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
            playerB
        );

        setCardOwner(
            targetCard,
            playerA
        );

        state.table[
            ownIndex
        ] = targetCard;

        state.table[
            targetIndex
        ] = ownCard;
    }

    return amount;
}

function applyCard19(
    state,
    action
) {
    const target =
        Number(action.target);

    if (!Number.isInteger(target)) {
        return;
    }

    const count =
        exchangeTableCards(
            state,
            state.currentPlayer,
            target,
            1
        );

    state.event(
        "card-19-exchange",
        {
            player:
                state.currentPlayer,
            target,
            count
        }
    );

    state.drawUnknownCard();
}


/* =========================================================
 * DOUBLE 19
 * ========================================================= */

function applyDouble19(
    state,
    action
) {
    const target =
        Number(action.target);

    if (!Number.isInteger(target)) {
        return;
    }

    const count =
        exchangeTableCards(
            state,
            state.currentPlayer,
            target,
            2
        );

    state.event(
        "double-19-exchange",
        {
            player:
                state.currentPlayer,
            target,
            count
        }
    );

    state.drawUnknownCard();
}


/* =========================================================
 * 21
 * ========================================================= */

function applyCard21(
    state,
    action
) {
    const target =
        action.target == null
            ? null
            : Number(
                action.target
            );

    const amount =
        Number(
            action.value ??
            action.metadata?.amount ??
            20
        );

    if (
        target == null ||
        !Number.isInteger(target)
    ) {
        state.addScore(
            state.currentPlayer,
            Math.abs(amount)
        );

        state.addTableCard({
            value:
                Math.abs(amount),
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
                amount:
                    Math.abs(amount)
            }
        );
    } else {
        const delta =
            amount > 0
                ? -Math.abs(amount)
                : amount;

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
 * DOUBLE 21
 * ========================================================= */

function applyDouble21(
    state,
    action
) {
    const target =
        action.target == null
            ? null
            : Number(
                action.target
            );

    const amount =
        Number(
            action.value ??
            action.metadata?.amount ??
            40
        );

    if (
        target == null ||
        !Number.isInteger(target)
    ) {
        state.addScore(
            state.currentPlayer,
            Math.abs(amount)
        );

        state.addTableCard({
            value:
                Math.abs(amount),
            owner:
                state.currentPlayer,
            linked: true,
            sourceCard: 21,
            double: true
        });
    } else {
        const delta =
            amount > 0
                ? -Math.abs(amount)
                : amount;

        state.addScore(
            target,
            delta
        );

        state.addTableCard({
            value: delta,
            owner: target,
            linked: true,
            sourceCard: 21,
            double: true
        });
    }

    state.event(
        "double-21",
        {
            player:
                state.currentPlayer,
            target,
            amount
        }
    );

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
            action.effect ??
            action.metadata?.effect ??
            ""
        ).toLowerCase();

    const value =
        Number(
            action.value ??
            action.metadata?.amount
        );

    if (
        effect.includes("exchange") ||
        effect.includes("echange") ||
        effect === "swap"
    ) {
        const target =
            Number(
                action.target
            );

        if (
            Number.isInteger(target)
        ) {
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
        }
    } else {
        const amount =
            Number.isFinite(value)
                ? value
                : 10;

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
 * CONTINUE / TERMINATE
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

    /*
     * Une action intermédiaire terminée peut rendre
     * le tour à l'état normal.
     */
    state.action = null;
    state.target = null;
}


/* =========================================================
 * ACTION GÉNÉRIQUE DE JEU
 * ========================================================= */

function applyPlayCard(
    state,
    action
) {
    const indices =
        resolveCardIndices(
            state,
            action
        );

    if (!indices.length) {
        return false;
    }

    const index =
        indices[0];

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
                value
        }
    );

    switch (value) {
        case 1:
            applyCard1(
                state,
                action
            );
            break;

        case 3:
            applyCard3(
                state,
                action
            );
            break;

        case 9:
            applyCard9(
                state,
                action
            );
            break;

        case 11:
            applyCard11(
                state,
                action
            );
            break;

        case 13:
            applyCard13(
                state,
                action
            );
            break;

        case 15:
            applyCard15(
                state,
                action
            );
            break;

        case 17:
            applyCard17(
                state,
                action
            );
            break;

        case 19:
            applyCard19(
                state,
                action
            );
            break;

        case 21:
            applyCard21(
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
            /*
             * Carte sans effet spécial :
             * elle devient simplement une carte
             * de score personnelle.
             */
            if (
                isPointCard(card)
            ) {
                addScoreCard(
                    state,
                    state.currentPlayer,
                    card
                );

                state.addScore(
                    state.currentPlayer,
                    Number(value)
                );
            }

            state.drawUnknownCard();
            break;
    }

    return true;
}


/* =========================================================
 * JEU D'UNE DOUBLE
 * ========================================================= */

function applyPlayDouble(
    state,
    action
) {
    const card =
        cardValue(
            action.card
        );

    const indices =
        resolveCardIndices(
            state,
            action
        );

    if (
        indices.length < 2
    ) {
        /*
         * Certains générateurs fournissent directement
         * les deux indices.
         */
        if (
            Array.isArray(
                action.cardIndices
            ) &&
            action.cardIndices.length >= 2
        ) {
            indices.push(
                ...action.cardIndices.slice(
                    0,
                    2
                )
            );
        }
    }

    if (
        indices.length < 2
    ) {
        return false;
    }

    removeCardsFromHand(
        state,
        state.currentPlayer,
        indices.slice(0, 2)
    );

    state.event(
        "play-double",
        {
            player:
                state.currentPlayer,
            card
        }
    );

    switch (card) {
        case 1:
            applyDouble1(
                state,
                action
            );
            break;

        case 3:
            applyDouble3(
                state,
                action
            );
            break;

        case 9:
            applyDouble9(
                state,
                action
            );
            break;

        case 11:
            applyDouble11(
                state,
                action
            );
            break;

        case 13:
            applyDouble13(
                state,
                action
            );
            break;

        case 15:
            applyDouble15(
                state,
                action
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
            applyDouble21(
                state,
                action
            );
            break;

        default:
            /*
             * Double d'une carte sans effet spécial :
             * elle reste représentée comme une action
             * double dans la simulation.
             */
            state.drawUnknownCard();

            break;
    }

    return true;
}


/* =========================================================
 * APPLICATION PRINCIPALE
 * ========================================================= */

export function applyAction(
    state,
    rawAction
) {
    const action =
        normalizeAction(
            rawAction
        );

    if (!action) {
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

    if (
        type === "target" ||
        type === "table_card" ||
        type === "table_cards" ||
        type === "effect" ||
        type === "combination"
    ) {
        /*
         * Les actions complètes peuvent représenter
         * directement l'effet final d'une carte.
         */
        const card =
            number(
                cardValue(
                    action.card
                )
            );

        const isDouble =
            !!(
                action.double ||
                action.metadata?.double ||
                type === "combination"
            );

        if (
            card === 1
        ) {
            return isDouble
                ? (
                    applyDouble1(
                        state,
                        action
                    ),
                    true
                )
                : (
                    applyCard1(
                        state,
                        action
                    ),
                    true
                );
        }

        if (card === 3) {
            return isDouble
                ? (
                    applyDouble3(
                        state,
                        action
                    ),
                    true
                )
                : (
                    applyCard3(
                        state,
                        action
                    ),
                    true
                );
        }

        if (card === 9) {
            return isDouble
                ? (
                    applyDouble9(
                        state,
                        action
                    ),
                    true
                )
                : (
                    applyCard9(
                        state,
                        action
                    ),
                    true
                );
        }

        if (card === 11) {
            return isDouble
                ? (
                    applyDouble11(
                        state,
                        action
                    ),
                    true
                )
                : (
                    applyCard11(
                        state,
                        action
                    ),
                    true
                );
        }

        if (card === 13) {
            return isDouble
                ? (
                    applyDouble13(
                        state,
                        action
                    ),
                    true
                )
                : (
                    applyCard13(
                        state,
                        action
                    ),
                    true
                );
        }

        if (card === 15) {
            return isDouble
                ? (
                    applyDouble15(
                        state,
                        action
                    ),
                    true
                )
                : (
                    applyCard15(
                        state,
                        action
                    ),
                    true
                );
        }

        if (card === 17) {
            return isDouble
                ? (
                    applyDouble17(
                        state,
                        action
                    ),
                    true
                )
                : (
                    applyCard17(
                        state,
                        action
                    ),
                    true
                );
        }

        if (card === 19) {
            return isDouble
                ? (
                    applyDouble19(
                        state,
                        action
                    ),
                    true
                )
                : (
                    applyCard19(
                        state,
                        action
                    ),
                    true
                );
        }

        if (card === 21) {
            return isDouble
                ? (
                    applyDouble21(
                        state,
                        action
                    ),
                    true
                )
                : (
                    applyCard21(
                        state,
                        action
                    ),
                    true
                );
        }

        if (
            cardValue(action.card) ===
            "Joker"
        ) {
            applyJoker(
                state,
                action
            );

            return true;
        }

        return true;
    }

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

    return false;
}


/* =========================================================
 * VALIDATION
 * ========================================================= */

function validateState(
    state
) {
    return !!(
        state &&
        (
            state instanceof VirtualGameState ||
            typeof state === "object"
        )
    );
}


/* =========================================================
 * SIMULATION RESULT
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
        this.state = state;
        this.action = action;
        this.legal = legal;
        this.completed = completed;
        this.error = error;
        this.events = events;
        this.revealedInformation =
            revealedInformation;
        this.scoreDelta = scoreDelta;
        this.metadata = metadata;
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
 * SIMULATE UNE ACTION
 * ========================================================= */

export function simulateAction(
    sourceState,
    action
) {
    if (
        !validateState(
            sourceState
        )
    ) {
        return new SimulationResult({
            action,
            legal: false,
            completed: false,
            error:
                "État de simulation invalide."
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
                state: virtual,
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

        virtual.checkEndConditions();

        /*
         * Après une action complète, le tour est terminé
         * sauf lorsqu'il s'agit explicitement d'une action
         * intermédiaire.
         */
        const normalized =
            normalizeAction(
                action
            );

        const type =
            String(
                normalized?.type || ""
            ).toLowerCase();

        if (
            type !== "continue" &&
            type !== "terminate"
        ) {
            virtual.advanceTurn();
        }

        return new SimulationResult({
            state: virtual,
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
                target:
                    getVictoryTarget(
                        virtual
                    )
            }
        });
    } catch (error) {
        return new SimulationResult({
            state: virtual,
            action,
            legal: false,
            completed: false,
            error:
                error?.message ||
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
 * SIMULER UNE LIGNE
 * ========================================================= */

export function simulateActions(
    sourceState,
    actions
) {
    let current =
        sourceState;

    const results = [];

    for (
        const action of
        ensureArray(actions)
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
    }

    return results;
}

export function simulateLine(
    sourceState,
    actions
) {
    const results =
        simulateActions(
            sourceState,
            actions
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
            ensureArray(actions).length &&
            results.every(
                result =>
                    result.isUsable
            ),

        events:
            results.flatMap(
                result =>
                    result.events || []
            ),

        revealedInformation:
            results.flatMap(
                result =>
                    result.revealedInformation ||
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
    if (!a || !b) {
        return false;
    }

    const signatureA =
        typeof a.signature === "function"
            ? a.signature()
            : JSON.stringify(a);

    const signatureB =
        typeof b.signature === "function"
            ? b.signature()
            : JSON.stringify(b);

    return (
        signatureA ===
        signatureB
    );
}

export function stateDifference(
    before,
    after
) {
    if (!before || !after) {
        return null;
    }

    const beforeScores =
        getPlayersArray(
            before
        ).map(
            player =>
                Number(
                    player?.score || 0
                )
        );

    const afterScores =
        getPlayersArray(
            after
        ).map(
            player =>
                Number(
                    player?.score || 0
                )
        );

    const scoreDelta = {};

    const count =
        Math.max(
            beforeScores.length,
            afterScores.length
        );

    for (
        let i = 0;
        i < count;
        i += 1
    ) {
        scoreDelta[i] =
            (
                afterScores[i] || 0
            ) -
            (
                beforeScores[i] || 0
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
                0
            ) !==
            Number(
                before.currentPlayer ??
                0
            ),

        roundEndedChanged:
            !!after.roundEnded !==
            !!before.roundEnded,

        actionChanged:
            (
                after.action ??
                null
            ) !==
            (
                before.action ??
                null
            )
    };
}


/* =========================================================
 * EXPORTS
 * ========================================================= */

export {
    normalizeAction,
    cardValue,
    isPointCard,
    getLatestOwnedPointCards,
    findTableCardIndex
};

export default {
    ACTION_TYPES,
    VirtualGameState,
    SimulationResult,
    simulateAction,
    simulateActions,
    simulateLine,
    cloneSimulationState,
    statesEqual,
    stateDifference,
    applyAction
};
