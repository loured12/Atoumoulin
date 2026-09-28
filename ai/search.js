/**
 * Atoumoulin AI
 * search.js
 *
 * Recherche stratégique de l'IA.
 *
 * Principe :
 *   état actuel
 *      ↓
 *   actions légales complètes
 *      ↓
 *   simulation de chaque action
 *      ↓
 *   évaluation de l'état résultant
 *      ↓
 *   recherche des tours suivants
 *      ↓
 *   comparaison des lignes
 *
 * Important :
 * - Une action = une décision complète.
 * - Les actions futures sont recalculées à chaque tour.
 * - Les informations cachées ne sont jamais révélées artificiellement.
 * - Une finition n'est PAS sélectionnée par une logique séparée :
 *   elle passe par la même recherche et la même évaluation.
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
    evaluatePlayerPosition,
    calculateFinishPotential
} from "./evaluation.js";

import {
    getGamePhase,
    getTargetDistance,
    getVictoryTarget,
    hasExactTarget
} from "./state.js";


/* =========================================================
 * DIFFICULTÉ / PROFONDEUR
 * ========================================================= */

const SEARCH_DEPTH = {
    facile: 1,
    normal: 2,
    difficile: 3
};

function normalizeDifficulty(value) {
    const aliases = {
        easy: "facile",
        medium: "normal",
        hard: "difficile"
    };

    const normalized = String(value || "normal").toLowerCase();

    return aliases[normalized] ||
        (
            normalized === "facile" ||
            normalized === "normal" ||
            normalized === "difficile" ||
            normalized === "expert"
                ? normalized
                : "normal"
        );
}

function getAdaptiveExpertDepth(state, actionCount = 0) {
    let depth = 3;

    const phase = Number(getGamePhase(state)) || 0;
    const distance = Number(getTargetDistance(state)) || 0;

    /*
     * Plus la partie avance, plus la recherche devient importante.
     */
    if (phase >= 0.65) {
        depth += 1;
    }

    if (phase >= 0.82) {
        depth += 1;
    }

    /*
     * Une proximité forte de la cible justifie davantage
     * de profondeur.
     */
    if (distance <= 40) {
        depth += 1;
    }

    if (distance <= 20) {
        depth += 1;
    }

    /*
     * Évite l'explosion combinatoire lorsque beaucoup
     * d'actions sont disponibles.
     */
    if (actionCount >= 20) {
        depth -= 1;
    }

    return Math.max(3, Math.min(6, depth));
}

export function getSearchDepth(
    difficulty = "normal",
    {
        state = null,
        actionCount = 0,
        gamePhase = null
    } = {}
) {
    const level = normalizeDifficulty(difficulty);

    if (level === "expert") {
        if (state) {
            return getAdaptiveExpertDepth(
                state,
                actionCount
            );
        }

        const phase =
            Number(gamePhase) || 0;

        let depth = 3;

        if (phase >= 0.65) depth += 1;
        if (phase >= 0.82) depth += 1;
        if (actionCount >= 20) depth -= 1;

        return Math.max(3, Math.min(6, depth));
    }

    return SEARCH_DEPTH[level];
}


/* =========================================================
 * CONVERSION ACTION → SIMULATION
 * ========================================================= */

export function toSimulatedAction(action) {
    if (!action) {
        return null;
    }

    /*
     * L'action-generator historique et le nouveau générateur
     * peuvent fournir des objets légèrement différents.
     *
     * On conserve donc une conversion tolérante.
     */

    const kind = String(
        action.kind ||
        action.type ||
        "effect"
    );

    let type = "effect";

    if (
        kind === "PLAY_CARD" ||
        kind === "card" ||
        kind === "play_card"
    ) {
        type = "card";
    } else if (
        kind === "PLAY_DOUBLE" ||
        kind === "double" ||
        kind === "play_double"
    ) {
        type = "double";
    } else if (
        kind === "TARGET" ||
        kind === "target"
    ) {
        type = "target";
    } else if (
        kind === "TABLE_CARD" ||
        kind === "table_card"
    ) {
        type = "table_card";
    } else if (
        kind === "TABLE_CARDS" ||
        kind === "table_cards"
    ) {
        type = "table_cards";
    } else if (
        kind === "CONTINUE" ||
        kind === "continue"
    ) {
        type = "continue";
    } else if (
        kind === "TERMINATE" ||
        kind === "finish"
    ) {
        type = "terminate";
    }

    return new SimulatedAction({
        type,
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
        parameters: {
            ...(action.parameters || {}),
            ...(action.metadata || {}),
            tableCard:
                action.tableCard ?? null,
            tableCards:
                action.tableCards ?? null,
            commands:
                action.commands || null,
            hiddenInformation:
                action.hiddenInformation || null,
            uncertainty:
                action.uncertainty || null
        },
        description:
            action.description ||
            action.metadata?.description ||
            ""
    });
}


