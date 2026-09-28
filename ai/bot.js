import {
    searchActions,
    searchBestAction,
    getSearchDepth
} from "./search.js";

import {
    generateLegalActions,
    sortByActionPriority
} from "./action-generator.js";


/* =========================================================
 * DIFFICULTÉ
 * ========================================================= */

export const DIFFICULTY = {
    facile: {
        strategic: 0.40,
        random: 0.60
    },

    normal: {
        strategic: 0.75,
        random: 0.25
    },

    difficile: {
        strategic: 0.90,
        random: 0.10
    },

    expert: {
        strategic: 1.00,
        random: 0.00
    }
};


export function normalizeDifficulty(
    difficulty
) {
    const value =
        String(
            difficulty ?? "normal"
        )
        .trim()
        .toLowerCase();

    const aliases = {
        easy: "facile",
        facile: "facile",

        medium: "normal",
        normal: "normal",

        hard: "difficile",
        difficile: "difficile",

        expert: "expert"
    };

    return (
        aliases[value] ??
        "normal"
    );
}


/* =========================================================
 * OUTILS
 * ========================================================= */

function randomItem(
    array
) {
    if (
        !Array.isArray(array) ||
        array.length === 0
    ) {
        return null;
    }

    return array[
        Math.floor(
            Math.random() *
            array.length
        )
    ];
}


function actionSignature(
    action
) {
    if (!action) {
        return "";
    }

    if (
        typeof action.signature ===
        "function"
    ) {
        return action.signature();
    }

    try {
        return JSON.stringify(
            action
        );
    } catch {
        return String(
            action.id ??
            action.kind ??
            action.card ??
            ""
        );
    }
}


function getLegalActions(
    state
) {
    const actions =
        generateLegalActions(
            state
        );

    if (
        !Array.isArray(actions)
    ) {
        return [];
    }

    return sortByActionPriority(
        actions.filter(Boolean)
    );
}


function findEquivalentAction(
    action,
    legalActions
) {
    if (
        !action ||
        !Array.isArray(legalActions)
    ) {
        return null;
    }

    const signature =
        actionSignature(
            action
        );

    if (!signature) {
        return null;
    }

    return (
        legalActions.find(
            candidate =>
                actionSignature(
                    candidate
                ) === signature
        ) ??
        null
    );
}


function ensureLegalAction(
    action,
    legalActions
) {
    if (
        !Array.isArray(
            legalActions
        ) ||
        legalActions.length === 0
    ) {
        return null;
    }

    const equivalent =
        findEquivalentAction(
            action,
            legalActions
        );

    if (equivalent) {
        return equivalent;
    }

    /*
     * Sécurité absolue :
     *
     * si la recherche renvoie quelque chose
     * d'obsolète ou de mal formé, le bot ne
     * joue jamais cette action.
     */
    return legalActions[0];
}


/* =========================================================
 * COMPLEXITÉ
 * ========================================================= */

function getActionComplexity(
    action,
    state,
    legalActions
) {
    let complexity = 0;

    const alternatives =
        Array.isArray(
            legalActions
        )
            ? legalActions.length
            : 0;

    /*
     * Nombre d'alternatives disponibles.
     */
    if (alternatives >= 12) {
        complexity += 30;
    } else if (
        alternatives >= 7
    ) {
        complexity += 20;
    } else if (
        alternatives >= 3
    ) {
        complexity += 10;
    }

    /*
     * Action à choix multiple.
     */
    const kind =
        String(
            action?.kind ??
            action?.type ??
            ""
        ).toLowerCase();

    if (
        kind.includes("target") ||
        kind.includes("table")
    ) {
        complexity += 15;
    }

    if (
        kind.includes("effect") ||
        kind.includes("continue")
    ) {
        complexity += 10;
    }

    /*
     * Information cachée.
     */
    if (
        action?.hiddenInformation
    ) {
        complexity += 20;
    }

    if (
        action?.uncertainty
    ) {
        complexity += 10;
    }

    /*
     * Conséquences fortes.
     */
    const card =
        Number(
            action?.card ??
            action?.value
        );

    if (
        [
            1,
            3,
            9,
            13,
            17,
            19,
            21
        ].includes(card)
    ) {
        complexity += 10;
    }

    /*
     * Profondeur de recherche.
     */
    const progress =
        typeof state?.getGamePhase ===
        "function"
            ? state.getGamePhase()
            : typeof state?.getCardsProgress ===
                "function"
                ? state.getCardsProgress()
                : 0;

    if (
        progress >= 0.75
    ) {
        complexity += 10;
    }

    return Math.max(
        0,
        Math.min(
            100,
            complexity
        )
    );
}


