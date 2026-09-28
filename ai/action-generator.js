/**
 * Atoumoulin AI
 * action-generator.js
 *
 * Générateur unique des ACTIONS COMPLÈTES disponibles.
 *
 * IMPORTANT :
 *
 * action.js
 *   = représentation / construction d'une action
 *
 * action-generator.js
 *   = détermine quelles actions sont légales dans l'état courant
 *
 * Ce module ne choisit jamais la meilleure action.
 */

import {
    ACTION_TYPES,

    getBaseActions,

    get1Actions,
    get3Actions,
    get9Actions,
    get17Actions,

    getAvailableTargets,
    getPlayersWithPointCards,
    getPlayersWithCards,

    getStealableCards13,
    getStealableCardsDouble13,

    getDouble15Targets,
    getTriple15Targets,

    get19Targets,
    getDouble19Targets,

    get21Actions,
    getJokerActions,

    createTableCardAction,
    createTableCardsAction,
    createContinueAction,
    createTerminateAction,

    isCompleteAction,
    isActionApplicable,

    deduplicateActions,
    sortActions,
    validateActions,

    actionSignature,
    actionPriority
} from "./action.js";


/* ============================================================
 * UTILITAIRES
 * ========================================================== */

function getAction(state) {
    return state?.action ?? null;
}


function getBotIndex(state, explicitIndex = null) {
    if (
        explicitIndex !== null &&
        explicitIndex !== undefined
    ) {
        return Number(explicitIndex);
    }

    if (
        state?.botIndex !== null &&
        state?.botIndex !== undefined
    ) {
        return Number(state.botIndex);
    }

    return Number(state?.currentPlayer ?? 0);
}


function isOwnTurn(state, botIndex) {
    return (
        Number(state?.currentPlayer) ===
        Number(botIndex)
    );
}


function getTarget(state) {
    return (
        state?.target ??
        state?.cibleChoisie ??
        null
    );
}


/* ============================================================
 * DÉBUT DE TOUR
 * ========================================================== */

/**
 * Les priorités sont strictes :
 *
 * 1. Double 7
 * 2. 7
 * 3. Double X
 * 4. Carte simple
 */
function generateTurnActions(
    state,
    botIndex
) {
    if (!isOwnTurn(state, botIndex)) {
        return [];
    }

    return getBaseActions(
        state,
        botIndex
    );
}


/* ============================================================
 * 1 / DOUBLE 1
 * ========================================================== */

function generateCard1Actions(
    state,
    botIndex,
    isDouble = false
) {
    const targets =
        getPlayersWithPointCards(
            state,
            botIndex
        );

    return targets.map(
        target => ({
            id:
                `${isDouble ? "double1" : "1"}:${target}`,

            type:
                ACTION_TYPES.TARGET,

            card:
                isDouble ? 1 : 1,

            target,

            effect:
                isDouble
                    ? "steal_latest_two_points"
                    : "steal_latest_point",

            complete: true,

            metadata: {
                double: isDouble,
                hiddenInformation: false
            }
        })
    );
}


/* ============================================================
 * 3 / DOUBLE 3
 * ========================================================== */

function generateCard3Actions(
    state,
    botIndex,
    isDouble = false
) {
    return get3Actions(
        state,
        botIndex,
        isDouble ? "Double3" : 3
    ).map(
        action => ({
            ...action,

            card:
                isDouble
                    ? 3
                    : 3,

            effect:
                "score_target",

            value:
                isDouble
                    ? -40
                    : -20,

            metadata: {
                ...(action.metadata ?? {}),
                double: isDouble
            }
        })
    );
}


/* ============================================================
 * 9 / DOUBLE 9
 * ========================================================== */

function generateCard9Actions(
    state,
    botIndex,
    isDouble = false
) {
    return getAvailableTargets(
        state,
        botIndex
    ).map(
        action => ({
            ...action,

            id:
                `${isDouble ? "double9" : "9"}:${action.target}`,

            type:
                ACTION_TYPES.TARGET,

            card: 9,

            effect:
                "swap_hands",

            complete: true,

            metadata: {
                double: isDouble,

                /*
                 * Pour un 9 normal, le contenu adverse reste
                 * caché.
                 *
                 * Pour Double9, le moteur peut temporairement
                 * révéler la main de la cible au joueur actif.
                 */
                hiddenInformation:
                    !isDouble,

                double9Reveal:
                    isDouble
            }
        })
    );
}


