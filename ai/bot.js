/**
 * Atoumoulin AI
 * bot.js
 *
 * Chef d'orchestre de la nouvelle IA.
 *
 * Rôle :
 * - recevoir l'état courant ;
 * - lancer la recherche ;
 * - appliquer la difficulté ;
 * - choisir une action légale ;
 * - ne jamais produire une action illégale.
 *
 * La stratégie détaillée reste dans :
 * - action-generator.js
 * - evaluation.js
 * - search.js
 * - knowledge.js
 * - simulation.js
 */

import {
    searchActions,
    searchBestAction,
    searchFinish,
    getSearchDepth
} from "./search.js";

import {
    generateLegalActions
} from "./action-generator.js";


/* ============================================================
 * DIFFICULTÉ
 * ========================================================== */

const DIFFICULTY = {
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


/* ============================================================
 * OUTILS
 * ========================================================== */

function normalizeDifficulty(
    difficulty
) {
    const value =
        String(
            difficulty ?? "normal"
        ).toLowerCase();

    if (
        value === "easy"
    ) {
        return "facile";
    }

    if (
        value === "medium"
    ) {
        return "normal";
    }

    if (
        value === "hard"
    ) {
        return "difficile";
    }

    if (
        value === "expert"
    ) {
        return "expert";
    }

    if (
        DIFFICULTY[value]
    ) {
        return value;
    }

    return "normal";
}


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
    if (
        action &&
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
            action
        );
    }
}


/* ============================================================
 * ACTIONS LÉGALES
 * ========================================================== */

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

    return actions.filter(
        Boolean
    );
}


/* ============================================================
 * VÉRIFICATION
 * ========================================================== */

function findEquivalentAction(
    action,
    legalActions
) {
    if (!action) {
        return null;
    }

    const signature =
        actionSignature(
            action
        );

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


/**
 * Sécurité absolue :
 * le bot ne retourne jamais une action qui n'est plus légale.
 */
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

    return legalActions[0];
}


/* ============================================================
 * OPTIONS PROCHES
 * ========================================================== */

/**
 * Les actions proches de la meilleure sont candidates
 * pour la part aléatoire de la difficulté.
 *
 * On ne choisit jamais une action manifestement mauvaise
 * juste pour faire du hasard.
 */
function getCloseActions(
    results,
    tolerance = 5
) {
    if (
        !Array.isArray(results) ||
        results.length === 0
    ) {
        return [];
    }

    const bestScore =
        Number(
            results[0]?.score
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
                    result?.score
                );

            if (
                !Number.isFinite(
                    score
                )
            ) {
                return false;
            }

            return (
                bestScore -
                score <=
                tolerance
            );
        }
    );
}


/* ============================================================
 * CHOIX SELON DIFFICULTÉ
 * ========================================================== */

function chooseByDifficulty({
    results,
    legalActions,
    difficulty
}) {
    if (
        !Array.isArray(
            results
        ) ||
        results.length === 0
    ) {
        return ensureLegalAction(
            null,
            legalActions
        );
    }

    const level =
        normalizeDifficulty(
            difficulty
        );

    const settings =
        DIFFICULTY[level];

    /*
     * Expert :
     * aucune part aléatoire.
     */
    if (
        settings.random === 0
    ) {
        return ensureLegalAction(
            results[0]?.action,
            legalActions
        );
    }

    /*
     * Choix stratégique.
     */
    if (
        Math.random() <
        settings.strategic
    ) {
        return ensureLegalAction(
            results[0]?.action,
            legalActions
        );
    }

    /*
     * Choix aléatoire mais raisonnable :
     * uniquement parmi les actions proches
     * du meilleur score.
     */
    const close =
        getCloseActions(
            results,
            5
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


/* ============================================================
 * BOT
 * ========================================================== */

export class AtoumoulinBot {
    constructor({
        playerIndex = 0,
        difficulty = "normal"
    } = {}) {
        this.playerIndex =
            Number(
                playerIndex
            );

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
            this.difficulty,
            {
                actionCount,

                gamePhase:
                    typeof state?.getCardsProgress ===
                    "function"
                        ? state.getCardsProgress()
                        : 0
            }
        );
    }


    /**
     * Recherche complète d'un tour.
     */
    think(
        state
    ) {
        if (!state) {
            throw new Error(
                "AtoumoulinBot.think : state manquant."
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
                    this.difficulty
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


    /**
     * Renvoie uniquement l'action à jouer.
     */
    chooseAction(
        state
    ) {
        return this.think(
            state
        ).action;
    }


    /**
     * Recherche prioritaire d'une possibilité
     * de terminer la manche.
     *
     * Cette recherche passe avant le choix
     * aléatoire de difficulté.
     */
    findFinish(
        state,
        maxDepth = 8
    ) {
        const finishes =
            searchFinish({
                state,

                playerIndex:
                    this.playerIndex,

                maxDepth
            });

        if (
            !Array.isArray(
                finishes
            ) ||
            finishes.length === 0
        ) {
            return null;
        }

        return finishes[0];
    }


    /**
     * Recherche une action avec priorité
     * aux lignes de finition.
     */
    thinkWithFinish(
        state
    ) {
        const legalActions =
            getLegalActions(
                state
            );

        if (
            legalActions.length === 0
        ) {
            return {
                action: null,
                finish: null,
                results: [],
                legalActions: []
            };
        }

        const finish =
            this.findFinish(
                state
            );

        if (finish) {
            return {
                action:
                    ensureLegalAction(
                        finish.action,
                        legalActions
                    ),

                finish,

                results: [],

                legalActions
            };
        }

        return {
            ...this.think(
                state
            ),

            finish: null
        };
    }
}


/* ============================================================
 * API SIMPLE
 * ========================================================== */

/**
 * Crée un bot.
 */
export function createBot(
    options = {}
) {
    return new AtoumoulinBot(
        options
    );
}


/**
 * Choisit directement une action.
 */
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


/**
 * Analyse complète sans jouer.
 */
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

    return bot.thinkWithFinish(
        state
    );
}


/* ============================================================
 * EXPORT PAR DÉFAUT
 * ========================================================== */

export default {
    AtoumoulinBot,
    createBot,
    chooseBotAction,
    thinkBot
};