/* =========================================================
 * SIGNATURES / CYCLES
 * ========================================================= */

function getStateSignature(state) {
    if (!state) {
        return "null";
    }

    if (
        typeof state.signature === "function"
    ) {
        return state.signature();
    }

    if (
        typeof state.toMutableObject === "function"
    ) {
        return JSON.stringify(
            state.toMutableObject()
        );
    }

    try {
        return JSON.stringify(state);
    } catch {
        return String(state);
    }
}

function getActionSignature(action) {
    if (!action) {
        return "null";
    }

    if (
        typeof action.signature === "function"
    ) {
        return action.signature();
    }

    try {
        return JSON.stringify(action);
    } catch {
        return String(action);
    }
}


/* =========================================================
 * COMPLEXITÉ D'UNE ACTION
 * ========================================================= */

/*
 * La complexité ne correspond PAS à la puissance de la carte.
 *
 * Elle dépend notamment :
 * - du nombre d'alternatives ;
 * - du nombre de cibles ;
 * - du choix de cartes ;
 * - des informations cachées ;
 * - de l'incertitude ;
 * - des conséquences ;
 * - de la profondeur de recherche nécessaire.
 */

export function calculateActionComplexity(
    state,
    action,
    actionCount = null
) {
    let complexity = 0;

    const actions =
        Array.isArray(
            generateLegalActions(state)
        )
            ? generateLegalActions(state)
            : [];

    const alternatives =
        actionCount == null
            ? actions.length
            : actionCount;

    if (alternatives >= 12) {
        complexity += 2;
    } else if (alternatives >= 6) {
        complexity += 1;
    }

    const kind = String(
        action?.kind ||
        action?.type ||
        ""
    ).toLowerCase();

    if (
        kind.includes("target") ||
        action?.target != null
    ) {
        complexity += 1;
    }

    if (
        action?.tableCard != null ||
        Array.isArray(action?.tableCards)
    ) {
        complexity += 1;
    }

    if (
        action?.hiddenInformation ||
        action?.metadata?.hiddenInformation
    ) {
        complexity += 2;
    }

    if (
        action?.uncertainty ||
        action?.metadata?.uncertainty
    ) {
        complexity += 1;
    }

    if (
        Array.isArray(action?.commands) &&
        action.commands.length > 1
    ) {
        complexity += 1;
    }

    /*
     * Conséquences particulièrement ramifiées.
     */
    const card =
        Number(action?.card?.value ?? action?.card);

    if (
        card === 9 ||
        card === 13 ||
        card === 17 ||
        card === 19 ||
        card === 21
    ) {
        complexity += 1;
    }

    if (
        card === 1 &&
        action?.target != null
    ) {
        complexity += 1;
    }

    if (complexity <= 2) {
        return "simple";
    }

    if (complexity <= 5) {
        return "medium";
    }

    return "complex";
}


/* =========================================================
 * TOLÉRANCE ADAPTATIVE
 * ========================================================= */

export function getActionTolerance(
    state,
    action,
    actionCount = null
) {
    const complexity =
        calculateActionComplexity(
            state,
            action,
            actionCount
        );

    const phase =
        Number(getGamePhase(state)) || 0;

    /*
     * La tolérance augmente avec la complexité :
     * une action complexe peut avoir plusieurs lignes
     * proches sans qu'il soit pertinent de considérer
     * toutes ces lignes comme totalement différentes.
     */

    let tolerance;

    if (complexity === "simple") {
        tolerance = 3;
    } else if (complexity === "medium") {
        tolerance = 5;
    } else {
        tolerance = 8;
    }

    /*
     * En fin de partie, les écarts deviennent plus importants.
     */
    if (phase >= 0.80) {
        tolerance += 1;
    }

    return tolerance;
}


/* =========================================================
 * CONTEXTE D'ÉVALUATION
 * ========================================================= */

function buildEvaluationContext({
    state,
    playerIndex,
    action,
    resultingState,
    depth,
    path,
    actionCount
}) {
    return {
        playerIndex,
        action,
        resultingState,
        depth,
        path,
        actionCount,
        complexity:
            calculateActionComplexity(
                state,
                action,
                actionCount
            ),
        tolerance:
            getActionTolerance(
                state,
                action,
                actionCount
            ),
        gamePhase:
            getGamePhase(state),
        targetDistance:
            getTargetDistance(
                state,
                playerIndex
            ),
        victoryTarget:
            getVictoryTarget(
                state
            )
    };
}