/* ============================================================
 * 13
 * ========================================================== */

function generateCard13Actions(
    state,
    botIndex,
    isDouble = false
) {
    const actions = [];

    const targets =
        getAvailableTargets(
            state,
            botIndex
        );

    for (const targetAction of targets) {
        const target =
            targetAction.target;

        const cardActions =
            isDouble
                ? getStealableCardsDouble13(
                    state,
                    target
                )
                : getStealableCards13(
                    state,
                    target
                );

        for (const action of cardActions) {
            actions.push({
                ...action,

                id:
                    isDouble
                        ? `double13:${target}:${
                            (
                                action.tableCardIndices ??
                                []
                            ).join(",")
                        }`
                        : `13:${target}:${
                            action.tableCardIndex
                        }`,

                card: 13,

                target,

                effect:
                    isDouble
                        ? "steal_points"
                        : "steal_point",

                metadata: {
                    ...(action.metadata ?? {}),
                    double: isDouble
                },

                complete: true
            });
        }
    }

    return actions;
}


/* ============================================================
 * 15
 * ========================================================== */

function generateCard15Actions(
    state,
    botIndex,
    isDouble = false
) {
    const actions =
        isDouble
            ? getTriple15Targets(
                state,
                botIndex
            )
            : getDouble15Targets(
                state,
                botIndex
            );

    return actions.map(
        action => ({
            ...action,

            id:
                `${isDouble ? "double15" : "15"}:${
                    action.tableCardIndex
                }`,

            card: 15,

            effect:
                isDouble
                    ? "triple_point_card"
                    : "double_point_card",

            metadata: {
                ...(action.metadata ?? {}),

                multiplier:
                    isDouble
                        ? 3
                        : 2
            },

            complete: true
        })
    );
}


/* ============================================================
 * 17 / DOUBLE 17
 * ========================================================== */

function generateCard17Actions(
    state,
    botIndex,
    isDouble = false
) {
    return getPlayersWithCards(
        state,
        botIndex
    ).map(
        target => ({
            id:
                `${isDouble ? "double17" : "17"}:${target}`,

            type:
                ACTION_TYPES.TARGET,

            card: 17,

            target,

            effect:
                isDouble
                    ? "steal_hidden_cards"
                    : "steal_hidden_card",

            complete: true,

            metadata: {
                double: isDouble,

                hiddenInformation: true,

                stolenCardKnown: false,

                revealRequired: true,

                /*
                 * Le nombre de cartes dépend du type.
                 */
                stealCount:
                    isDouble
                        ? 2
                        : 1
            }
        })
    );
}


/* ============================================================
 * 19
 * ========================================================== */

function generateCard19Actions(
    state,
    botIndex,
    isDouble = false
) {
    const actions =
        isDouble
            ? getDouble19Targets(
                state,
                botIndex
            )
            : get19Targets(
                state,
                botIndex
            );

    return actions.map(
        action => ({
            ...action,

            card: 19,

            effect:
                isDouble
                    ? "exchange_point_cards"
                    : "exchange_latest_point_cards",

            complete: true,

            metadata: {
                ...(action.metadata ?? {}),
                double: isDouble,

                /*
                 * Le contenu des mains adverses n'est jamais
                 * nécessaire pour le 19.
                 */
                hiddenInformation: false
            }
        })
    );
}


/* ============================================================
 * 21 / DOUBLE 21
 * ========================================================== */

function generateCard21Actions(
    state,
    botIndex,
    isDouble = false
) {
    const cardActions =
        get21Actions(
            state,
            botIndex,
            21
        );

    const multiplier =
        isDouble ? 2 : 1;

    return cardActions.map(
        action => ({
            ...action,

            id:
                isDouble
                    ? `double21:${
                        action.effect
                    }:${
                        action.target ?? "self"
                    }`
                    : `21:${
                        action.effect
                    }:${
                        action.target ?? "self"
                    }`,

            card: 21,

            value:
                action.value *
                multiplier,

            metadata: {
                ...(action.metadata ?? {}),
                double: isDouble,
                multiplier
            },

            complete: true
        })
    );
}


