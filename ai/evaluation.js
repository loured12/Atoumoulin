import {
    getPlayer,
    getSelf,
    getOpponents,
    getPlayerPointCards,
    getOpponentPointCards,
    getLatestPointCard,
    getTargetDistance,
    getVictoryTarget,
    getGameProgress,
    getGamePhase,
    getCardsOut,
    getTotalDeckSize,
    hasExactTarget,
    isAboveTarget
} from "./state.js";


/* ============================================================
 * CONFIGURATION
 * ========================================================== */

const WEIGHTS = {
    personalImpact: 0.40,
    opponentImpact: 0.30,
    futurePotential: 0.15,
    opportunityCost: 0.10,
    risk: 0.05
};


const FINISH_TURN_VALUES = {
    1: 100,
    2: 70,
    3: 45,
    4: 25
};


const CERTAINTY_VALUES = {
    certain: 100,
    veryProbable: 80,
    possible: 55,
    low: 30,
    impossible: 0
};


/* ============================================================
 * UTILITAIRES
 * ========================================================== */

function clamp(
    value,
    min = 0,
    max = 100
) {
    const n =
        Number(value);

    if (!Number.isFinite(n)) {
        return min;
    }

    return Math.max(
        min,
        Math.min(max, n)
    );
}


function safeDivide(
    numerator,
    denominator,
    fallback = 0
) {
    const n =
        Number(numerator);

    const d =
        Number(denominator);

    if (
        !Number.isFinite(n) ||
        !Number.isFinite(d) ||
        d === 0
    ) {
        return fallback;
    }

    return n / d;
}


function normalizePercent(
    value
) {
    return clamp(
        Number(value)
    );
}


function cardValue(card) {
    if (
        card === null ||
        card === undefined
    ) {
        return null;
    }

    if (
        typeof card === "number"
    ) {
        return card;
    }

    if (
        typeof card === "string"
    ) {
        const n =
            Number(card);

        return Number.isFinite(n)
            ? n
            : card;
    }

    if (
        typeof card === "object"
    ) {
        if (
            card.valeur !== undefined
        ) {
            return cardValue(
                card.valeur
            );
        }

        if (
            card.value !== undefined
        ) {
            return cardValue(
                card.value
            );
        }
    }

    return null;
}


function isDoubleAction(
    action
) {
    return (
        action?.type ===
            "PLAY_DOUBLE" ||
        action?.metadata?.double === true
    );
}


function getActionCard(
    action
) {
    return cardValue(
        action?.card
    );
}


function getPlayerScore(
    player
) {
    return Number(
        player?.score ?? 0
    );
}


function getHand(
    player
) {
    if (
        Array.isArray(
            player?.main
        )
    ) {
        return player.main;
    }

    if (
        Array.isArray(
            player?.hand
        )
    ) {
        return player.hand;
    }

    return [];
}


function getAllPointCards(
    state,
    playerIndex
) {
    return getPlayerPointCards(
        state,
        playerIndex
    ) ?? [];
}


function getTable(
    state
) {
    return (
        state?.table ??
        state?.cartesTable ??
        []
    );
}


function getTableOwner(
    card
) {
    if (!card) {
        return null;
    }

    return (
        card.proprietaire ??
        card.owner ??
        card.playerId ??
        null
    );
}


function getTableValue(
    card
) {
    return cardValue(
        card
    );
}


function getTargetScore(
    state
) {
    return getVictoryTarget(
        state
    );
}


function getScoreDistance(
    state,
    playerIndex
) {
    return getTargetDistance(
        state,
        playerIndex
    );
}


function actionCount(
    state,
    playerIndex
) {
    if (
        typeof state?.getLegalActions ===
        "function"
    ) {
        return state
            .getLegalActions(
                playerIndex
            )
            ?.length ?? 0;
    }

    if (
        Array.isArray(
            state?.legalActions
        )
    ) {
        return state.legalActions.length;
    }

    return estimateActionCount(
        state,
        playerIndex
    );
}


function estimateActionCount(
    state,
    playerIndex
) {
    const player =
        getPlayer(
            state,
            playerIndex
        );

    const hand =
        getHand(player);

    if (!hand.length) {
        return 0;
    }

    const counts =
        new Map();

    for (const card of hand) {
        const value =
            cardValue(card);

        counts.set(
            value,
            (counts.get(value) ?? 0) + 1
        );
    }

    /*
     * Cette estimation respecte les priorités :
     * double 7 > 7 > double > simple.
     */
    if (
        (counts.get(7) ?? 0) >= 2
    ) {
        return 1;
    }

    if (
        (counts.get(7) ?? 0) === 1
    ) {
        return 1;
    }

    let doubles = 0;

    for (
        const [
            value,
            count
        ] of counts
    ) {
        if (
            count >= 2
        ) {
            doubles += 1;
        }
    }

    if (doubles > 0) {
        return doubles;
    }

    return hand.length;
}


