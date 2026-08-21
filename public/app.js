```javascript
let ws = null;
let state = null;
let myPid = localStorage.getItem("atoumoulin_pid") || "";
let pendingAction = null;
let reconnecting = false;

const $ = id => document.getElementById(id);

const powers = {
  1: "Vole la dernière carte de points",
  3: "−20 à un adversaire",
  5: "Pioche 2",
  7: "+20, ne pioche pas",
  9: "Échange les mains",
  11: "+10 ou −10",
  13: "Vole une carte de points",
  15: "Double une carte de points",
  17: "Vole et joue une carte",
  19: "Échange une carte de points",
  21: "+20 ou −20",
  J: "10 / 22 / échange les points"
};

/* =========================================================
   CONNEXION
========================================================= */

function connect() {
  if (
    ws &&
    (
      ws.readyState === WebSocket.OPEN ||
      ws.readyState === WebSocket.CONNECTING
    )
  ) {
    return;
  }

  ws = new WebSocket(
  "wss://" + location.host
);

  ws.onopen = () => {
    reconnecting = false;
    toast("Connecté au serveur");

    /*
     * Si on avait déjà un salon, on ne peut pas
     * automatiquement rejoindre sans modification
     * serveur supplémentaire. On garde néanmoins
     * le PID local pour les messages reçus.
     */
  };

  ws.onmessage = event => {
    try {
      const m =
        JSON.parse(event.data);

      if (m.type === "room") {
        myPid = m.pid;

        localStorage.setItem(
          "atoumoulin_pid",
          myPid
        );

        $("roomBadge").textContent =
          "Salon " + m.code;

        return;
      }

      if (m.type === "state") {
        state = m.state;

        render();

        return;
      }

      if (m.type === "log") {
        return;
      }

      if (m.type === "error") {
        toast(m.message);
      }
    } catch (error) {
      console.error(
        "Message serveur invalide :",
        error
      );
    }
  };

  ws.onclose = () => {
    if (!reconnecting && state?.started) {
      toast("Connexion perdue");
    }

    reconnecting = false;
  };

  ws.onerror = () => {
    toast("Erreur de connexion");
  };
}

function send(object) {
  if (
    ws &&
    ws.readyState === WebSocket.OPEN
  ) {
    ws.send(
      JSON.stringify(object)
    );

    return true;
  }

  toast("Pas de connexion au serveur");
  return false;
}

/* =========================================================
   CREATION / REJOINDRE
========================================================= */

function createRoom() {
  connect();

  const wait = setInterval(() => {
    if (
      ws &&
      ws.readyState === WebSocket.OPEN
    ) {
      clearInterval(wait);

      send({
        type: "create",

        name:
          $("createName").value.trim() ||
          "Joueur",

        maxPlayers:
          Number($("maxPlayers").value),

        rounds:
          Number($("rounds").value)
      });
    }
  }, 30);

  setTimeout(
    () => clearInterval(wait),
    5000
  );
}

function createSolo() {
  connect();

  const wait = setInterval(() => {
    if (
      ws &&
      ws.readyState === WebSocket.OPEN
    ) {
      clearInterval(wait);

      send({
        type: "solo",

        name:
          $("createName").value.trim() ||
          "Joueur"
      });
    }
  }, 30);

  setTimeout(
    () => clearInterval(wait),
    5000
  );
}

function joinRoom() {
  connect();

  const wait = setInterval(() => {
    if (
      ws &&
      ws.readyState === WebSocket.OPEN
    ) {
      clearInterval(wait);

      send({
        type: "join",

        name:
          $("joinName").value.trim() ||
          "Joueur",

        code:
          $("joinCode").value
            .trim()
            .toUpperCase()
      });
    }
  }, 30);

  setTimeout(
    () => clearInterval(wait),
    5000
  );
}

function startGame() {
  send({
    type: "start"
  });
}

/* =========================================================
   IDENTITE
========================================================= */

function getPid() {
  return myPid || ws?.pid || "";
}

function me() {
  return state?.players?.find(
    p => p.id === getPid()
  );
}

function isHost() {
  return (
    state?.players?.[0]?.id ===
    getPid()
  );
}

/* =========================================================
   CARTES OBLIGATOIRES
========================================================= */

function forced(hand) {
  const c = {};

  hand.forEach(card => {
    const key = String(card);

    c[key] =
      (c[key] || 0) + 1;
  });

  /*
   * Le 7 est toujours prioritaire.
   */
  if (c["7"]) {
    return ["7"];
  }

  /*
   * Sinon une paire.
   */
  for (const key in c) {
    if (c[key] >= 2) {
      return [key];
    }
  }

  return [];
}

/* =========================================================
   RENDU
========================================================= */

function render() {
  $("lobby").classList.toggle(
    "hidden",
    !!state
  );

  $("game").classList.toggle(
    "hidden",
    !state
  );

  if (!state) {
    return;
  }

  const current =
    state.players[state.turn];

  const player =
    me();

  $("target").textContent =
    `Objectif : ${state.target}`;

  $("startBtn").classList.toggle(
    "hidden",
    state.started ||
    !isHost()
  );

  if (state.winner) {
    if (
      state.winner.reason ===
      "draw"
    ) {
      $("status").textContent =
        "Partie nulle";
    } else {
      $("status").textContent =
        `${state.winner.name} gagne !`;
    }
  } else if (state.started) {
    $("status").textContent =
      current
        ? `Tour de ${current.name}`
        : "Tour...";
  } else {
    $("status").textContent =
      "En attente des joueurs";
  }

  /*
   * JOUEURS
   */
  $("players").innerHTML =
    state.players
      .map(p => {
        const active =
          p.id === current?.id;

        const mine =
          p.id === getPid();

        const bot =
          p.bot
            ? " 🤖"
            : "";

        return `
          <div class="player
            ${active ? "active" : ""}
            ${mine ? "me" : ""}
          ">
            <b>
              ${escapeHtml(p.name)}${bot}
            </b>

            <div class="score">
              ${p.points}
            </div>

            <div>
              ${p.handCount} carte(s) en main
            </div>

            ${
              state.rounds > 1
                ? `<div>
                    🏆 ${p.roundWins || 0}
                    manche(s)
                   </div>`
                : ""
            }

            <div class="pile">
              ${
                p.pile
                  .map(item => `
                    <div
                      class="mini"
                      title="${item.value} points"
                    >
                      ${escapeHtml(item.card)}
                    </div>
                  `)
                  .join("")
              }
            </div>
          </div>
        `;
      })
      .join("");

  /*
   * DEFAUSSE
   */
  $("discardCards").innerHTML =
    state.discard
      .slice(-3)
      .map(c => `
        <span>
          ${escapeHtml(c)}
        </span>
      `)
      .join(" ");

  /*
   * PIOCHE
   */
  $("deck").innerHTML = `
    🂠
    <small>
      ${state.deckCount} cartes
    </small>
  `;

  /*
   * MAIN
   */
  $("handCount").textContent =
    player
      ? `(${state.hand?.length || 0})`
      : "";

  const f =
    forced(state.hand || []);

  $("hand").innerHTML =
    (state.hand || [])
      .map((card, index) => {
        const isForced =
          f.includes(
            String(card)
          );

        const disabled =
          !state.started ||
          !player ||
          state.players[state.turn]?.id !==
            getPid();

        return `
          <button
            class="card ${isForced ? "forced" : ""}"
            ${disabled ? "disabled" : ""}
            onclick="chooseCard(${JSON.stringify(String(card))})"
            title="${escapeHtml(
              powers[card] || ""
            )}"
          >
            ${art(card)}

            ${
              isForced
                ? `<span class="badge">
                    OBLIGATOIRE
                   </span>`
                : ""
            }
          </button>
        `;
      })
      .join("");

  /*
   * HISTORIQUE
   */
  if ($("history")) {
    $("history").innerHTML =
      (state.log || [])
        .slice(-8)
        .reverse()
        .map(text => `
          <div>
            ${escapeHtml(text)}
          </div>
        `)
        .join("");
  }
}

/* =========================================================
   CHOIX D'UNE CARTE
========================================================= */

function chooseCard(card) {
  if (!state?.started) {
    return;
  }

  const player = me();

  if (!player) {
    return;
  }

  if (
    state.players[state.turn]?.id !==
    getPid()
  ) {
    toast("Ce n'est pas ton tour.");
    return;
  }

  const f =
    forced(state.hand || []);

  if (
    f.length &&
    !f.includes(String(card))
  ) {
    toast(
      "Tu dois jouer la carte obligatoire."
    );

    return;
  }

  const n = Number(card);

  pendingAction = {
    card,
    targetId: null,
    extra: {}
  };

  /*
   * CARTES AVEC CIBLE
   */
  if (
    [1, 3, 9, 13, 17, 19]
      .includes(n)
  ) {
    const eligible =
      state.players.filter(
        p => p.id !== getPid()
      );

    showTargets(
      card,
      eligible
    );

    return;
  }

  /*
   * 11 / 21
   */
  if (
    n === 11 ||
    n === 21
  ) {
    const amount =
      n === 11
        ? 10
        : 20;

    const double =
      (state.hand || []).filter(
        c => String(c) === String(card)
      ).length >= 2;

    const plus =
      double
        ? amount * 2
        : amount;

    const minus =
      double
        ? amount * 2
        : amount;

    showOptions(
      `Carte ${card}`,
      `Choisis l'effet de la carte ${card}.`,
      [
        {
          label:
            `+${plus} points`,
          action: () =>
            submitPending({
              choice: "plus"
            })
        },
        {
          label:
            `−${minus} points`,
          action: () =>
            submitPending({
              choice: "minus"
            })
        }
      ]
    );

    return;
  }

  /*
   * JOKER
   */
  if (String(card) === "J") {
    showOptions(
      "Joker",
      "Choisis une des trois possibilités.",
      [
        {
          label: "+10 points",
          action: () =>
            submitPending({
              choice: "10"
            })
        },
        {
          label: "+22 points",
          action: () =>
            submitPending({
              choice: "22"
            })
        },
        {
          label:
            "Échanger tous tes points",
          action: () =>
            showTargets(
              card,
              state.players.filter(
                p => p.id !== getPid()
              ),
              "swap"
            )
        }
      ]
    );

    return;
  }

  /*
   * 15
   */
  if (n === 15) {
    if (!player.pile.length) {
      toast(
        "Tu n'as aucune carte de points à doubler."
      );

      pendingAction = null;

      return;
    }

    showPileChoice(
      player,
      "Choisis la carte de points à doubler.",
      false
    );

    return;
  }

  submitPending({});
}

