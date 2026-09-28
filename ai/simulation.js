/**
 * Atoumoulin AI
 * simulation.js
 *
 * Moteur de simulation virtuelle.
 *
 * IMPORTANT :
 * Ce fichier ne doit JAMAIS modifier la partie réelle.
 *
 * Une simulation reçoit un GameState puis crée une copie
 * indépendante sur laquelle les actions peuvent être testées.
 *
 * Architecture :
 *
 *     état réel
 *         ↓
 *     copie virtuelle
 *         ↓
 *     action complète
 *         ↓
 *     nouvel état
 *         ↓
 *     évaluation
 *
 * Les actions sont représentées comme des objets complets :
 *
 * {
 *     type: "card",
 *     cardIndex: 2,
 *     target: 1,
 *     effect: "..."
 * }
 *
 * Une carte seule n'est donc jamais considérée comme une
 * possibilité complète lorsqu'elle nécessite une cible ou
 * un choix supplémentaire.
 */

import {
    AtoumoulinGameState
} from "./game-state.js";


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


/* ============================================================
 * TYPES D'ACTIONS
 * ========================================================== */

/**
 * Types génériques utilisés par l'IA.
 *
 * Ils ne remplacent pas les fonctions du moteur du jeu.
 * Ils servent à représenter une possibilité complète avant
 * son exécution.
 */

export const ACTION_TYPES =
    Object.freeze({

        CARD:
            "card",

        DOUBLE:
            "double",

        TARGET:
            "target",

        EFFECT:
            "effect",

        COMBINATION:
            "combination"
    });


/* ============================================================
 * ACTION VIRTUELLE
 * ========================================================== */

export class SimulatedAction {

    constructor({
        type,
        cardIndex = null,
        card = null,
        cards = [],
        target = null,
        effect = null,
        value = null,
        parameters = {},
        description = ""
    } = {}) {

        this.type =
            type;

        this.cardIndex =
            cardIndex;

        this.card =
            clone(card);

        this.cards =
            clone(cards);

        this.target =
            target;

        this.effect =
            effect;

        this.value =
            value;

        this.parameters =
            clone(parameters);

        this.description =
            description;
    }


    clone() {

        return new SimulatedAction({
            type:
                this.type,

            cardIndex:
                this.cardIndex,

            card:
                clone(this.card),

            cards:
                clone(this.cards),

            target:
                this.target,

            effect:
                this.effect,

            value:
                this.value,

            parameters:
                clone(this.parameters),

            description:
                this.description
        });
    }


    /**
     * Identifiant stable permettant de comparer deux
     * possibilités.
     */
    signature() {

        return JSON.stringify({
            type:
                this.type,

            cardIndex:
                this.cardIndex,

            card:
                this.card,

            cards:
                this.cards,

            target:
                this.target,

            effect:
                this.effect,

            value:
                this.value,

            parameters:
                this.parameters
        });
    }
}


