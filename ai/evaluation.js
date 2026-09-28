import {
  getPlayer,
  getOpponents,
  getKnownHand,
  getPlayerTableCards,
  getPlayerPointCards,
  getGameProgress,
  getVictoryTarget,
  getTargetDistance
} from "./state.js";

import { AI_CONFIG } from "./config.js";

/*
 * ============================================================
 * OUTILS GÉNÉRAUX
 * ============================================================
 */

function clamp(value, min = 0, max = 100) {
  if (!Number.isFinite(value)) {
    return min;
  }

  return Math.max(min, Math.min(max, value));
}

function safeNumber(value, fallback = 0) {
  return Number.isFinite(Number(value))
    ? Number(value)
    : fallback;
}

function average(values) {
  const valid = values.filter(Number.isFinite);

  if (valid.length === 0) {
    return 0;
  }

  return (
    valid.reduce((sum, value) => sum + value, 0) /
    valid.length
  );
}

function unique(values) {
  return [...new Set(values)];
}

function normalizeScore(value, minimum, maximum) {
  if (maximum <= minimum) {
    return 50;
  }

  return clamp(
    ((value - minimum) / (maximum - minimum)) * 100
  );
}

/*
 * ============================================================
 * CONFIGURATION
 * ============================================================
 */

function getWeights() {
  return {
    personalImpact:
      AI_CONFIG?.weights?.personalImpact ?? 0.40,

    opponentImpact:
      AI_CONFIG?.weights?.opponentImpact ?? 0.30,

    futurePotential:
      AI_CONFIG?.weights?.futurePotential ?? 0.15,

    opportunityCost:
      AI_CONFIG?.weights?.opportunityCost ?? 0.10,

    risk:
      AI_CONFIG?.weights?.risk ?? 0.05
  };
}

/*
 * ============================================================
 * FINISH / RETURN
 * ============================================================
 */

/**
 * Valeur associée au nombre minimal de tours nécessaires
 * pour atteindre exactement la cible.
 */
export function getTurnValue(turns) {
  if (!Number.isFinite(turns)) {
    return 0;
  }

  if (turns <= 1) return 100;
  if (turns === 2) return 70;
  if (turns === 3) return 45;
  if (turns === 4) return 25;

  return 10;
}

/**
 * Convertit une certitude qualitative en pourcentage.
 */
export function getCertaintyValue(certainty) {
  if (typeof certainty === "number") {
    return clamp(certainty);
  }

  switch (String(certainty || "").toLowerCase()) {
    case "certain":
      return 100;

    case "tres_probable":
    case "très_probable":
    case "very_probable":
      return 80;

    case "possible":
      return 55;

    case "faible":
    case "low":
      return 30;

    case "impossible":
      return 0;

    default:
      return 50;
  }
}

/**
 * FinishPotential =
 *
 * TurnValue × Certainty / 100
 */
export function calculateFinishPotential({
  turns,
  certainty
}) {
  const turnValue = getTurnValue(turns);
  const certaintyValue = getCertaintyValue(certainty);

  return clamp(
    turnValue * certaintyValue / 100
  );
}

/**
 * Estime le nombre minimal de tours nécessaires à partir
 * des résultats fournis par la simulation.
 *
 * Cette fonction accepte plusieurs formats afin de rester
 * compatible avec les modules de simulation existants.
 */
export function estimateTurnsToTarget(
  state,
  playerIndex,
  result = {}
) {
  const target = getVictoryTarget(state);
  const player = getPlayer(state, playerIndex);

  if (player.score === target) {
    return 0;
  }

  if (
    result.exactTarget === true ||
    result.reachesTarget === true
  ) {
    return 1;
  }

  if (Number.isFinite(result.turnsToTarget)) {
    return Math.max(1, result.turnsToTarget);
  }

  if (Number.isFinite(result.minTurns)) {
    return Math.max(1, result.minTurns);
  }

  /*
   * Estimation prudente si le simulateur ne fournit pas encore
   * de recherche de fin complète.
   */
  const distance = target - player.score;

  if (distance <= 0) {
    return 1;
  }

  const expectedGain =
    safeNumber(result.expectedGain, 10);

  if (expectedGain <= 0) {
    return Infinity;
  }

  return Math.max(
    1,
    Math.ceil(distance / expectedGain)
  );
}

/*
 * ============================================================
 * PROGRESSION
 * ============================================================
 */

/**
 * PathsToTarget :
 * nombre de chemins distincts permettant de progresser
 * vers la cible.
 */
