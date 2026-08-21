import express from "express";
import http from "http";
import { WebSocketServer } from "ws";
import crypto from "crypto";

const app = express();
const server = http.createServer(app);
const wss = new WebSocketServer({ server });

app.use(express.static("public"));

const PORT = process.env.PORT || 3000;
const rooms = new Map();

const TARGETS = {
  2: 120,
  3: 120,
  4: 180,
  5: 240,
  6: 300,
  7: 360,
  8: 420
};

const CARD_IDS = [
  ...Array.from({ length: 21 }, (_, i) => i + 1),
  "J"
];

function makeDeck(players) {
  const copies = players === 2 ? 2 : players === 3 ? 2 : players;
  const deck = [];

  for (let c = 0; c < copies; c++) {
    for (const id of CARD_IDS) {
      deck.push(id);
    }
  }

  return shuffle(deck);
}

function shuffle(a) {
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

function cardKey(c) {
  return String(c);
}

function isPointCard(c) {
  return [2, 4, 6, 8, 10, 12, 14, 16, 18, 20].includes(Number(c));
}

function newRoom(hostName, maxPlayers, rounds) {
  const code = crypto.randomBytes(3).toString("hex").toUpperCase();

  return {
    code,
    maxPlayers,
    rounds,
    round: 1,
    started: false,
    winner: null,
    players: [
      {
        id: crypto.randomUUID(),
        name: hostName,
        ws: null,
        isBot: false,
        hand: [],
        points: 0,
        pile: [],
        skip: 0
      }
    ],
    deck: [],
    discard: [],
    turn: 0,
    target: TARGETS[maxPlayers] || 120,
    log: []
  };
}

function publicState(room) {
  return {
    code: room.code,
    started: room.started,
    winner: room.winner,
    round: room.round,
    rounds: room.rounds,
    target: room.target,
    turn: room.turn,
    deckCount: room.deck.length,
    discard: room.discard.slice(-12),
    players: room.players.map(p => ({
      id: p.id,
      name: p.name,
      handCount: p.hand.length,
      points: p.points,
      pile: p.pile.slice(-12),
      skip: p.skip,
      isBot: !!p.isBot
    }))
  };
}

function send(ws, type, payload = {}) {
  if (ws?.readyState === 1) {
    ws.send(JSON.stringify({ type, ...payload }));
  }
}

function broadcast(room) {
  const base = publicState(room);

  for (const p of room.players) {
    if (p.ws) {
      send(p.ws, "state", {
        state: {
          ...base,
          hand: p.hand
        }
      });
    }
  }
}

function log(room, text) {
  room.log.push(text);
  room.log = room.log.slice(-40);
}

function exactWinner(room) {
  return room.players.find(p => p.points === room.target) || null;
}

function allHandsEmpty(room) {
  return room.players.every(p => p.hand.length === 0);
}

function finishIfNeeded(room) {
  const exact = exactWinner(room);

  if (exact) {
    room.winner = {
      id: exact.id,
      name: exact.name,
      reason: "exact"
    };
    room.started = false;
    log(
      room,
      `${exact.name} atteint exactement ${room.target} points et gagne !`
    );
    return true;
  }

  if (room.deck.length === 0 && allHandsEmpty(room)) {
    const best = Math.min(
      ...room.players.map(p => Math.abs(p.points - room.target))
    );

    const winners = room.players.filter(
      p => Math.abs(p.points - room.target) === best
    );

    if (winners.length === 1) {
      room.winner = {
        id: winners[0].id,
        name: winners[0].name,
        reason: "closest"
      };
    } else {
      room.winner = {
        id: null,
        name: null,
        reason: "draw"
      };
    }

    room.started = false;

    log(
      room,
      winners.length === 1
        ? `${winners[0].name} est le plus proche de ${room.target}.`
        : "Partie nulle."
    );

    return true;
  }

  return false;
}

function startRound(room) {
  room.deck = makeDeck(room.players.length);
  room.discard = [];
  room.turn = 0;
  room.winner = null;
  room.target = TARGETS[room.players.length] || 120;

  room.players.forEach(p => {
    p.hand = [];
    p.points = 0;
    p.pile = [];
    p.skip = 0;
  });

  // 4 cartes par joueur
  for (let i = 0; i < 4; i++) {
    for (const p of room.players) {
      if (room.deck.length) {
        p.hand.push(room.deck.pop());
      }
    }
  }

  room.started = true;

  log(
    room,
    `Manche ${room.round} commencée. Objectif : ${room.target} points.`
  );

  broadcast(room);

  scheduleBotTurn(room);
}

function nextTurn(room) {
  const n = room.players.length;

  for (let i = 1; i <= n; i++) {
    const idx = (room.turn + i) % n;
    const p = room.players[idx];

    if (p.hand.length > 0) {
      room.turn = idx;

      if (p.skip > 0) {
        p.skip--;
        log(room, `${p.name} passe son tour.`);
        return nextTurn(room);
      }

      return;
    }
  }
}

function counts(hand) {
  const m = new Map();

  for (const c of hand) {
    m.set(
      cardKey(c),
      (m.get(cardKey(c)) || 0) + 1
    );
  }

  return m;
}

function forcedSet(p) {
  const c = counts(p.hand);

  // Le 7 est prioritaire.
  if (c.has("7")) {
    return ["7"];
  }

  for (const [k, n] of c) {
    if (n >= 2) {
      return [k];
    }
  }

  return null;
}

function removeOne(hand, id) {
  const i = hand.findIndex(
    c => cardKey(c) === cardKey(id)
  );

  if (i < 0) return false;

  hand.splice(i, 1);
  return true;
}

function removeDouble(hand, id) {
  return removeOne(hand, id) && removeOne(hand, id);
}

function pointValue(card) {
  return Number(card);
}

function addPileCard(p, card, value = null, attachments = []) {
  const item = {
    card,
    value: value === null ? pointValue(card) : value,
    attachments: [...attachments]
  };

  p.pile.push(item);
  p.points += item.value;

  return item;
}

function stealPoint(from, to, index = -1) {
  if (!from.pile.length) return null;

  const idx =
    index < 0
      ? from.pile.length - 1
      : index;

  if (!from.pile[idx]) return null;

  const item = from.pile.splice(idx, 1)[0];

  from.points -= item.value;
  to.pile.push(item);
  to.points += item.value;

  return item;
}

function applyCard(
  room,
  actor,
  card,
  targetId = null,
  extra = {}
) {
  const target = room.players.find(
    p => p.id === targetId
  );

  const n = Number(card);

  if (isPointCard(card)) {
    const item = addPileCard(actor, card);

    log(
      room,
      `${actor.name} joue ${card} et marque ${item.value} points.`
    );

    return;
  }

  if (n === 1) {
    if (target) {
      const item = stealPoint(target, actor);

      log(
        room,
        item
          ? `${actor.name} vole la dernière carte de points de ${target.name}.`
          : `${actor.name} joue 1 mais ${target.name} n'a aucune carte de points.`
      );
    }

    return;
  }

  if (n === 3) {
    if (target) {
      target.points -= 20;

      log(
        room,
        `${actor.name} retire 20 points à ${target.name}.`
      );
    }

    room.discard.push(3);
    return;
  }

  if (n === 5) {
    room.discard.push(5);

    const draws = extra.double ? 4 : 2;

    for (
      let i = 0;
      i < draws && room.deck.length;
      i++
    ) {
      actor.hand.push(room.deck.pop());
    }

    log(
      room,
      `${actor.name} joue ${extra.double ? "double " : ""}5 et pioche ${draws} cartes.`
    );

    return;
  }

  if (n === 7) {
    room.discard.push(7);

    const value = extra.double ? 40 : 20;

    actor.points += value;

    log(
      room,
      `${actor.name} joue ${extra.double ? "double " : ""}7 et gagne ${value} points sans piocher.`
    );

    return;
  }

  if (n === 9) {
    room.discard.push(9);

    if (target) {
      [actor.hand, target.hand] = [
        target.hand,
        actor.hand
      ];

      log(
        room,
        `${actor.name} échange sa main avec ${target.name}.`
      );
    }

    return;
  }

  if (n === 11) {
    room.discard.push(11);

    const delta =
      extra.choice === "minus"
        ? -(extra.double ? 20 : 10)
        : extra.double
          ? 20
          : 10;

    actor.points += delta;

    log(
      room,
      `${actor.name} applique ${delta > 0 ? "+" : ""}${delta} avec ${extra.double ? "double " : ""}11.`
    );

    return;
  }

  if (n === 13) {
    room.discard.push(13);

    if (target) {
      const item = stealPoint(
        target,
        actor,
        extra.index ?? -1
      );

      log(
        room,
        item
          ? `${actor.name} vole une carte de points à ${target.name}.`
          : `${actor.name} joue 13 mais ${target.name} n'a aucune carte de points.`
      );
    }

    return;
  }

  if (n === 15) {
    room.discard.push(15);

    const idx =
      extra.index ?? (actor.pile.length - 1);

    const item = actor.pile[idx];

    if (item) {
      const oldValue = item.value;
      const multiplier = extra.double ? 4 : 2;

      item.value *= multiplier;
      item.attachments.push(
        ...(extra.double
          ? ["15", "15"]
          : ["15"])
      );

      actor.points +=
        item.value - oldValue;

      log(
        room,
        `${actor.name} double la valeur d'une carte de points.`
      );
    }

    return;
  }

  if (n === 17) {
    room.discard.push(17);

    const count = extra.double ? 2 : 1;

    for (let i = 0; i < count; i++) {
      if (!target || !target.hand.length) break;

      const idx = Math.floor(
        Math.random() * target.hand.length
      );

      const stolen =
        target.hand.splice(idx, 1)[0];

      applyCard(
        room,
        actor,
        stolen,
        null,
        {},
        "17"
      );
    }

    return;
  }

  if (n === 19) {
    room.discard.push(19);

    if (target) {
      const count = extra.double ? 2 : 1;

      for (let k = 0; k < count; k++) {
        const ai = actor.pile.length - 1 - k;
        const bi = target.pile.length - 1 - k;

        if (ai >= 0 && bi >= 0) {
          [
            actor.pile[ai],
            target.pile[bi]
          ] = [
            target.pile[bi],
            actor.pile[ai]
          ];
        }
      }

      actor.points = actor.pile.reduce(
        (s, x) => s + x.value,
        0
      );

      target.points = target.pile.reduce(
        (s, x) => s + x.value,
        0
      );

      log(
        room,
        `${actor.name} échange ${count} carte(s) de points avec ${target.name}.`
      );
    }

    return;
  }

  if (n === 21) {
    room.discard.push(21);

    const delta =
      extra.choice === "minus"
        ? -(extra.double ? 40 : 20)
        : extra.double
          ? 40
          : 20;

    actor.points += delta;

    log(
      room,
      `${actor.name} applique ${delta > 0 ? "+" : ""}${delta} avec ${extra.double ? "double " : ""}21.`
    );

    return;
  }

  if (card === "J") {
    room.discard.push("J");

    if (extra.choice === "swap" && target) {
      const a = actor.points;
      actor.points = target.points;
      target.points = a;

      log(
        room,
        `${actor.name} échange tous ses points avec ${target.name}.`
      );
    } else {
      const value =
        extra.choice === "22"
          ? 22
          : 10;

      actor.points += value;

      log(
        room,
        `${actor.name} choisit +${value} avec le Joker.`
      );
    }
  }
}

function play(
  room,
  player,
  card,
  targetId,
  extra = {}
) {
  const forced = forcedSet(player);

  if (
    forced &&
    !forced.includes(cardKey(card))
  ) {
    throw new Error(
      "Une carte obligatoire doit être jouée en priorité."
    );
  }

  const count = player.hand.filter(
    c => cardKey(c) === cardKey(card)
  ).length;

  const isDouble =
    count >= 2 &&
    extra.forceDouble !== false;

  if (isDouble) {
    if (!removeDouble(player.hand, card)) {
      throw new Error("Carte absente de la main.");
    }
  } else {
    if (!removeOne(player.hand, card)) {
      throw new Error("Carte absente de la main.");
    }
  }

  applyCard(
    room,
    player,
    card,
    targetId,
    {
      ...extra,
      double: isDouble
    }
  );

  // 7 : aucune pioche
  // 5 : pioche déjà effectuée
  // sinon : une carte
  if (
    Number(card) !== 7 &&
    Number(card) !== 5 &&
    room.deck.length
  ) {
    player.hand.push(room.deck.pop());
  }

  // Double Joker : passe les deux prochains tours.
  if (card === "J" && isDouble) {
    player.skip += 2;
  }

  if (finishIfNeeded(room)) {
    broadcast(room);
    return;
  }

  nextTurn(room);

  broadcast(room);

  scheduleBotTurn(room);
}

function chooseBotMove(room, bot) {
  const forced = forcedSet(bot);

  let card;

  if (forced?.length) {
    card = forced[0];
  } else {
    // Priorité aux cartes de points.
    const pointCards = bot.hand.filter(
      c => isPointCard(c)
    );

    if (pointCards.length) {
      card = pointCards.sort(
        (a, b) => Number(b) - Number(a)
      )[0];
    } else {
      card = bot.hand[0];
    }
  }

  const opponents = room.players.filter(
    p => p.id !== bot.id
  );

  let targetId = null;
  let extra = {};

  const n = Number(card);

  if (
    [1, 3, 9, 13, 17, 19].includes(n) &&
    opponents.length
  ) {
    // Pour le bot, on cible l'adversaire.
    targetId = opponents[0].id;

    if (n === 13) {
      const target = opponents[0];

      if (target.pile.length) {
        extra.index =
          target.pile.length - 1;
      }
    }
  }

  if (n === 11 || n === 21) {
    extra.choice = "plus";
  }

  if (card === "J") {
    extra.choice = "22";
  }

  if (n === 15) {
    if (bot.pile.length) {
      extra.index = bot.pile.length - 1;
    }
  }

  return {
    card,
    targetId,
    extra
  };
}

function scheduleBotTurn(room) {
  if (!room.started) return;

  const player = room.players[room.turn];

  if (!player?.isBot) return;

  setTimeout(() => {
    if (!room.started) return;

    const bot = room.players[room.turn];

    if (!bot?.isBot || !bot.hand.length) return;

    try {
      const move = chooseBotMove(room, bot);

      play(
        room,
        bot,
        move.card,
        move.targetId,
        move.extra
      );
    } catch (e) {
      console.error("Erreur bot:", e);

      if (room.started) {
        nextTurn(room);
        broadcast(room);
        scheduleBotTurn(room);
      }
    }
  }, 700);
}

function createSoloRoom(ws, name, rounds) {
  const room = newRoom(
    name,
    2,
    rounds
  );

  room.players[0].ws = ws;

  ws.room = room.code;
  ws.pid = room.players[0].id;

  const bot = {
    id: crypto.randomUUID(),
    name: "Bot 🤖",
    ws: null,
    isBot: true,
    hand: [],
    points: 0,
    pile: [],
    skip: 0
  };

  room.players.push(bot);

  rooms.set(room.code, room);

  send(ws, "room", {
    code: room.code,
    pid: ws.pid
  });

  startRound(room);
}

wss.on("connection", ws => {
  ws.on("message", raw => {
    try {
      const msg = JSON.parse(raw);

      if (msg.type === "create") {
        const room = newRoom(
          (msg.name || "Joueur").slice(0, 18),
          Number(msg.maxPlayers) || 2,
          Number(msg.rounds) || 1
        );

        room.players[0].ws = ws;

        ws.room = room.code;
        ws.pid = room.players[0].id;

        rooms.set(room.code, room);

        send(ws, "room", {
          code: room.code,
          pid: ws.pid
        });

        broadcast(room);
      }

      else if (msg.type === "createSolo") {
        createSoloRoom(
          ws,
          (msg.name || "Joueur").slice(0, 18),
          Number(msg.rounds) || 1
        );
      }

      else if (msg.type === "join") {
        const room = rooms.get(
          String(msg.code || "").toUpperCase()
        );

        if (!room) {
          throw new Error("Salon introuvable.");
        }

        if (room.started) {
          throw new Error(
            "La partie a déjà commencé."
          );
        }

        if (
          room.players.length >=
          room.maxPlayers
        ) {
          throw new Error("Salon complet.");
        }

        const p = {
          id: crypto.randomUUID(),
          name: (msg.name || "Joueur").slice(0, 18),
          ws,
          isBot: false,
          hand: [],
          points: 0,
          pile: [],
          skip: 0
        };

        room.players.push(p);

        ws.room = room.code;
        ws.pid = p.id;

        send(ws, "room", {
          code: room.code,
          pid: ws.pid
        });

        broadcast(room);
      }

      else if (msg.type === "start") {
        const room = rooms.get(ws.room);

        if (!room) {
          throw new Error(
            "Salon introuvable."
          );
        }

        if (
          room.players[0].id !==
          ws.pid
        ) {
          throw new Error(
            "Seul l'hôte peut lancer la partie."
          );
        }

        if (room.players.length < 2) {
          throw new Error(
            "Il faut au moins 2 joueurs."
          );
        }

        startRound(room);
      }

      else if (msg.type === "play") {
        const room = rooms.get(ws.room);

        if (!room || !room.started) {
          throw new Error(
            "Partie inactive."
          );
        }

        const player =
          room.players.find(
            p => p.id === ws.pid
          );

        if (!player) {
          throw new Error(
            "Joueur introuvable."
          );
        }

        if (
          room.players[room.turn].id !==
          player.id
        ) {
          throw new Error(
            "Ce n'est pas votre tour."
          );
        }

        if (!player.hand.length) {
          throw new Error(
            "Vous n'avez plus de cartes."
          );
        }

        play(
          room,
          player,
          msg.card,
          msg.targetId,
          msg.extra || {}
        );
      }

      else if (msg.type === "log") {
        send(ws, "log", {
          log:
            rooms.get(ws.room)?.log || []
        });
      }

    } catch (e) {
      send(ws, "error", {
        message:
          e.message || "Erreur inconnue"
      });
    }
  });

  ws.on("close", () => {
    // Les joueurs peuvent rester dans le salon
    // jusqu'à la fin de la partie.
  });
});

server.listen(PORT, () => {
  console.log(
    `Atoumoulin listening on http://localhost:${PORT}`
  );
});