/* ============================================================
 * RÉSULTAT DE SIMULATION
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

        this.state =
            state;

        this.action =
            action;

        this.legal =
            !!legal;

        this.completed =
            !!completed;

        this.error =
            error;

        this.events =
            clone(events);

        this.revealedInformation =
            clone(
                revealedInformation
            );

        this.scoreDelta =
            clone(scoreDelta);

        this.metadata =
            clone(metadata);
    }


    isUsable() {

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

    constructor(
        source,
        metadata = {}
    ) {

        if (
            source instanceof
            AtoumoulinGameState
        ) {

            this.data =
                source.toMutableObject();

            this.botIndex =
                source.botIndex;

        } else {

            this.data =
                clone(source);

            this.botIndex =
                Number(
                    source?.botIndex ??
                    0
                );
        }

        this.metadata =
            clone(metadata);

        this.events =
            [];

        this.revealedInformation =
            [];

        this.previous =
            null;
    }


    /* ========================================================
     * ACCÈS
     * ====================================================== */

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

        return this.data.deckCount;
    }


    get currentPlayer() {

        return this.data.currentPlayer;
    }


    get action() {

        return this.data.action;
    }


    get target() {

        return this.data.target;
    }


    get roundEnded() {

        return !!this.data.roundEnded;
    }


    get winner() {

        return this.data.winner;
    }


    /* ========================================================
     * JOUEURS
     * ====================================================== */

    getPlayer(index) {

        return (
            this.players[
                Number(index)
            ] ??
            null
        );
    }


    getBot() {

        return this.getPlayer(
            this.botIndex
        );
    }


    getOpponents() {

        return this.players.filter(
            player =>
                player.id !==
                this.botIndex
        );
    }


    /* ========================================================
     * COPIE
     * ====================================================== */

    clone() {

        const result =
            new VirtualGameState(
                this.data,
                this.metadata
            );

        result.events =
            clone(
                this.events
            );

        result.revealedInformation =
            clone(
                this.revealedInformation
            );

        result.previous =
            this.previous;

        return result;
    }


    /* ========================================================
     * SCORE
     * ====================================================== */

    getScore(
        playerIndex
    ) {

        const player =
            this.getPlayer(
                playerIndex
            );

        return player
            ? Number(player.score) || 0
            : null;
    }


    setScore(
        playerIndex,
        score
    ) {

        const player =
            this.getPlayer(
                playerIndex
            );

        if (!player) {
            return false;
        }

        player.score =
            Number(score) || 0;

        return true;
    }


    addScore(
        playerIndex,
        amount
    ) {

        const current =
            this.getScore(
                playerIndex
            );

        if (
            current === null
        ) {
            return false;
        }

        return this.setScore(
            playerIndex,
            current +
            Number(amount || 0)
        );
    }


    /* ========================================================
     * MAIN
     * ====================================================== */

    getHand(
        playerIndex
    ) {

        const player =
            this.getPlayer(
                playerIndex
            );

        if (!player) {
            return [];
        }

        return Array.isArray(
            player.main
        )
            ? player.main
            : [];
    }


    removeCard(
        playerIndex,
        cardIndex
    ) {

        const hand =
            this.getHand(
                playerIndex
            );

        if (
            cardIndex < 0 ||
            cardIndex >=
                hand.length
        ) {
            return null;
        }

        return hand.splice(
            cardIndex,
            1
        )[0];
    }


    addCard(
        playerIndex,
        card
    ) {

        const player =
            this.getPlayer(
                playerIndex
            );

        if (!player) {
            return false;
        }

        if (!Array.isArray(
            player.main
        )) {
            player.main = [];
        }

        player.main.push(
            clone(card)
        );

        player.cardCount =
            player.main.length;

        return true;
    }


    /* ========================================================
     * TABLE
     * ====================================================== */

    addTableCard(card) {

        if (!Array.isArray(
            this.data.table
        )) {
            this.data.table = [];
        }

        this.data.table.push(
            clone(card)
        );

        return true;
    }


    removeTableCard(
        index
    ) {

        if (
            index < 0 ||
            index >=
                this.data.table.length
        ) {
            return null;
        }

        return this.data.table.splice(
            index,
            1
        )[0];
    }


    /* ========================================================
     * DÉFAUSSE
     * ====================================================== */

    addDiscard(card) {

        if (!Array.isArray(
            this.data.discard
        )) {
            this.data.discard = [];
        }

        this.data.discard.push(
            clone(card)
        );
    }


    /* ========================================================
     * PIOCHE
     * ====================================================== */

    drawUnknownCard() {

        if (
            this.data.deckCount <= 0
        ) {
            return null;
        }

        this.data.deckCount--;

        /*
         * La valeur de la carte tirée n'est pas inventée.
         *
         * Pour une simulation stratégique, une carte inconnue
         * est représentée par null.
         */
        return null;
    }


    /* ========================================================
     * TOUR
     * ====================================================== */

    setCurrentPlayer(
        playerIndex
    ) {

        this.data.currentPlayer =
            Number(playerIndex);

        return true;
    }


    advancePlayer() {

        const count =
            this.players.length;

        if (
            count <= 0
        ) {
            return;
        }

        this.data.currentPlayer =
            (
                Number(
                    this.data.currentPlayer
                ) + 1
            ) %
            count;
    }


    /* ========================================================
     * ACTION EN COURS
     * ====================================================== */

    setAction(
        action
    ) {

        this.data.action =
            action;

        return true;
    }


    setTarget(
        target
    ) {

        this.data.target =
            target;

        return true;
    }


    /* ========================================================
     * ÉVÉNEMENTS
     * ====================================================== */

    addEvent(
        event
    ) {

        this.events.push(
            clone(event)
        );
    }


    revealInformation(
        information
    ) {

        const value =
            clone(information);

        this.revealedInformation.push(
            value
        );

        this.addEvent({
            type:
                "information-revealed",

            information:
                value
        });
    }


    /* ========================================================
     * FIN DE PARTIE
     * ====================================================== */

    setWinner(
        playerIndex
    ) {

        const player =
            this.getPlayer(
                playerIndex
            );

        if (!player) {
            return false;
        }

        this.data.winner =
            player.name;

        this.data.roundEnded =
            true;

        return true;
    }


    /* ========================================================
     * SIGNATURE
     * ====================================================== */

    signature() {

        return JSON.stringify(
            this.data
        );
    }
}