/* ============================================================
 * FINITION
 * ========================================================== */

export function getFinishTurnValue(
    turns
) {
    const n =
        Number(turns);

    if (
        !Number.isFinite(n) ||
        n <= 0
    ) {
        return 0;
    }

    if (
        FINISH_TURN_VALUES[n] !==
        undefined
    ) {
        return FINISH_TURN_VALUES[n];
    }

    return 10;
}


export function getCertaintyValue(
    certainty
) {
    if (
        typeof certainty ===
        "number"
    ) {
        return clamp(
            certainty
        );
    }

    return (
        CERTAINTY_VALUES[
            certainty
        ] ??
        0
    );
}


export function calculateFinishPotential({
    turns = Infinity,
    certainty = "impossible"
} = {}) {
    const turnValue =
        getFinishTurnValue(
            turns
        );

    const certaintyValue =
        getCertaintyValue(
            certainty
        );

    return clamp(
        turnValue *
        certaintyValue /
        100
    );
}


/*
 * Estimation locale de la finition.
 *
 * Cette fonction ne prétend pas connaître le futur.
 * Elle mesure uniquement la situation actuelle.
 */
export function estimateFinishPotential(
    state,
    playerIndex
) {
    if (
        hasExactTarget(
            state,
            playerIndex
        )
    ) {
        return 100;
    }

    const distance =
        Math.abs(
            getScoreDistance(
                state,
                playerIndex
            )
        );

    if (
        !Number.isFinite(distance)
    ) {
        return 0;
    }

    const actions =
        actionCount(
            state,
            playerIndex
        );

    const pointCards =
        getAllPointCards(
            state,
            playerIndex
        );

    const positivePoints =
        pointCards
            .map(cardValue)
            .filter(
                value =>
                    Number.isFinite(value) &&
                    value > 0
            );

    /*
     * Une possibilité directe vers la cible est très forte.
     */
    const direct =
        positivePoints.some(
            value =>
                value === distance
        );

    if (direct) {
        return 100;
    }

    /*
     * Une carte proche de la distance crée une possibilité,
     * sans être considérée comme une finition certaine.
     */
    const closest =
        positivePoints.length
            ? Math.min(
                ...positivePoints.map(
                    value =>
                        Math.abs(
                            distance -
                            value
                        )
                )
            )
            : Infinity;

    let base = 0;

    if (
        closest === 0
    ) {
        base = 100;
    } else if (
        closest <= 5
    ) {
        base = 80;
    } else if (
        closest <= 15
    ) {
        base = 55;
    } else if (
        closest <= 30
    ) {
        base = 30;
    }

    /*
     * Plus il existe de possibilités, plus la situation
     * offre de chemins vers la cible.
     */
    const possibilityBonus =
        Math.min(
            20,
            actions * 2
        );

    return clamp(
        base +
        possibilityBonus
    );
}


/* ============================================================
 * PROGRESSION
 * ========================================================== */

export function calculateProgression({
    scoreImprovement = 0,
    pathsToTarget = 0,
    diversity = 0,
    cardQuality = 0,
    adaptation = 0
} = {}) {
    return clamp(
        (
            clamp(scoreImprovement) * 25 +
            clamp(pathsToTarget) * 30 +
            clamp(diversity) * 20 +
            clamp(cardQuality) * 15 +
            clamp(adaptation) * 10
        ) / 100
    );
}


function calculateScoreImprovement(
    beforeState,
    afterState,
    playerIndex
) {
    if (
        !afterState
    ) {
        return 0;
    }

    const before =
        getPlayerScore(
            getPlayer(
                beforeState,
                playerIndex
            )
        );

    const after =
        getPlayerScore(
            getPlayer(
                afterState,
                playerIndex
            )
        );

    const target =
        getTargetScore(
            beforeState
        );

    if (
        after === before
    ) {
        return 0;
    }

    /*
     * Une amélioration vers la cible est positive.
     */
    const beforeDistance =
        Math.abs(
            target -
            before
        );

    const afterDistance =
        Math.abs(
            target -
            after
        );

    return clamp(
        safeDivide(
            beforeDistance -
            afterDistance,
            Math.max(
                1,
                beforeDistance
            )
        ) * 100
    );
}


function calculatePathsToTarget(
    state,
    playerIndex
) {
    const player =
        getPlayer(
            state,
            playerIndex
        );

    const cards =
        getAllPointCards(
            state,
            playerIndex
        );

    const distance =
        Math.abs(
            getScoreDistance(
                state,
                playerIndex
            )
        );

    if (
        distance === 0
    ) {
        return 100;
    }

    let paths = 0;

    for (
        const card of cards
    ) {
        const value =
            cardValue(card);

        if (
            !Number.isFinite(value)
        ) {
            continue;
        }

        if (
            value === distance
        ) {
            paths += 3;
        } else if (
            Math.abs(
                value - distance
            ) <= 10
        ) {
            paths += 1;
        }
    }

    return clamp(
        paths * 20
    );
}


