let ws = null;
let state = null;
let pendingAction = null;

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
  19: "Échange la dernière carte",
  21: "+20 ou −20",
  J: "10 / 22 / échange les points"
};

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
    (location.protocol === "https:" ? "wss://" : "ws://") +
    location.host
  );

  ws.onopen = () => {
    toast("Connecté");
  };

  ws.onmessage = e => {
    const m = JSON.parse(e.data);

    if (m.type === "room") {
      ws.pid = m.pid;

      if ($("roomBadge")) {
        $("roomBadge").textContent =
          "Salon " + m.code;
      }
    }

    if (m.type === "state") {
      state = m.state;
      render();
    }

    if (m.type === "error") {
      toast(m.message);
    }
  };

  ws.onclose = () => {
    ws = null;
  };
}

function send(o) {
  if (
    ws &&
    ws.readyState === WebSocket.OPEN
  ) {
    ws.send(JSON.stringify(o));
  }
}

function waitForConnection(callback) {
  connect();

  const timer = setInterval(() => {
    if (
      ws &&
      ws.readyState === WebSocket.OPEN
    ) {
      clearInterval(timer);
      callback();
    }
  }, 30);

  setTimeout(() => {
    clearInterval(timer);
  }, 10000);
}

function createRoom() {
  waitForConnection(() => {
    send({
      type: "create",
      name:
        $("createName").value ||
        "Joueur",
      maxPlayers:
        Number($("maxPlayers").value) || 2,
      rounds:
        Number($("rounds").value) || 1
    });
  });
}

function createSolo() {
  waitForConnection(() => {
    send({
      type: "createSolo",
      name:
        $("createName").value ||
        "Joueur",
      rounds:
        Number($("rounds").value) || 1
    });
  });
}

function joinRoom() {
  waitForConnection(() => {
    send({
      type: "join",
      name:
        $("joinName").value ||
        "Joueur",
      code:
        $("joinCode").value.trim()
    });
  });
}

function startGame() {
  send({
    type: "start"
  });
}

function forced(hand) {
  const c = {};

  hand.forEach(x => {
    c[x] = (c[x] || 0) + 1;
  });

  if (c["7"]) {
    return ["7"];
  }

  for (const k in c) {
    if (c[k] >= 2) {
      return [k];
    }
  }

  return [];
}

function render() {
  if (!state) return;

  const lobby = $("lobby");
  const game = $("game");

  if (lobby) {
    lobby.classList.toggle(
      "hidden",
      !!state
    );
  }

  if (game) {
    game.classList.toggle(
      "hidden",
      !state
    );
  }

  $("target").textContent =
    `Objectif : ${state.target}`;

  const me =
    state.players.find(
      p => p.id === getPid()
    );

  $("startBtn").classList.toggle(
    "hidden",
    state.started ||
    !isHost()
  );

  $("status").textContent =
    state.winner
      ? (
        state.winner.reason === "draw"
          ? "Partie nulle"
          : `${state.winner.name} gagne !`
      )
      : state.started
        ? `Tour de ${state.players[state.turn]?.name || ""}`
        : "En attente des joueurs";

  $("players").innerHTML =
    state.players
      .map(p => `
        <div class="player ${
          p.id === state.players[state.turn]?.id
            ? "active"
            : ""
        } ${
          p.id === getPid()
            ? "me"
            : ""
        }">
          <b>${escapeHtml(p.name)}</b>
          <div class="score">${p.points}</div>
          <div>${p.handCount} carte(s) en main</div>
          <div class="pile">
            ${p.pile.map(x => `
              <div class="mini" title="${x.value}">
                ${escapeHtml(x.card)}
              </div>
            `).join("")}
          </div>
        </div>
      `)
      .join("");

  $("discardCards").innerHTML =
    state.discard
      .slice(-3)
      .map(c => `<span>${escapeHtml(c)}</span>`)
      .join(" ");

  $("deck").innerHTML =
    `🂠<small>${state.deckCount} cartes</small>`;

  $("handCount").textContent =
    me
      ? `(${me.hand.length})`
      : "";

  const hand = state.hand || [];
  const f = forced(hand);

  $("hand").innerHTML =
    hand
      .map(c => {
        const isF =
          f.includes(String(c));

        return `
          <button
            type="button"
            class="card ${isF ? "forced" : ""}"
            onclick="chooseCard('${escapeHtml(c)}')"
          >
            ${art(c)}
            ${
              isF
                ? '<span class="badge">OBLIGATOIRE</span>'
                : ""
            }
          </button>
        `;
      })
      .join("");
}

