import {
    cloneState,
    getPlayer,
    getSelf,
    getOpponents,
    getPlayerTableCards,
    getLatestPointCard,
    getLatestPointCards,
    getVictoryTarget,
    hasExactTarget,
    getCardsOut,
    getTotalDeckSize
} from "./state.js";

import {
    ACTION_TYPES,
    actionSignature
} from "./action.js";


/* ============================================================
 * CONSTANTES
 * ========================================================== */

const SIMULATION_VERSION = 2;

const CARD_1 = 1;
const CARD_3 = 3;
const CARD_9 = 9;
const CARD_11 = 11;
const CARD_13 = 13;
const CARD_15 = 15;
const CARD_17 = 17;
const CARD_19 = 19;
const CARD_21 = 21;

const JOKER = "Joker";


/* ============================================================
 * UTILITAIRES
 * ========================================================== */

function clone(value) {
    if (value === undefined) {
        return undefined;
    }

    return JSON.parse(
        JSON.stringify(value)
    );
}


function numberValue(card) {
    if (card === null || card === undefined) {
        return null;
    }

    if (typeof card === "number") {
        return card;
    }

    if (typeof card === "string") {
        const n = Number(card);

        return Number.isFinite(n)
            ? n
            : card;
    }

    if (typeof card === "object") {
        if (card.valeur !== undefined) {
            return numberValue(card.valeur);
        }

        if (card.value !== undefined) {
            return numberValue(card.value);
        }
    }

    return null;
}


function cardIs(card, value) {
    return numberValue(card) === value ||
        card === value;
}


function isPointCard(card) {
    const value = numberValue(card);

    return (
        value !== null &&
        value !== 0
    );
}


function getHand(player) {
    if (!player) {
        return [];
    }

    if (Array.isArray(player.main)) {
        return player.main;
    }

    if (Array.isArray(player.hand)) {
        return player.hand;
    }

    return [];
}


function setHand(player, hand) {
    if (Array.isArray(player.main)) {
        player.main = hand;
        return;
    }

    player.hand = hand;
}


function getTable(state) {
    if (Array.isArray(state.table)) {
        return state.table;
    }

    if (Array.isArray(state.cartesTable)) {
        return state.cartesTable;
    }

    state.table = [];
    return state.table;
}


function getDiscard(state) {
    if (Array.isArray(state.discard)) {
        return state.discard;
    }

    if (Array.isArray(state.defaussePouvoirs)) {
        return state.defaussePouvoirs;
    }

    state.discard = [];
    return state.discard;
}


function getPlayerId(player, fallback) {
    if (!player) {
        return fallback;
    }

    if (player.id !== undefined) {
        return Number(player.id);
    }

    if (player.index !== undefined) {
        return Number(player.index);
    }

    return fallback;
}


function tableOwner(card) {
    if (!card || typeof card !== "object") {
        return null;
    }

    if (card.proprietaire !== undefined) {
        return card.proprietaire;
    }

    if (card.owner !== undefined) {
        return card.owner;
    }

    if (card.playerId !== undefined) {
        return card.playerId;
    }

    return null;
}


function tableValue(card) {
    return numberValue(card);
}


function setTableValue(card, value) {
    if (
        card &&
        typeof card === "object"
    ) {
        if (card.valeur !== undefined) {
            card.valeur = value;
        } else {
            card.value = value;
        }

        return card;
    }

    return value;
}


function setTableOwner(card, owner) {
    if (
        card &&
        typeof card === "object"
    ) {
        if (card.proprietaire !== undefined) {
            card.proprietaire = owner;
        } else {
            card.owner = owner;
        }
    }

    return card;
}


function getPlayerScore(player) {
    return Number(
        player?.score ?? 0
    );
}


function setPlayerScore(player, score) {
    player.score = Number(score);
}


function getTargetScore(state) {
    if (
        Number.isFinite(
            Number(state?.targetScore)
        )
    ) {
        return Number(
            state.targetScore
        );
    }

    return getVictoryTarget(
        state
    );
}


function advancePlayer(state) {
    const players =
        Array.isArray(state.players)
            ? state.players
            : [];

    if (!players.length) {
        return;
    }

    const current =
        Number(
            state.currentPlayer ?? 0
        );

    state.currentPlayer =
        (current + 1) %
        players.length;
}


function pushEvent(
    state,
    type,
    data = {}
) {
    if (!Array.isArray(state.events)) {
        state.events = [];
    }

    state.events.push({
        type,
        ...clone(data)
    });
}


function reveal(
    result,
    information
) {
    if (!result.revealedInformation) {
        result.revealedInformation = [];
    }

    result.revealedInformation.push(
        clone(information)
    );
}


/* ============================================================
 * ACTION VIRTUELLE
 * ========================================================== */