/* =========================================================
 * ÉVALUATION D'UN ÉTAT
 * ========================================================= */

function scoreEvaluation(evaluation) {
    if (!evaluation) {
        return 0;
    }

    const candidates = [
        evaluation.finalScore,
        evaluation.score,
        evaluation.position,
        evaluation.metrics?.finalScore
    ];

    for (const value of candidates) {
        const number = Number(value);

        if (Number.isFinite(number)) {
            return number;
        }
    }

    return 0;
}

function evaluateResult({
    state,
    playerIndex,
    action,
    resultingState,
    depth,
    path,
    actionCount
}) {
    const context =
        buildEvaluationContext({
            state,
            playerIndex,
            action,
            resultingState,
            depth,
            path,
            actionCount
        });

    const result =
        evaluate({
            state,
            playerIndex,
            action,
            resultingState,
            context
        });

    return {
        evaluation: result,
        score: scoreEvaluation(result)
    };
}


/* =========================================================
 * FINITION
 * ========================================================= */

function getFinishInfo(
    state,
    playerIndex,
    action,
    resultingState,
    depth,
    path
) {
    if (!resultingState) {
        return {
            potential: 0,
            exact: false
        };
    }

    const exact =
        hasExactTarget(
            resultingState,
            playerIndex
        );

    if (exact) {
        return {
            potential: 100,
            exact: true
        };
    }

    /*
     * On demande au moteur d'évaluation de calculer
     * la possibilité de finir depuis l'état résultant.
     *
     * Ce n'est pas un sélecteur séparé.
     * C'est une métrique utilisée dans la ligne de recherche.
     */
    let potential = 0;

    try {
        potential =
            Number(
                calculateFinishPotential({
                    state: resultingState,
                    playerIndex,
                    action,
                    depth,
                    path
                })
            );

        if (!Number.isFinite(potential)) {
            potential = 0;
        }
    } catch {
        potential = 0;
    }

    return {
        potential: Math.max(
            0,
            Math.min(100, potential)
        ),
        exact: false
    };
}


/* =========================================================
 * SIMULATION
 * ========================================================= */

function simulateOne(
    state,
    action
) {
    const simulated =
        toSimulatedAction(action);

    if (!simulated) {
        return null;
    }

    try {
        return simulateAction(
            state,
            simulated
        );
    } catch {
        return null;
    }
}


/* =========================================================
 * ACTIONS LÉGALES
 * ========================================================= */

function generateActions(state) {
    const actions =
        generateLegalActions(state);

    if (!Array.isArray(actions)) {
        return [];
    }

    const legal =
        actions.filter(Boolean);

    return sortByActionPriority(
        legal
    );
}


/* =========================================================
 * TERMINAL
 * ========================================================= */

function isTerminalState(
    state,
    playerIndex
) {
    if (!state) {
        return false;
    }

    if (state.roundEnded) {
        return true;
    }

    if (
        hasExactTarget(
            state,
            playerIndex
        )
    ) {
        return true;
    }

    return false;
}


/* =========================================================
 * RECHERCHE RÉCURSIVE
 * ========================================================= */