function chooseCard(card) {
  if (!state?.started) {
    return;
  }

  const me =
    state.players.find(
      p => p.id === getPid()
    );

  if (!me) {
    toast("Joueur introuvable.");
    return;
  }

  if (
    state.players[state.turn]?.id !==
    getPid()
  ) {
    toast("Ce n'est pas ton tour.");
    return;
  }

  const f = forced(
    state.hand || []
  );

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

  if (
    [1, 3, 9, 13, 17, 19].includes(n)
  ) {
    const eligible =
      state.players.filter(
        p => p.id !== getPid()
      );

    return showTargets(
      card,
      eligible
    );
  }

  if ([11, 21].includes(n)) {
    const vals =
      n === 11
        ? ["+10 pour toi", "−10 pour toi"]
        : ["+20 pour toi", "−20 pour toi"];

    return showOptions(
      `Carte ${card}`,
      `Choisis l'effet de la carte ${card}.`,
      [
        {
          label: vals[0],
          action: () =>
            submitPending({
              choice: "plus"
            })
        },
        {
          label: vals[1],
          action: () =>
            submitPending({
              choice: "minus"
            })
        }
      ]
    );
  }

  if (card === "J") {
    return showOptions(
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
  }

  if (n === 15) {
    if (!me.pile.length) {
      toast(
        "Tu n'as aucune carte de points à doubler."
      );
      pendingAction = null;
      return;
    }

    return showPileChoice(
      me,
      "Choisis la carte de points à doubler."
    );
  }

  submitPending({});
}

function showTargets(
  card,
  players,
  mode = "target"
) {
  if (!players.length) {
    toast("Aucune cible disponible.");
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
        pendingAction.targetId = p.id;

        if (Number(card) === 13) {
          const target =
            state.players.find(
              x => x.id === p.id
            );

          if (!target?.pile.length) {
            toast(
              "Cet adversaire n'a aucune carte de points."
            );
            return;
          }

          return showPileChoice(
            target,
            "Choisis la carte de points à voler."
          );
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

function showPileChoice(
  player,
  text
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
    pile.map((item, i) => ({
      label:
        `${i + 1}. ${item.card} — ${item.value} points`,
      action: () => {
        pendingAction.extra.index = i;
        submitPending({});
      }
    }))
  );
}

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
        (o, i) =>
          `<button type="button" class="choiceBtn" onclick="choicePick(${i})">${escapeHtml(o.label)}</button>`
      )
      .join("");

  window._choiceOptions =
    options;

  $("choiceModal")
    .classList.remove("hidden");
}

function choicePick(i) {
  const option =
    window._choiceOptions?.[i];

  if (option?.action) {
    option.action();
  }
}

function closeChoice() {
  $("choiceModal")
    .classList.add("hidden");

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
    extra: pendingAction.extra
  };

  closeChoice();
  send(payload);
}

function isHost() {
  return (
    state?.players?.[0]?.id ===
    getPid()
  );
}

function getPid() {
  return ws?.pid || "";
}

function art(c) {
  return `
    <img
      class="cardart"
      src="/cards/${encodeURIComponent(c)}.svg"
      alt="Carte ${escapeHtml(c)}"
    >
  `;
}

function toast(t) {
  const x = $("toast");

  if (!x) return;

  x.textContent = t;
  x.style.opacity = 1;

  setTimeout(() => {
    x.style.opacity = 0;
  }, 2200);
}

function escapeHtml(s) {
  return String(s).replace(
    /[&<>"']/g,
    m => ({
      "&": "&amp;",
      "<": "&lt;",
      ">": "&gt;",
      '"': "&quot;",
      "'": "&#39;"
    }[m])
  );
}