/* ============================================================
 * JOKER
 * ========================================================== */

function generateJokerActions(
    state,
    botIndex
) {
    return getJokerActions(
        state,
        botIndex
    ).map(
        action => ({
            ...action,

            complete: true,

            metadata: {
                ...(action.metadata ?? {}),

                hiddenInformation:
                    action.effect ===
                    "exchange_scores"
            }
        })
    );
}


/* ============================================================
 * ACTIONS PENDANTES
 * ========================================================== */

/**
 * Certains états existent parce que le moteur réel a déjà
 * commencé à résoudre une carte.
 *
 * Ils sont conservés ici uniquement pour permettre à
 * l'adaptateur moteur de terminer une action.
 *
 * Le moteur stratégique, lui, doit normalement recevoir une
 * action complète dès le départ.
 */

function generatePendingActions(
    state,
    botIndex
) {
    const action =
        getAction(state);

    const target =
        getTarget(state);

    if (!action) {
        return [];
    }


    /* --------------------------------------------------------
     * 13 : choix de carte
     * ------------------------------------------------------ */

    if (action === "carte13choix") {
        if (
            target === null ||
            target === undefined
        ) {
            return [];
        }

        return getStealableCards13(
            state,
            target
        );
    }


    /* --------------------------------------------------------
     * Double 13
     * ------------------------------------------------------ */

    if (action === "double13choix") {
        if (
            target === null ||
            target === undefined
        ) {
            return [];
        }

        return getStealableCardsDouble13(
            state,
            target
        );
    }


    /* --------------------------------------------------------
     * 17 révélé
     *
     * La carte a maintenant été révélée par le moteur.
     * Elle peut être traitée comme une nouvelle information.
     * ------------------------------------------------------ */

    if (
        action === "carte17revelee"
    ) {
        return [
            {
                id: "17:continue",

                type:
                    ACTION_TYPES.CONTINUE,

                card: 17,

                target,

                effect:
                    "play_stolen_card",

                complete: true,

                metadata: {
                    revealed:
                        true
                }
            }
        ];
    }


    /* --------------------------------------------------------
     * Double 17 révélé
     * ------------------------------------------------------ */

    if (
        action === "double17revelee"
    ) {
        const cards =
            Array.isArray(
                state.double17Cards
            )
                ? state.double17Cards
                : [];

        return cards.map(
            (card, index) => ({
                id:
                    `double17:revealed:${index}`,

                type:
                    ACTION_TYPES.TABLE_CARD,

                card:
                    card?.valeur ??
                    card?.value ??
                    card,

                cardIndex:
                    index,

                target,

                effect:
                    "choose_revealed_card",

                complete: true,

                metadata: {
                    revealed:
                        true,

                    hiddenInformation:
                        false
                }
            })
        );
    }


    if (
        action === "double17jouer"
    ) {
        return [
            createContinueAction({
                card: 17,

                target,

                effect:
                    "play_revealed_card"
            })
        ];
    }


    /* --------------------------------------------------------
     * Fin d'une résolution 13 / 15 / 17
     * ------------------------------------------------------ */

    if (
        action === "terminerDouble13"
    ) {
        return [
            createTerminateAction({
                effect:
                    "finish_double13"
            })
        ];
    }


    if (
        action === "terminerDouble15"
    ) {
        return [
            createTerminateAction({
                effect:
                    "finish_double15"
            })
        ];
    }


    if (
        action === "terminer17SansCarte"
    ) {
        return [
            createTerminateAction({
                effect:
                    "finish_17_without_card"
            })
        ];
    }


    return [];
}


/* ============================================================
 * GÉNÉRATEUR PRINCIPAL
 * ========================================================== */

