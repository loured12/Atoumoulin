import {
    searchActions,
    searchBestAction,
    searchFinish
} from "./search.js";

import {
    AtoumoulinBot
} from "./bot.js";


export function testSearch(
    state,
    playerIndex = 0
) {
    console.log("=== TEST IA SEARCH ===");

    const results = searchActions({
        state,
        playerIndex,
        difficulty: "normal"
    });

    console.log(
        "Nombre d'actions trouvées :",
        results.length
    );

    for (const result of results.slice(0, 10)) {
        console.log({
            action: result.action,
            score: result.score,
            immediateScore: result.immediateScore,
            futureScore: result.futureScore
        });
    }

    const best = searchBestAction({
        state,
        playerIndex,
        difficulty: "normal"
    });

    console.log(
        "Meilleure action trouvée :",
        best
    );

    const finishes = searchFinish({
        state,
        playerIndex,
        maxDepth: 6
    });

    console.log(
        "Plans de finition :",
        finishes
    );

    console.log("=== TEST BOT ===");

    const bot = new AtoumoulinBot({
        playerIndex,
        difficulty: "normal"
    });

    const decision =
        bot.thinkWithFinish(state);

    console.log(
        "Difficulté :",
        decision.difficulty
    );

    console.log(
        "Action choisie :",
        decision.action
    );

    console.log(
        "Résultats de recherche :",
        decision.results?.length ?? 0
    );

    console.log(
        "Plan de finition :",
        decision.finish
    );

    return {
        results,
        best,
        finishes,
        bot: decision
    };
}