function searchNode({
    state,
    playerIndex,
    depth,
    maxDepth,
    path = [],
    visited = new Set()
}) {
    /*
     * État terminal :
     * on l'évalue normalement.
     */
    if (
        depth >= maxDepth ||
        isTerminalState(
            state,
            playerIndex
        )
    ) {
        const evaluation =
            evaluatePlayerPosition(
                state,
                playerIndex
            );

        return {
            score:
                scoreEvaluation(
                    evaluation
                ),
            evaluation,
            action: null,
            depth,
            path,
            finishPotential:
                hasExactTarget(
                    state,
                    playerIndex
                )
                    ? 100
                    : 0,
            terminal: true
        };
    }

    const signature =
        getStateSignature(state);

    if (visited.has(signature)) {
        const evaluation =
            evaluatePlayerPosition(
                state,
                playerIndex
            );

        return {
            score:
                scoreEvaluation(
                    evaluation
                ),
            evaluation,
            action: null,
            depth,
            path,
            finishPotential: 0,
            terminal: false,
            cycle: true
        };
    }

    const nextVisited =
        new Set(visited);

    nextVisited.add(signature);

    const actions =
        generateActions(state);

    if (!actions.length) {
        const evaluation =
            evaluatePlayerPosition(
                state,
                playerIndex
            );

        return {
            score:
                scoreEvaluation(
                    evaluation
                ),
            evaluation,
            action: null,
            depth,
            path,
            finishPotential: 0,
            terminal: true
        };
    }

    let best = null;

    for (const action of actions) {
        const simulation =
            simulateOne(
                state,
                action
            );

        if (!simulation) {
            continue;
        }

        if (
            simulation.legal === false ||
            simulation.completed === false
        ) {
            continue;
        }

        const resultingState =
            simulation.state;

        if (!resultingState) {
            continue;
        }

        const actionPath =
            [...path, action];

        const immediate =
            evaluateResult({
                state,
                playerIndex,
                action,
                resultingState,
                depth,
                path: actionPath,
                actionCount:
                    actions.length
            });

        const finish =
            getFinishInfo(
                state,
                playerIndex,
                action,
                resultingState,
                depth,
                actionPath
            );

        let future = null;

        if (
            depth + 1 < maxDepth &&
            !isTerminalState(
                resultingState,
                playerIndex
            )
        ) {
            future =
                searchNode({
                    state: resultingState,
                    playerIndex,
                    depth: depth + 1,
                    maxDepth,
                    path: actionPath,
                    visited: nextVisited
                });
        }

        /*
         * Si aucune recherche future n'est possible,
         * l'évaluation immédiate reste la référence.
         *
         * Sinon, on conserve l'évaluation future comme
         * conséquence de cette action.
         *
         * Pas de 40/60 arbitraire :
         * le résultat futur est lui-même une évaluation
         * complète du nouvel état.
         */
        const futureScore =
            future
                ? Number(future.score) || 0
                : immediate.score;

        /*
         * On utilise la moyenne des évaluations disponibles
         * afin d'éviter qu'une profondeur supplémentaire
         * écrase complètement l'état immédiat.
         *
         * Le poids est ajusté selon la profondeur restante.
         */
        const remainingDepth =
            Math.max(
                1,
                maxDepth - depth
            );

        const futureWeight =
            remainingDepth <= 1
                ? 0
                : 1 / (remainingDepth + 1);

        const immediateWeight =
            1 - futureWeight;

        const combinedScore =
            immediate.score *
                immediateWeight +
            futureScore *
                futureWeight;

        /*
         * La finition est une information de l'évaluation,
         * pas une règle de sélection prioritaire.
         */
        const finishAdjustment =
            finish.potential > 0
                ? finish.potential * 0.10
                : 0;

        const finalScore =
            combinedScore +
            finishAdjustment;

        const candidate = {
            action,
            score: finalScore,
            finalScore,
            immediateScore:
                immediate.score,
            futureScore,
            finishPotential:
                finish.potential,
            winning:
                finish.exact,
            evaluation:
                immediate.evaluation,
            future,
            resultingState,
            simulation,
            depth,
            path: actionPath,
            complexity:
                calculateActionComplexity(
                    state,
                    action,
                    actions.length
                ),
            tolerance:
                getActionTolerance(
                    state,
                    action,
                    actions.length
                )
        };

        if (
            best === null ||
            candidate.score > best.score
        ) {
            best = candidate;
        }
    }

    return best || {
        score: 0,
        finalScore: 0,
        action: null,
        depth,
        path,
        finishPotential: 0,
        terminal: false
    };
}


/* =========================================================
 * RECHERCHE DES ACTIONS
 * ========================================================= */

