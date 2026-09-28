// ai/search.js
//
// Recherche stratégique par tours.
// Le moteur ne choisit jamais une action ici : il explore les actions légales,
// simule leurs conséquences et transmet les états à l'évaluation.
//
// Principe :
//   état courant
//      ↓
//   actions complètes légales
//      ↓
//   simulation
//      ↓
//   évaluation
//      ↓
//   tour suivant
//      ↓
//   meilleure ligne stratégique
//
// Important :
// - aucune combinaison de cartes n'est codée ici ;
// - aucune difficulté ne modifie les règles ;
// - une action gagnante passe par l'évaluation normale ;
// - les informations cachées restent cachées ;
// - le bot pourra ensuite choisir parmi les actions proches du meilleur score.

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


// ---------------------------------------------------------------------------
// DIFFICULTÉ / PROFONDEUR
// ---------------------------------------------------------------------------

const SEARCH_DEPTH = Object.freeze({
  facile: 1,
  normal: 2,
  difficile: 3,
  expert: 3
});


function normalizeDifficulty(value) {
  const difficulty = String(value || "normal").toLowerCase();

  if (
    difficulty === "facile" ||
    difficulty === "easy"
  ) {
    return "facile";
  }

  if (
    difficulty === "normal" ||
    difficulty === "medium"
  ) {
    return "normal";
  }

  if (
    difficulty === "difficile" ||
    difficulty === "hard"
  ) {
    return "difficile";
  }

  if (
    difficulty === "expert"
  ) {
    return "expert";
  }

  return "normal";
}


/**
 * Profondeur de recherche en nombre de tours.
 *
 * Easy     = 1
 * Normal   = 2
 * Hard     = 3
 * Expert   = adaptatif
 *
 * Les actions intermédiaires ne sont pas comptées comme des tours
 * supplémentaires : action-generator est censé produire une action complète.
 */
export function getSearchDepth(
  state,
  {
    difficulty = "normal",
    actionCount = null,
    playerIndex = null
  } = {}
) {
  const level = normalizeDifficulty(difficulty);

  if (level !== "expert") {
    return SEARCH_DEPTH[level];
  }

  const progress =
    typeof state?.getGamePhase === "function"
      ? state.getGamePhase()
      : typeof state?.getCardsProgress === "function"
        ? state.getCardsProgress()
        : 0;

  const distance =
    typeof state?.getTargetDistance === "function"
      ? state.getTargetDistance(
          playerIndex ?? state.currentPlayer
        )
      : Number.POSITIVE_INFINITY;

  const alternatives =
    Number.isFinite(actionCount)
      ? actionCount
      : safeActionCount(state);

  let depth = 3;

  // En fin de partie, les conséquences à court terme deviennent
  // plus importantes : on regarde un tour supplémentaire.
  if (progress >= 0.70) {
    depth += 1;
  }

  if (distance <= 40) {
    depth += 1;
  }

  if (distance <= 20) {
    depth += 1;
  }

  // Trop de branches => profondeur plafonnée pour éviter l'explosion.
  if (alternatives >= 20) {
    depth = Math.min(depth, 4);
  } else if (alternatives >= 12) {
    depth = Math.min(depth, 5);
  }

  return Math.max(3, Math.min(depth, 6));
}


function safeActionCount(state) {
  try {
    if (!state) {
      return 0;
    }

    return generateLegalActions(state).length;
  } catch {
    return 0;
  }
}


// ---------------------------------------------------------------------------
// CONVERSION ACTION IA -> ACTION DE SIMULATION
// ---------------------------------------------------------------------------

function inferSimulationType(action) {
  if (!action) {
    return "card";
  }

  if (action.kind === "PLAY_DOUBLE") {
    return "double";
  }

  if (action.kind === "PLAY_CARD") {
    return "card";
  }

  if (action.kind === "CHOOSE_TARGET") {
    return "target";
  }

  if (
    action.kind === "CHOOSE_EFFECT" ||
    action.kind === "CHOOSE_TABLE_CARD" ||
    action.kind === "CHOOSE_MULTIPLE_TABLE_CARDS" ||
    action.kind === "CHOOSE_REVEALED_CARD" ||
    action.kind === "CONTINUE" ||
    action.kind === "FINISH"
  ) {
    return "effect";
  }

  return "combination";
}


