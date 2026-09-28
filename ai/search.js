// ai/search.js
//
// Recherche stratégique par tours.
//
// Pipeline :
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
//   meilleure ligne
//
// search.js ne choisit pas selon des règles de cartes.
// Il explore les actions produites par action-generator.js.
//

import {
  generateLegalActions,
  sortByActionPriority
} from "./action-generator.js";

import {
  simulateAction
} from "./simulation.js";

import {
  evaluate,
  evaluatePlayerPosition
} from "./evaluation.js";


// ============================================================
// DIFFICULTÉ / PROFONDEUR
// ============================================================

const SEARCH_DEPTH = Object.freeze({
  facile: 1,
  normal: 2,
  difficile: 3,
  expert: 3
});


function normalizeDifficulty(value) {
  const level =
    String(value || "normal")
      .toLowerCase();

  if (
    level === "facile" ||
    level === "easy"
  ) {
    return "facile";
  }

  if (
    level === "normal" ||
    level === "medium"
  ) {
    return "normal";
  }

  if (
    level === "difficile" ||
    level === "hard"
  ) {
    return "difficile";
  }

  if (
    level === "expert"
  ) {
    return "expert";
  }

  return "normal";
}


export function getSearchDepth(
  state,
  {
    difficulty = "normal",
    actionCount = null,
    playerIndex = null
  } = {}
) {
  const level =
    normalizeDifficulty(
      difficulty
    );

  if (
    level !== "expert"
  ) {
    return SEARCH_DEPTH[level];
  }

  const progress =
    getGameProgress(
      state
    );

  const distance =
    getDistanceToTarget(
      state,
      playerIndex ??
        getCurrentPlayer(state)
    );

  const alternatives =
    Number.isFinite(actionCount)
      ? actionCount
      : safeActionCount(state);

  let depth = 3;

  if (
    progress >= 0.70
  ) {
    depth += 1;
  }

  if (
    distance <= 40
  ) {
    depth += 1;
  }

  if (
    distance <= 20
  ) {
    depth += 1;
  }

  /*
   * On limite la profondeur quand le nombre de branches
   * devient très important.
   */
  if (
    alternatives >= 20
  ) {
    depth =
      Math.min(
        depth,
        4
      );
  } else if (
    alternatives >= 12
  ) {
    depth =
      Math.min(
        depth,
        5
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


// ============================================================
// ÉTAT
// ============================================================

function getCurrentPlayer(state) {
  if (
    state &&
    Number.isInteger(
      state.currentPlayer
    )
  ) {
    return state.currentPlayer;
  }

  const value =
    Number(
      state?.currentPlayer
    );

  return Number.isInteger(value)
    ? value
    : 0;
}


function getGameProgress(state) {
  if (
    typeof state?.getGameProgress ===
    "function"
  ) {
    return Number(
      state.getGameProgress()
    ) || 0;
  }

  if (
    typeof state?.getGamePhase ===
    "function"
  ) {
    return Number(
      state.getGamePhase()
    ) || 0;
  }

  if (
    typeof state?.getCardsProgress ===
    "function"
  ) {
    return Number(
      state.getCardsProgress()
    ) || 0;
  }

  /*
   * Fallback calculé à partir des informations
   * de l'état virtuel.
   */
  const deck =
    Number(
      state?.deckCount
    );

  const total =
    Number(
      state?.totalCards
    );

  if (
    Number.isFinite(deck) &&
    Number.isFinite(total) &&
    total > 0
  ) {
    return Math.max(
      0,
      Math.min(
        1,
        1 - deck / total
      )
    );
  }

  return 0;
}


function getPlayerScore(
  state,
  playerIndex
) {
  if (
    typeof state?.getScore ===
    "function"
  ) {
    return Number(
      state.getScore(
        playerIndex
      )
    ) || 0;
  }

  return Number(
    state?.players?.[
      playerIndex
    ]?.score
  ) || 0;
}


function getTargetScore(
  state,
  playerIndex
) {
  if (
    typeof state?.getVictoryTarget ===
    "function"
  ) {
    return Number(
      state.getVictoryTarget(
        playerIndex
      )
    );
  }

  if (
    Number.isFinite(
      state?.targetScore
    )
  ) {
    return Number(
      state.targetScore
    );
  }

  const count =
    Array.isArray(
      state?.players
    )
      ? state.players.length
      : 2;

  if (
    count <= 3
  ) {
    return 120;
  }

  if (
    count === 4
  ) {
    return 160;
  }

  if (
    count === 5
  ) {
    return 200;
  }

  if (
    count === 6
  ) {
    return 220;
  }

  if (
    count === 7
  ) {
    return 240;
  }

  return 260;
}


function getDistanceToTarget(
  state,
  playerIndex
) {
  if (
    playerIndex == null
  ) {
    return Number.POSITIVE_INFINITY;
  }

  if (
    typeof state?.getTargetDistance ===
    "function"
  ) {
    return Number(
      state.getTargetDistance(
        playerIndex
      )
    );
  }

  return (
    getTargetScore(
      state,
      playerIndex
    ) -
    getPlayerScore(
      state,
      playerIndex
    )
  );
}


function hasExactTarget(
  state,
  playerIndex
) {
  if (
    typeof state?.hasExactTarget ===
    "function"
  ) {
    return !!state.hasExactTarget(
      playerIndex
    );
  }

  return (
    getPlayerScore(
      state,
      playerIndex
    ) ===
    getTargetScore(
      state,
      playerIndex
    )
  );
}


function isTerminalState(
  state,
  playerIndex
) {
  if (!state) {
    return true;
  }

  if (
    state.roundEnded ||
    state.mancheTerminee
  ) {
    return true;
  }

  return hasExactTarget(
    state,
    playerIndex
  );
}


function getStateSignature(state) {
  if (!state) {
    return "null";
  }

  if (
    typeof state.signature ===
    "function"
  ) {
    return state.signature();
  }

  try {
    return JSON.stringify(
      state
    );
  } catch {
    return String(state);
  }
}


// ============================================================
// ACTIONS
// ============================================================

export function generateActions(
  state
) {
  if (!state) {
    return [];
  }

  let actions;

  try {
    actions =
      generateLegalActions(
        state
      );
  } catch {
    return [];
  }

  if (
    !Array.isArray(actions)
  ) {
    return [];
  }

  return sortByActionPriority(
    actions.slice()
  );
}


function safeActionCount(state) {
  try {
    return generateActions(
      state
    ).length;
  } catch {
    return 0;
  }
}


// ============================================================
// ÉVALUATION
// ============================================================

function numericEvaluation(
  result
) {
  if (!result) {
    return 0;
  }

  if (
    Number.isFinite(
      result.finalScore
    )
  ) {
    return result.finalScore;
  }

  if (
    Number.isFinite(
      result.score
    )
  ) {
    return result.score;
  }

  if (
    Number.isFinite(
      result.position
    )
  ) {
    return result.position;
  }

  return 0;
}


function evaluateState(
  state,
  playerIndex
) {
  try {
    const result =
      evaluatePlayerPosition(
        state,
        playerIndex
      );

    return {
      ...result,

      finalScore:
        numericEvaluation(
          result
        )
    };
  } catch {
    return {
      finalScore: 0,
      score: 0
    };
  }
}


function evaluateAction(
  state,
  resultingState,
  action,
  playerIndex
) {
  try {
    const result =
      evaluate({
        state,
        resultingState,
        action,
        playerIndex
      });

    return {
      ...result,

      finalScore:
        numericEvaluation(
          result
        )
    };
  } catch {
    /*
     * Fallback minimal si une évaluation particulière
     * n'est pas disponible.
     */
    return evaluateState(
      resultingState,
      playerIndex
    );
  }
}


// ============================================================
// SIMULATION
// ============================================================

function simulate(
  state,
  action
) {
  try {
    return simulateAction(
      state,
      action
    );
  } catch (error) {
    return {
      legal: false,
      completed: false,
      state: null,
      error:
        error?.message ??
        String(error)
    };
  }
}


// ============================================================
// NOEUD TERMINAL
// ============================================================

function terminalResult({
  state,
  playerIndex,
  depth,
  path,
  terminal = true
}) {
  const evaluation =
    evaluateState(
      state,
      playerIndex
    );

  return {
    score:
      numericEvaluation(
        evaluation
      ),

    finalScore:
      numericEvaluation(
        evaluation
      ),

    immediateScore:
      numericEvaluation(
        evaluation
      ),

    futureScore:
      numericEvaluation(
        evaluation
      ),

    depth,

    terminal,

    finish:
      Number(
        evaluation.finish ??
        evaluation.finishPotential ??
        0
      ) || 0,

    evaluation,

    resultingState:
      state,

    line:
      path.slice()
  };
}


// ============================================================
// RECHERCHE MINIMAX SIMPLIFIÉE
// ============================================================

function searchNode({
  rootState,
  state,
  playerIndex,
  depth,
  maxDepth,
  path = [],
  visited = new Set()
}) {
  if (
    isTerminalState(
      state,
      playerIndex
    )
  ) {
    return terminalResult({
      state,
      playerIndex,
      depth,
      path
    });
  }

  if (
    depth >= maxDepth
  ) {
    return terminalResult({
      state,
      playerIndex,
      depth,
      path,
      terminal: false
    });
  }

  /*
   * Protection contre les cycles.
   */
  const signature =
    getStateSignature(
      state
    );

  const cycleKey =
    `${signature}|${depth}|${playerIndex}`;

  if (
    visited.has(
      cycleKey
    )
  ) {
    return terminalResult({
      state,
      playerIndex,
      depth,
      path,
      terminal: false
    });
  }

  const nextVisited =
    new Set(
      visited
    );

  nextVisited.add(
    cycleKey
  );

  const actions =
    generateActions(
      state
    );

  if (
    !actions.length
  ) {
    return terminalResult({
      state,
      playerIndex,
      depth,
      path,
      terminal: false
    });
  }

  const currentPlayer =
    getCurrentPlayer(
      state
    );

  const aiTurn =
    Number(
      currentPlayer
    ) ===
    Number(
      playerIndex
    );

  const candidates = [];

  for (
    const action of actions
  ) {
    const simulation =
      simulate(
        state,
        action
      );

    if (
      !simulation ||
      simulation.legal === false ||
      simulation.error ||
      !simulation.state
    ) {
      continue;
    }

    const resultingState =
      simulation.state;

    const immediateEvaluation =
      evaluateAction(
        state,
        resultingState,
        action,
        playerIndex
      );

    const immediateScore =
      numericEvaluation(
        immediateEvaluation
      );

    const node =
      {
        action,

        simulation,

        resultingState,

        immediateScore,

        evaluation:
          immediateEvaluation,

        line:
          path.concat({
            action,
            simulation,
            resultingState
          })
      };

    /*
     * Victoire immédiate :
     * elle passe par la même évaluation,
     * sans sélecteur spécial.
     */
    if (
      isTerminalState(
        resultingState,
        playerIndex
      )
    ) {
      candidates.push({
        ...node,

        score:
          immediateScore,

        finalScore:
          immediateScore,

        futureScore:
          immediateScore,

        depth:
          depth + 1,

        terminal: true,

        finish:
          Number(
            immediateEvaluation.finish ??
            immediateEvaluation.finishPotential ??
            0
          ) || 0
      });

      continue;
    }

    /*
     * Fin de profondeur.
     */
    if (
      depth + 1 >= maxDepth
    ) {
      candidates.push({
        ...node,

        score:
          immediateScore,

        finalScore:
          immediateScore,

        futureScore:
          immediateScore,

        depth:
          depth + 1,

        terminal: false,

        finish:
          Number(
            immediateEvaluation.finish ??
            immediateEvaluation.finishPotential ??
            0
          ) || 0
      });

      continue;
    }

    /*
     * Recherche du tour suivant.
     */
    const future =
      searchNode({
        rootState,
        state: resultingState,
        playerIndex,
        depth:
          depth + 1,
        maxDepth,
        path:
          node.line,
        visited:
          nextVisited
      });

    const futureScore =
      numericEvaluation(
        future
      );

    candidates.push({
      ...node,

      score:
        futureScore,

      finalScore:
        futureScore,

      futureScore,

      depth:
        future.depth ??
        depth + 1,

      terminal:
        !!future.terminal,

      finish:
        Math.max(
          Number(
            immediateEvaluation.finish ??
            immediateEvaluation.finishPotential ??
            0
          ) || 0,

          Number(
            future.finish
          ) || 0
        ),

      futureEvaluation:
        future.evaluation,

      line:
        future.line?.length
          ? future.line
          : node.line
    });
  }

  if (
    !candidates.length
  ) {
    return terminalResult({
      state,
      playerIndex,
      depth,
      path,
      terminal: false
    });
  }

  /*
   * Tour de l'IA :
   * maximum.
   *
   * Tour adverse :
   * minimum pour notre position.
   */
  candidates.sort(
    (a, b) =>
      aiTurn
        ? b.finalScore -
          a.finalScore
        : a.finalScore -
          b.finalScore
  );

  return candidates[0];
}


// ============================================================
// RECHERCHE DES ACTIONS DE DÉPART
// ============================================================

export function searchActions(
  state,
  {
    playerIndex =
      getCurrentPlayer(
        state
      ),

    depth = 1,

    difficulty = "normal"
  } = {}
) {
  if (!state) {
    return [];
  }

  const actions =
    generateActions(
      state
    );

  if (
    !actions.length
  ) {
    return [];
  }

  const results = [];

  for (
    const action of actions
  ) {
    const simulation =
      simulate(
        state,
        action
      );

    if (
      !simulation ||
      simulation.legal === false ||
      simulation.error ||
      !simulation.state
    ) {
      continue;
    }

    const resultingState =
      simulation.state;

    const evaluation =
      evaluateAction(
        state,
        resultingState,
        action,
        playerIndex
      );

    const immediateScore =
      numericEvaluation(
        evaluation
      );

    /*
     * Une profondeur de 1 signifie :
     *
     * action actuelle → état résultant → évaluation
     */
    if (
      depth <= 1 ||
      isTerminalState(
        resultingState,
        playerIndex
      )
    ) {
      results.push({
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

        depth: 1,

        terminal:
          isTerminalState(
            resultingState,
            playerIndex
          ),

        finish:
          Number(
            evaluation.finish ??
            evaluation.finishPotential ??
            0
          ) || 0,

        evaluation,

        futureEvaluation:
          null,

        line: [
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

      continue;
    }

    /*
     * Recherche des tours futurs.
     */
    const future =
      searchNode({
        rootState: state,

        state:
          resultingState,

        playerIndex,

        depth: 1,

        maxDepth:
          depth,

        path: [
          {
            action,
            simulation,
            resultingState
          }
        ]
      });

    const futureScore =
      numericEvaluation(
        future
      );

    results.push({
      action,

      simulation,

      resultingState,

      score:
        futureScore,

      finalScore:
        futureScore,

      immediateScore,

      futureScore,

      depth:
        future.depth ??
        1,

      terminal:
        !!future.terminal,

      finish:
        Math.max(
          Number(
            evaluation.finish ??
            evaluation.finishPotential ??
            0
          ) || 0,

          Number(
            future.finish
          ) || 0
        ),

      evaluation,

      futureEvaluation:
        future.evaluation ??
        null,

      line:
        future.line?.length
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

  /*
   * Toujours classement décroissant pour le joueur IA.
   *
   * searchActions ne choisit pas le bot :
   * il retourne toutes les lignes classées.
   */
  results.sort(
    (a, b) =>
      b.finalScore -
      a.finalScore
  );

  return results;
}


// ============================================================
// MEILLEURE LIGNE
// ============================================================

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


// ============================================================
// RECHERCHE DES FINITIONS
// ============================================================
//
// Fonction de diagnostic.
//
// Elle ne remplace PAS la sélection normale du bot.
//

export function searchFinish(
  state,
  {
    playerIndex =
      getCurrentPlayer(
        state
      ),

    depth = 6
  } = {}
) {
  const results =
    searchActions(
      state,
      {
        playerIndex,
        depth,
        difficulty:
          "expert"
      }
    );

  return results
    .filter(
      result =>
        result.terminal ||
        Number(
          result.finish
        ) > 0 ||
        hasExactTarget(
          result.resultingState,
          playerIndex
        )
    )
    .sort(
      (a, b) => {
        /*
         * Diagnostic :
         * moins de tours d'abord,
         * puis score de l'évaluation.
         */
        if (
          a.depth !==
          b.depth
        ) {
          return (
            a.depth -
            b.depth
          );
        }

        return (
          b.finalScore -
          a.finalScore
        );
      }
    );
}


// ============================================================
// VALEUR D'UNE FINITION
// ============================================================

export function calculateFinishLineScore(
  turns
) {
  const value =
    Number(turns);

  if (
    !Number.isFinite(value)
  ) {
    return 0;
  }

  if (
    value <= 1
  ) {
    return 100;
  }

  if (
    value === 2
  ) {
    return 70;
  }

  if (
    value === 3
  ) {
    return 45;
  }

  if (
    value === 4
  ) {
    return 25;
  }

  return 10;
}


// ============================================================
// ANALYSE COMPLÈTE
// ============================================================

export function analyzeSearch(
  state,
  {
    playerIndex =
      getCurrentPlayer(
        state
      ),

    difficulty =
      "normal",

    depth =
      null
  } = {}
) {
  const actions =
    generateActions(
      state
    );

  const searchDepth =
    Number.isInteger(
      depth
    )
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
      results[0] ??
      null
  };
}


// ============================================================
// EXPORT
// ============================================================

export default {
  getSearchDepth,

  generateActions,

  simulate,

  searchActions,

  searchBestAction,

  searchFinish,

  calculateFinishLineScore,

  getDistanceToTarget,

  analyzeSearch
};
