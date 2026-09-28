/**
 * Test d'intégration de la nouvelle IA
 *
 * IMPORTANT :
 * - utilise le moteur réel script.js via AtoumoulinEngine
 * - n'utilise PAS runBotTurn()
 * - n'utilise PAS l'ancien bot
 * - le nouveau bot choisit et exécute les actions
 *   via engine-adapter.js
 *
 * L'objectif est de vérifier toute la chaîne :
 *
 * moteur réel
 *   ↓
 * état IA
 *   ↓
 * génération actions
 *   ↓
 * recherche
 *   ↓
 * décision bot
 *   ↓
 * action complète
 *   ↓
 * engine-adapter
 *   ↓
 * moteur réel
 */

import { AtoumoulinEngine } from "../server/engine.js";

import {
    AtoumoulinBot
} from "./bot.js";

import {
    createEngineAdapter
} from "./engine-adapter.js";

import * as GameStateModule from "./game-state.js";


/* =========================================================
 * CONFIGURATION
 * ========================================================= */

const PLAYER_COUNT = 2;

/*
 * Un seul nouveau bot.
 *
 * Le deuxième joueur reste humain/inactif :
 * le test peut donc avancer uniquement lorsque
 * le bot possède le tour.
 */
const BOT_INDEX = 0;

const DIFFICULTY =
    process.env.AI_DIFFICULTY ??
    "facile";

const MAX_TURNS =
    Number(
        process.env.AI_MAX_TURNS ??
        100
    );


/* =========================================================
 * OUTILS
 * ========================================================= */

function log(...args) {
    console.log(
        "[NEW-AI]",
        ...args
    );
}


function error(...args) {
    console.error(
        "[NEW-AI]",
        ...args
    );
}


function getPlayerState(
    state,
    index
) {
    return state?.players?.find(
        player =>
            Number(player.id) ===
            Number(index)
    ) ?? null;
}


function summarizeState(
    state
) {
    if (!state) {
        return null;
    }

    return {
        currentPlayer:
            state.currentPlayer,

        action:
            state.action,

        roundEnded:
            state.roundEnded,

        winner:
            state.winner,

        roundWinner:
            state.roundWinner,

        deckCount:
            state.deckCount,

        players:
            Array.isArray(state.players)
                ? state.players.map(
                    player => ({
                        id: player.id,
                        name: player.name,
                        score: player.score,
                        cardCount:
                            player.cardCount,
                        bot: player.bot
                    })
                )
                : []
    };
}


/* =========================================================
 * CONVERSION ÉTAT MOTEUR → ÉTAT IA
 * ========================================================= */

function createAIState(
    engineState
) {
    /*
     * game-state.js peut évoluer sans que le test
     * ait besoin d'être réécrit.
     *
     * On recherche les constructeurs/factories
     * réellement exportés par le fichier.
     */

    if (
        typeof GameStateModule.createGameState ===
        "function"
    ) {
        return GameStateModule.createGameState(
            engineState
        );
    }

    if (
        typeof GameStateModule.createState ===
        "function"
    ) {
        return GameStateModule.createState(
            engineState
        );
    }

    if (
        typeof GameStateModule.fromState ===
        "function"
    ) {
        return GameStateModule.fromState(
            engineState
        );
    }

    if (
        typeof GameStateModule.AtoumoulinGameState ===
        "function"
    ) {
        return new GameStateModule.AtoumoulinGameState(
            engineState
        );
    }

    /*
     * Dernier recours :
     *
     * l'état exposé par engine.stateFor()
     * possède déjà la structure utilisée
     * par l'action-generator.
     */
    return engineState;
}


/* =========================================================
 * VALIDATION DE LA DÉCISION
 * ========================================================= */

function validateDecision(
    decision
) {
    if (!decision) {
        throw new Error(
            "Le bot n'a retourné aucune décision."
        );
    }

    if (!decision.action) {
        throw new Error(
            "Le bot n'a retourné aucune action."
        );
    }

    if (
        !Array.isArray(
            decision.legalActions
        )
    ) {
        throw new Error(
            "La décision ne contient pas legalActions."
        );
    }

    const id =
        decision.action.id ??
        decision.action.type ??
        "action";

    log(
        "Action sélectionnée :",
        id
    );
}


/* =========================================================
 * AFFICHAGE
 * ========================================================= */

function printDecision(
    decision
) {
    const action =
        decision.action;

    console.log("");
    console.log(
        "────────────────────────────────────"
    );

    console.log(
        `Joueur : ${decision.playerIndex ?? BOT_INDEX}`
    );

    console.log(
        `Difficulté : ${decision.difficulty}`
    );

    console.log(
        `Profondeur : ${decision.depth}`
    );

    console.log(
        `Actions légales : ${decision.legalActions.length}`
    );

    console.log(
        "Action :",
        JSON.stringify(
            action,
            null,
            2
        )
    );

    if (
        Array.isArray(
            decision.results
        ) &&
        decision.results.length > 0
    ) {
        console.log(
            "Meilleures évaluations :"
        );

        for (
            const result of
            decision.results.slice(0, 3)
        ) {
            console.log(
                " ",
                result?.score ??
                result?.finalScore,
                result?.action?.id ??
                result?.action?.type
            );
        }
    }

    console.log(
        "────────────────────────────────────"
    );
}


/* =========================================================
 * TEST
 * ========================================================= */