export class SimulatedAction {
    constructor({
        type = ACTION_TYPES.EFFECT,
        card = null,
        cardIndex = null,
        cards = [],
        target = null,
        tableCard = null,
        tableCards = [],
        effect = null,
        value = null,
        metadata = {},
        hiddenInformation = false,
        uncertainty = null,
        commands = []
    } = {}) {
        this.type = type;
        this.card = card;
        this.cardIndex = cardIndex;
        this.cards = cards;
        this.target = target;
        this.tableCard = tableCard;
        this.tableCards = tableCards;
        this.effect = effect;
        this.value = value;
        this.metadata = metadata;
        this.hiddenInformation =
            hiddenInformation;

        this.uncertainty =
            uncertainty;

        this.commands =
            commands;
    }

    signature() {
        return JSON.stringify({
            type: this.type,
            card: this.card,
            cardIndex: this.cardIndex,
            cards: this.cards,
            target: this.target,
            tableCard: this.tableCard,
            tableCards: this.tableCards,
            effect: this.effect,
            value: this.value,
            metadata: this.metadata
        });
    }
}


/* ============================================================
 * RÉSULTAT
 * ========================================================== */

export class SimulationResult {
    constructor({
        state,
        action,
        legal = true,
        completed = true,
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


/* ============================================================
 * ÉTAT VIRTUEL
 * ========================================================== */

export class VirtualGameState {
    constructor(source) {
        this.data =
            clone(
                source?.data ??
                source
            );

        if (!this.data) {
            throw new Error(
                "État de simulation absent."
            );
        }

        if (!Array.isArray(this.data.players)) {
            this.data.players = [];
        }

        if (!Array.isArray(this.data.table)) {
            this.data.table =
                Array.isArray(
                    this.data.cartesTable
                )
                    ? this.data.cartesTable
                    : [];
        }

        if (!Array.isArray(this.data.discard)) {
            this.data.discard =
                Array.isArray(
                    this.data.defaussePouvoirs
                )
                    ? this.data.defaussePouvoirs
                    : [];
        }

        if (!Array.isArray(this.data.events)) {
            this.data.events = [];
        }

        this.data.simulationVersion =
            SIMULATION_VERSION;
    }

    get players() {
        return this.data.players;
    }

    get table() {
        return this.data.table;
    }

    get discard() {
        return this.data.discard;
    }

    get deckCount() {
        return Number(
            this.data.deckCount ?? 0
        );
    }

    set deckCount(value) {
        this.data.deckCount =
            Math.max(
                0,
                Number(value) || 0
            );
    }

    get currentPlayer() {
        return Number(
            this.data.currentPlayer ?? 0
        );
    }

    set currentPlayer(value) {
        this.data.currentPlayer =
            Number(value);
    }

    get action() {
        return this.data.action;
    }

    set action(value) {
        this.data.action = value;
    }

    get target() {
        return this.data.target;
    }

    set target(value) {
        this.data.target = value;
    }

    player(index) {
        return this.players[
            Number(index)
        ];
    }

    score(index) {
        return getPlayerScore(
            this.player(index)
        );
    }

    addScore(index, delta) {
        const player =
            this.player(index);

        if (!player) {
            return;
        }

        setPlayerScore(
            player,
            this.score(index) +
            Number(delta)
        );
    }

    hand(index) {
        return getHand(
            this.player(index)
        );
    }

    removeHandCard(
        index,
        cardIndex
    ) {
        const hand =
            this.hand(index);

        if (
            cardIndex === null ||
            cardIndex === undefined ||
            cardIndex < 0 ||
            cardIndex >= hand.length
        ) {
            return null;
        }

        const [
            card
        ] =
            hand.splice(
                cardIndex,
                1
            );

        return card;
    }

    addHandCard(
        index,
        card
    ) {
        const player =
            this.player(index);

        if (!player) {
            return;
        }

        const hand =
            getHand(player);

        hand.push(card);

        setHand(
            player,
            hand
        );
    }

    addTableCard(card) {
        this.table.push(card);
    }

    addDiscard(card) {
        this.discard.push(card);
    }

    drawUnknownCard(
        playerIndex
    ) {
        if (this.deckCount <= 0) {
            return null;
        }

        /*
         * La carte est inconnue.
         *
         * On ne fabrique volontairement pas une valeur
         * arbitraire. On représente l'incertitude par un
         * objet spécial.
         */
        const unknown = {
            unknown: true,
            owner: Number(playerIndex),
            location: "hand",
            simulation: true
        };

        this.deckCount -= 1;

        this.addHandCard(
            playerIndex,
            unknown
        );

        return unknown;
    }

    finishRound(
        winnerIndex = null
    ) {
        this.data.roundEnded = true;

        if (
            winnerIndex !== null &&
            winnerIndex !== undefined
        ) {
            this.data.roundWinner =
                Number(winnerIndex);
        }

        pushEvent(
            this.data,
            "round_end",
            {
                winner:
                    winnerIndex
            }
        );
    }

    signature() {
        return JSON.stringify({
            players:
                this.players.map(
                    (player, index) => ({
                        id:
                            getPlayerId(
                                player,
                                index
                            ),

                        score:
                            getPlayerScore(
                                player
                            ),

                        cardCount:
                            getHand(
                                player
                            ).length,

                        hand:
                            getHand(
                                player
                            ).map(
                                card =>
                                    card?.unknown
                                        ? "?"
                                        : numberValue(
                                            card
                                        )
                            )
                    })
                ),

            table:
                this.table.map(
                    card => ({
                        value:
                            tableValue(
                                card
                            ),

                        owner:
                            tableOwner(
                                card
                            )
                    })
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
                !!this.data.roundEnded
        });
    }

    toObject() {
        return clone(
            this.data
        );
    }
}


/* ============================================================
 * VALIDATION
 * ========================================================== */

function validateAction(
    state,
    action
) {
    if (!action) {
        return {
            valid: false,
            reason: "Action absente."
        };
    }

    const playerIndex =
        Number(
            state.currentPlayer ?? 0
        );

    if (
        action.target !== null &&
        action.target !== undefined
    ) {
        const target =
            state.players[
                Number(action.target)
            ];

        if (!target) {
            return {
                valid: false,
                reason:
                    "Cible inexistante."
            };
        }

        if (
            Number(action.target) ===
            playerIndex
        ) {
            return {
                valid: false,
                reason:
                    "La cible est le joueur actif."
            };
        }
    }

    return {
        valid: true,
        reason: null
    };
}


/* ============================================================
 * CARTES DE MAIN
 * ========================================================== */

function playCardFromHand(
    state,
    action,
    result
) {
    const playerIndex =
        state.currentPlayer;

    let cardIndex =
        action.cardIndex;

    if (
        cardIndex === null ||
        cardIndex === undefined
    ) {
        cardIndex =
            state.hand(
                playerIndex
            ).findIndex(
                card =>
                    numberValue(card) ===
                    numberValue(
                        action.card
                    )
            );
    }

    const card =
        state.removeHandCard(
            playerIndex,
            cardIndex
        );

    if (card === null) {
        throw new Error(
            "Carte introuvable dans la main."
        );
    }

    result.metadata.playedCard =
        clone(card);

    pushEvent(
        state.data,
        "play_card",
        {
            player:
                playerIndex,

            card:
                numberValue(card),

            cardIndex
        }
    );

    return card;
}


/* ============================================================
 * CARTES DE TABLE
 * ========================================================== */

function findTableCardIndex(
    state,
    action,
    owner = null
) {
    if (
        action.tableCardIndex !==
        undefined
    ) {
        return Number(
            action.tableCardIndex
        );
    }

    if (
        action.cardIndex !== null &&
        action.cardIndex !== undefined
    ) {
        return Number(
            action.cardIndex
        );
    }

    const requested =
        numberValue(
            action.tableCard
        );

    if (requested === null) {
        return -1;
    }

    return state.table.findIndex(
        card => {
            if (
                owner !== null &&
                Number(
                    tableOwner(card)
                ) !== Number(owner)
            ) {
                return false;
            }

            return (
                tableValue(card) ===
                requested
            );
        }
    );
}


function removeTableCard(
    state,
    index
) {
    if (
        index < 0 ||
        index >= state.table.length
    ) {
        return null;
    }

    return state.table.splice(
        index,
        1
    )[0] ?? null;
}


/* ============================================================
 * 1
 * ========================================================== */

function applyCard1(
    state,
    action,
    result,
    double = false
) {
    const target =
        Number(action.target);

    const count =
        double ? 2 : 1;

    const indices = [];

    for (
        let i = state.table.length - 1;
        i >= 0 &&
        indices.length < count;
        i--
    ) {
        const card =
            state.table[i];

        if (
            Number(
                tableOwner(card)
            ) === target &&
            isPointCard(card)
        ) {
            indices.push(i);
        }
    }

    /*
     * L'action réelle peut ne rien voler si la cible
     * ne possède aucune carte de score.
     */
    for (const index of indices) {
        const card =
            removeTableCard(
                state,
                index
            );

        if (!card) {
            continue;
        }

        state.addTableCard(
            setTableOwner(
                card,
                state.currentPlayer
            )
        );
    }

    drawAfterEffect(
        state
    );

    pushEvent(
        state.data,
        double
            ? "double1"
            : "card1",
        {
            player:
                state.currentPlayer,

            target,

            stolen:
                indices.length
        }
    );
}


/* ============================================================
 * 3
 * ========================================================== */

function applyCard3(
    state,
    action,
    result,
    double = false
) {
    const target =
        Number(action.target);

    const delta =
        double ? -40 : -20;

    state.addScore(
        target,
        delta
    );

    /*
     * Le moteur associe l'effet 3 à une carte de score
     * négative sur la table de la cible.
     */
    state.addTableCard({
        valeur: delta,
        value: delta,
        proprietaire: target,
        owner: target,
        linked: true,
        liee: true,
        source: double
            ? "double3"
            : "3"
    });

    drawAfterEffect(
        state
    );

    pushEvent(
        state.data,
        double
            ? "double3"
            : "card3",
        {
            target,
            delta
        }
    );
}


/* ============================================================
 * 9
 * ========================================================== */

function applyCard9(
    state,
    action,
    result,
    double = false
) {
    const target =
        Number(action.target);

    const own =
        state.hand(
            state.currentPlayer
        );

    const opponent =
        state.hand(
            target
        );

    /*
     * Pour une simulation stratégique, on échange les
     * représentations connues/cachées sans révéler leur contenu.
     */
    const ownCopy =
        own.map(
            card => clone(card)
        );

    const opponentCopy =
        opponent.map(
            card => clone(card)
        );

    state.players[
        state.currentPlayer
    ].main =
        opponentCopy;

    state.players[
        target
    ].main =
        ownCopy;

    /*
     * Si le format utilise hand plutôt que main.
     */
    if (
        !Array.isArray(
            state.players[
                state.currentPlayer
            ].main
        )
    ) {
        setHand(
            state.players[
                state.currentPlayer
            ],
            opponentCopy
        );
    }

    if (
        !Array.isArray(
            state.players[target].main
        )
    ) {
        setHand(
            state.players[target],
            ownCopy
        );
    }

    result.revealedInformation =
        double
            ? [
                {
                    type:
                        "double9_hand_visibility",

                    target,

                    cardCount:
                        opponentCopy.length,

                    /*
                     * Les cartes effectivement visibles sont
                     * conservées dans le scénario.
                     */
                    cards:
                        opponentCopy
                }
            ]
            : [];

    pushEvent(
        state.data,
        double
            ? "double9"
            : "card9",
        {
            player:
                state.currentPlayer,

            target
        }
    );
}


/* ============================================================
 * 11
 * ========================================================== */

function applyCard11(
    state,
    action,
    double = false
) {
    const multiplier =
        double ? 2 : 1;

    const value =
        Number(
            action.value ??
            action.metadata?.value ??
            10
        );

    /*
     * +10 / -10 pour 11
     * +20 / -20 pour Double11.
     */
    const delta =
        value === 0
            ? 10 * multiplier
            : Math.sign(value) *
              Math.abs(value) *
              multiplier;

    state.addScore(
        state.currentPlayer,
        delta
    );

    state.addTableCard({
        valeur: delta,
        value: delta,
        proprietaire:
            state.currentPlayer,
        owner:
            state.currentPlayer,
        linked: true,
        liee: true,
        source:
            double
                ? "double11"
                : "11"
    });

    drawAfterEffect(
        state
    );

    pushEvent(
        state.data,
        double
            ? "double11"
            : "card11",
        {
            delta
        }
    );
}


/* ============================================================
 * 13
 * ========================================================== */

function getSelectedTableIndices(
    action,
    count
) {
    if (
        Array.isArray(
            action.tableCardIndices
        )
    ) {
        return action.tableCardIndices
            .slice(0, count)
            .map(Number);
    }

    if (
        Array.isArray(
            action.tableCards
        )
    ) {
        return action.tableCards
            .slice(0, count)
            .map(Number);
    }

    if (
        action.tableCardIndex !==
        undefined
    ) {
        return [
            Number(
                action.tableCardIndex
            )
        ];
    }

    return [];
}


function applyCard13(
    state,
    action,
    result,
    double = false
) {
    const target =
        Number(action.target);

    const count =
        double ? 2 : 1;

    let indices =
        getSelectedTableIndices(
            action,
            count
        );

    if (!indices.length) {
        indices =
            state.table
                .map(
                    (card, index) => ({
                        card,
                        index
                    })
                )
                .filter(
                    ({ card }) =>
                        Number(
                            tableOwner(card)
                        ) === target &&
                        isPointCard(card)
                )
                .slice(
                    double ? -2 : -1
                )
                .map(
                    ({ index }) =>
                        index
                );
    }

    /*
     * Supprimer dans l'ordre inverse pour conserver
     * les indices.
     */
    indices =
        [...new Set(indices)]
            .sort(
                (a, b) =>
                    b - a
            );

    let stolen = 0;

    for (const index of indices) {
        const card =
            state.table[index];

        if (!card) {
            continue;
        }

        if (
            Number(
                tableOwner(card)
            ) !== target
        ) {
            continue;
        }

        if (!isPointCard(card)) {
            continue;
        }

        const removed =
            removeTableCard(
                state,
                index
            );

        if (!removed) {
            continue;
        }

        state.addTableCard(
            setTableOwner(
                removed,
                state.currentPlayer
            )
        );

        stolen += 1;
    }

    drawAfterEffect(
        state
    );

    pushEvent(
        state.data,
        double
            ? "double13"
            : "card13",
        {
            target,
            stolen
        }
    );
}


/* ============================================================
 * 15
 * ========================================================== */

function applyCard15(
    state,
    action,
    result,
    double = false
) {
    const owner =
        state.currentPlayer;

    const multiplier =
        double ? 3 : 2;

    const index =
        findTableCardIndex(
            state,
            action,
            owner
        );

    if (
        index < 0
    ) {
        throw new Error(
            "Carte de score introuvable pour 15."
        );
    }

    const card =
        state.table[index];

    const current =
        tableValue(card);

    if (
        !Number.isFinite(current) ||
        current === 0
    ) {
        throw new Error(
            "La carte ciblée par 15 n'est pas une carte de score."
        );
    }

    const updated =
        current * multiplier;

    setTableValue(
        card,
        updated
    );

    pushEvent(
        state.data,
        double
            ? "double15"
            : "card15",
        {
            index,
            previous: current,
            value: updated,
            multiplier
        }
    );
}


/* ============================================================
 * 17
 * ========================================================== */

function applyCard17(
    state,
    action,
    result,
    double = false
) {
    const target =
        Number(action.target);

    const count =
        double ? 2 : 1;

    /*
     * La carte volée est inconnue avant le tirage.
     *
     * On ne choisit donc PAS arbitrairement une carte réelle.
     * On ajoute des cartes inconnues.
     */
    const stolenCards = [];

    for (
        let i = 0;
        i < count;
        i++
    ) {
        const unknown = {
            unknown: true,

            source:
                double
                    ? "double17"
                    : "17",

            stolenFrom:
                target,

            location:
                "hand",

            owner:
                state.currentPlayer
        };

        state.addHandCard(
            state.currentPlayer,
            unknown
        );

        stolenCards.push(
            unknown
        );
    }

    result.metadata.hidden =
        true;

    result.metadata.stolenCards =
        stolenCards.length;

    result.metadata.uncertain =
        true;

    /*
     * Les cartes viennent de la main adverse.
     * Leur nombre est réduit dans la représentation adverse.
     */
    const opponent =
        state.player(target);

    if (opponent) {
        const hand =
            getHand(opponent);

        for (
            let i = 0;
            i < count &&
            hand.length > 0;
            i++
        ) {
            hand.pop();
        }
    }

    pushEvent(
        state.data,
        double
            ? "double17"
            : "card17",
        {
            target,
            stolen:
                count,

            hidden:
                true
        }
    );

    reveal(
        result,
        {
            type:
                double
                    ? "double17_hidden"
                    : "17_hidden",

            target,

            count
        }
    );
}


/* ============================================================
 * 19
 * ========================================================== */

function applyCard19(
    state,
    action,
    result,
    double = false
) {
    const own =
        state.currentPlayer;

    const target =
        Number(action.target);

    const count =
        double ? 2 : 1;

    let ownIndices =
        getSelectedTableIndices(
            action,
            count
        );

    let targetIndices =
        Array.isArray(
            action.targetTableCardIndices
        )
            ? action.targetTableCardIndices
                .slice(0, count)
                .map(Number)
            : [];

    if (!ownIndices.length) {
        ownIndices =
            getLatestOwnedPointIndices(
                state,
                own,
                count
            );
    }

    if (!targetIndices.length) {
        targetIndices =
            getLatestOwnedPointIndices(
                state,
                target,
                count
            );
    }

    const pairs =
        Math.min(
            ownIndices.length,
            targetIndices.length
        );

    for (
        let i = 0;
        i < pairs;
        i++
    ) {
        const ownIndex =
            ownIndices[i];

        const targetIndex =
            targetIndices[i];

        const ownCard =
            state.table[
                ownIndex
            ];

        const targetCard =
            state.table[
                targetIndex
            ];

        if (
            !ownCard ||
            !targetCard
        ) {
            continue;
        }

        if (
            Number(
                tableOwner(ownCard)
            ) !== own ||
            Number(
                tableOwner(targetCard)
            ) !== target
        ) {
            continue;
        }

        const ownValue =
            tableValue(
                ownCard
            );

        const targetValue =
            tableValue(
                targetCard
            );

        setTableOwner(
            ownCard,
            target
        );

        setTableOwner(
            targetCard,
            own
        );

        /*
         * Les valeurs restent attachées aux cartes :
         * seul leur propriétaire change.
         */
        setTableValue(
            ownCard,
            ownValue
        );

        setTableValue(
            targetCard,
            targetValue
        );
    }

    pushEvent(
        state.data,
        double
            ? "double19"
            : "card19",
        {
            target,
            exchanged:
                pairs
        }
    );
}


function getLatestOwnedPointIndices(
    state,
    owner,
    count
) {
    const result = [];

    for (
        let i = state.table.length - 1;
        i >= 0 &&
        result.length < count;
        i--
    ) {
        const card =
            state.table[i];

        if (
            Number(
                tableOwner(card)
            ) !== Number(owner)
        ) {
            continue;
        }

        if (!isPointCard(card)) {
            continue;
        }

        result.push(i);
    }

    return result;
}


/* ============================================================
 * 21
 * ========================================================== */

function applyCard21(
    state,
    action,
    result,
    double = false
) {
    const multiplier =
        double ? 2 : 1;

    const target =
        action.target === null ||
        action.target === undefined
            ? null
            : Number(
                action.target
            );

    let delta =
        Number(
            action.value
        );

    if (!Number.isFinite(delta)) {
        delta =
            action.effect ===
            "minus"
                ? -20
                : 20;
    }

    delta *= multiplier;

    const recipient =
        target === null
            ? state.currentPlayer
            : target;

    state.addScore(
        recipient,
        delta
    );

    state.addTableCard({
        valeur: delta,
        value: delta,

        proprietaire:
            recipient,

        owner:
            recipient,

        linked: true,
        liee: true,

        source:
            double
                ? "double21"
                : "21"
    });

    drawAfterEffect(
        state
    );

    pushEvent(
        state.data,
        double
            ? "double21"
            : "card21",
        {
            target,
            delta
        }
    );
}


/* ============================================================
 * JOKER
 * ========================================================== */

function applyJoker(
    state,
    action,
    result
) {
    const effect =
        action.effect ??
        action.metadata?.effect;

    if (
        effect ===
        "exchange_scores"
    ) {
        const target =
            Number(
                action.target
            );

        exchangeScores(
            state,
            state.currentPlayer,
            target
        );

        pushEvent(
            state.data,
            "joker_exchange",
            {
                target
            }
        );

        return;
    }

    const value =
        Number(
            action.value ??
            action.metadata?.value
        );

    if (!Number.isFinite(value)) {
        throw new Error(
            "Valeur Joker absente."
        );
    }

    state.addScore(
        state.currentPlayer,
        value
    );

    state.addTableCard({
        valeur: value,
        value,

        proprietaire:
            state.currentPlayer,

        owner:
            state.currentPlayer,

        linked: true,
        liee: true,

        source:
            "Joker"
    });

    pushEvent(
        state.data,
        "joker",
        {
            value
        }
    );
}


function exchangeScores(
    state,
    first,
    second
) {
    const firstPlayer =
        state.player(first);

    const secondPlayer =
        state.player(second);

    if (
        !firstPlayer ||
        !secondPlayer
    ) {
        return;
    }

    const firstScore =
        getPlayerScore(
            firstPlayer
        );

    const secondScore =
        getPlayerScore(
            secondPlayer
        );

    setPlayerScore(
        firstPlayer,
        secondScore
    );

    setPlayerScore(
        secondPlayer,
        firstScore
    );
}


/* ============================================================
 * PIOCHE
 * ========================================================== */

function drawAfterEffect(
    state
) {
    if (
        state.deckCount <= 0
    ) {
        return null;
    }

    return state.drawUnknownCard(
        state.currentPlayer
    );
}


/* ============================================================
 * FIN DE MANCHE
 * ========================================================== */

function checkEndConditions(
    state,
    result
) {
    const target =
        getTargetScore(
            state.data
        );

    /*
     * Victoire exacte :
     * elle termine immédiatement la manche.
     */
    for (
        let i = 0;
        i < state.players.length;
        i++
    ) {
        const score =
            getPlayerScore(
                state.players[i]
            );

        if (
            score === target
        ) {
            state.finishRound(i);

            result.metadata.roundEnded =
                true;

            result.metadata.winner =
                i;

            return;
        }
    }

    /*
     * Si les cartes sont épuisées sans score exact,
     * le joueur le plus proche de la cible gagne.
     *
     * Cette règle est appliquée uniquement lorsque la pioche
     * est réellement vide.
     */
    if (
        state.deckCount <= 0
    ) {
        let winner = null;
        let bestDistance = Infinity;

        for (
            let i = 0;
            i < state.players.length;
            i++
        ) {
            const score =
                getPlayerScore(
                    state.players[i]
                );

            const distance =
                Math.abs(
                    target - score
                );

            if (
                distance <
                bestDistance
            ) {
                bestDistance =
                    distance;

                winner = i;
            }
        }

        if (
            winner !== null
        ) {
            state.finishRound(
                winner
            );

            result.metadata.roundEnded =
                true;

            result.metadata.winner =
                winner;
        }
    }
}


/* ============================================================
 * DISPATCH
 * ========================================================== */

function applyAction(
    state,
    action,
    result
) {
    const card =
        numberValue(
            action.card
        );

    const isDouble =
        action.type ===
        ACTION_TYPES.PLAY_DOUBLE ||
        action.metadata?.double === true;

    /*
     * Une action PLAY_CARD / PLAY_DOUBLE doit d'abord
     * retirer la carte de la main.
     */
    if (
        action.type ===
            ACTION_TYPES.PLAY_CARD ||
        action.type ===
            ACTION_TYPES.PLAY_DOUBLE
    ) {
        playCardFromHand(
            state,
            action,
            result
        );
    }

    /*
     * Les actions produites par action-generator peuvent
     * représenter directement l'effet complet sans avoir
     * besoin d'un second PLAY_CARD.
     */

    if (
        card === CARD_1
    ) {
        applyCard1(
            state,
            action,
            result,
            isDouble
        );

        return;
    }

    if (
        card === CARD_3
    ) {
        applyCard3(
            state,
            action,
            result,
            isDouble
        );

        return;
    }

    if (
        card === CARD_9
    ) {
        applyCard9(
            state,
            action,
            result,
            isDouble
        );

        return;
    }

    if (
        card === CARD_11
    ) {
        applyCard11(
            state,
            action,
            isDouble
        );

        return;
    }

    if (
        card === CARD_13
    ) {
        applyCard13(
            state,
            action,
            result,
            isDouble
        );

        return;
    }

    if (
        card === CARD_15
    ) {
        applyCard15(
            state,
            action,
            result,
            isDouble
        );

        return;
    }

    if (
        card === CARD_17
    ) {
        applyCard17(
            state,
            action,
            result,
            isDouble
        );

        return;
    }

    if (
        card === CARD_19
    ) {
        applyCard19(
            state,
            action,
            result,
            isDouble
        );

        return;
    }

    if (
        card === CARD_21
    ) {
        applyCard21(
            state,
            action,
            result,
            isDouble
        );

        return;
    }

    if (
        action.card === JOKER ||
        action.card === "Joker"
    ) {
        applyJoker(
            state,
            action,
            result
        );

        return;
    }

    /*
     * 7 et cartes normales :
     * la carte a simplement été jouée.
     *
     * Leur résolution détaillée sera prise en compte par
     * le moteur de règles lorsqu'elles ont un effet spécifique.
     */
    if (
        card === 7 ||
        card === 2 ||
        card === 4 ||
        card === 5 ||
        card === 6 ||
        card === 8 ||
        card === 10 ||
        card === 12 ||
        card === 14 ||
        card === 16 ||
        card === 18 ||
        card === 20
    ) {
        drawAfterEffect(
            state
        );

        return;
    }

    /*
     * Action intermédiaire.
     */
    if (
        action.type ===
        ACTION_TYPES.CONTINUE
    ) {
        state.action = null;

        return;
    }

    if (
        action.type ===
        ACTION_TYPES.TERMINATE
    ) {
        state.action = null;

        return;
    }

    throw new Error(
        `Action de simulation inconnue : ${
            action.effect ??
            action.type ??
            "inconnue"
        }`
    );
}


/* ============================================================
 * SIMULATION PRINCIPALE
 * ========================================================== */

export function simulateAction(
    sourceState,
    action
) {
    if (
        !sourceState
    ) {
        return new SimulationResult({
            state: null,
            action,
            legal: false,
            completed: false,
            error:
                "État source absent."
        });
    }

    const validation =
        validateAction(
            sourceState,
            action
        );

    if (!validation.valid) {
        return new SimulationResult({
            state: null,
            action,
            legal: false,
            completed: false,
            error:
                validation.reason
        });
    }

    let virtual;

    try {
        virtual =
            new VirtualGameState(
                sourceState
            );
    } catch (error) {
        return new SimulationResult({
            state: null,
            action,
            legal: false,
            completed: false,
            error:
                error.message
        });
    }

    const beforeScores =
        virtual.players.map(
            player =>
                getPlayerScore(player)
        );

    const result =
        new SimulationResult({
            state: virtual,
            action,
            legal: true,
            completed: false
        });

    try {
        applyAction(
            virtual,
            action,
            result
        );

        checkEndConditions(
            virtual,
            result
        );

        /*
         * Sauf si la simulation vient de terminer la manche,
         * on passe au joueur suivant.
         */
        if (
            !virtual.data.roundEnded &&
            action.type !==
                ACTION_TYPES.CONTINUE &&
            action.type !==
                ACTION_TYPES.TERMINATE
        ) {
            advancePlayer(
                virtual.data
            );
        }

        virtual.action =
            null;

        virtual.target =
            null;

        result.state =
            virtual;

        result.events =
            virtual.data.events
                .slice();

        result.scoreDelta = {};

        virtual.players.forEach(
            (player, index) => {
                const after =
                    getPlayerScore(
                        player
                    );

                result.scoreDelta[index] =
                    after -
                    beforeScores[index];
            }
        );

        result.completed =
            true;

        result.metadata.progress =
            calculateProgress(
                virtual
            );

        result.metadata.cardsOut =
            calculateCardsOut(
                virtual
            );

        result.metadata.target =
            getTargetScore(
                virtual.data
            );

        return result;

    } catch (error) {
        return new SimulationResult({
            state: null,
            action,
            legal: true,
            completed: false,
            error:
                error.message,

            events:
                virtual.data.events
        });
    }
}


/* ============================================================
 * SIMULATION DE LIGNES
 * ========================================================== */

export function simulateActions(
    sourceState,
    actions = []
) {
    let current =
        sourceState;

    const results = [];

    for (
        const action of actions
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
    actions = []
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
        initialState:
            sourceState,

        actions:
            actions.slice(),

        results,

        finalState:
            last?.isUsable
                ? last.state
                : null,

        completed:
            results.length ===
                actions.length &&
            results.every(
                result =>
                    result.isUsable
            )
    };
}


/* ============================================================
 * MESURES
 * ========================================================== */

function calculateCardsOut(
    state
) {
    const players =
        state.players
            .map(
                player =>
                    getHand(player).length
            )
            .reduce(
                (sum, value) =>
                    sum + value,
                0
            );

    return (
        players +
        state.table.length +
        state.discard.length
    );
}


function calculateProgress(
    state
) {
    const total =
        getTotalCardCountSafe(
            state
        );

    if (total <= 0) {
        return 0;
    }

    return Math.max(
        0,
        Math.min(
            1,
            calculateCardsOut(
                state
            ) / total
        )
    );
}


function getTotalCardCountSafe(
    state
) {
    const players =
        state.players.length;

    if (
        players <= 3
    ) {
        return 44;
    }

    return (
        (players - 1) *
        22
    );
}


/* ============================================================
 * COMPARAISONS
 * ========================================================== */

export function statesEqual(
    first,
    second
) {
    const a =
        first?.signature
            ? first.signature()
            : JSON.stringify(first);

    const b =
        second?.signature
            ? second.signature()
            : JSON.stringify(second);

    return a === b;
}


export function stateDifference(
    before,
    after
) {
    const beforeObject =
        before?.toObject
            ? before.toObject()
            : before?.data ??
              before;

    const afterObject =
        after?.toObject
            ? after.toObject()
            : after?.data ??
              after;

    return {
        scores: {
            before:
                beforeObject.players?.map(
                    player =>
                        Number(
                            player.score ??
                            0
                        )
                ) ?? [],

            after:
                afterObject.players?.map(
                    player =>
                        Number(
                            player.score ??
                            0
                        )
                ) ?? []
        },

        hands: {
            before:
                beforeObject.players?.map(
                    player =>
                        Array.isArray(
                            player.main
                        )
                            ? player.main.length
                            : Array.isArray(
                                player.hand
                            )
                                ? player.hand.length
                                : 0
                ) ?? [],

            after:
                afterObject.players?.map(
                    player =>
                        Array.isArray(
                            player.main
                        )
                            ? player.main.length
                            : Array.isArray(
                                player.hand
                            )
                                ? player.hand.length
                                : 0
                ) ?? []
        },

        table: {
            before:
                beforeObject.table ??
                beforeObject.cartesTable ??
                [],

            after:
                afterObject.table ??
                afterObject.cartesTable ??
                []
        },

        deckCount: {
            before:
                Number(
                    beforeObject.deckCount ??
                    0
                ),

            after:
                Number(
                    afterObject.deckCount ??
                    0
                )
        },

        roundEnded: {
            before:
                !!beforeObject.roundEnded,

            after:
                !!afterObject.roundEnded
        }
    };
}


/* ============================================================
 * CONVERSIONS
 * ========================================================== */

export function toSimulatedAction(
    action
) {
    if (!action) {
        return null;
    }

    if (
        action instanceof
        SimulatedAction
    ) {
        return action;
    }

    return new SimulatedAction({
        type:
            action.type ??
            ACTION_TYPES.EFFECT,

        card:
            action.card ?? null,

        cardIndex:
            action.cardIndex ??
            null,

        cards:
            action.cards ??
            [],

        target:
            action.target ??
            null,

        tableCard:
            action.tableCard ??
            null,

        tableCards:
            action.tableCards ??
            [],

        effect:
            action.effect ??
            null,

        value:
            action.value ??
            null,

        metadata:
            action.metadata ??
            {},

        hiddenInformation:
            action.hiddenInformation ??
            action.metadata?.hiddenInformation ??
            false,

        uncertainty:
            action.uncertainty ??
            null,

        commands:
            action.commands ??
            []
    });
}


/* ============================================================
 * API
 * ========================================================== */

export function createSimulationState(
    state
) {
    return new VirtualGameState(
        state
    );
}


export function cloneSimulationState(
    state
) {
    return new VirtualGameState(
        state
    );
}


export default {
    SimulatedAction,
    SimulationResult,
    VirtualGameState,

    simulateAction,
    simulateActions,
    simulateLine,

    createSimulationState,
    cloneSimulationState,

    toSimulatedAction,

    statesEqual,
    stateDifference
};