function calculateDiversity(
    state,
    playerIndex
) {
    const player =
        getPlayer(
            state,
            playerIndex
        );

    const hand =
        getHand(player);

    if (!hand.length) {
        return 0;
    }

    const values =
        new Set(
            hand.map(
                cardValue
            )
        );

    return clamp(
        safeDivide(
            values.size,
            Math.max(
                1,
                hand.length
            )
        ) * 100
    );
}


function calculateCardQuality(
    state,
    playerIndex
) {
    const cards =
        getAllPointCards(
            state,
            playerIndex
        );

    if (!cards.length) {
        return 0;
    }

    const target =
        getTargetScore(
            state
        );

    const score =
        getPlayerScore(
            getPlayer(
                state,
                playerIndex
            )
        );

    const distance =
        Math.abs(
            target -
            score
        );

    let quality = 0;

    for (
        const card of cards
    ) {
        const value =
            cardValue(card);

        if (
            !Number.isFinite(value)
        ) {
            continue;
        }

        if (
            value === distance
        ) {
            quality += 100;
        } else if (
            Math.abs(
                value - distance
            ) <= 10
        ) {
            quality += 70;
        } else if (
            value > 0
        ) {
            quality += 40;
        }
    }

    return clamp(
        safeDivide(
            quality,
            cards.length
        )
    );
}


function calculateAdaptation(
    state,
    playerIndex
) {
    const opponents =
        getOpponents(
            state,
            playerIndex
        );

    if (!opponents.length) {
        return 100;
    }

    const actions =
        actionCount(
            state,
            playerIndex
        );

    const diversity =
        calculateDiversity(
            state,
            playerIndex
        );

    return clamp(
        diversity * 0.6 +
        Math.min(
            40,
            actions * 4
        )
    );
}


export function calculateProgressionScore(
    beforeState,
    afterState,
    playerIndex
) {
    return calculateProgression({
        scoreImprovement:
            calculateScoreImprovement(
                beforeState,
                afterState,
                playerIndex
            ),

        pathsToTarget:
            calculatePathsToTarget(
                afterState ??
                beforeState,
                playerIndex
            ),

        diversity:
            calculateDiversity(
                afterState ??
                beforeState,
                playerIndex
            ),

        cardQuality:
            calculateCardQuality(
                afterState ??
                beforeState,
                playerIndex
            ),

        adaptation:
            calculateAdaptation(
                afterState ??
                beforeState,
                playerIndex
            )
    });
}


/* ============================================================
 * STABILITÉ
 * ========================================================== */

export function calculateStability({
    backupPlans = 0,
    diversity = 0,
    independenceFromUncertainty = 0,
    recovery = 0
} = {}) {
    return clamp(
        (
            clamp(backupPlans) * 35 +
            clamp(diversity) * 30 +
            clamp(independenceFromUncertainty) * 20 +
            clamp(recovery) * 15
        ) / 100
    );
}


function calculateBackupPlans(
    state,
    playerIndex
) {
    const actions =
        actionCount(
            state,
            playerIndex
        );

    if (
        actions <= 0
    ) {
        return 0;
    }

    if (
        actions === 1
    ) {
        return 20;
    }

    if (
        actions === 2
    ) {
        return 45;
    }

    if (
        actions === 3
    ) {
        return 70;
    }

    return 100;
}


function calculateIndependenceFromUncertainty(
    state,
    playerIndex
) {
    const player =
        getPlayer(
            state,
            playerIndex
        );

    const hand =
        getHand(player);

    if (!hand.length) {
        return 100;
    }

    const unknown =
        hand.filter(
            card =>
                card?.unknown === true ||
                card === null
        ).length;

    return clamp(
        100 -
        safeDivide(
            unknown,
            hand.length
        ) * 100
    );
}


function calculateRecovery(
    state,
    playerIndex
) {
    const actions =
        actionCount(
            state,
            playerIndex
        );

    const hand =
        getHand(
            getPlayer(
                state,
                playerIndex
            )
        );

    if (
        hand.length === 0
    ) {
        return 0;
    }

    return clamp(
        Math.min(
            100,
            actions * 15 +
            hand.length * 5
        )
    );
}


export function calculateStabilityScore(
    state,
    playerIndex
) {
    return calculateStability({
        backupPlans:
            calculateBackupPlans(
                state,
                playerIndex
            ),

        diversity:
            calculateDiversity(
                state,
                playerIndex
            ),

        independenceFromUncertainty:
            calculateIndependenceFromUncertainty(
                state,
                playerIndex
            ),

        recovery:
            calculateRecovery(
                state,
                playerIndex
            )
    });
}