/* =========================================================
   CIBLES
========================================================= */

function showTargets(
  card,
  players,
  mode = "target"
) {
  if (!players.length) {
    toast(
      "Aucune cible disponible."
    );

    pendingAction = null;

    return;
  }

  showOptions(
    `Carte ${card}`,
    "Choisis un adversaire.",
    players.map(p => ({
      label:
        `${p.name} — ${p.points} points • ${p.handCount} cartes`,

      action: () => {
        pendingAction.targetId =
          p.id;

        /*
         * 13 : choix précis d'une carte.
         */
        if (Number(card) === 13) {
          const target =
            state.players.find(
              x => x.id === p.id
            );

          if (
            !target?.pile?.length
          ) {
            toast(
              "Cet adversaire n'a aucune carte de points."
            );

            return;
          }

          showPileChoice(
            target,
            "Choisis la carte de points à voler.",
            true
          );

          return;
        }

        submitPending(
          mode === "swap"
            ? { choice: "swap" }
            : {}
        );
      }
    }))
  );
}

/* =========================================================
   CHOIX DANS UNE PILE
========================================================= */

function showPileChoice(
  player,
  text,
  forSteal
) {
  const pile =
    player.pile || [];

  if (!pile.length) {
    toast(
      "Aucune carte de points disponible."
    );

    return;
  }

  showOptions(
    "Choix de carte",
    text,
    pile.map((item, index) => ({
      label:
        `${index + 1}. ${item.card} — ${item.value} points`,

      action: () => {
        pendingAction.extra.index =
          index;

        submitPending({});
      }
    }))
  );
}

