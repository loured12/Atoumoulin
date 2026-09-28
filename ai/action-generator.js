/**
 * Atoumoulin AI
 * action-generator.js
 *
 * Générateur unique des ACTIONS COMPLÈTES disponibles.
 *
 * Principe :
 *
 *   état réel
 *      ↓
 *   cartes légalement jouables
 *      ↓
 *   toutes les conséquences connues
 *      ↓
 *   UNE action complète
 *
 * Ce module ne choisit jamais la meilleure action.
 */

import {
    ACTION_TYPES,

    getBaseActions,

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

    getPointCardsOfPlayer,

    createCardAction,
    createDoubleAction,
    createTargetAction,
    createTableCardAction,
    createTableCardsAction,
    createEffectAction,
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


function getBotIndex(
    state,
    explicitIndex = null
) {
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

    return Number(
        state?.currentPlayer ?? 0
    );
}


function isOwnTurn(
    state,
    botIndex
) {
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


function getCardValue(card) {
    if (
        card &&
        typeof card === "object"
    ) {
        return (
            card.valeur ??
            card.value ??
            null
        );
    }

    return card;
}


function getPlayer(
    state,
    playerIndex
) {
    return (
        state?.players?.find(
            player =>
                Number(player.id) ===
                Number(playerIndex)
        ) ??
        state?.players?.[playerIndex] ??
        null
    );
}


function getHand(
    state,
    botIndex
) {
    const player =
        getPlayer(
            state,
            botIndex
        );

    return Array.isArray(player?.main)
        ? player.main
        : [];
}


function getBaseCardIndex(action) {
    return (
        action?.cardIndex ??
        null
    );
}


function getBaseDoubleIndices(action) {
    return Array.isArray(action?.indices)
        ? action.indices.slice(0, 2)
        : [];
}


function getBaseCard(action) {
    return getCardValue(
        action?.card
    );
}


/* ============================================================
 * DÉBUT DE TOUR
 * ========================================================== */

/**
 * Les priorités restent strictes :
 *
 * 1. Double 7
 * 2. 7 simple
 * 3. Double X
 * 4. Carte simple
 *
 * getBaseActions() garantit déjà cette priorité.
 */
function generateTurnActions(
    state,
    botIndex
) {
    if (
        !isOwnTurn(
            state,
            botIndex
        )
    ) {
        return [];
    }

    const baseActions =
        getBaseActions(
            state,
            botIndex
        );

    const result = [];

    for (
        const baseAction
        of baseActions
    ) {
        result.push(
            ...expandBaseAction(
                state,
                botIndex,
                baseAction
            )
        );
    }

    return result;
}


/* ============================================================
 * EXPANSION D'UNE ACTION DE BASE
 * ========================================================== */

/**
 * Une action de base représente :
 *
 *   "je joue cette carte"
 *
 * Cette fonction la transforme en :
 *
 *   "je joue cette carte ET voici tout ce que
 *    je choisis pour son effet."
 *
 * Pour les informations réellement inconnues (17),
 * l'action conserve explicitement l'incertitude.
 */
function expandBaseAction(
    state,
    botIndex,
    baseAction
) {
    const card =
        getBaseCard(
            baseAction
        );

    const isDouble =
        baseAction.type ===
        ACTION_TYPES.PLAY_DOUBLE;

    const cardIndex =
        getBaseCardIndex(
            baseAction
        );

    const indices =
        getBaseDoubleIndices(
            baseAction
        );

    if (
        card === null ||
        card === undefined
    ) {
        return [];
    }


    /* --------------------------------------------------------
     * DOUBLE
     * ------------------------------------------------------ */

    if (isDouble) {
        return expandDoubleCard(
            state,
            botIndex,
            card,
            indices
        );
    }


    /* --------------------------------------------------------
     * CARTE SIMPLE
     * ------------------------------------------------------ */

    return expandSingleCard(
        state,
        botIndex,
        card,
        cardIndex
    );
}


/* ============================================================
 * CARTE SIMPLE
 * ========================================================== */

function expandSingleCard(
    state,
    botIndex,
    card,
    cardIndex
) {
    switch (String(card)) {

        case "1":
            return generateCard1Actions(
                state,
                botIndex,
                false,
                cardIndex
            );

        case "3":
            return generateCard3Actions(
                state,
                botIndex,
                false,
                cardIndex
            );

        case "9":
            return generateCard9Actions(
                state,
                botIndex,
                false,
                cardIndex
            );

        case "13":
            return generateCard13Actions(
                state,
                botIndex,
                false,
                cardIndex
            );

        case "15":
            return generateCard15Actions(
                state,
                botIndex,
                false,
                cardIndex
            );

        case "17":
            return generateCard17Actions(
                state,
                botIndex,
                false,
                cardIndex
            );

        case "19":
            return generateCard19Actions(
                state,
                botIndex,
                false,
                cardIndex
            );

        case "21":
            return generateCard21Actions(
                state,
                botIndex,
                false,
                cardIndex
            );

        case "11":
            return [
                createEffectAction({
                    card: 11,
                    cardIndex,
                    effect: "score",
                    value: 10
                })
            ];

        case "Joker":
        case "joker":
            return generateJokerActions(
                state,
                botIndex,
                cardIndex
            );

        default:
            /*
             * Carte ordinaire sans pouvoir spécial.
             *
             * On la conserve comme action complète.
             */
            return [
                createCardAction({
                    card,
                    cardIndex,
                    effect: "play_card"
                })
            ];
    }
}


/* ============================================================
 * DOUBLE
 * ========================================================== */

function expandDoubleCard(
    state,
    botIndex,
    card,
    indices
) {
    if (
        !Array.isArray(indices) ||
        indices.length !== 2
    ) {
        return [];
    }

    switch (String(card)) {

        case "1":
            return generateCard1Actions(
                state,
                botIndex,
                true,
                null,
                indices
            );

        case "3":
            return generateCard3Actions(
                state,
                botIndex,
                true,
                null,
                indices
            );

        case "9":
            return generateCard9Actions(
                state,
                botIndex,
                true,
                null,
                indices
            );

        case "11":
            return [
                createDoubleAction({
                    card: 11,
                    indices,
                    effect: "score",
                    value: 20
                })
            ];

        case "13":
            return generateCard13Actions(
                state,
                botIndex,
                true,
                null,
                indices
            );

        case "15":
            return generateCard15Actions(
                state,
                botIndex,
                true,
                null,
                indices
            );

        case "17":
            return generateCard17Actions(
                state,
                botIndex,
                true,
                null,
                indices
            );

        case "19":
            return generateCard19Actions(
                state,
                botIndex,
                true,
                null,
                indices
            );

        case "21":
            return generateCard21Actions(
                state,
                botIndex,
                true,
                null,
                indices
            );

        case "7":
            /*
             * Le Double 7 reste une action complète.
             * La priorité est déjà imposée par getBaseActions().
             */
            return [
                createDoubleAction({
                    card: 7,
                    indices,
                    effect: "play_double"
                })
            ];

        default:
            return [
                createDoubleAction({
                    card,
                    indices,
                    effect: "play_double"
                })
            ];
    }
}


/* ============================================================
 * 1 / DOUBLE 1
 * ========================================================== */

function generateCard1Actions(
    state,
    botIndex,
    isDouble = false,
    cardIndex = null,
    indices = []
) {
    const targets =
        getPlayersWithPointCards(
            state,
            botIndex
        );

    return targets.map(
        target => {

            if (isDouble) {
                return createDoubleAction({
                    card: 1,
                    indices,
                    target,
                    effect:
                        "steal_latest_two_points",
                    metadata: {
                        double: true,
                        hiddenInformation: false,
                        stealCount: 2
                    }
                });
            }

            return createCardAction({
                card: 1,
                cardIndex,
                target,
                effect:
                    "steal_latest_point",
                metadata: {
                    double: false,
                    hiddenInformation: false,
                    stealCount: 1
                }
            });
        }
    );
}


/* ============================================================
 * 3 / DOUBLE 3
 * ========================================================== */

function generateCard3Actions(
    state,
    botIndex,
    isDouble = false,
    cardIndex = null,
    indices = []
) {
    return getAvailableTargets(
        state,
        botIndex
    ).map(
        targetAction => {

            const target =
                targetAction.target;

            const value =
                isDouble
                    ? -40
                    : -20;

            if (isDouble) {
                return createDoubleAction({
                    card: 3,
                    indices,
                    target,
                    effect:
                        "score_target",
                    value,
                    metadata: {
                        double: true
                    }
                });
            }

            return createCardAction({
                card: 3,
                cardIndex,
                target,
                effect:
                    "score_target",
                value,
                metadata: {
                    double: false
                }
            });
        }
    );
}


/* ============================================================
 * 9 / DOUBLE 9
 * ========================================================== */

function generateCard9Actions(
    state,
    botIndex,
    isDouble = false,
    cardIndex = null,
    indices = []
) {
    return getAvailableTargets(
        state,
        botIndex
    ).map(
        targetAction => {

            const target =
                targetAction.target;

            const metadata = {
                double: isDouble,

                /*
                 * Le contenu de la main adverse reste caché
                 * pour le 9 normal.
                 */
                hiddenInformation:
                    !isDouble,

                double9Reveal:
                    isDouble
            };

            if (isDouble) {
                return createDoubleAction({
                    card: 9,
                    indices,
                    target,
                    effect:
                        "swap_hands",
                    metadata
                });
            }

            return createCardAction({
                card: 9,
                cardIndex,
                target,
                effect:
                    "swap_hands",
                metadata
            });
        }
    );
}


/* ============================================================
 * 13 / DOUBLE 13
 * ========================================================== */

function generateCard13Actions(
    state,
    botIndex,
    isDouble = false,
    cardIndex = null,
    indices = []
) {
    const result = [];

    const targets =
        getAvailableTargets(
            state,
            botIndex
        );

    for (
        const targetAction
        of targets
    ) {
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

        for (
            const tableAction
            of cardActions
        ) {
            if (isDouble) {

                const tableIndices =
                    Array.isArray(
                        tableAction.tableCardIndices
                    )
                        ? tableAction.tableCardIndices
                        : [];

                result.push(
                    createDoubleAction({
                        card: 13,
                        indices,
                        target,
                        tableCardIndices:
                            tableIndices,
                        effect:
                            "steal_points",
                        metadata: {
                            double: true,
                            stolenValues:
                                tableIndices.map(
                                    index =>
                                        state.table?.[
                                            index
                                        ]?.valeur ??
                                        state.table?.[
                                            index
                                        ]?.value ??
                                        null
                                )
                        }
                    })
                );

            } else {

                result.push(
                    createCardAction({
                        card: 13,
                        cardIndex,
                        target,
                        tableCardIndex:
                            tableAction.tableCardIndex,
                        effect:
                            "steal_point",
                        value:
                            tableAction.value,
                        metadata: {
                            double: false,
                            stolenValue:
                                tableAction.value
                        }
                    })
                );
            }
        }
    }

    return result;
}


/* ============================================================
 * 15 / DOUBLE 15
 * ========================================================== */

function generateCard15Actions(
    state,
    botIndex,
    isDouble = false,
    cardIndex = null,
    indices = []
) {
    const targets =
        isDouble
            ? getTriple15Targets(
                state,
                botIndex
            )
            : getDouble15Targets(
                state,
                botIndex
            );

    return targets.map(
        targetAction => {

            const tableCardIndex =
                targetAction.tableCardIndex;

            const value =
                targetAction.value;

            if (isDouble) {
                return createDoubleAction({
                    card: 15,
                    indices,
                    tableCardIndex,
                    value,
                    effect:
                        "triple_point_card",
                    metadata: {
                        multiplier: 3
                    }
                });
            }

            return createCardAction({
                card: 15,
                cardIndex,
                tableCardIndex,
                value,
                effect:
                    "double_point_card",
                metadata: {
                    multiplier: 2
                }
            });
        }
    );
}


/* ============================================================
 * 17 / DOUBLE 17
 * ========================================================== */

/**
 * IMPORTANT :
 *
 * La carte volée n'est PAS révélée ici.
 *
 * L'action complète signifie :
 *
 *   17 + cible + "voler une carte inconnue"
 *
 * La simulation doit ensuite représenter plusieurs scénarios
 * possibles pour cette information cachée.
 */
function generateCard17Actions(
    state,
    botIndex,
    isDouble = false,
    cardIndex = null,
    indices = []
) {
    const targets =
        getPlayersWithCards(
            state,
            botIndex
        );

    return targets.map(
        target => {

            const metadata = {
                double: isDouble,

                hiddenInformation: true,

                stolenCardKnown: false,

                revealRequired: true,

                stealCount:
                    isDouble
                        ? 2
                        : 1
            };

            if (isDouble) {
                return createDoubleAction({
                    card: 17,
                    indices,
                    target,
                    effect:
                        "steal_hidden_cards",
                    metadata
                });
            }

            return createCardAction({
                card: 17,
                cardIndex,
                target,
                effect:
                    "steal_hidden_card",
                metadata
            });
        }
    );
}


/* ============================================================
 * 19 / DOUBLE 19
 * ========================================================== */

function generateCard19Actions(
    state,
    botIndex,
    isDouble = false,
    cardIndex = null,
    indices = []
) {
    const baseActions =
        isDouble
            ? getDouble19Targets(
                state,
                botIndex
            )
            : get19Targets(
                state,
                botIndex
            );

    return baseActions.map(
        baseAction => {

            const target =
                baseAction.target;

            if (isDouble) {

                const ownIndices =
                    baseAction.metadata
                        ?.ownTableCardIndices ??
                    [];

                const targetIndices =
                    baseAction.metadata
                        ?.targetTableCardIndices ??
                    [];

                return createDoubleAction({
                    card: 19,
                    indices,
                    target,

                    tableCardIndices:
                        targetIndices,

                    effect:
                        "exchange_point_cards",

                    metadata: {
                        double: true,

                        ownTableCardIndices:
                            ownIndices,

                        targetTableCardIndices:
                            targetIndices,

                        hiddenInformation: false
                    }
                });
            }

            const ownTableCardIndex =
                baseAction.metadata
                    ?.ownTableCardIndex ??
                null;

            const targetTableCardIndex =
                baseAction.metadata
                    ?.targetTableCardIndex ??
                null;

            return createCardAction({
                card: 19,
                cardIndex,
                target,

                ownTableCardIndex,

                targetTableCardIndex,

                effect:
                    "exchange_latest_point_cards",

                metadata: {
                    double: false,

                    hiddenInformation: false
                }
            });
        }
    );
}


/* ============================================================
 * 21 / DOUBLE 21
 * ========================================================== */

function generateCard21Actions(
    state,
    botIndex,
    isDouble = false,
    cardIndex = null,
    indices = []
) {
    /*
     * get21Actions() produit :
     *
     *   +20 soi
     *   -20 cible
     *
     * La valeur est ensuite doublée pour Double21.
     */
    const baseActions =
        get21Actions(
            state,
            botIndex,
            21
        );

    const multiplier =
        isDouble
            ? 2
            : 1;

    return baseActions.map(
        baseAction => {

            const value =
                Number(baseAction.value) *
                multiplier;

            const effect =
                baseAction.effect;

            if (isDouble) {
                return createDoubleAction({
                    card: 21,
                    indices,
                    target:
                        baseAction.target ??
                        null,
                    effect,
                    value,
                    metadata: {
                        double: true,
                        multiplier
                    }
                });
            }

            return createCardAction({
                card: 21,
                cardIndex,
                target:
                    baseAction.target ??
                    null,
                effect,
                value,
                metadata: {
                    double: false,
                    multiplier
                }
            });
        }
    );
}


/* ============================================================
 * JOKER
 * ========================================================== */

function generateJokerActions(
    state,
    botIndex,
    cardIndex = null
) {
    return getJokerActions(
        state,
        botIndex
    ).map(
        baseAction => {

            const hiddenInformation =
                baseAction.effect ===
                "exchange_scores";

            return createCardAction({
                card: "Joker",
                cardIndex,

                target:
                    baseAction.target ??
                    null,

                effect:
                    baseAction.effect,

                value:
                    baseAction.value ??
                    null,

                metadata: {
                    ...(baseAction.metadata ?? {}),
                    hiddenInformation
                }
            });
        }
    );
}


/* ============================================================
 * ACTIONS PENDANTES
 * ========================================================== */

/**
 * Compatibilité avec le moteur réel.
 *
 * La recherche stratégique utilise normalement les actions
 * complètes générées au début du tour.
 *
 * Ces états servent lorsque script.js est déjà engagé dans
 * une résolution interactive.
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
     * 13
     * ------------------------------------------------------ */

    if (
        action === "carte13choix"
    ) {
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

    if (
        action === "double13choix"
    ) {
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
     * ------------------------------------------------------ */

    if (
        action === "carte17revelee"
    ) {
        return [
            createContinueAction({
                card: 17,
                target,
                effect:
                    "play_stolen_card",
                metadata: {
                    revealed: true
                }
            })
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
            (card, index) =>
                createTableCardAction({
                    card:
                        getCardValue(card),

                    cardIndex:
                        index,

                    target,

                    tableCardIndex:
                        index,

                    effect:
                        "choose_revealed_card",

                    metadata: {
                        revealed: true,
                        hiddenInformation: false
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
     * Terminaisons
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

    if (
        !isOwnTurn(
            state,
            index
        )
    ) {
        return [];
    }

    const currentAction =
        getAction(state);


    /* --------------------------------------------------------
     * TOUR NORMAL
     * ------------------------------------------------------ */

    if (
        currentAction === null ||
        currentAction === undefined
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


    /* --------------------------------------------------------
     * MOTEUR DÉJÀ ENGAGÉ DANS UNE ACTION
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
     * Compatibilité avec les états intermédiaires
     * de script.js.
     *
     * Si l'ancien moteur a déjà joué une carte et attend
     * encore une décision, on régénère uniquement la partie
     * encore inconnue.
     */

    let actions = [];

    switch (currentAction) {

        case "vol1":
            actions =
                generateCard1Actions(
                    state,
                    index,
                    false,
                    null
                );
            break;

        case "double1":
            actions =
                generateCard1Actions(
                    state,
                    index,
                    true,
                    null,
                    []
                );
            break;

        case "carte3":
            actions =
                generateCard3Actions(
                    state,
                    index,
                    false,
                    null
                );
            break;

        case "double3":
            actions =
                generateCard3Actions(
                    state,
                    index,
                    true,
                    null,
                    []
                );
            break;

        case "carte9":
            actions =
                generateCard9Actions(
                    state,
                    index,
                    false,
                    null
                );
            break;

        case "double9":
            actions =
                generateCard9Actions(
                    state,
                    index,
                    true,
                    null,
                    []
                );
            break;

        case "carte13":
            actions =
                generateCard13Actions(
                    state,
                    index,
                    false,
                    null
                );
            break;

        case "double13":
            actions =
                generateCard13Actions(
                    state,
                    index,
                    true,
                    null,
                    []
                );
            break;

        case "carte15":
            actions =
                generateCard15Actions(
                    state,
                    index,
                    false,
                    null
                );
            break;

        case "double15":
            actions =
                generateCard15Actions(
                    state,
                    index,
                    true,
                    null,
                    []
                );
            break;

        case "carte17":
            actions =
                generateCard17Actions(
                    state,
                    index,
                    false,
                    null
                );
            break;

        case "double17":
            actions =
                generateCard17Actions(
                    state,
                    index,
                    true,
                    null,
                    []
                );
            break;

        case "carte19":
            actions =
                generateCard19Actions(
                    state,
                    index,
                    false,
                    null
                );
            break;

        case "double19":
            actions =
                generateCard19Actions(
                    state,
                    index,
                    true,
                    null,
                    []
                );
            break;

        case "carte21":
            actions =
                generateCard21Actions(
                    state,
                    index,
                    false,
                    null
                );
            break;

        case "double21":
            actions =
                generateCard21Actions(
                    state,
                    index,
                    true,
                    null,
                    []
                );
            break;

        case "joker":
            actions =
                generateJokerActions(
                    state,
                    index,
                    null
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
    const complete =
        (actions ?? [])
            .filter(
                isCompleteAction
            );

    const unique =
        deduplicateActions(
            complete
        );

    const valid =
        validateActions(
            state,
            botIndex,
            unique
        );

    return sortActions(
        valid
    );
}


/* ============================================================
 * API
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