/* ============================================================
 * POSITION PERSONNELLE
 * ========================================================== */

export function calculatePersonalPosition({
    finish = 0,
    progression = 0,
    stability = 0
} = {}) {
    return clamp(
        (
            clamp(finish) * 90 +
            clamp(progression) * 65 +
            clamp(stability) * 55
        ) / 210
    );
}


export function evaluatePlayerPosition(
    state,
    playerIndex
) {
    const finish =
        estimateFinishPotential(
            state,
            playerIndex
        );

    const progression =
        calculateProgressionScore(
            state,
            state,
            playerIndex
        );

    const stability =
        calculateStabilityScore(
            state,
            playerIndex
        );

    const position =
        calculatePersonalPosition({
            finish,
            progression,
            stability
        });

    return {
        finish,
        progression,
        stability,
        position,

        finalScore:
            position,

        score:
            position
    };
}


/* ============================================================
 * DANGER ADVERSAIRE
 * ========================================================== */

export function calculateIndividualDanger({
    finish = 0,
    position = 0,
    possibilities = 0,
    stability = 0
} = {}) {
    return clamp(
        (
            clamp(finish) * 50 +
            clamp(position) * 20 +
            clamp(possibilities) * 20 +
            clamp(stability) * 10
        ) / 100
    );
}


function calculateOpponentPossibilities(
    state,
    opponentIndex
) {
    const actions =
        actionCount(
            state,
            opponentIndex
        );

    const finish =
        estimateFinishPotential(
            state,
            opponentIndex
        );

    return clamp(
        Math.min(
            50,
            actions * 5
        ) +
        finish * 0.5
    );
}


function calculateOpponentDanger(
    state,
    opponentIndex
) {
    const finish =
        estimateFinishPotential(
            state,
            opponentIndex
        );

    const position =
        evaluatePlayerPosition(
            state,
            opponentIndex
        ).position;

    const possibilities =
        calculateOpponentPossibilities(
            state,
            opponentIndex
        );

    const stability =
        calculateStabilityScore(
            state,
            opponentIndex
        );

    return calculateIndividualDanger({
        finish,
        position,
        possibilities,
        stability
    });
}


/* ============================================================
 * POTENTIEL FUTUR ADVERSAIRE
 * ========================================================== */

export function calculateOpponentFuturePotential({
    progression = 0,
    manipulation = 0,
    cardQuality = 0,
    creation = 0
} = {}) {
    return clamp(
        (
            clamp(progression) * 40 +
            clamp(manipulation) * 30 +
            clamp(cardQuality) * 20 +
            clamp(creation) * 10
        ) / 100
    );
}


function calculateOpponentManipulation(
    state,
    opponentIndex
) {
    const actions =
        actionCount(
            state,
            opponentIndex
        );

    const hand =
        getHand(
            getPlayer(
                state,
                opponentIndex
            )
        );

    const special =
        hand.filter(
            card => {
                const value =
                    cardValue(card);

                return [
                    1,
                    3,
                    9,
                    13,
                    15,
                    17,
                    19,
                    21
                ].includes(value);
            }
        ).length;

    return clamp(
        special * 12 +
        actions * 2
    );
}


function calculateOpponentCreation(
    state,
    opponentIndex
) {
    const hand =
        getHand(
            getPlayer(
                state,
                opponentIndex
            )
        );

    const values =
        new Set(
            hand.map(
                cardValue
            )
        );

    return clamp(
        values.size * 8
    );
}


function calculateOpponentFuture(
    state,
    opponentIndex
) {
    return calculateOpponentFuturePotential({
        progression:
            calculateProgressionScore(
                state,
                state,
                opponentIndex
            ),

        manipulation:
            calculateOpponentManipulation(
                state,
                opponentIndex
            ),

        cardQuality:
            calculateCardQuality(
                state,
                opponentIndex
            ),

        creation:
            calculateOpponentCreation(
                state,
                opponentIndex
            )
    });
}


/* ============================================================
 * SITUATION ADVERSAIRE
 * ========================================================== */

export function calculateOpponentSituation({
    danger = 0,
    futurePotential = 0,
    stability = 0
} = {}) {
    return clamp(
        (
            clamp(danger) * 100 +
            clamp(futurePotential) * 65 +
            clamp(stability) * 50
        ) / 215
    );
}