/* ============================================================
 * SIMULATEUR
 * ========================================================== */

export class AtoumoulinSimulator {

    constructor(
        gameState,
        options = {}
    ) {

        if (!gameState) {

            throw new Error(
                "Le simulateur nécessite un GameState."
            );
        }

        this.gameState =
            gameState;

        this.options = {

            /*
             * Le simulateur ne révèle aucune information
             * cachée par défaut.
             */
            revealHidden:
                false,

            /*
             * Autorise les transitions génériques.
             */
            allowGenericTransitions:
                true,

            /*
             * Permet de brancher ultérieurement les règles
             * exactes de chaque carte.
             */
            actionHandlers:
                {},

            ...options
        };
    }


    /* ========================================================
     * CRÉATION D'UN ÉTAT
     * ====================================================== */

    createInitialState() {

        return new VirtualGameState(
            this.gameState
        );
    }


    /* ========================================================
     * SIMULATION PRINCIPALE
     * ====================================================== */

    simulate(
        action
    ) {

        const normalized =
            action instanceof
            SimulatedAction
                ? action
                : new SimulatedAction(
                    action
                );


        /*
         * On crée TOUJOURS une copie.
         */
        const state =
            this.createInitialState();


        /*
         * On mémorise l'état précédent.
         */
        state.previous =
            this.gameState.signature();


        /*
         * Vérification minimale.
         */
        const validation =
            this.validateAction(
                normalized,
                state
            );

        if (!validation.valid) {

            return new SimulationResult({

                state,

                action:
                    normalized,

                legal:
                    false,

                completed:
                    false,

                error:
                    validation.reason
            });
        }


        /*
         * Cherche un gestionnaire spécifique.
         */
        const handler =
            this.getHandler(
                normalized
            );


        try {

            if (handler) {

                handler(
                    state,
                    normalized,
                    this
                );

            } else if (
                this.options
                    .allowGenericTransitions
            ) {

                this.applyGenericAction(
                    state,
                    normalized
                );

            } else {

                return new SimulationResult({

                    state,

                    action:
                        normalized,

                    legal:
                        false,

                    completed:
                        false,

                    error:
                        "Aucun simulateur disponible pour cette action."
                });
            }


            /*
             * Vérifie les conditions générales de fin.
             */
            this.checkEndConditions(
                state
            );


            /*
             * Calcule les différences de score.
             */
            const scoreDelta =
                this.calculateScoreDelta(
                    this.gameState,
                    state
                );


            return new SimulationResult({

                state,

                action:
                    normalized,

                legal:
                    true,

                completed:
                    true,

                events:
                    state.events,

                revealedInformation:
                    state.revealedInformation,

                scoreDelta,

                metadata: {

                    source:
                        handler
                            ? "specific-handler"
                            : "generic-handler"
                }
            });

        } catch (error) {

            return new SimulationResult({

                state,

                action:
                    normalized,

                legal:
                    false,

                completed:
                    false,

                error:
                    error instanceof Error
                        ? error.message
                        : String(error)
            });
        }
    }


    /* ========================================================
     * HANDLER
     * ====================================================== */

