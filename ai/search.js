/**
 * Atoumoulin AI
 * search.js
 *
 * Recherche prospective de l'IA.
 *
 * Principe :
 *
 *     état actuel
 *          ↓
 *     actions légales
 *          ↓
 *     simulation
 *          ↓
 *     évaluation
 *          ↓
 *     actions futures
 *          ↓
 *     résultat final
 *
 * IMPORTANT :
 * - ne modifie jamais la partie réelle ;
 * - ne choisit pas directement selon la difficulté ;
 * - respecte les actions produites par action-generator.js ;
 * - recalcule les possibilités après chaque simulation ;
 * - ne révèle pas volontairement les informations cachées.
 */

import {
    generateLegalActions,
    sortByActionPriority
} from "./action-generator.js";

import {
    SimulatedAction,
    simulateAction
} from "./simulation.js";

import {
    evaluate,
    evaluatePlayerPosition
} from "./evaluation.js";


/* ============================================================
 * UTILITAIRES
 * ========================================================== */

function number(value, fallback = 0) {
    const result = Number(value);

    return Number.isFinite(result)
        ? result
        : fallback;
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
            number(value)
        )
    );
}


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

    if (
        typeof value === "object"
    ) {
        const result = {};

        for (
            const [key, item]
            of Object.entries(value)
        ) {
            result[key] = clone(item);
        }

        return result;
    }

    return value;
}


/* ============================================================
 * PROFONDEUR
 * ========================================================== */

/**
 * Profondeur générale par niveau.
 *
 * Le niveau peut être :
 * - facile
 * - normal
 * - difficile
 * - expert
 *
 * L'expert pourra ensuite être rendu adaptatif.
 */
export function getSearchDepth(
    difficulty = "normal",
    context = {}
) {
    const level =
        String(
            difficulty
        ).toLowerCase();

    if (
        Number.isInteger(
            context.depth
        ) &&
        context.depth > 0
    ) {
        return context.depth;
    }

    switch (level) {
        case "facile":
        case "easy":
            return 1;

        case "difficile":
        case "hard":
            return 3;

        case "expert":
            return getAdaptiveExpertDepth(
                context
            );

        case "normal":
        default:
            return 2;
    }
}


/**
 * Profondeur adaptative Expert.
 *
 * On augmente la recherche lorsque :
 * - la fin de manche approche ;
 * - le bot est proche de la cible ;
 * - beaucoup d'informations sont déjà connues ;
 * - le nombre d'actions reste raisonnable.
 */
export function getAdaptiveExpertDepth(
    context = {}
) {
    let depth = 3;

    const gamePhase =
        number(
            context.gamePhase,
            0
        );

    const distance =
        number(
            context.distanceToTarget,
            Infinity
        );

    const actionCount =
        number(
            context.actionCount,
            0
        );

    if (
        gamePhase >= 0.70
    ) {
        depth++;
    }

    if (
        distance <= 40
    ) {
        depth++;
    }

    if (
        distance <= 20
    ) {
        depth++;
    }

    /*
     * Évite une explosion combinatoire.
     */
    if (
        actionCount > 20
    ) {
        depth = Math.min(
            depth,
            4
        );
    }

    return Math.max(
        3,
        Math.min(
            depth,
            6
        )
    );
}


/* ============================================================
 * ADAPTATION ACTION → SIMULATION
 * ========================================================== */

/**
 * action-generator.js utilise AIAction.
 *
 * simulation.js utilise SimulatedAction.
 *
 * Cette fonction fait uniquement le pont structurel.
 *
 * Elle ne révèle aucune information cachée.
 */