export function evaluateOpponents(
    state,
    playerIndex
) {
    const opponents =
        getOpponents(
            state,
            playerIndex
        );

    if (!opponents.length) {
        return {
            opponents: [],
            maxDanger: 0,
            averageDanger: 0,
            situation: 0
        };
    }

    const details =
        opponents.map(
            opponent => {
                const index =
                    Number(
                        opponent.id
                    );

                const danger =
                    calculateOpponentDanger(
                        state,
                        index
                    );

                const futurePotential =
                    calculateOpponentFuture(
                        state,
                        index
                    );

                const stability =
                    calculateStabilityScore(
                        state,
                        index
                    );

                const situation =
                    calculateOpponentSituation({
                        danger,
                        futurePotential,
                        stability
                    });

                return {
                    playerIndex: index,
                    danger,
                    futurePotential,
                    stability,
                    situation
                };
            }
        );

    const dangers =
        details.map(
            item =>
                item.danger
        );

    const maxDanger =
        dangers.length
            ? Math.max(
                ...dangers
            )
            : 0;

    const averageDanger =
        dangers.length
            ? dangers.reduce(
                (sum, value) =>
                    sum + value,
                0
            ) /
              dangers.length
            : 0;

    const situations =
        details.map(
            item =>
                item.situation
        );

    const situation =
        situations.length
            ? Math.max(
                ...situations
            )
            : 0;

    return {
        opponents: details,
        maxDanger,
        averageDanger,
        situation
    };
}


/* ============================================================
 * IMPACT PERSONNEL
 * ========================================================== */

export function calculateHandQuality({
    actions = 0,
    finish = 0,
    manipulation = 0,
    doubles = 0,
    synergies = 0
} = {}) {
    return clamp(
        (
            clamp(actions) * 25 +
            clamp(finish) * 25 +
            clamp(manipulation) * 20 +
            clamp(doubles) * 15 +
            clamp(synergies) * 15
        ) / 100
    );
}


export function calculateRemainingPossibilities({
    actions = 0,
    diversity = 0,
    finish = 0,
    manipulation = 0,
    responses = 0,
    plans = 0
} = {}) {
    return clamp(
        (
            clamp(actions) * 25 +
            clamp(diversity) * 20 +
            clamp(finish) * 20 +
            clamp(manipulation) * 15 +
            clamp(responses) * 10 +
            clamp(plans) * 10
        ) / 100
    );
}


export function calculatePersonalImpact({
    position = 0,
    handQuality = 0,
    remainingPossibilities = 0
} = {}) {
    return clamp(
        (
            clamp(position) * 95 +
            clamp(handQuality) * 60 +
            clamp(remainingPossibilities) * 45
        ) / 200
    );
}


function calculateManipulation(
    state,
    playerIndex
) {
    const hand =
        getHand(
            getPlayer(
                state,
                playerIndex
            )
        );

    const special =
        hand.filter(
            card =>
                [
                    1,
                    3,
                    9,
                    13,
                    15,
                    17,
                    19,
                    21
                ].includes(
                    cardValue(card)
                )
        ).length;

    return clamp(
        special * 12
    );
}


function calculateDoubles(
    state,
    playerIndex
) {
    const hand =
        getHand(
            getPlayer(
                state,
                playerIndex
            )
        );

    const counts =
        new Map();

    for (
        const card of hand
    ) {
        const value =
            cardValue(card);

        counts.set(
            value,
            (counts.get(value) ?? 0) + 1
        );
    }

    let doubles = 0;

    for (
        const count of counts.values()
    ) {
        if (
            count >= 2
        ) {
            doubles += 1;
        }
    }

    return clamp(
        doubles * 20
    );
}


function calculateSynergies(
    state,
    playerIndex
) {
    const hand =
        getHand(
            getPlayer(
                state,
                playerIndex
            )
        );

    const values =
        hand.map(
            cardValue
        );

    let synergy = 0;

    if (
        values.includes(15)
    ) {
        synergy += 25;
    }

    if (
        values.includes(17)
    ) {
        synergy += 15;
    }

    if (
        values.includes(19)
    ) {
        synergy += 15;
    }

    if (
        values.includes(21)
    ) {
        synergy += 15;
    }

    if (
        values.includes("Joker") ||
        values.includes("joker")
    ) {
        synergy += 20;
    }

    return clamp(
        synergy
    );
}