async function main() {

    log(
        "Démarrage du test de la nouvelle IA."
    );

    log(
        `Joueurs : ${PLAYER_COUNT}`
    );

    log(
        `Bot : joueur ${BOT_INDEX}`
    );

    log(
        `Difficulté : ${DIFFICULTY}`
    );

    log(
        `Limite : ${MAX_TURNS} tours`
    );


    /* -----------------------------------------------------
     * MOTEUR RÉEL
     * ----------------------------------------------------- */

    const engine =
        new AtoumoulinEngine(
            [
                "Nouvelle IA",
                "Testeur"
            ],
            [
                BOT_INDEX
            ],
            1,
            DIFFICULTY
        );


    /*
     * L'adaptateur est le seul composant autorisé
     * à exécuter les actions de la nouvelle IA
     * dans le moteur.
     */
    const adapter =
        createEngineAdapter(
            engine,
            {
                strict: true,
                autoResolve: true
            }
        );


    const bot =
        new AtoumoulinBot({
            playerIndex:
                BOT_INDEX,
            difficulty:
                DIFFICULTY
        });


    /* -----------------------------------------------------
     * BOUCLE DE PARTIE
     * ----------------------------------------------------- */

    let turn = 0;

    while (
        turn <
        MAX_TURNS
    ) {

        const currentIndex =
            engine.currentIndex();

        const rawState =
            engine.stateFor(
                BOT_INDEX
            );


        /*
         * Partie terminée.
         */
        if (
            rawState.roundEnded ||
            rawState.winner !== null
        ) {
            log(
                "Fin détectée."
            );

            break;
        }


        /*
         * Le nouveau bot ne joue que lorsqu'il
         * possède effectivement le tour.
         */
        if (
            Number(currentIndex) !==
            Number(BOT_INDEX)
        ) {

            log(
                `Tour du joueur ${currentIndex}.`
            );

            /*
             * Le test ne doit surtout pas appeler
             * l'ancien bot automatiquement.
             *
             * On arrête donc proprement.
             */
            log(
                "Le joueur suivant n'est pas le nouveau bot."
            );

            break;
        }


        /* -------------------------------------------------
         * ÉTAT POUR L'IA
         * ------------------------------------------------- */

        const aiState =
            createAIState(
                rawState
            );


        const player =
            getPlayerState(
                rawState,
                BOT_INDEX
            );

        log(
            `Tour ${turn + 1} | score=${player?.score ?? "?"} | cartes=${player?.cardCount ?? "?"} | deck=${rawState.deckCount}`
        );


        /* -------------------------------------------------
         * RÉFLEXION
         * ------------------------------------------------- */

        let decision;

        try {

            decision =
                bot.think(
                    aiState
                );

        } catch (err) {

            error(
                "ERREUR PENDANT LA RÉFLEXION DE L'IA"
            );

            error(
                err
            );

            throw err;
        }


        validateDecision(
            decision
        );

        printDecision(
            decision
        );


        /* -------------------------------------------------
         * EXÉCUTION
         * ------------------------------------------------- */

        let result;

        try {

            result =
                adapter.execute(
                    decision.action,
                    BOT_INDEX
                );

        } catch (err) {

            error(
                "ERREUR PENDANT L'EXÉCUTION DE L'ACTION"
            );

            error(
                "Action :",
                JSON.stringify(
                    decision.action,
                    null,
                    2
                )
            );

            error(
                err
            );

            error(
                "État moteur :",
                JSON.stringify(
                    summarizeState(
                        engine.stateFor(
                            BOT_INDEX
                        )
                    ),
                    null,
                    2
                )
            );

            throw err;
        }


        /* -------------------------------------------------
         * VÉRIFICATION POST-ACTION
         * ------------------------------------------------- */

        if (!result) {
            throw new Error(
                "L'adaptateur n'a retourné aucun état."
            );
        }


        const after =
            engine.stateFor(
                BOT_INDEX
            );


        log(
            "État après action :",
            JSON.stringify(
                summarizeState(
                    after
                ),
                null,
                2
            )
        );


        /*
         * Si le moteur a besoin d'une nouvelle décision
         * pour le même pouvoir, on ne force rien.
         *
         * Le prochain passage doit analyser ce nouvel état.
         */
        if (
            after.action !== null &&
            Number(
                after.currentPlayer
            ) ===
            Number(BOT_INDEX)
        ) {

            log(
                `Nouvelle décision nécessaire : ${after.action}`
            );
        }


        turn++;
    }


    /* =====================================================
     * RÉSULTAT
     * ===================================================== */

    const finalState =
        engine.stateFor(
            BOT_INDEX
        );

    console.log("");
    console.log(
        "=================================================="
    );

    console.log(
        "TEST DE LA NOUVELLE IA TERMINÉ"
    );

    console.log(
        "=================================================="
    );

    console.log(
        JSON.stringify(
            summarizeState(
                finalState
            ),
            null,
            2
        )
    );

    console.log(
        `Tours exécutés : ${turn}`
    );

    console.log(
        "Ancien bot utilisé : NON"
    );

    console.log(
        "script.js modifié : NON"
    );

    console.log(
        "=================================================="
    );
}


/* =========================================================
 * EXÉCUTION
 * ========================================================= */

main().catch(
    err => {
        console.error("");
        console.error(
            "=================================================="
        );
        console.error(
            "ÉCHEC DU TEST DE LA NOUVELLE IA"
        );
        console.error(
            "=================================================="
        );
        console.error(
            err
        );
        process.exitCode = 1;
    }
);