    getHandler(
        action
    ) {

        /*
         * Priorité à un identifiant explicite.
         */
        if (
            action.effect &&
            typeof
                this.options
                    .actionHandlers[
                    action.effect
                ] === "function"
        ) {

            return this.options
                .actionHandlers[
                    action.effect
                ];
        }


        /*
         * Puis au type.
         */
        if (
            typeof
                this.options
                    .actionHandlers[
                    action.type
                ] === "function"
        ) {

            return this.options
                .actionHandlers[
                    action.type
                ];
        }

        return null;
    }


    /* ========================================================
     * VALIDATION
     * ====================================================== */

    validateAction(
        action,
        state
    ) {

        if (!action) {

            return {
                valid:
                    false,

                reason:
                    "Action absente."
            };
        }


        if (
            !action.type
        ) {

            return {
                valid:
                    false,

                reason:
                    "Type d'action absent."
            };
        }


        /*
         * Une action du bot doit être effectuée pendant son
         * tour, sauf lorsqu'une action spéciale est explicitement
         * prévue.
         */
        if (
            state.currentPlayer !==
            state.botIndex
        ) {

            return {
                valid:
                    false,

                reason:
                    "Ce n'est pas le tour du bot."
            };
        }


        /*
         * Vérification de carte.
         */
        if (
            action.cardIndex !==
            null &&
            action.cardIndex !==
            undefined
        ) {

            const hand =
                state.getHand(
                    state.botIndex
                );

            if (
                action.cardIndex < 0 ||
                action.cardIndex >=
                    hand.length
            ) {

                return {
                    valid:
                        false,

                    reason:
                        "Index de carte invalide."
                };
            }
        }


        /*
         * Une cible doit être un adversaire.
         */
        if (
            action.target !==
            null &&
            action.target !==
            undefined
        ) {

            const target =
                state.getPlayer(
                    action.target
                );

            if (!target) {

                return {
                    valid:
                        false,

                    reason:
                        "Cible inexistante."
                };
            }


            if (
                Number(action.target) ===
                Number(state.botIndex)
            ) {

                /*
                 * Certaines cartes peuvent cibler soi-même.
                 * On laisse les handlers spécifiques décider.
                 */
                if (
                    action.parameters
                        ?.allowSelfTarget !==
                    true
                ) {

                    return {
                        valid:
                            false,

                        reason:
                            "Cette action cible le bot lui-même."
                    };
                }
            }
        }


        return {
            valid:
                true
        };
    }


    /* ========================================================
     * ACTION GÉNÉRIQUE
     * ====================================================== */

    applyGenericAction(
        state,
        action
    ) {

        /*
         * Cette fonction ne prétend pas connaître les règles
         * détaillées de chaque carte.
         *
         * Elle représente uniquement la structure générique
         * d'une action :
         *
         *     carte consommée
         *     cible enregistrée
         *     effet enregistré
         *
         * Les règles précises seront branchées ensuite.
         */


        if (
            action.cardIndex !==
            null &&
            action.cardIndex !==
            undefined
        ) {

            const card =
                state.removeCard(
                    state.botIndex,
                    action.cardIndex
                );

            state.addEvent({
                type:
                    "card-played",

                player:
                    state.botIndex,

                card:
                    clone(card)
            });
        }


        if (
            action.target !==
            null &&
            action.target !==
            undefined
        ) {

            state.setTarget(
                action.target
            );

            state.addEvent({
                type:
                    "target-selected",

                player:
                    state.botIndex,

                target:
                    action.target
            });
        }


        if (action.effect) {

            state.addEvent({
                type:
                    "effect",

                effect:
                    action.effect,

                parameters:
                    clone(
                        action.parameters
                    )
            });
        }


        /*
         * Une action générique est considérée comme terminée.
         *
         * Les handlers spéciaux pourront au contraire laisser
         * une action en cours.
         */
        state.setAction(
            null
        );


        /*
         * Dans une simulation simple, on passe au joueur
         * suivant.
         */
        state.advancePlayer();
    }


    /* ========================================================
     * FIN DE PARTIE
     * ====================================================== */