function calculatePersonalImpactMetrics(
    state,
    playerIndex
) {
    const position =
        evaluatePlayerPosition(
            state,
            playerIndex
        ).position;

    const finish =
        estimateFinishPotential(
            state,
            playerIndex
        );

    const actions =
        actionCount(
            state,
            playerIndex
        );

    const manipulation =
        calculateManipulation(
            state,
            playerIndex
        );

    const doubles =
        calculateDoubles(
            state,
            playerIndex
        );

    const synergies =
        calculateSynergies(
            state,
            playerIndex
        );

    const diversity =
        calculateDiversity(
            state,
            playerIndex
        );

    const handQuality =
        calculateHandQuality({
            actions:
                Math.min(
                    100,
                    actions * 10
                ),

            finish,
            manipulation,
            doubles,
            synergies
        });

    const remainingPossibilities =
        calculateRemainingPossibilities({
            actions:
                Math.min(
                    100,
                    actions * 10
                ),

            diversity,
            finish,
            manipulation,

            responses:
                Math.min(
                    100,
                    actions * 8
                ),

            plans:
                calculateBackupPlans(
                    state,
                    playerIndex
                )
        });

    const personalImpact =
        calculatePersonalImpact({
            position,
            handQuality,
            remainingPossibilities
        });

    return {
        position,
        handQuality,
        remainingPossibilities,
        personalImpact
    };
}


/* ============================================================
 * POTENTIEL FUTUR PERSONNEL
 * ========================================================== */

export function calculateFlexibility({
    planDiversity = 0,
    independence = 0,
    opponentAdaptation = 0,
    eventAdaptation = 0
} = {}) {
    return clamp(
        (
            clamp(planDiversity) * 35 +
            clamp(independence) * 25 +
            clamp(opponentAdaptation) * 25 +
            clamp(eventAdaptation) * 15
        ) / 100
    );
}


export function calculateFuturePotential({
    futurePossibilities = 0,
    handAfterAction = 0,
    flexibility = 0,
    creation = 0
} = {}) {
    return clamp(
        (
            clamp(futurePossibilities) * 35 +
            clamp(handAfterAction) * 30 +
            clamp(flexibility) * 30 +
            clamp(creation) * 10
        ) / 105
    );
}


function calculateFutureMetrics(
    state,
    playerIndex
) {
    const actions =
        actionCount(
            state,
            playerIndex
        );

    const diversity =
        calculateDiversity(
            state,
            playerIndex
        );

    const flexibility =
        calculateFlexibility({
            planDiversity:
                diversity,

            independence:
                calculateIndependenceFromUncertainty(
                    state,
                    playerIndex
                ),

            opponentAdaptation:
                calculateAdaptation(
                    state,
                    playerIndex
                ),

            eventAdaptation:
                calculateStabilityScore(
                    state,
                    playerIndex
                )
        });

    const futurePossibilities =
        clamp(
            Math.min(
                100,
                actions * 12
            )
        );

    const hand =
        getHand(
            getPlayer(
                state,
                playerIndex
            )
        );

    const handAfterAction =
        clamp(
            Math.min(
                100,
                hand.length * 8 +
                diversity * 0.3
            )
        );

    const creation =
        calculateSynergies(
            state,
            playerIndex
        );

    return {
        futurePossibilities,
        handAfterAction,
        flexibility,
        creation,

        futurePotential:
            calculateFuturePotential({
                futurePossibilities,
                handAfterAction,
                flexibility,
                creation
            })
    };
}


/* ============================================================
 * COÛT D'OPPORTUNITÉ
 * ========================================================== */

export function calculateOpportunityCost({
    sacrifice = 0,
    abandonedAlternatives = 0,
    rarity = 0
} = {}) {
    return clamp(
        (
            clamp(sacrifice) * 50 +
            clamp(abandonedAlternatives) * 30 +
            clamp(rarity) * 20
        ) / 100
    );
}


function calculateActionRarity(
    state,
    action,
    playerIndex
) {
    const value =
        getActionCard(
            action
        );

    if (
        value === null
    ) {
        return 0;
    }

    const hand =
        getHand(
            getPlayer(
                state,
                playerIndex
            )
        );

    const copies =
        hand.filter(
            card =>
                cardValue(card) ===
                value
        ).length;

    if (
        copies <= 0
    ) {
        return 0;
    }

    if (
        copies >= 3
    ) {
        return 20;
    }

    if (
        copies === 2
    ) {
        return 50;
    }

    return 80;
}


function calculateOpportunityMetrics(
    state,
    action,
    playerIndex
) {
    const alternatives =
        actionCount(
            state,
            playerIndex
        );

    const rarity =
        calculateActionRarity(
            state,
            action,
            playerIndex
        );

    const value =
        getActionCard(
            action
        );

    let sacrifice = 0;

    /*
     * Cartes à fort potentiel futur.
     */
    if (
        [
            15,
            17,
            19,
            21
        ].includes(value)
    ) {
        sacrifice += 35;
    }

    if (
        value === 1 ||
        value === 9 ||
        value === 13
    ) {
        sacrifice += 20;
    }

    if (
        isDoubleAction(action)
    ) {
        sacrifice += 10;
    }

    const abandonedAlternatives =
        alternatives <= 1
            ? 0
            : clamp(
                100 -
                alternatives * 10
            );

    return {
        sacrifice:
            clamp(sacrifice),

        abandonedAlternatives,

        rarity,

        opportunityCost:
            calculateOpportunityCost({
                sacrifice,
                abandonedAlternatives,
                rarity
            })
    };
}