export function searchActions({
    state,
    playerIndex = 0,
    difficulty = "normal",
    depth = null
} = {}) {
    if (!state) {
        return [];
    }

    const actions =
        generateActions(state);

    if (!actions.length) {
        return [];
    }

    const maxDepth =
        depth == null
            ? getSearchDepth(
                difficulty,
                {
                    state,
                    actionCount:
                        actions.length
                }
            )
            : Math.max(
                1,
                Number(depth) || 1
            );

    const results = [];

    for (const action of actions) {
        const simulation =
            simulateOne(
                state,
                action
            );

        if (!simulation) {
            continue;
        }

        if (
            simulation.legal === false ||
            simulation.completed === false
        ) {
            continue;
        }

        const resultingState =
            simulation.state;

        if (!resultingState) {
            continue;
        }

        const path = [action];

        const immediate =
            evaluateResult({
                state,
                playerIndex,
                action,
                resultingState,
                depth: 0,
                path,
                actionCount:
                    actions.length
            });

        const finish =
            getFinishInfo(
                state,
                playerIndex,
                action,
                resultingState,
                0,
                path
            );

        let future = null;

        if (
            maxDepth > 1 &&
            !isTerminalState(
                resultingState,
                playerIndex
            )
        ) {
            future =
                searchNode({
                    state: resultingState,
                    playerIndex,
                    depth: 1,
                    maxDepth,
                    path,
                    visited: new Set([
                        getStateSignature(state)
                    ])
                });
        }

        const futureScore =
            future
                ? Number(future.score) || 0
                : immediate.score;

        const remainingDepth =
            Math.max(
                1,
                maxDepth
            );

        const futureWeight =
            maxDepth <= 1
                ? 0
                : 1 / (remainingDepth + 1);

        const immediateWeight =
            1 - futureWeight;

        const combinedScore =
            immediate.score *
                immediateWeight +
            futureScore *
                futureWeight;

        const finishAdjustment =
            finish.potential > 0
                ? finish.potential * 0.10
                : 0;

        const finalScore =
            combinedScore +
            finishAdjustment;

        results.push({
            action,
            score: finalScore,
            finalScore,

            immediateScore:
                immediate.score,

            futureScore,

            finishPotential:
                finish.potential,

            winning:
                finish.exact,

            evaluation:
                immediate.evaluation,

            future,

            resultingState,
            simulation,

            depth: maxDepth,

            complexity:
                calculateActionComplexity(
                    state,
                    action,
                    actions.length
                ),

            tolerance:
                getActionTolerance(
                    state,
                    action,
                    actions.length
                )
        });
    }

    results.sort(
        (a, b) =>
            Number(b.finalScore || 0) -
            Number(a.finalScore || 0)
    );

    return results;
}


/* =========================================================
 * MEILLEURE ACTION
 * ========================================================= */

export function searchBestAction({
    state,
    playerIndex = 0,
    difficulty = "normal",
    depth = null
} = {}) {
    const results =
        searchActions({
            state,
            playerIndex,
            difficulty,
            depth
        });

    return results[0] || null;
}


/* =========================================================
 * ANALYSE DES LIGNES DE FINITION
 * ========================================================= */

/*
 * Cette fonction reste disponible pour le diagnostic.
 *
 * Elle ne doit PAS être utilisée par bot.js pour dire :
 * "j'ai trouvé une finition donc je la joue".
 *
 * La décision principale passe par searchActions().
 */

export function searchFinish({
    state,
    playerIndex = 0,
    maxDepth = 8
} = {}) {
    if (!state) {
        return [];
    }

    const results =
        searchActions({
            state,
            playerIndex,
            difficulty: "expert",
            depth: Math.max(
                1,
                Number(maxDepth) || 1
            )
        });

    return results
        .filter(
            result =>
                Number(
                    result.finishPotential
                ) > 0 ||
                result.winning
        )
        .sort(
            (a, b) =>
                Number(
                    b.finishPotential || 0
                ) -
                Number(
                    a.finishPotential || 0
                )
        );
}


/* =========================================================
 * UTILITAIRES
 * ========================================================= */

export function calculateFinishLineScore(turns) {
    const value =
        Number(turns);

    if (!Number.isFinite(value)) {
        return 0;
    }

    if (value <= 1) return 100;
    if (value === 2) return 70;
    if (value === 3) return 45;
    if (value === 4) return 25;
    if (value >= 5) return 10;

    return 0;
}

export function getDistanceToTarget(
    state,
    playerIndex = 0
) {
    return getTargetDistance(
        state,
        playerIndex
    );
}

export function groupCloseResults(
    results,
    tolerance = null
) {
    if (!Array.isArray(results) || !results.length) {
        return [];
    }

    const best =
        Number(
            results[0]?.finalScore ??
            results[0]?.score
        );

    if (!Number.isFinite(best)) {
        return results.slice(0, 1);
    }

    /*
     * Si aucune tolérance n'est fournie,
     * on prend celle de la meilleure action.
     */
    const effectiveTolerance =
        tolerance == null
            ? Number(
                results[0]?.tolerance
            ) || 5
            : Number(tolerance);

    return results.filter(result => {
        const score =
            Number(
                result?.finalScore ??
                result?.score
            );

        return (
            Number.isFinite(score) &&
            best - score <=
                effectiveTolerance
        );
    });
}


/* =========================================================
 * EXPORT PAR DÉFAUT
 * ========================================================= */

export default {
    searchActions,
    searchBestAction,
    searchFinish,
    getSearchDepth,
    toSimulatedAction,
    calculateActionComplexity,
    getActionTolerance,
    groupCloseResults,
    calculateFinishLineScore,
    getDistanceToTarget
};