    checkEndConditions(
        state
    ) {

        /*
         * La cible exacte dépend du jeu.
         *
         * Le simulateur ne fixe volontairement pas une valeur
         * en dur ici.
         *
         * Cette fonction pourra utiliser la règle exacte lorsque
         * la constante de cible sera branchée au moteur.
         */
        for (
            const player
            of state.players
        ) {

            if (
                player &&
                player.score ===
                state.data.targetScore
            ) {

                state.setWinner(
                    player.id
                );

                return true;
            }
        }

        return false;
    }


    /* ========================================================
     * DIFFÉRENCE DE SCORE
     * ====================================================== */

    calculateScoreDelta(
        before,
        after
    ) {

        const result = {};

        for (
            const player
            of before.players
        ) {

            const previous =
                Number(
                    player.score
                ) || 0;

            const nextPlayer =
                after.getPlayer(
                    player.id
                );

            const next =
                nextPlayer
                    ? Number(
                        nextPlayer.score
                    ) || 0
                    : previous;

            result[
                player.id
            ] =
                next -
                previous;
        }

        return result;
    }
}


/* ============================================================
 * SIMULATION D'UNE ACTION
 * ========================================================== */

export function simulateAction(
    gameState,
    action,
    options = {}
) {

    const simulator =
        new AtoumoulinSimulator(
            gameState,
            options
        );

    return simulator.simulate(
        action
    );
}


/* ============================================================
 * SIMULATION DE PLUSIEURS ACTIONS
 * ========================================================== */

export function simulateActions(
    gameState,
    actions,
    options = {}
) {

    const simulator =
        new AtoumoulinSimulator(
            gameState,
            options
        );

    const results = [];

    for (
        const action
        of actions
    ) {

        results.push(
            simulator.simulate(
                action
            )
        );
    }

    return results;
}


/* ============================================================
 * SIMULATION D'UNE LIGNE
 * ========================================================== */

/**
 * Permettra plus tard de faire :
 *
 * action 1
 *   ↓
 * état 1
 *   ↓
 * action 2
 *   ↓
 * état 2
 *   ↓
 * action 3
 *   ↓
 * état 3
 *
 * C'est la base de la recherche profondeur 2, 3, etc.
 */
export function simulateLine(
    gameState,
    actions,
    options = {}
) {

    let current =
        gameState;

    const results = [];


    for (
        const action
        of actions
    ) {

        const result =
            simulateAction(
                current,
                action,
                options
            );

        results.push(
            result
        );


        if (
            !result.isUsable()
        ) {

            return {
                success:
                    false,

                state:
                    current,

                results,

                failedAt:
                    results.length - 1,

                error:
                    result.error
            };
        }


        current =
            result.state;
    }


    return {
        success:
            true,

        state:
            current,

        results,

        failedAt:
            null,

        error:
            null
    };
}


/* ============================================================
 * COMPARAISON D'ÉTATS
 * ========================================================== */

export function statesEqual(
    first,
    second
) {

    if (!first || !second) {
        return false;
    }

    const firstSignature =
        typeof first.signature ===
        "function"
            ? first.signature()
            : JSON.stringify(first);

    const secondSignature =
        typeof second.signature ===
        "function"
            ? second.signature()
            : JSON.stringify(second);

    return (
        firstSignature ===
        secondSignature
    );
}


/* ============================================================
 * DISTANCE ENTRE ÉTATS
 * ========================================================== */

export function stateDifference(
    before,
    after
) {

    const difference = {

        score:
            {},

        handSize:
            {},

        deck:
            0,

        table:
            0,

        currentPlayer:
            null,

        actionChanged:
            false
    };


    for (
        const player
        of before.players
    ) {

        const next =
            after.getPlayer(
                player.id
            );

        if (!next) {
            continue;
        }

        difference.score[
            player.id
        ] =
            (
                Number(next.score) || 0
            ) -
            (
                Number(player.score) || 0
            );


        difference.handSize[
            player.id
        ] =
            (
                next.main?.length ??
                next.cardCount ??
                0
            ) -
            (
                player.main?.length ??
                player.cardCount ??
                0
            );
    }


    difference.deck =
        after.deckCount -
        before.deckCount;


    difference.table =
        after.table.length -
        before.table.length;


    difference.currentPlayer =
        after.currentPlayer;


    difference.actionChanged =
        before.action !==
        after.action;


    return difference;
}