export function toSimulatedAction(action) {
  if (!action) {
    throw new Error("Action IA absente.");
  }

  return new SimulatedAction({
    type: inferSimulationType(action),

    cardIndex:
      action.cardIndex ??
      action.index ??
      null,

    card:
      action.card ??
      action.value ??
      null,

    cards:
      Array.isArray(action.cards)
        ? action.cards.slice()
        : [],

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
      ...(action.parameters || {}),
      tableCard:
        action.tableCard ??
        action.parameters?.tableCard ??
        null,

      tableCards:
        Array.isArray(action.tableCards)
          ? action.tableCards.slice()
          : Array.isArray(action.parameters?.tableCards)
            ? action.parameters.tableCards.slice()
            : [],

      hiddenInformation:
        action.hiddenInformation ??
        action.parameters?.hiddenInformation ??
        false,

      uncertainty:
        action.uncertainty ??
        action.parameters?.uncertainty ??
        null,

      metadata:
        action.metadata
          ? { ...action.metadata }
          : {},

      commands:
        Array.isArray(action.commands)
          ? action.commands.slice()
          : Array.isArray(action.parameters?.commands)
            ? action.parameters.commands.slice()
            : []
    },

    description:
      action.metadata?.description ??
      action.description ??
      action.id ??
      "Action IA"
  });
}


// ---------------------------------------------------------------------------
// OUTILS D'ÉTAT
// ---------------------------------------------------------------------------

function getCurrentPlayer(state) {
  if (!state) {
    return null;
  }

  if (
    Number.isInteger(state.currentPlayer)
  ) {
    return state.currentPlayer;
  }

  if (
    typeof state.currentPlayer === "string" &&
    state.currentPlayer.trim() !== ""
  ) {
    const parsed = Number(state.currentPlayer);

    return Number.isInteger(parsed)
      ? parsed
      : null;
  }

  return null;
}


function getPlayerIndex(state, fallback = 0) {
  if (
    Number.isInteger(fallback)
  ) {
    return fallback;
  }

  if (
    state &&
    Number.isInteger(state.currentPlayer)
  ) {
    return state.currentPlayer;
  }

  return 0;
}


function getStateSignature(state) {
  if (!state) {
    return "null";
  }

  if (
    typeof state.signature === "function"
  ) {
    return state.signature();
  }

  try {
    return JSON.stringify(state);
  } catch {
    return String(state);
  }
}


function isRoundEnded(state) {
  return !!(
    state?.roundEnded ||
    state?.mancheTerminee
  );
}


function getTargetScore(state, playerIndex) {
  if (
    typeof state?.getVictoryTarget === "function"
  ) {
    return state.getVictoryTarget(playerIndex);
  }

  if (
    Number.isFinite(state?.targetScore)
  ) {
    return state.targetScore;
  }

  const count =
    Array.isArray(state?.players)
      ? state.players.length
      : 2;

  if (count <= 3) return 120;
  if (count === 4) return 160;
  if (count === 5) return 200;
  if (count === 6) return 220;
  if (count === 7) return 240;
  return 260;
}


function getPlayerScore(state, playerIndex) {
  if (
    typeof state?.getScore === "function"
  ) {
    return Number(
      state.getScore(playerIndex)
    ) || 0;
  }

  const player =
    state?.players?.[playerIndex];

  return Number(
    player?.score
  ) || 0;
}


function hasExactTarget(state, playerIndex) {
  if (
    typeof state?.hasExactTarget === "function"
  ) {
    return !!state.hasExactTarget(playerIndex);
  }

  return (
    getPlayerScore(state, playerIndex) ===
    getTargetScore(state, playerIndex)
  );
}


function isTerminalState(state, playerIndex) {
  if (!state) {
    return false;
  }

  if (isRoundEnded(state)) {
    return true;
  }

  return hasExactTarget(
    state,
    playerIndex
  );
}


function getDistance(state, playerIndex) {
  if (
    typeof state?.getTargetDistance === "function"
  ) {
    return state.getTargetDistance(
      playerIndex
    );
  }

  return (
    getTargetScore(state, playerIndex) -
    getPlayerScore(state, playerIndex)
  );
}


// ---------------------------------------------------------------------------
// CONTEXTE D'ÉVALUATION
// ---------------------------------------------------------------------------