/* =========================================================
   MODALE
========================================================= */

function showOptions(
  title,
  text,
  options
) {
  $("choiceTitle").textContent =
    title;

  $("choiceText").textContent =
    text;

  $("choiceOptions").innerHTML =
    options
      .map(
        (option, index) => `
          <button
            class="choiceBtn"
            onclick="choicePick(${index})"
          >
            ${escapeHtml(option.label)}
          </button>
        `
      )
      .join("");

  window._choiceOptions =
    options;

  $("choiceModal")
    .classList
    .remove("hidden");
}

function choicePick(index) {
  const option =
    window._choiceOptions?.[index];

  if (option?.action) {
    option.action();
  }
}

function closeChoice() {
  $("choiceModal")
    .classList
    .add("hidden");

  window._choiceOptions = null;
  pendingAction = null;
}

function submitPending(extra) {
  if (!pendingAction) {
    return;
  }

  pendingAction.extra = {
    ...pendingAction.extra,
    ...extra
  };

  const payload = {
    type: "play",
    card: pendingAction.card,
    targetId:
      pendingAction.targetId,
    extra:
      pendingAction.extra
  };

  closeChoice();

  send(payload);
}

/* =========================================================
   OUTILS UI
========================================================= */

function art(card) {
  return `
    <img
      class="cardart"
      src="/cards/${encodeURIComponent(card)}.svg"
      alt="Carte ${escapeHtml(card)}"
    >
  `;
}

function toast(text) {
  const element =
    $("toast");

  if (!element) return;

  element.textContent =
    text;

  element.style.opacity = 1;

  clearTimeout(
    toast.timer
  );

  toast.timer =
    setTimeout(() => {
      element.style.opacity = 0;
    }, 2200);
}

function escapeHtml(value) {
  return String(value).replace(
    /[&<>"']/g,
    char => ({
      "&": "&amp;",
      "<": "&lt;",
      ">": "&gt;",
      '"': "&quot;",
      "'": "&#039;"
    })[char]
  );
}

/* =========================================================
   FERMETURE DE MODALE AVEC ECHAP
========================================================= */

document.addEventListener(
  "keydown",
  event => {
    if (
      event.key === "Escape" &&
      !$("choiceModal")
        .classList.contains("hidden")
    ) {
      closeChoice();
    }
  }
);

/* =========================================================
   DEMARRAGE
========================================================= */

console.log("APP JS CHARGE");
connect();
```