export function toSimulatedAction(
    action
) {
    if (!action) {
        return null;
    }

    if (
        action instanceof SimulatedAction
    ) {
        return action;
    }

    const isDouble =
        action.kind === "play-double" ||
        action.metadata?.double === true;

    let type = "card";

    if (isDouble) {
        type = "double";
    }

    if (
        action.kind === "choose-target"
    ) {
        type = "target";
    }

    if (
        action.kind === "choose-effect"
    ) {
        type = "effect";
    }

    if (
        action.kind === "choose-table-card" ||
        action.kind ===
            "choose-multiple-table-cards"
    ) {
        type = "combination";
    }

    if (
        action.kind === "choose-revealed-card"
    ) {
        type = "card";
    }

    if (
        action.kind === "continue"
    ) {
        type = "effect";
    }

    if (
        action.kind === "finish"
    ) {
        type = "effect";
    }

    return new SimulatedAction({
        type,

        cardIndex:
            action.cardIndex ??
            null,

        card:
            clone(
                action.card
            ),

        cards:
            clone(
                action.cards ??
                []
            ),

        target:
            action.target ??
            null,

        effect:
            action.effect ??
            null,

        value:
            action.value ??
            null,

        parameters: {
            tableCard:
                action.tableCard ??
                null,

            tableCards:
                clone(
                    action.tableCards ??
                    []
                ),

            hiddenInformation:
                !!action.hiddenInformation,

            uncertainty:
                action.uncertainty ??
                null,

            metadata:
                clone(
                    action.metadata ??
                    {}
                ),

            commands:
                clone(
                    action.commands ??
                    []
                )
        },

        description:
            action.metadata?.description ??
            ""
    });
}


/* ============================================================
 * CONTEXTE
 * ========================================================== */

function buildEvaluationContext({
    state,
    playerIndex,
    actions = [],
    depth = 0,
    maxDepth = 1,
    path = [],
    simulation = null
}) {
    const player =
        typeof state?.getPlayer === "function"
            ? state.getPlayer(
                playerIndex
            )
            : state?.players?.[
                playerIndex
            ];

    const target =
        number(
            state?.targetScore ??
            state?.victoryTarget ??
            0
        );

    const score =
        number(
            player?.score
        );

    const distance =
        target > 0
            ? target - score
            : null;

    const progress =
        typeof state?.getCardsProgress ===
        "function"
            ? state.getCardsProgress()
            : 0;

    return {
        possibilities:
            actions,

        depth,

        maxDepth,

        path,

        gamePhase:
            progress,

        distanceToTarget:
            distance,

        actionCount:
            actions.length,

        simulation,

        searching:
            true
    };
}


/* ============================================================
 * ÉVALUATION
 * ========================================================== */

function evaluateLeaf({
    state,
    playerIndex,
    action = null,
    resultingState = null,
    actions = [],
    depth = 0,
    maxDepth = 0,
    path = [],
    simulation = null
}) {
    const context =
        buildEvaluationContext({
            state,
            playerIndex,
            actions,
            depth,
            maxDepth,
            path,
            simulation
        });

    if (
        action &&
        resultingState
    ) {
        return evaluate({
            state,
            playerIndex,
            action,
            resultingState,
            context
        });
    }

    return evaluatePlayerPosition(
        state,
        playerIndex,
        context
    );
}


function scoreEvaluation(
    evaluation
) {
    if (!evaluation) {
        return -Infinity;
    }

    /*
     * evaluateAction() expose normalement finalScore.
     */
    if (
        Number.isFinite(
            Number(
                evaluation.finalScore
            )
        )
    ) {
        return number(
            evaluation.finalScore
        );
    }

    /*
     * Fallback : position globale.
     */
    if (
        Number.isFinite(
            Number(
                evaluation.position
            )
        )
    ) {
        return number(
            evaluation.position
        );
    }

    return 0;
}


/* ============================================================
 * DÉTECTION FIN
 * ========================================================== */