function buildEvaluationContext({
  rootState,
  state,
  action,
  resultingState,
  playerIndex,
  depth,
  maxDepth,
  path,
  isOpponentNode = false
}) {
  return {
    rootState,
    state,
    action,
    resultingState,

    playerIndex,

    depth,
    maxDepth,

    path: path.slice(),

    isOpponentNode,

    score:
      getPlayerScore(
        resultingState || state,
        playerIndex
      ),

    distance:
      getDistance(
        resultingState || state,
        playerIndex
      ),

    progress:
      typeof (
        resultingState || state
      )?.getGamePhase === "function"
        ? (
            resultingState || state
          ).getGamePhase()
        : typeof (
            resultingState || state
          )?.getCardsProgress === "function"
          ? (
              resultingState || state
            ).getCardsProgress()
          : 0
  };
}


// ---------------------------------------------------------------------------
// ÉVALUATION
// ---------------------------------------------------------------------------

function evaluateNode({
  rootState,
  state,
  action = null,
  resultingState = state,
  playerIndex,
  depth,
  maxDepth,
  path,
  isOpponentNode = false
}) {
  const context = buildEvaluationContext({
    rootState,
    state,
    action,
    resultingState,
    playerIndex,
    depth,
    maxDepth,
    path,
    isOpponentNode
  });

  if (action) {
    const result = evaluate({
      state,
      playerIndex,
      action,
      resultingState,
      context
    });

    return {
      ...result,
      finalScore:
        Number.isFinite(result?.finalScore)
          ? result.finalScore
          : Number.isFinite(result?.score)
            ? result.score
            : 0
    };
  }

  const result =
    evaluatePlayerPosition(
      resultingState,
      playerIndex,
      context
    );

  return {
    ...result,
    finalScore:
      Number.isFinite(result?.finalScore)
        ? result.finalScore
        : Number.isFinite(result?.score)
          ? result.score
          : Number.isFinite(result?.position)
            ? result.position
            : 0
  };
}


function numericEvaluation(evaluation) {
  if (!evaluation) {
    return 0;
  }

  if (
    Number.isFinite(
      evaluation.finalScore
    )
  ) {
    return evaluation.finalScore;
  }

  if (
    Number.isFinite(
      evaluation.score
    )
  ) {
    return evaluation.score;
  }

  if (
    Number.isFinite(
      evaluation.position
    )
  ) {
    return evaluation.position;
  }

  return 0;
}


// ---------------------------------------------------------------------------
// ACTIONS LÉGALES
// ---------------------------------------------------------------------------

export function generateActions(state) {
  if (!state) {
    return [];
  }

  let actions = generateLegalActions(
    state
  );

  actions = Array.isArray(actions)
    ? actions.slice()
    : [];

  return sortByActionPriority(
    actions
  );
}


// ---------------------------------------------------------------------------
// SIMULATION
// ---------------------------------------------------------------------------

export function simulateOne(
  state,
  action
) {
  const simulated =
    toSimulatedAction(action);

  return simulateAction(
    state,
    simulated
  );
}


// ---------------------------------------------------------------------------
// COMPARAISON DE NŒUDS
// ---------------------------------------------------------------------------

function chooseBestForAi(results) {
  if (!results.length) {
    return null;
  }

  return results.reduce(
    (best, current) =>
      !best ||
      current.score > best.score
        ? current
        : best,
    null
  );
}


function chooseBestForOpponent(results) {
  if (!results.length) {
    return null;
  }

  // Le futur adversaire est supposé jouer de manière défavorable
  // au joueur IA étudié : il choisit donc la ligne qui donne
  // la plus petite valeur au joueur IA.
  return results.reduce(
    (best, current) =>
      !best ||
      current.score < best.score
        ? current
        : best,
    null
  );
}


// ---------------------------------------------------------------------------
// RECHERCHE RÉCURSIVE
// ---------------------------------------------------------------------------