/*
 * Tolérance utilisée pour le choix aléatoire
 * d'une action proche de la meilleure.
 *
 * Plus la décision est complexe,
 * plus le bot peut considérer plusieurs
 * actions proches comme raisonnables.
 */
export function getAdaptiveTolerance(
    {
        action,
        state,
        legalActions,
        results
    } = {}
) {
    const complexity =
        getActionComplexity(
            action,
            state,
            legalActions
        );

    const resultCount =
        Array.isArray(results)
            ? results.length
            : 0;

    let tolerance = 3;

    if (
        complexity >= 60
    ) {
        tolerance = 8;
    } else if (
        complexity >= 35
    ) {
        tolerance = 6;
    } else if (
        complexity >= 15
    ) {
        tolerance = 5;
    }

    /*
     * Beaucoup de possibilités :
     * la décision est naturellement moins
     * discriminante.
     */
    if (
        resultCount >= 15
    ) {
        tolerance += 1;
    }

    return tolerance;
}


/* =========================================================
 * ACTIONS PROCHES
 * ========================================================= */

export function getCloseActions(
    results,
    {
        tolerance = 5
    } = {}
) {
    if (
        !Array.isArray(results) ||
        results.length === 0
    ) {
        return [];
    }

    const bestScore =
        Number(
            results[0]?.score ??
            results[0]?.finalScore
        );

    if (
        !Number.isFinite(
            bestScore
        )
    ) {
        return results.slice(
            0,
            1
        );
    }

    return results.filter(
        result => {
            const score =
                Number(
                    result?.score ??
                    result?.finalScore
                );

            return (
                Number.isFinite(
                    score
                ) &&
                bestScore -
                    score <=
                    tolerance
            );
        }
    );
}


/* =========================================================
 * CHOIX SELON LA DIFFICULTÉ
 * ========================================================= */

export function chooseByDifficulty({
    results,
    legalActions,
    difficulty,
    state
} = {}) {
    if (
        !Array.isArray(
            legalActions
        ) ||
        legalActions.length === 0
    ) {
        return null;
    }

    const level =
        normalizeDifficulty(
            difficulty
        );

    const settings =
        DIFFICULTY[level];

    if (
        !Array.isArray(
            results
        ) ||
        results.length === 0
    ) {
        return legalActions[0];
    }

    const best =
        ensureLegalAction(
            results[0]?.action,
            legalActions
        );

    /*
     * Expert :
     * toujours la meilleure action
     * issue de la recherche.
     */
    if (
        settings.random === 0
    ) {
        return best;
    }

    /*
     * Partie stratégique.
     */
    if (
        Math.random() <
        settings.strategic
    ) {
        return best;
    }

    /*
     * Partie aléatoire :
     * on ne choisit jamais n'importe quoi.
     *
     * On choisit uniquement parmi les
     * actions suffisamment proches de la
     * meilleure.
     */
    const tolerance =
        getAdaptiveTolerance({
            action:
                results[0]?.action,
            state,
            legalActions,
            results
        });

    const close =
        getCloseActions(
            results,
            {
                tolerance
            }
        );

    const selected =
        randomItem(
            close
        );

    return ensureLegalAction(
        selected?.action,
        legalActions
    );
}