export function calculatePathsToTarget(
  state,
  playerIndex,
  possibilities = []
) {
  if (!Array.isArray(possibilities)) {
    return 0;
  }

  const target = getVictoryTarget(state);
  const player = getPlayer(state, playerIndex);

  const paths = possibilities.filter(possibility => {
    const score =
      possibility?.resultingState?.players?.[playerIndex]
        ?.score;

    if (Number.isFinite(score)) {
      return (
        score <= target &&
        score > player.score
      );
    }

    if (
      Number.isFinite(possibility?.scoreGain)
    ) {
      return (
        possibility.scoreGain > 0 &&
        player.score + possibility.scoreGain <= target
      );
    }

    return false;
  });

  return paths.length;
}

/**
 * Diversité des chemins stratégiques.
 */
export function calculateDiversity(possibilities = []) {
  if (!Array.isArray(possibilities) ||
      possibilities.length === 0) {
    return 0;
  }

  const categories = unique(
    possibilities
      .map(action =>
        action?.category ||
        action?.type ||
        action?.kind
      )
      .filter(Boolean)
  );

  const targets = unique(
    possibilities
      .map(action =>
        action?.target ??
        action?.targetPlayer ??
        action?.targetId
      )
      .filter(value => value !== undefined && value !== null)
  );

  const effects = unique(
    possibilities
      .map(action =>
        action?.effect ||
        action?.effectType
      )
      .filter(Boolean)
  );

  const categoryScore =
    Math.min(100, categories.length * 25);

  const targetScore =
    Math.min(100, targets.length * 20);

  const effectScore =
    Math.min(100, effects.length * 20);

  return clamp(
    categoryScore * 0.45 +
    targetScore * 0.30 +
    effectScore * 0.25
  );
}

/**
 * Qualité globale des cartes restantes.
 */
export function calculateCardQuality(
  state,
  playerIndex,
  possibilities = []
) {
  const player = getPlayer(state, playerIndex);
  const hand = getKnownHand(player);

  if (hand.length === 0) {
    return 100;
  }

  const actions = possibilities.length;

  const doubles = countDoubles(hand);

  const finishActions = possibilities.filter(
    action =>
      action?.finishPotential >= 70 ||
      action?.reachesTarget === true ||
      action?.exactTarget === true
  ).length;

  const manipulationActions = possibilities.filter(
    action =>
      action?.manipulation === true ||
      action?.category === "manipulation"
  ).length;

  const synergyActions = possibilities.filter(
    action =>
      action?.synergy === true ||
      action?.category === "synergy"
  ).length;

  const actionScore =
    Math.min(100, actions * 10);

  const finishScore =
    Math.min(100, finishActions * 25);

  const manipulationScore =
    Math.min(100, manipulationActions * 20);

  const doubleScore =
    Math.min(100, doubles * 25);

  const synergyScore =
    Math.min(100, synergyActions * 20);

  return clamp(
    actionScore * 0.25 +
    finishScore * 0.25 +
    manipulationScore * 0.20 +
    doubleScore * 0.15 +
    synergyScore * 0.15
  );
}

/**
 * Progression générale.
 */
export function calculateProgression({
  scoreImprovement = 0,
  pathsToTarget = 0,
  diversity = 0,
  cardQuality = 0,
  adaptation = 0
}) {
  const improvementScore =
    clamp(scoreImprovement);

  const pathScore =
    clamp(pathsToTarget);

  return clamp(
    (
      improvementScore * 25 +
      pathScore * 30 +
      clamp(diversity) * 20 +
      clamp(cardQuality) * 15 +
      clamp(adaptation) * 10
    ) / 100
  );
}

/*
 * ============================================================
 * STABILITÉ
 * ============================================================
 */

export function calculateStability({
  backupPlans = 0,
  diversity = 0,
  independenceFromUncertainty = 0,
  recovery = 0
}) {
  return clamp(
    (
      clamp(backupPlans) * 35 +
      clamp(diversity) * 30 +
      clamp(independenceFromUncertainty) * 20 +
      clamp(recovery) * 15
    ) / 100
  );
}

/**
 * Flexibilité d'un état.
 */
export function calculateFlexibility({
  planDiversity = 0,
  independence = 0,
  opponentAdaptation = 0,
  eventAdaptation = 0
}) {
  return clamp(
    (
      clamp(planDiversity) * 35 +
      clamp(independence) * 25 +
      clamp(opponentAdaptation) * 25 +
      clamp(eventAdaptation) * 15
    ) / 100
  );
}

/*
 * ============================================================
 * POSITION PERSONNELLE
 * ============================================================
 */

export function calculatePosition({
  finishPotential = 0,
  progression = 0,
  stability = 0
}) {
  return clamp(
    (
      clamp(finishPotential) * 90 +
      clamp(progression) * 65 +
      clamp(stability) * 55
    ) / 210
  );
}