/* ============================================================
 * RISQUE
 * ========================================================== */

export function calculateRisk({
    adverseProbability = 0,
    severity = 0,
    recoveryDifficulty = 0
} = {}) {
    return clamp(
        (
            clamp(adverseProbability) * 40 +
            clamp(severity) * 40 +
            clamp(recoveryDifficulty) * 20
        ) / 100
    );
}


function calculateRiskMetrics(
    state,
    action,
    playerIndex
) {
    const target =
        action?.target;

    let adverseProbability = 0;
    let severity = 0;
    let recoveryDifficulty = 0;

    /*
     * Les actions à information cachée ont une incertitude
     * supérieure.
     */
    if (
        action?.metadata?.hiddenInformation
    ) {
        adverseProbability += 35;
    }

    if (
        action?.hiddenInformation
    ) {
        adverseProbability += 20;
    }

    /*
     * Une action qui aide potentiellement un adversaire
     * augmente le risque.
     */
    if (
        target !== null &&
        target !== undefined
    ) {
        const danger =
            calculateOpponentDanger(
                state,
                Number(target)
            );

        if (
            danger > 70
        ) {
            severity += 30;
        }

        if (
            danger > 85
        ) {
            severity += 20;
        }
    }

    const distance =
        Math.abs(
            getScoreDistance(
                state,
                playerIndex
            )
        );

    if (
        distance <= 20
    ) {
        recoveryDifficulty += 40;
    } else if (
        distance <= 40
    ) {
        recoveryDifficulty += 20;
    }

    if (
        isDoubleAction(action)
    ) {
        recoveryDifficulty += 10;
    }

    return {
        adverseProbability:
            clamp(
                adverseProbability
            ),

        severity:
            clamp(
                severity
            ),

        recoveryDifficulty:
            clamp(
                recoveryDifficulty
            ),

        risk:
            calculateRisk({
                adverseProbability,
                severity,
                recoveryDifficulty
            })
    };
}


/* ============================================================
 * IMPACT ADVERSAIRE
 * ========================================================== */

export function calculateOpponentImpact({
    situationBefore = 0,
    situationAfter = 0
} = {}) {
    /*
     * Une réduction de la situation adverse est positive.
     */
    const reduction =
        situationBefore -
        situationAfter;

    return clamp(
        reduction
    );
}


function evaluateOpponentImpact(
    beforeState,
    afterState,
    playerIndex
) {
    const before =
        evaluateOpponents(
            beforeState,
            playerIndex
        );

    const after =
        evaluateOpponents(
            afterState ??
            beforeState,
            playerIndex
        );

    return {
        before:
            before.situation,

        after:
            after.situation,

        maxDangerBefore:
            before.maxDanger,

        maxDangerAfter:
            after.maxDanger,

        averageDangerBefore:
            before.averageDanger,

        averageDangerAfter:
            after.averageDanger,

        opponentImpact:
            calculateOpponentImpact({
                situationBefore:
                    before.situation,

                situationAfter:
                    after.situation
            })
    };
}


/* ============================================================
 * SCORE FINAL
 * ========================================================== */

export function calculateFinalScore({
    personalImpact = 0,
    opponentImpact = 0,
    futurePotential = 0,
    opportunityCost = 0,
    risk = 0
} = {}) {
    return (
        clamp(personalImpact) *
            WEIGHTS.personalImpact +

        clamp(opponentImpact) *
            WEIGHTS.opponentImpact +

        clamp(futurePotential) *
            WEIGHTS.futurePotential -

        clamp(opportunityCost) *
            WEIGHTS.opportunityCost -

        clamp(risk) *
            WEIGHTS.risk
    );
}


/* ============================================================
 * ÉVALUATION D'UNE ACTION
 * ========================================================== */