function searchNode({
  rootState,
  state,
  playerIndex,
  depth,
  maxDepth,
  path = [],
  visited = new Set()
}) {
  const currentPlayer =
    getCurrentPlayer(state);

  const isAiTurn =
    currentPlayer === null ||
    Number(currentPlayer) ===
      Number(playerIndex);

  // -------------------------------------------------------------------------
  // TERMINAL
  // -------------------------------------------------------------------------

  if (
    isTerminalState(
      state,
      playerIndex
    )
  ) {
    const evaluation =
      evaluateNode({
        rootState,
        state,
        resultingState: state,
        playerIndex,
        depth,
        maxDepth,
        path,
        isOpponentNode: !isAiTurn
      });

    return {
      score:
        numericEvaluation(evaluation),

      finalScore:
        numericEvaluation(evaluation),

      immediateScore:
        numericEvaluation(evaluation),

      futureScore:
        numericEvaluation(evaluation),

      depth,

      terminal: true,

      finish:
        evaluation?.finish ??
        evaluation?.finishPotential ??
        0,

      evaluation,

      resultingState: state,

      line: path.slice()
    };
  }

  // -------------------------------------------------------------------------
  // PROFONDEUR ATTEINTE
  // -------------------------------------------------------------------------

  if (
    depth >= maxDepth
  ) {
    const evaluation =
      evaluateNode({
        rootState,
        state,
        resultingState: state,
        playerIndex,
        depth,
        maxDepth,
        path,
        isOpponentNode: !isAiTurn
      });

    return {
      score:
        numericEvaluation(evaluation),

      finalScore:
        numericEvaluation(evaluation),

      immediateScore:
        numericEvaluation(evaluation),

      futureScore:
        numericEvaluation(evaluation),

      depth,

      terminal: false,

      finish:
        evaluation?.finish ??
        evaluation?.finishPotential ??
        0,

      evaluation,

      resultingState: state,

      line: path.slice()
    };
  }

  // -------------------------------------------------------------------------
  // PROTECTION CONTRE LES CYCLES
  // -------------------------------------------------------------------------

  const signature =
    getStateSignature(state);

  const cycleKey =
    `${signature}|${depth}|${playerIndex}`;

  if (visited.has(cycleKey)) {
    const evaluation =
      evaluateNode({
        rootState,
        state,
        resultingState: state,
        playerIndex,
        depth,
        maxDepth,
        path,
        isOpponentNode: !isAiTurn
      });

    return {
      score:
        numericEvaluation(evaluation),

      finalScore:
        numericEvaluation(evaluation),

      immediateScore:
        numericEvaluation(evaluation),

      futureScore:
        numericEvaluation(evaluation),

      depth,

      terminal: false,
      cycle: true,

      finish:
        evaluation?.finish ??
        evaluation?.finishPotential ??
        0,

      evaluation,

      resultingState: state,

      line: path.slice()
    };
  }

  const nextVisited =
    new Set(visited);

  nextVisited.add(cycleKey);

  // -------------------------------------------------------------------------
  // ACTIONS
  // -------------------------------------------------------------------------

  const actions =
    generateActions(state);

  if (!actions.length) {
    const evaluation =
      evaluateNode({
        rootState,
        state,
        resultingState: state,
        playerIndex,
        depth,
        maxDepth,
        path,
        isOpponentNode: !isAiTurn
      });

    return {
      score:
        numericEvaluation(evaluation),

      finalScore:
        numericEvaluation(evaluation),

      immediateScore:
        numericEvaluation(evaluation),

      futureScore:
        numericEvaluation(evaluation),

      depth,

      terminal: false,
      noActions: true,

      finish:
        evaluation?.finish ??
        evaluation?.finishPotential ??
        0,

      evaluation,

      resultingState: state,

      line: path.slice()
    };
  }

  // -------------------------------------------------------------------------
  // EXPLORATION
  // -------------------------------------------------------------------------

  const candidates = [];

  for (
    const action of actions
  ) {
    let simulation;

    try {
      simulation =
        simulateOne(
          state,
          action
        );
    } catch (error) {
      continue;
    }

    if (
      !simulation ||
      simulation.error ||
      simulation.legal === false
    ) {
      continue;
    }

    const resultingState =
      simulation.state;

    if (!resultingState) {
      continue;
    }

    const immediateEvaluation =
      evaluateNode({
        rootState,
        state,
        action,
        resultingState,
        playerIndex,
        depth: depth + 1,
        maxDepth,
        path,
        isOpponentNode: !isAiTurn
      });

    const immediateScore =
      numericEvaluation(
        immediateEvaluation
      );

    const nextPath =
      path.concat({
        action,
        simulation,
        resultingState
      });

    // -----------------------------------------------------------------------
    // PAS DE TOUR FUTUR
    // -----------------------------------------------------------------------

    if (
      depth + 1 >= maxDepth ||
      isTerminalState(
        resultingState,
        playerIndex
      )
    ) {
      candidates.push({
        action,
        simulation,
        resultingState,

        score:
          immediateScore,

        finalScore:
          immediateScore,

        immediateScore,

        futureScore:
          immediateScore,

        depth:
          depth + 1,

        terminal:
          isTerminalState(
            resultingState,
            playerIndex
          ),

        finish:
          immediateEvaluation?.finish ??
          immediateEvaluation?.finishPotential ??
          0,

        evaluation:
          immediateEvaluation,

        line:
          nextPath
      });

      continue;
    }

    // -----------------------------------------------------------------------
    // TOUR FUTUR
    // -----------------------------------------------------------------------

    const future =
      searchNode({
        rootState,
        state: resultingState,
        playerIndex,
        depth: depth + 1,
        maxDepth,
        path: nextPath,
        visited: nextVisited
      });

    const futureScore =
      Number.isFinite(
        future?.score
      )
        ? future.score
        : 0;

    // On conserve l'évaluation de l'action puis la meilleure conséquence
    // future. Le résultat futur est celui qui représente la position atteinte
    // après le nombre de tours demandé.
    //
    // Le score final n'est pas une moyenne arbitraire entre "immédiat" et
    // "futur" : la position future représente déjà l'évolution complète
    // de la ligne recherchée.
    const finalScore =
      futureScore;

    candidates.push({
      action,
      simulation,
      resultingState,

      score:
        finalScore,

      finalScore,

      immediateScore,

      futureScore,

      depth:
        future.depth ??
        depth + 1,

      terminal:
        !!future.terminal,

      finish:
        Math.max(
          Number(
            immediateEvaluation?.finish ??
            immediateEvaluation?.finishPotential ??
            0
          ) || 0,

          Number(
            future?.finish
          ) || 0
        ),

      evaluation:
        immediateEvaluation,

      futureEvaluation:
        future?.evaluation ?? null,

      line:
        future?.line?.length
          ? future.line
          : nextPath
    });
  }

  if (!candidates.length) {
    const evaluation =
      evaluateNode({
        rootState,
        state,
        resultingState: state,
        playerIndex,
        depth,
        maxDepth,
        path,
        isOpponentNode: !isAiTurn
      });

    return {
      score:
        numericEvaluation(evaluation),

      finalScore:
        numericEvaluation(evaluation),

      immediateScore:
        numericEvaluation(evaluation),

      futureScore:
        numericEvaluation(evaluation),

      depth,

      terminal: false,
      noUsableActions: true,

      finish:
        evaluation?.finish ??
        evaluation?.finishPotential ??
        0,

      evaluation,

      resultingState: state,

      line: path.slice()
    };
  }

  const chosen =
    isAiTurn
      ? chooseBestForAi(candidates)
      : chooseBestForOpponent(candidates);

  return chosen;
}