/*
 * ============================================================
 * QUALITÉ DE MAIN
 * ============================================================
 */

export function calculateHandQuality({
  actions = 0,
  finish = 0,
  manipulation = 0,
  doubles = 0,
  synergies = 0
}) {
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
}) {
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

/*
 * ============================================================
 * IMPACT PERSONNEL
 * ============================================================
 */

export function calculatePersonalImpact({
  position = 0,
  handQuality = 0,
  remainingPossibilities = 0
}) {
  return clamp(
    (
      clamp(position) * 95 +
      clamp(handQuality) * 60 +
      clamp(remainingPossibilities) * 45
    ) / 200
  );
}

/*
 * ============================================================
 * DANGER ADVERSE
 * ============================================================
 */

/**
 * Possibilités intéressantes d'un adversaire.
 */
export function calculatePossibilities(
  state,
  playerIndex,
  possibilities = []
) {
  const actions = Array.isArray(possibilities)
    ? possibilities
    : [];

  if (actions.length === 0) {
    return 0;
  }

  const categories = unique(
    actions.map(action =>
      action?.category ||
      action?.type ||
      action?.kind
    ).filter(Boolean)
  );

  const manipulation = actions.filter(
    action =>
      action?.manipulation === true
  ).length;

  const reduction = actions.filter(
    action =>
      action?.scoreReduction === true ||
      safeNumber(action?.scoreDelta) < 0
  ).length;

  const finish = actions.filter(
    action =>
      action?.exactTarget === true ||
      action?.reachesTarget === true ||
      action?.finishPotential >= 70
  ).length;

  const diversity =
    Math.min(100, categories.length * 20);

  const actionVolume =
    Math.min(100, actions.length * 8);

  const manipulationScore =
    Math.min(100, manipulation * 15);

  const reductionScore =
    Math.min(100, reduction * 15);

  const finishScore =
    Math.min(100, finish * 25);

  return clamp(
    actionVolume * 0.20 +
    diversity * 0.20 +
    manipulationScore * 0.20 +
    reductionScore * 0.15 +
    finishScore * 0.25
  );
}

export function calculateOpponentDanger({
  finishReturn = 0,
  position = 0,
  possibilities = 0,
  stability = 0
}) {
  return clamp(
    (
      clamp(finishReturn) * 50 +
      clamp(position) * 20 +
      clamp(possibilities) * 20 +
      clamp(stability) * 10
    ) / 100
  );
}

/*
 * ============================================================
 * FUTURE POTENTIAL
 * ============================================================
 */

export function calculateFuturePotential({
  futurePossibilities = 0,
  handAfterAction = 0,
  flexibility = 0,
  creation = 0
}) {
  return clamp(
    (
      clamp(futurePossibilities) * 35 +
      clamp(handAfterAction) * 30 +
      clamp(flexibility) * 30 +
      clamp(creation) * 10
    ) / 105
  );
}

/**
 * Potentiel futur d'un adversaire.
 */
export function calculateOpponentFuturePotential({
  progression = 0,
  manipulation = 0,
  cardQuality = 0,
  creation = 0
}) {
  return clamp(
    (
      clamp(progression) * 40 +
      clamp(manipulation) * 30 +
      clamp(cardQuality) * 20 +
      clamp(creation) * 10
    ) / 100
  );
}

/**
 * Situation globale d'un adversaire.
 */
export function calculateOpponentSituation({
  danger = 0,
  futurePotential = 0,
  stability = 0
}) {
  return clamp(
    (
      clamp(danger) * 100 +
      clamp(futurePotential) * 65 +
      clamp(stability) * 50
    ) / 215
  );
}

/*
 * ============================================================
 * IMPACT ADVERSAIRE
 * ============================================================
 */

/**
 * Mesure l'évolution de la situation d'un adversaire.
 *
 * Une diminution de sa situation est positive pour l'IA.
 */
export function calculateOpponentImpact(
  beforeSituation,
  afterSituation
) {
  const before = clamp(beforeSituation);
  const after = clamp(afterSituation);

  const reduction = before - after;

  /*
   * 50 = aucune évolution.
   * >50 = situation adverse réduite.
   * <50 = situation adverse améliorée.
   */
  return clamp(
    50 + reduction / 2
  );
}

/**
 * Impact global contre tous les adversaires.
 *
 * On conserve :
 * - le danger maximal ;
 * - la moyenne ;
 *
 * afin d'éviter qu'un grand nombre d'adversaires faibles
 * masque un adversaire réellement dangereux.
 */
export function calculateGlobalOpponentImpact(
  impacts = [],
  situationsBefore = [],
  situationsAfter = []
) {
  if (impacts.length === 0) {
    return 50;
  }

  const validImpacts = impacts
    .filter(Number.isFinite)
    .map(clamp);

  if (validImpacts.length === 0) {
    return 50;
  }

  const maxDanger =
    Math.max(...situationsBefore.map(clamp), 0);

  const averageImpact =
    average(validImpacts);

  const averageBefore =
    average(situationsBefore);

  const averageAfter =
    average(situationsAfter);

  const globalReduction =
    averageBefore - averageAfter;

  /*
   * Une réduction importante de l'adversaire le plus dangereux
   * doit peser davantage qu'une petite réduction répartie ailleurs.
   */
  const dangerousOpponentImpact =
    clamp(50 + globalReduction / 2);

  return clamp(
    dangerousOpponentImpact * 0.60 +
    averageImpact * 0.25 +
    (100 - maxDanger) * 0.15
  );
}

/*
 * ============================================================
 * COÛT D'OPPORTUNITÉ
 * ============================================================
 */

export function calculateOpportunityCost({
  sacrifice = 0,
  abandonedAlternatives = 0,
  rarity = 0
}) {
  return clamp(
    (
      clamp(sacrifice) * 50 +
      clamp(abandonedAlternatives) * 30 +
      clamp(rarity) * 20
    ) / 100
  );
}

/*
 * ============================================================
 * RISQUE
 * ============================================================
 */

export function calculateRisk({
  adverseProbability = 0,
  severity = 0,
  recoveryDifficulty = 0
}) {
  return clamp(
    (
      clamp(adverseProbability) * 40 +
      clamp(severity) * 40 +
      clamp(recoveryDifficulty) * 20
    ) / 100
  );
}

/*
 * ============================================================
 * SCORE FINAL
 * ============================================================
 */

export function calculateFinalScore({
  personalImpact = 0,
  opponentImpact = 0,
  futurePotential = 0,
  opportunityCost = 0,
  risk = 0
}) {
  const weights = getWeights();

  return clamp(
    personalImpact * weights.personalImpact +
    opponentImpact * weights.opponentImpact +
    futurePotential * weights.futurePotential -
    opportunityCost * weights.opportunityCost -
    risk * weights.risk
  );
}

/*
 * ============================================================
 * ÉVALUATION D'UNE ACTION
 * ============================================================
 */

/**
 * Construit l'évaluation complète d'une possibilité.
 *
 * Le résultat est volontairement détaillé :
 * le bot pourra ensuite expliquer/debugger pourquoi
 * une action a été choisie.
 */
export function evaluateAction({
  state,
  playerIndex,
  action,
  resultingState,
  context = {}
}) {
  const player = getPlayer(state, playerIndex);
  const resultingPlayer =
    resultingState?.players?.[playerIndex] ||
    player;

  const target =
    getVictoryTarget(state);

  /*
   * ----------------------------------------------------------
   * DONNÉES AVANT / APRÈS
   * ----------------------------------------------------------
   */

  const scoreBefore =
    safeNumber(player.score);

  const scoreAfter =
    safeNumber(resultingPlayer.score, scoreBefore);

  const scoreImprovement =
    scoreAfter - scoreBefore;

  /*
   * ----------------------------------------------------------
   * FINISH
   * ----------------------------------------------------------
   */

  const finishTurns =
    context.finishTurns ??
    estimateTurnsToTarget(
      resultingState || state,
      playerIndex,
      context.finish || {}
    );

  const finishCertainty =
    context.finishCertainty ??
    context.finish?.certainty ??
    (
      context.finish?.certain === true
        ? 100
        : undefined
    );

  const finishPotential =
    context.finishPotential ??
    calculateFinishPotential({
      turns: finishTurns,
      certainty:
        finishCertainty ?? 50
    });

  /*
   * ----------------------------------------------------------
   * PROGRESSION
   * ----------------------------------------------------------
   */

  const futurePossibilities =
    context.futurePossibilities ??
    context.futureActions ??
    [];

  const pathsToTarget =
    context.pathsToTarget ??
    calculatePathsToTarget(
      resultingState || state,
      playerIndex,
      futurePossibilities
    );

  const diversity =
    context.diversity ??
    calculateDiversity(
      futurePossibilities
    );

  const cardQuality =
    context.cardQuality ??
    calculateCardQuality(
      resultingState || state,
      playerIndex,
      futurePossibilities
    );

  const adaptation =
    context.adaptation ??
    calculateAdaptation(
      action,
      resultingState || state,
      playerIndex,
      context
    );

  const progression =
    context.progression ??
    calculateProgression({
      scoreImprovement:
        calculateScoreImprovement(
          scoreBefore,
          scoreAfter,
          target
        ),

      pathsToTarget:
        normalizePathCount(pathsToTarget),

      diversity,
      cardQuality,
      adaptation
    });

  /*
   * ----------------------------------------------------------
   * STABILITÉ
   * ----------------------------------------------------------
   */

  const backupPlans =
    context.backupPlans ??
    calculateBackupPlans(
      futurePossibilities
    );

  const independenceFromUncertainty =
    context.independenceFromUncertainty ??
    calculateUncertaintyIndependence(
      action,
      context
    );

  const recovery =
    context.recovery ??
    calculateRecoveryPotential(
      futurePossibilities
    );

  const stability =
    context.stability ??
    calculateStability({
      backupPlans,
      diversity,
      independenceFromUncertainty,
      recovery
    });

  /*
   * ----------------------------------------------------------
   * POSITION
   * ----------------------------------------------------------
   */

  const position =
    context.position ??
    calculatePosition({
      finishPotential,
      progression,
      stability
    });

  /*
   * ----------------------------------------------------------
   * QUALITÉ DE MAIN
   * ----------------------------------------------------------
   */

  const handActions =
    futurePossibilities.length;

  const finishActions =
    futurePossibilities.filter(
      item =>
        item?.finishPotential >= 70 ||
        item?.reachesTarget === true ||
        item?.exactTarget === true
    ).length;

  const manipulationActions =
    futurePossibilities.filter(
      item =>
        item?.manipulation === true ||
        item?.category === "manipulation"
    ).length;

  const doubleActions =
    futurePossibilities.filter(
      item =>
        item?.double === true ||
        item?.isDouble === true
    ).length;

  const synergyActions =
    futurePossibilities.filter(
      item =>
        item?.synergy === true
    ).length;

  const handQuality =
    context.handQuality ??
    calculateHandQuality({
      actions:
        Math.min(100, handActions * 10),

      finish:
        Math.min(100, finishActions * 25),

      manipulation:
        Math.min(100, manipulationActions * 20),

      doubles:
        Math.min(100, doubleActions * 25),

      synergies:
        Math.min(100, synergyActions * 20)
    });

  /*
   * ----------------------------------------------------------
   * POSSIBILITÉS RESTANTES
   * ----------------------------------------------------------
   */

  const remainingPossibilities =
    context.remainingPossibilities ??
    calculateRemainingPossibilities({
      actions:
        Math.min(100, handActions * 10),

      diversity,

      finish:
        Math.min(100, finishActions * 25),

      manipulation:
        Math.min(100, manipulationActions * 20),

      responses:
        context.responses ??
        calculateResponses(
          futurePossibilities
        ),

      plans:
        context.plans ??
        calculatePlans(
          futurePossibilities
        )
    });

  /*
   * ----------------------------------------------------------
   * IMPACT PERSONNEL
   * ----------------------------------------------------------
   */

  const personalImpact =
    context.personalImpact ??
    calculatePersonalImpact({
      position,
      handQuality,
      remainingPossibilities
    });

  /*
   * ----------------------------------------------------------
   * ADVERSAIRES
   * ----------------------------------------------------------
   */

  const opponentEvaluations =
    context.opponentEvaluations ||
    [];

  const opponentImpacts =
    opponentEvaluations.map(
      item =>
        Number.isFinite(item.impact)
          ? item.impact
          : 50
    );

  const situationsBefore =
    opponentEvaluations.map(
      item =>
        Number.isFinite(item.situationBefore)
          ? item.situationBefore
          : 50
    );

  const situationsAfter =
    opponentEvaluations.map(
      item =>
        Number.isFinite(item.situationAfter)
          ? item.situationAfter
          : 50
    );

  const opponentImpact =
    context.opponentImpact ??
    calculateGlobalOpponentImpact(
      opponentImpacts,
      situationsBefore,
      situationsAfter
    );

  /*
   * ----------------------------------------------------------
   * POTENTIEL FUTUR
   * ----------------------------------------------------------
   */

  const futureFlexibility =
    context.flexibility ??
    calculateFlexibility({
      planDiversity:
        diversity,

      independence:
        independenceFromUncertainty,

      opponentAdaptation:
        adaptation,

      eventAdaptation:
        context.eventAdaptation ??
        adaptation
    });

  const futurePotential =
    context.futurePotential ??
    calculateFuturePotential({
      futurePossibilities:
        calculateFuturePossibilityScore(
          futurePossibilities
        ),

      handAfterAction:
        cardQuality,

      flexibility:
        futureFlexibility,

      creation:
        context.creation ??
        calculateCreationPotential(
          futurePossibilities
        )
    });

  /*
   * ----------------------------------------------------------
   * OPPORTUNITY COST
   * ----------------------------------------------------------
   */

  const opportunityCost =
    context.opportunityCost ??
    calculateOpportunityCost({
      sacrifice:
        context.sacrifice ??
        calculateSacrifice(
          action,
          state,
          playerIndex
        ),

      abandonedAlternatives:
        context.abandonedAlternatives ??
        calculateAbandonedAlternatives(
          action,
          context.allActions || []
        ),

      rarity:
        context.rarity ??
        calculateRarity(
          action,
          state,
          playerIndex
        )
    });

  /*
   * ----------------------------------------------------------
   * RISQUE
   * ----------------------------------------------------------
   */

  const risk =
    context.risk ??
    calculateRisk({
      adverseProbability:
        context.adverseProbability ??
        calculateAdverseProbability(
          action,
          context
        ),

      severity:
        context.severity ??
        calculateRiskSeverity(
          action,
          state,
          playerIndex
        ),

      recoveryDifficulty:
        context.recoveryDifficulty ??
        calculateRecoveryDifficulty(
          action,
          context
        )
    });

  /*
   * ----------------------------------------------------------
   * SCORE FINAL
   * ----------------------------------------------------------
   */

  const finalScore =
    calculateFinalScore({
      personalImpact,
      opponentImpact,
      futurePotential,
      opportunityCost,
      risk
    });

  return {
    action,

    score: finalScore,

    metrics: {
      finishPotential,
      progression,
      stability,
      position,

      handQuality,
      remainingPossibilities,

      personalImpact,
      opponentImpact,

      futurePotential,
      opportunityCost,
      risk
    },

    details: {
      scoreBefore,
      scoreAfter,
      scoreImprovement,

      finishTurns,
      finishCertainty,

      pathsToTarget,
      diversity,

      backupPlans,
      independenceFromUncertainty,
      recovery,

      futureFlexibility,

      opponentEvaluations
    }
  };
}

/*
 * ============================================================
 * CALCULS SECONDAIRES
 * ============================================================
 */

function calculateScoreImprovement(
  before,
  after,
  target
) {
  const difference = after - before;

  if (difference > 0) {
    return clamp(
      difference / Math.max(1, target - before) * 100
    );
  }

  if (difference === 0) {
    return 50;
  }

  return clamp(
    50 + difference
  );
}

function normalizePathCount(count) {
  if (!Number.isFinite(count)) {
    return 0;
  }

  if (count <= 0) {
    return 0;
  }

  return Math.min(
    100,
    count * 15
  );
}

function calculateBackupPlans(possibilities = []) {
  if (!possibilities.length) {
    return 0;
  }

  const plans = unique(
    possibilities
      .map(item =>
        item?.planType ||
        item?.category ||
        item?.kind
      )
      .filter(Boolean)
  );

  return Math.min(
    100,
    plans.length * 25
  );
}

function calculateUncertaintyIndependence(
  action,
  context
) {
  if (
    action?.uncertain === false ||
    action?.requiresHiddenInformation === false
  ) {
    return 100;
  }

  if (
    action?.uncertain === true ||
    action?.requiresHiddenInformation === true
  ) {
    return context?.uncertaintyIndependence ?? 30;
  }

  return 60;
}

function calculateRecoveryPotential(
  possibilities = []
) {
  if (!possibilities.length) {
    return 0;
  }

  const recoveryActions =
    possibilities.filter(
      item =>
        item?.recovery === true ||
        item?.recoveryAction === true ||
        item?.category === "recovery"
    ).length;

  return Math.min(
    100,
    recoveryActions * 20
  );
}

function calculateResponses(
  possibilities = []
) {
  const responses =
    possibilities.filter(
      item =>
        item?.response === true ||
        item?.category === "response"
    ).length;

  return Math.min(
    100,
    responses * 20
  );
}

function calculatePlans(
  possibilities = []
) {
  const plans = unique(
    possibilities
      .map(item =>
        item?.planType ||
        item?.strategy
      )
      .filter(Boolean)
  );

  return Math.min(
    100,
    plans.length * 25
  );
}

function calculateFuturePossibilityScore(
  possibilities = []
) {
  if (!possibilities.length) {
    return 0;
  }

  const countScore =
    Math.min(100, possibilities.length * 10);

  const diversity =
    calculateDiversity(possibilities);

  const finish =
    Math.min(
      100,
      possibilities.filter(
        item =>
          item?.finishPotential >= 70 ||
          item?.reachesTarget === true ||
          item?.exactTarget === true
      ).length * 25
    );

  return clamp(
    countScore * 0.40 +
    diversity * 0.30 +
    finish * 0.30
  );
}

function calculateCreationPotential(
  possibilities = []
) {
  const creation =
    possibilities.filter(
      item =>
        item?.creation === true ||
        item?.createsOptions === true ||
        item?.category === "creation"
    ).length;

  return Math.min(
    100,
    creation * 20
  );
}

function calculateAdaptation(
  action,
  state,
  playerIndex,
  context
) {
  let score = 50;

  if (action?.adaptive === true) {
    score += 25;
  }

  if (action?.opponentDependent === true) {
    score += 10;
  }

  if (action?.eventDependent === true) {
    score += 10;
  }

  if (context?.gamePhase) {
    score += 5;
  }

  return clamp(score);
}

function calculateSacrifice(
  action,
  state,
  playerIndex
) {
  if (!action) {
    return 0;
  }

  let sacrifice = 0;

  if (
    action?.double === true ||
    action?.isDouble === true
  ) {
    sacrifice += 20;
  }

  if (
    action?.consumesHighValueCard === true
  ) {
    sacrifice += 30;
  }

  if (
    action?.removesFutureOption === true
  ) {
    sacrifice += 30;
  }

  if (
    action?.card !== undefined
  ) {
    const player = getPlayer(
      state,
      playerIndex
    );

    const hand = getKnownHand(player);

    const occurrences =
      hand.filter(
        card => card === action.card
      ).length;

    if (occurrences === 1) {
      sacrifice += 15;
    }
  }

  return clamp(sacrifice);
}

function calculateAbandonedAlternatives(
  action,
  allActions = []
) {
  if (!Array.isArray(allActions) ||
      allActions.length <= 1) {
    return 0;
  }

  const alternatives =
    allActions.filter(
      candidate =>
        candidate !== action &&
        candidate?.legal !== false
    );

  if (alternatives.length === 0) {
    return 0;
  }

  return Math.min(
    100,
    alternatives.length * 8
  );
}

function calculateRarity(
  action,
  state,
  playerIndex
) {
  if (!action) {
    return 0;
  }

  let rarity = 0;

  if (
    action?.double === true ||
    action?.isDouble === true
  ) {
    rarity += 20;
  }

  if (
    action?.card === "Joker"
  ) {
    rarity += 20;
  }

  if (
    action?.rare === true
  ) {
    rarity += 40;
  }

  return clamp(rarity);
}

function calculateAdverseProbability(
  action,
  context
) {
  if (!action) {
    return 0;
  }

  if (
    Number.isFinite(
      action?.adverseProbability
    )
  ) {
    return clamp(
      action.adverseProbability
    );
  }

  if (
    Number.isFinite(
      context?.adverseProbability
    )
  ) {
    return clamp(
      context.adverseProbability
    );
  }

  if (
    action?.uncertain === true ||
    action?.requiresHiddenInformation === true
  ) {
    return 40;
  }

  return 10;
}

function calculateRiskSeverity(
  action,
  state,
  playerIndex
) {
  let severity = 0;

  if (
    action?.losesScore === true
  ) {
    severity += 30;
  }

  if (
    action?.givesOpponentAdvantage === true
  ) {
    severity += 25;
  }

  if (
    action?.irreversible === true
  ) {
    severity += 20;
  }

  if (
    action?.uncertain === true
  ) {
    severity += 15;
  }

  return clamp(severity);
}

function calculateRecoveryDifficulty(
  action,
  context
) {
  if (
    Number.isFinite(
      action?.recoveryDifficulty
    )
  ) {
    return clamp(
      action.recoveryDifficulty
    );
  }

  if (
    Number.isFinite(
      context?.recoveryDifficulty
    )
  ) {
    return clamp(
      context.recoveryDifficulty
    );
  }

  if (
    action?.irreversible === true
  ) {
    return 60;
  }

  return 20;
}

/*
 * ============================================================
 * DOUBLES
 * ============================================================
 */

function countDoubles(hand = []) {
  const counts = new Map();

  for (const card of hand) {
    const key = String(card);

    counts.set(
      key,
      (counts.get(key) || 0) + 1
    );
  }

  let doubles = 0;

  for (const count of counts.values()) {
    if (count >= 2) {
      doubles++;
    }
  }

  return doubles;
}

/*
 * ============================================================
 * ÉVALUATION D'UN JOUEUR
 * ============================================================
 */

/**
 * Évalue la position actuelle d'un joueur sans action.
 *
 * Utilisé notamment par search.js pour comparer :
 *
 * état avant
 * état après
 */
export function evaluatePlayerPosition(
  state,
  playerIndex,
  context = {}
) {
  const player =
    getPlayer(state, playerIndex);

  const target =
    getVictoryTarget(state);

  const distance =
    getTargetDistance(
      state,
      playerIndex
    );

  const possibilities =
    context.possibilities || [];

  const finishPotential =
    context.finishPotential ??
    estimateCurrentFinishPotential(
      state,
      playerIndex,
      context
    );

  const progression =
    context.progression ??
    calculateCurrentProgression(
      state,
      playerIndex,
      possibilities
    );

  const stability =
    context.stability ??
    calculateStability({
      backupPlans:
        calculateBackupPlans(
          possibilities
        ),

      diversity:
        calculateDiversity(
          possibilities
        ),

      independenceFromUncertainty:
        calculateUncertaintyIndependence(
          null,
          context
        ),

      recovery:
        calculateRecoveryPotential(
          possibilities
        )
    });

  const position =
    calculatePosition({
      finishPotential,
      progression,
      stability
    });

  const danger =
    calculateOpponentDanger({
      finishReturn:
        finishPotential,

      position,

      possibilities:
        calculatePossibilities(
          state,
          playerIndex,
          possibilities
        ),

      stability
    });

  const futurePotential =
    calculateOpponentFuturePotential({
      progression,

      manipulation:
        calculateManipulationPotential(
          possibilities
        ),

      cardQuality:
        calculateCardQuality(
          state,
          playerIndex,
          possibilities
        ),

      creation:
        calculateCreationPotential(
          possibilities
        )
    });

  const situation =
    calculateOpponentSituation({
      danger,
      futurePotential,
      stability
    });

  return {
    playerId: player.id,
    score: safeNumber(player.score),

    target,

    distance,

    finishPotential,
    progression,
    stability,
    position,

    danger,
    futurePotential,
    situation
  };
}

function estimateCurrentFinishPotential(
  state,
  playerIndex,
  context
) {
  if (
    context?.finishPotential !== undefined
  ) {
    return clamp(
      context.finishPotential
    );
  }

  const player =
    getPlayer(state, playerIndex);

  const target =
    getVictoryTarget(state);

  const distance =
    target - player.score;

  if (distance === 0) {
    return 100;
  }

  if (distance < 0) {
    return 0;
  }

  if (distance <= 10) {
    return 70;
  }

  if (distance <= 20) {
    return 50;
  }

  if (distance <= 40) {
    return 30;
  }

  return 15;
}

function calculateCurrentProgression(
  state,
  playerIndex,
  possibilities
) {
  const player =
    getPlayer(state, playerIndex);

  const target =
    getVictoryTarget(state);

  const distance =
    target - player.score;

  const scoreProgress =
    target > 0
      ? clamp(
          player.score / target * 100
        )
      : 0;

  const paths =
    calculatePathsToTarget(
      state,
      playerIndex,
      possibilities
    );

  const pathScore =
    Math.min(100, paths * 15);

  const cardQuality =
    calculateCardQuality(
      state,
      playerIndex,
      possibilities
    );

  /*
   * La distance est volontairement seulement une partie
   * de la progression.
   */
  return clamp(
    scoreProgress * 0.30 +
    pathScore * 0.35 +
    cardQuality * 0.35
  );
}

function calculateManipulationPotential(
  possibilities = []
) {
  if (!possibilities.length) {
    return 0;
  }

  const count =
    possibilities.filter(
      action =>
        action?.manipulation === true ||
        action?.category === "manipulation"
    ).length;

  return Math.min(
    100,
    count * 20
  );
}

/*
 * ============================================================
 * EXPORT GLOBAL
 * ============================================================
 */

/**
 * Évaluation complète prête à être utilisée par search.js
 * ou bot.js.
 */
export function evaluate({
  state,
  playerIndex,
  action,
  resultingState,
  context = {}
}) {
  if (!state) {
    throw new Error(
      "evaluation.evaluate : state manquant."
    );
  }

  if (action && resultingState) {
    return evaluateAction({
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

export default {
  evaluate,
  evaluateAction,
  evaluatePlayerPosition,

  calculateFinishPotential,
  calculateProgression,
  calculateStability,
  calculateFlexibility,
  calculatePosition,

  calculateHandQuality,
  calculateRemainingPossibilities,

  calculatePersonalImpact,
  calculateOpponentDanger,
  calculateOpponentFuturePotential,
  calculateOpponentSituation,
  calculateOpponentImpact,
  calculateGlobalOpponentImpact,

  calculateFuturePotential,
  calculateOpportunityCost,
  calculateRisk,

  calculateFinalScore
};
