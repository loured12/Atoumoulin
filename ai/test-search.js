import {
    searchActions,
    searchBestAction,
    searchFinish
} from "./search.js";

export function testSearch(state, playerIndex = 0) {
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

    return {
        results,
        best,
        finishes
    };
}