export function evaluateAction({
    state,
    playerIndex = 0,
    action = null,
    resultingState = null,
    context = {}
} = {}) {
    if (!state) {
        return {
            action,
            score: 0,
            finalScore: 0,
            metrics: {},
            details: {}
        };
    }

    const after =
        resultingState ??
        state;

    const personal =
        calculatePersonalImpactMetrics(
            after,
            playerIndex
        );

    const future =
        calculateFutureMetrics(
            after,
            playerIndex
        );

    const opponentImpact =
        evaluateOpponentImpact(
            state,
            after,
            playerIndex
        );

    const opportunity =
        calculateOpportunityMetrics(
            state,
            action,
            playerIndex
        );

    const risk =
        calculateRiskMetrics(
            state,
            action,
            playerIndex
        );

    /*
     * En fin de partie, la distance à la cible devient
     * progressivement plus importante.
     *
     * Elle ne remplace jamais les autres critères.
     */
    const phase =
        getGamePhase(
            after
        );

    const distance =
        Math.abs(
            getScoreDistance(
                after,
                playerIndex
            )
        );

    const target =
        getTargetScore(
            after
        );

    const final =
        calculateFinalScore({
            personalImpact:
                personal.personalImpact,

            opponentImpact:
                opponentImpact.opponentImpact,

            futurePotential:
                future.futurePotential,

            opportunityCost:
                opportunity.opportunityCost,

            risk:
                risk.risk
        });

    const endgameBonus =
        calculateEndgameAdjustment({
            state: after,
            playerIndex,
            phase,
            distance,
            target,
            baseScore: final
        });

    const score =
        clamp(
            final +
            endgameBonus
        );

    return {
        action,

        /*
         * IMPORTANT :
         * search.js lit directement finalScore.
         */
        finalScore: score,

        score,

        metrics: {
            personalImpact:
                personal.personalImpact,

            opponentImpact:
                opponentImpact.opponentImpact,

            futurePotential:
                future.futurePotential,

            opportunityCost:
                opportunity.opportunityCost,

            risk:
                risk.risk,

            endgameAdjustment:
                endgameBonus
        },

        details: {
            personal,
            future,
            opponent:
                opponentImpact,
            opportunity,
            risk,

            phase,
            distance,
            target
        },

        context
    };
}


/* ============================================================
 * AJUSTEMENT FIN DE PARTIE
 * ========================================================== */

function calculateEndgameAdjustment({
    state,
    playerIndex,
    phase,
    distance,
    target,
    baseScore
}) {
    if (
        !Number.isFinite(
            distance
        )
    ) {
        return 0;
    }

    /*
     * L'exactitude devient plus importante à mesure que la
     * partie avance.
     */
    const phaseWeight =
        clamp(
            Number(phase) * 100
        );

    if (
        distance === 0
    ) {
        return 20;
    }

    /*
     * Une position proche de la cible n'est intéressante
     * que si elle correspond réellement à un chemin viable.
     */
    const closeness =
        clamp(
            100 -
            safeDivide(
                distance,
                Math.max(
                    1,
                    target
                )
            ) * 100
        );

    return (
        closeness *
        (phaseWeight / 100) *
        0.10
    );
}


/* ============================================================
 * ÉVALUATION DE POSITION SEULE
 * ========================================================== */

export function evaluateState(
    state,
    playerIndex
) {
    const position =
        evaluatePlayerPosition(
            state,
            playerIndex
        );

    const future =
        calculateFutureMetrics(
            state,
            playerIndex
        );

    const opponents =
        evaluateOpponents(
            state,
            playerIndex
        );

    const personal =
        calculatePersonalImpactMetrics(
            state,
            playerIndex
        );

    /*
     * Pour une position sans action, il n'existe pas de coût
     * d'opportunité ou de risque d'action.
     */
    const finalScore =
        calculateFinalScore({
            personalImpact:
                personal.personalImpact,

            opponentImpact:
                100 -
                opponents.situation,

            futurePotential:
                future.futurePotential,

            opportunityCost:
                0,

            risk:
                0
        });

    return {
        finalScore,
        score:
            finalScore,

        position,

        personalImpact:
            personal,

        futurePotential:
            future,

        opponents
    };
}


/* ============================================================
 * API COMPATIBLE AVEC SEARCH
 * ========================================================== */

export function evaluate({
    state,
    playerIndex = 0,
    action = null,
    resultingState = null,
    context = {}
} = {}) {
    /*
     * Si une action a produit un état, on évalue l'action.
     */
    if (
        action &&
        resultingState
    ) {
        return evaluateAction({
            state,
            playerIndex,
            action,
            resultingState,
            context
        });
    }

    /*
     * Sinon on évalue simplement la position actuelle.
     */
    return evaluateState(
        state,
        playerIndex
    );
}


/* ============================================================
 * EXPORT
 * ========================================================== */

export {
    WEIGHTS
};


export default {
    evaluate,
    evaluateAction,
    evaluateState,
    evaluatePlayerPosition,

    calculateFinishPotential,
    calculateProgression,
    calculateProgressionScore,

    calculateStability,
    calculateStabilityScore,

    calculatePersonalPosition,

    calculateIndividualDanger,
    calculateOpponentFuturePotential,
    calculateOpponentSituation,
    evaluateOpponents,

    calculateHandQuality,
    calculateRemainingPossibilities,
    calculatePersonalImpact,

    calculateFlexibility,
    calculateFuturePotential,

    calculateOpportunityCost,
    calculateRisk,

    calculateOpponentImpact,
    calculateFinalScore,

    getFinishTurnValue,
    getCertaintyValue
};