function isWinningState(
    state,
    playerIndex
) {
    if (!state) {
        return false;
    }

    if (
        state.roundEnded === true
    ) {
        const winner =
            state.winner;

        if (
            winner === null ||
            winner === undefined
        ) {
            return false;
        }

        if (
            typeof winner === "number"
        ) {
            return (
                Number(winner) ===
                Number(playerIndex)
            );
        }

        const player =
            typeof state.getPlayer ===
            "function"
                ? state.getPlayer(
                    playerIndex
                )
                : null;

        return (
            player &&
            player.name === winner
        );
    }

    const player =
        typeof state.getPlayer ===
        "function"
            ? state.getPlayer(
                playerIndex
            )
            : state.players?.[
                playerIndex
            ];

    if (!player) {
        return false;
    }

    const target =
        number(
            state.targetScore ??
            state.victoryTarget ??
            0
        );

    return (
        target > 0 &&
        number(player.score) ===
        target
    );
}


/* ============================================================
 * RECHERCHE D'UNE LIGNE
 * ========================================================== */

function searchNode({
    state,
    playerIndex,
    depth,
    maxDepth,
    path = [],
    visited = new Set()
}) {
    /*
     * Fin immédiate.
     */
    if (
        isWinningState(
            state,
            playerIndex
        )
    ) {
        const evaluation =
            evaluateLeaf({
                state,
                playerIndex,
                actions: [],
                depth,
                maxDepth,
                path
            });

        return {
            score:
                Math.max(
                    1000,
                    scoreEvaluation(
                        evaluation
                    )
                ),

            evaluation,

            state,

            path,

            terminal:
                true,

            depth
        };
    }

    /*
     * Limite de profondeur.
     */
    if (
        depth >= maxDepth
    ) {
        const actions =
            generateActions(
                state
            );

        const evaluation =
            evaluateLeaf({
                state,
                playerIndex,
                actions,
                depth,
                maxDepth,
                path
            });

        return {
            score:
                scoreEvaluation(
                    evaluation
                ),

            evaluation,

            state,

            path,

            terminal:
                false,

            depth
        };
    }

    /*
     * Protection contre les cycles.
     */
    const signature =
        getStateSignature(
            state
        );

    if (
        signature &&
        visited.has(signature)
    ) {
        const evaluation =
            evaluateLeaf({
                state,
                playerIndex,
                actions: [],
                depth,
                maxDepth,
                path
            });

        return {
            score:
                scoreEvaluation(
                    evaluation
                ),

            evaluation,

            state,

            path,

            terminal:
                false,

            repeated:
                true,

            depth
        };
    }

    const nextVisited =
        new Set(
            visited
        );

    if (signature) {
        nextVisited.add(
            signature
        );
    }

    const actions =
        generateActions(
            state
        );

    if (
        actions.length === 0
    ) {
        const evaluation =
            evaluateLeaf({
                state,
                playerIndex,
                actions,
                depth,
                maxDepth,
                path
            });

        return {
            score:
                scoreEvaluation(
                    evaluation
                ),

            evaluation,

            state,

            path,

            terminal:
                true,

            depth
        };
    }

    let best = null;

    for (
        const action
        of actions
    ) {
        const simulation =
            simulateOne(
                state,
                action
            );

        if (
            !simulation ||
            !simulation.isUsable()
        ) {
            continue;
        }

        const resultingState =
            simulation.state;

        const childPath =
            [
                ...path,
                action
            ];

        const evaluation =
            evaluateLeaf({
                state,
                playerIndex,
                action,
                resultingState,
                actions,
                depth,
                maxDepth,
                path:
                    childPath,
                simulation
            });

        /*
         * Si l'action termine immédiatement,
         * elle passe avant toute continuation.
         */
        if (
            isWinningState(
                resultingState,
                playerIndex
            )
        ) {
            const immediateScore =
                Math.max(
                    1000,
                    scoreEvaluation(
                        evaluation
                    )
                );

            const candidate = {
                score:
                    immediateScore,

                evaluation,

                state:
                    resultingState,

                action,

                simulation,

                path:
                    childPath,

                terminal:
                    true,

                depth:
                    depth + 1
            };

            if (
                !best ||
                candidate.score >
                best.score
            ) {
                best =
                    candidate;
            }

            continue;
        }

        /*
         * Recherche récursive.
         */
        const child =
            searchNode({
                state:
                    resultingState,

                playerIndex,

                depth:
                    depth + 1,

                maxDepth,

                path:
                    childPath,

                visited:
                    nextVisited
            });

        const candidateScore =
            scoreEvaluation(
                evaluation
            ) * 0.40 +
            child.score * 0.60;

        const candidate = {
            score:
                candidateScore,

            evaluation,

            childEvaluation:
                child.evaluation,

            state:
                resultingState,

            action,

            simulation,

            child,

            path:
                childPath,

            terminal:
                child.terminal,

            depth:
                depth + 1
        };

        if (
            !best ||
            candidate.score >
            best.score
        ) {
            best =
                candidate;
        }
    }

    /*
     * Aucun coup simulable.
     */
    if (!best) {
        const evaluation =
            evaluateLeaf({
                state,
                playerIndex,
                actions,
                depth,
                maxDepth,
                path
            });

        return {
            score:
                scoreEvaluation(
                    evaluation
                ),

            evaluation,

            state,

            path,

            terminal:
                false,

            noSimulation:
                true,

            depth
        };
    }

    return best;
}