/* =========================================================
 * BOT
 * ========================================================= */

export class AtoumoulinBot {
    constructor({
        playerIndex = 0,
        difficulty = "normal"
    } = {}) {
        this.playerIndex =
            Number(playerIndex);

        this.difficulty =
            normalizeDifficulty(
                difficulty
            );
    }


    setPlayerIndex(
        index
    ) {
        this.playerIndex =
            Number(index);

        return this;
    }


    setDifficulty(
        difficulty
    ) {
        this.difficulty =
            normalizeDifficulty(
                difficulty
            );

        return this;
    }


    getDifficulty() {
        return this.difficulty;
    }


    getDepth(
        state,
        actionCount = 0
    ) {
        return getSearchDepth(
            state,
            {
                difficulty:
                    this.difficulty,
                actionCount,
                playerIndex:
                    this.playerIndex
            }
        );
    }


    think(
        state
    ) {
        if (!state) {
            throw new Error(
                "État de jeu absent."
            );
        }

        const legalActions =
            getLegalActions(
                state
            );

        if (
            legalActions.length === 0
        ) {
            return {
                action: null,
                results: [],
                legalActions: [],
                depth: 0,
                difficulty:
                    this.difficulty
            };
        }

        const depth =
            this.getDepth(
                state,
                legalActions.length
            );

        const results =
            searchActions({
                state,
                playerIndex:
                    this.playerIndex,
                difficulty:
                    this.difficulty,
                depth
            });

        const action =
            chooseByDifficulty({
                results,
                legalActions,
                difficulty:
                    this.difficulty,
                state
            });

        return {
            action,
            results,
            legalActions,
            depth,
            difficulty:
                this.difficulty
        };
    }


    chooseAction(
        state
    ) {
        return this.think(
            state
        ).action;
    }


    /*
     * Méthode de diagnostic uniquement.
     *
     * Elle ne remplace PAS think().
     * Elle permet de demander au moteur
     * quelles lignes de finition ont été
     * identifiées par la recherche.
     */
    getFinishAnalysis(
        state
    ) {
        const result =
            this.think(
                state
            );

        const selected =
            result.results?.find(
                item =>
                    item.action &&
                    item.finish
            ) ?? null;

        return {
            selectedAction:
                result.action,

            selectedResult:
                selected,

            results:
                result.results,

            depth:
                result.depth
        };
    }


    /*
     * Diagnostic détaillé.
     */
    analyze(
        state
    ) {
        const decision =
            this.think(
                state
            );

        return {
            playerIndex:
                this.playerIndex,

            difficulty:
                this.difficulty,

            depth:
                decision.depth,

            legalActions:
                decision.legalActions,

            selectedAction:
                decision.action,

            results:
                decision.results,

            tolerance:
                getAdaptiveTolerance({
                    action:
                        decision.results?.[0]
                            ?.action,

                    state,

                    legalActions:
                        decision.legalActions,

                    results:
                        decision.results
                })
        };
    }
}


/* =========================================================
 * FACTORIES
 * ========================================================= */

export function createBot(
    options = {}
) {
    return new AtoumoulinBot(
        options
    );
}


export function chooseBotAction({
    state,
    playerIndex = 0,
    difficulty = "normal"
} = {}) {
    const bot =
        new AtoumoulinBot({
            playerIndex,
            difficulty
        });

    return bot.chooseAction(
        state
    );
}


export function thinkBot({
    state,
    playerIndex = 0,
    difficulty = "normal"
} = {}) {
    const bot =
        new AtoumoulinBot({
            playerIndex,
            difficulty
        });

    return bot.think(
        state
    );
}


/* =========================================================
 * EXPORT PAR DÉFAUT
 * ========================================================= */

export default {
    DIFFICULTY,
    AtoumoulinBot,
    createBot,
    chooseBotAction,
    thinkBot,
    normalizeDifficulty,
    chooseByDifficulty,
    getCloseActions,
    getAdaptiveTolerance
};