export function generateActions(
    state,
    botIndex = null
) {
    if (!state) {
        return [];
    }

    const index =
        getBotIndex(
            state,
            botIndex
        );

    /*
     * Un bot ne génère jamais d'action si ce n'est pas son tour.
     */
    if (!isOwnTurn(state, index)) {
        return [];
    }

    const action =
        getAction(state);


    /*
     * --------------------------------------------------------
     * TOUR NORMAL
     * ------------------------------------------------------ */

    if (
        action === null ||
        action === undefined
    ) {
        return finalize(
            state,
            index,
            generateTurnActions(
                state,
                index
            )
        );
    }


    /*
     * --------------------------------------------------------
     * ACTIONS PENDANTES DU MOTEUR
     * ------------------------------------------------------ */

    const pending =
        generatePendingActions(
            state,
            index
        );

    if (pending.length) {
        return finalize(
            state,
            index,
            pending
        );
    }


    /*
     * --------------------------------------------------------
     * CARTES SPÉCIALES
     * ------------------------------------------------------ */

    let actions = [];


    switch (action) {

        case "vol1":
            actions =
                generateCard1Actions(
                    state,
                    index,
                    false
                );
            break;


        case "double1":
            actions =
                generateCard1Actions(
                    state,
                    index,
                    true
                );
            break;


        case "carte3":
            actions =
                generateCard3Actions(
                    state,
                    index,
                    false
                );
            break;


        case "double3":
            actions =
                generateCard3Actions(
                    state,
                    index,
                    true
                );
            break;


        case "carte9":
            actions =
                generateCard9Actions(
                    state,
                    index,
                    false
                );
            break;


        case "double9":
            actions =
                generateCard9Actions(
                    state,
                    index,
                    true
                );
            break;


        case "carte13":
            actions =
                generateCard13Actions(
                    state,
                    index,
                    false
                );
            break;


        case "double13":
            actions =
                generateCard13Actions(
                    state,
                    index,
                    true
                );
            break;


        case "carte15":
            actions =
                generateCard15Actions(
                    state,
                    index,
                    false
                );
            break;


        case "double15":
            actions =
                generateCard15Actions(
                    state,
                    index,
                    true
                );
            break;


        case "carte17":
            actions =
                generateCard17Actions(
                    state,
                    index,
                    false
                );
            break;


        case "double17":
            actions =
                generateCard17Actions(
                    state,
                    index,
                    true
                );
            break;


        case "carte19":
            actions =
                generateCard19Actions(
                    state,
                    index,
                    false
                );
            break;


        case "double19":
            actions =
                generateCard19Actions(
                    state,
                    index,
                    true
                );
            break;


        case "carte21":
            actions =
                generateCard21Actions(
                    state,
                    index,
                    false
                );
            break;


        case "double21":
            actions =
                generateCard21Actions(
                    state,
                    index,
                    true
                );
            break;


        case "joker":
            actions =
                generateJokerActions(
                    state,
                    index
                );
            break;


        default:
            actions = [];
    }


    return finalize(
        state,
        index,
        actions
    );
}


/* ============================================================
 * FINALISATION
 * ========================================================== */

function finalize(
    state,
    botIndex,
    actions
) {
    /*
     * 1. uniquement des actions complètes
     */
    const complete =
        (actions ?? [])
            .filter(
                isCompleteAction
            );

    /*
     * 2. suppression des doublons
     */
    const unique =
        deduplicateActions(
            complete
        );

    /*
     * 3. validation contre l'état
     */
    const valid =
        validateActions(
            state,
            botIndex,
            unique
        );

    /*
     * 4. ordre légal des catégories
     */
    return sortActions(
        valid
    );
}


/* ============================================================
 * API COMPATIBLE
 * ========================================================== */

export function generateLegalActions(
    state,
    botIndex = null
) {
    return generateActions(
        state,
        botIndex
    );
}


export function getLegalActions(
    state,
    botIndex = null
) {
    return generateActions(
        state,
        botIndex
    );
}


export function sortByActionPriority(
    actions
) {
    return sortActions(
        actions
    );
}


export function getActionPriority(
    action
) {
    return actionPriority(
        action
    );
}


export function isLegalAction(
    state,
    botIndex,
    action
) {
    if (!action) {
        return false;
    }

    return generateLegalActions(
        state,
        botIndex
    ).some(
        legal =>
            actionSignature(legal) ===
            actionSignature(action)
    );
}


/* ============================================================
 * EXPORT
 * ========================================================== */

export {
    ACTION_TYPES
};

export default {
    ACTION_TYPES,

    generateActions,
    generateLegalActions,
    getLegalActions,

    sortByActionPriority,
    getActionPriority,

    isLegalAction
};