/* ============================================================
 * ACTIONS
 * ========================================================== */

function generateActions(
    state
) {
    let actions =
        generateLegalActions(
            state
        );

    if (
        !Array.isArray(actions)
    ) {
        return [];
    }

    actions =
        actions.filter(
            Boolean
        );

    return sortByActionPriority(
        actions
    );
}


/* ============================================================
 * SIMULATION
 * ========================================================== */

function simulateOne(
    state,
    action
) {
    const simulated =
        toSimulatedAction(
            action
        );

    if (!simulated) {
        return null;
    }

    return simulateAction(
        state,
        simulated
    );
}


/* ============================================================
 * SIGNATURE
 * ========================================================== */

function getStateSignature(
    state
) {
    if (!state) {
        return null;
    }

    if (
        typeof state.signature ===
        "function"
    ) {
        try {
            return state.signature();
        } catch {}
    }

    try {
        return JSON.stringify(
            state
        );
    } catch {
        return null;
    }
}


/* ============================================================
 * RECHERCHE PUBLIQUE
 * ========================================================== */

/**
 * Recherche toutes les premières actions et leur meilleure
 * continuation connue.
 */
export function searchActions({
    state,
    playerIndex,
    difficulty = "normal",
    depth = null
} = {}) {
    if (!state) {
        throw new Error(
            "searchActions : state manquant."
        );
    }

    const index =
        Number(playerIndex);

    if (
        !Number.isInteger(index)
    ) {
        throw new Error(
            "searchActions : playerIndex invalide."
        );
    }

    const initialActions =
        generateActions(
            state
        );

    if (
        initialActions.length === 0
    ) {
        return [];
    }

    const maxDepth =
        Number.isInteger(depth) &&
        depth > 0
            ? depth
            : getSearchDepth(
                difficulty,
                {
                    actionCount:
                        initialActions.length,

                    gamePhase:
                        typeof state.getCardsProgress ===
                        "function"
                            ? state.getCardsProgress()
                            : 0,

                    distanceToTarget:
                        getDistanceToTarget(
                            state,
                            index
                        )
                }
            );

    const results = [];

    for (
        const action
        of initialActions
    ) {
        const simulation =
            simulateOne(
                state,
                action
            );

        if (
            !simulation ||
            !simulation.isUsable()
        ) {
            continue;
        }

        const resultingState =
            simulation.state;

        const evaluation =
            evaluateLeaf({
                state,
                playerIndex:
                    index,

                action,

                resultingState,

                actions:
                    initialActions,

                depth:
                    0,

                maxDepth,

                path:
                    [action],

                simulation
            });

        let continuation = null;

        if (
            maxDepth > 1 &&
            !isWinningState(
                resultingState,
                index
            )
        ) {
            continuation =
                searchNode({
                    state:
                        resultingState,

                    playerIndex:
                        index,

                    depth:
                        1,

                    maxDepth,

                    path:
                        [action],

                    visited:
                        new Set([
                            getStateSignature(
                                state
                            )
                        ])
                });
        }

        const immediateScore =
            scoreEvaluation(
                evaluation
            );

        const futureScore =
            continuation
                ? continuation.score
                : immediateScore;

        const finalScore =
            continuation
                ? immediateScore * 0.40 +
                  futureScore * 0.60
                : immediateScore;

        results.push({
            action,

            score:
                finalScore,

            immediateScore,

            futureScore,

            evaluation,

            simulation,

            resultingState,

            continuation,

            depth:
                continuation
                    ? continuation.depth
                    : 1
        });
    }

    return results.sort(
        (a, b) =>
            b.score -
            a.score
    );
}