// ---------------------------------------------------------------------------
// RECHERCHE DES ACTIONS INITIALES
// ---------------------------------------------------------------------------

export function searchActions(
  state,
  {
    playerIndex = state?.currentPlayer ?? 0,
    depth = 1,
    difficulty = "normal"
  } = {}
) {
  const actions =
    generateActions(state);

  if (!actions.length) {
    return [];
  }

  const results = [];

  for (
    const action of actions
  ) {
    let simulation;

    try {
      simulation =
        simulateOne(
          state,
          action
        );
    } catch {
      continue;
    }

    if (
      !simulation ||
      simulation.error ||
      simulation.legal === false ||
      !simulation.state
    ) {
      continue;
    }

    const resultingState =
      simulation.state;

    const immediateEvaluation =
      evaluateNode({
        rootState: state,
        state,
        action,
        resultingState,
        playerIndex,
        depth: 1,
        maxDepth: depth,
        path: [],
        isOpponentNode: false
      });

    const immediateScore =
      numericEvaluation(
        immediateEvaluation
      );

    let future = null;

    if (
      depth > 1 &&
      !isTerminalState(
        resultingState,
        playerIndex
      )
    ) {
      future =
        searchNode({
          rootState: state,
          state: resultingState,
          playerIndex,
          depth: 1,
          maxDepth: depth,
          path: [
            {
              action,
              simulation,
              resultingState
            }
          ]
        });
    }

    const futureScore =
      future
        ? numericEvaluation(future)
        : immediateScore;

    const finalScore =
      future
        ? futureScore
        : immediateScore;

    results.push({
      action,

      simulation,

      resultingState,

      score:
        finalScore,

      finalScore,

      immediateScore,

      futureScore,

      depth:
        future?.depth ??
        1,

      finish:
        Math.max(
          Number(
            immediateEvaluation?.finish ??
            immediateEvaluation?.finishPotential ??
            0
          ) || 0,

          Number(
            future?.finish
          ) || 0
        ),

      evaluation:
        immediateEvaluation,

      futureEvaluation:
        future?.evaluation ?? null,

      line:
        future?.line?.length
          ? future.line
          : [
              {
                action,
                simulation,
                resultingState
              }
            ],

      difficulty:
        normalizeDifficulty(
          difficulty
        )
    });
  }

  results.sort(
    (a, b) =>
      b.finalScore -
      a.finalScore
  );

  return results;
}