/**
 * Renvoie la meilleure possibilité issue de la recherche.
 *
 * Cette fonction ne contient aucune logique de difficulté
 * aléatoire. Elle donne uniquement le résultat stratégique.
 */
export function searchBestAction(
    options = {}
) {
    const results =
        searchActions(
            options
        );

    return (
        results[0] ??
        null
    );
}


/**
 * Recherche dédiée à la fin de manche.
 *
 * Elle peut utiliser une profondeur supérieure à la profondeur
 * générale.
 */
export function searchFinish({
    state,
    playerIndex,
    maxDepth = 8
} = {}) {
    if (!state) {
        throw new Error(
            "searchFinish : state manquant."
        );
    }

    const index =
        Number(playerIndex);

    const actions =
        generateActions(
            state
        );

    const winningLines = [];

    for (
        const action
        of actions
    ) {
        const simulation =
            simulateOne(
                state,
                action
            );

        if (
            !simulation ||
            !simulation.isUsable()
        ) {
            continue;
        }

        const resultingState =
            simulation.state;

        if (
            isWinningState(
                resultingState,
                index
            )
        ) {
            winningLines.push({
                action,

                turns:
                    1,

                score:
                    100,

                simulation,

                resultingState,

                path:
                    [action]
            });

            continue;
        }

        const result =
            searchNode({
                state:
                    resultingState,

                playerIndex:
                    index,

                depth:
                    1,

                maxDepth,

                path:
                    [action],

                visited:
                    new Set([
                        getStateSignature(
                            state
                        )
                    ])
            });

        if (
            result?.terminal &&
            isWinningState(
                result.state,
                index
            )
        ) {
            winningLines.push({
                action,

                turns:
                    result.depth,

                score:
                    calculateFinishLineScore(
                        result.depth
                    ),

                simulation,

                resultingState,

                result,

                path:
                    result.path
            });
        }
    }

    return winningLines.sort(
        (a, b) => {
            if (
                a.turns !==
                b.turns
            ) {
                return (
                    a.turns -
                    b.turns
                );
            }

            return (
                b.score -
                a.score
            );
        }
    );
}


/* ============================================================
 * FINISH SCORE
 * ========================================================== */

function calculateFinishLineScore(
    turns
) {
    switch (number(turns)) {
        case 1:
            return 100;

        case 2:
            return 70;

        case 3:
            return 45;

        case 4:
            return 25;

        default:
            return 10;
    }
}


/* ============================================================
 * OUTILS
 * ========================================================== */

function getDistanceToTarget(
    state,
    playerIndex
) {
    const player =
        typeof state?.getPlayer ===
        "function"
            ? state.getPlayer(
                playerIndex
            )
            : state?.players?.[
                playerIndex
            ];

    if (!player) {
        return Infinity;
    }

    const target =
        number(
            state?.targetScore ??
            state?.victoryTarget ??
            0
        );

    if (
        target <= 0
    ) {
        return Infinity;
    }

    return (
        target -
        number(player.score)
    );
}


/* ============================================================
 * API PAR DÉFAUT
 * ========================================================== */

export default {
    searchActions,
    searchBestAction,
    searchFinish,
    getSearchDepth,
    getAdaptiveExpertDepth,
    toSimulatedAction
};