// ---------------------------------------------------------------------------
// MEILLEURE ACTION
// ---------------------------------------------------------------------------

export function searchBestAction(
  state,
  options = {}
) {
  const results =
    searchActions(
      state,
      options
    );

  return (
    results[0] ??
    null
  );
}


// ---------------------------------------------------------------------------
// ANALYSE DE FIN DE PARTIE
// ---------------------------------------------------------------------------

/**
 * Analyse les lignes pouvant conduire à une fin.
 *
 * Cette fonction est volontairement séparée de la sélection normale.
 *
 * Le bot principal ne doit PAS appeler searchFinish() pour choisir
 * automatiquement une action : la possibilité de finir doit rester une
 * composante de l'évaluation générale.
 *
 * Elle sert surtout au diagnostic, aux tests et à l'affichage éventuel
 * des raisons d'une décision.
 */
export function searchFinish(
  state,
  {
    playerIndex = state?.currentPlayer ?? 0,
    depth = 6
  } = {}
) {
  const results =
    searchActions(
      state,
      {
        playerIndex,
        depth,
        difficulty: "expert"
      }
    );

  return results
    .filter(
      result =>
        result.terminal ||
        Number(result.finish) > 0 ||
        hasExactTarget(
          result.resultingState,
          playerIndex
        )
    )
    .sort(
      (a, b) => {
        const depthA =
          Number.isFinite(a.depth)
            ? a.depth
            : Number.POSITIVE_INFINITY;

        const depthB =
          Number.isFinite(b.depth)
            ? b.depth
            : Number.POSITIVE_INFINITY;

        if (depthA !== depthB) {
          return depthA - depthB;
        }

        return (
          b.finalScore -
          a.finalScore
        );
      }
    );
}


// ---------------------------------------------------------------------------
// VALEUR THÉORIQUE D'UNE LIGNE DE FIN
// ---------------------------------------------------------------------------

export function calculateFinishLineScore(
  turns
) {
  const n =
    Number(turns);

  if (!Number.isFinite(n)) {
    return 0;
  }

  if (n <= 1) {
    return 100;
  }

  if (n === 2) {
    return 70;
  }

  if (n === 3) {
    return 45;
  }

  if (n === 4) {
    return 25;
  }

  if (n >= 5) {
    return 10;
  }

  return 0;
}


export function getDistanceToTarget(
  state,
  playerIndex
) {
  return getDistance(
    state,
    playerIndex
  );
}


// ---------------------------------------------------------------------------
// ANALYSE COMPLÈTE
// ---------------------------------------------------------------------------

export function analyzeSearch(
  state,
  {
    playerIndex = state?.currentPlayer ?? 0,
    difficulty = "normal",
    depth = null
  } = {}
) {
  const actions =
    generateActions(state);

  const searchDepth =
    Number.isInteger(depth)
      ? depth
      : getSearchDepth(
          state,
          {
            difficulty,
            actionCount:
              actions.length,
            playerIndex
          }
        );

  const results =
    searchActions(
      state,
      {
        playerIndex,
        depth:
          searchDepth,
        difficulty
      }
    );

  return {
    playerIndex,

    difficulty:
      normalizeDifficulty(
        difficulty
      ),

    depth:
      searchDepth,

    actionCount:
      actions.length,

    results,

    best:
      results[0] ?? null
  };
}


// ---------------------------------------------------------------------------
// EXPORT PAR DÉFAUT
// ---------------------------------------------------------------------------

export default {
  getSearchDepth,
  toSimulatedAction,
  generateActions,
  simulateOne,
  searchActions,
  searchBestAction,
  searchFinish,
  calculateFinishLineScore,
  getDistanceToTarget,
  analyzeSearch
};
