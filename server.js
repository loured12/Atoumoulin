```javascript
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

/* =========================================================
   OUTILS
========================================================= */

function cardKey(card) {
  return String(card);
}

function shuffle(array) {
  const a = [...array];

  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }

  return a;
}

function makeDeck(players) {
  const copies =
    players <= 2 ? 2 :
    players === 3 ? 2 :
    players;

  const deck = [];

  for (let c = 0; c < copies; c++) {
    for (const id of CARD_IDS) {
      deck.push(id);
    }
  }

  return shuffle(deck);
}

function isPointCard(card) {
  return [
    2, 4, 6, 8, 10,
    12, 14, 16, 18, 20
  ].includes(Number(card));
}

function pointValue(card) {
  return Number(card);
}

function randomId() {
  return crypto.randomUUID();
}

/* =========================================================
   SALONS
========================================================= */

function newRoom(hostName, maxPlayers, rounds) {
  const code = crypto
    .randomBytes(3)
    .toString("hex")
    .toUpperCase();

  return {
    code,
    maxPlayers,
    rounds,

    round: 1,
    started: false,
    winner: null,

    players: [
      {
        id: randomId(),
        name: hostName,
        ws: null,
        bot: false,

        hand: [],
        points: 0,
        pile: [],
        skip: 0,

        roundWins: 0
      }
    ],

    deck: [],
    discard: [],
    turn: 0,
    target: TARGETS[maxPlayers] || 120,

    log: [],
    botTimer: null
  };
}

/* =========================================================
   ETAT PUBLIC
========================================================= */

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

    log: room.log.slice(-40),

    players: room.players.map(p => ({
      id: p.id,
      name: p.name,
      handCount: p.hand.length,
      points: p.points,
      pile: p.pile.slice(-12),
      skip: p.skip,
      bot: !!p.bot,
      roundWins: p.roundWins
    }))
  };
}

/* =========================================================
   COMMUNICATION
========================================================= */

function send(ws, type, payload = {}) {
  if (ws && ws.readyState === 1) {
    ws.send(
      JSON.stringify({
        type,
        ...payload
      })
    );
  }
}

function broadcast(room) {
  const base = publicState(room);

  for (const p of room.players) {
    send(p.ws, "state", {
      state: {
        ...base,
        hand: [...p.hand]
      }
    });
  }
}

function log(room, text) {
  room.log.push(text);
  room.log = room.log.slice(-40);
}

/* =========================================================
   JOUEUR / BOT
========================================================= */

function getPlayer(room, id) {
  return room.players.find(p => p.id === id);
}

function getCurrentPlayer(room) {
  return room.players[room.turn];
}

function isBot(player) {
  return !!player?.bot;
}

function addBot(room) {
  if (room.players.length >= room.maxPlayers) {
    throw new Error("Salon complet.");
  }

  const bot = {
    id: randomId(),
    name: "Bot Atoumoulin",
    ws: null,
    bot: true,

    hand: [],
    points: 0,
    pile: [],
    skip: 0,

    roundWins: 0
  };

  room.players.push(bot);

  log(room, "🤖 Le Bot Atoumoulin rejoint la partie.");

  return bot;
}

/* =========================================================
   FIN DE PARTIE / MANCHES
========================================================= */

function exactWinner(room) {
  return room.players.find(
    p => p.points === room.target
  ) || null;
}

function allHandsEmpty(room) {
  return room.players.every(
    p => p.hand.length === 0
  );
}

function finishRound(room) {
  const exact = exactWinner(room);

  if (exact) {
    exact.roundWins++;

    room.winner = {
      id: exact.id,
      name: exact.name,
      reason: "exact"
    };

    log(
      room,
      `${exact.name} atteint exactement ${room.target} points et remporte la manche.`
    );

    return true;
  }

  if (
    room.deck.length === 0 &&
    allHandsEmpty(room)
  ) {
    const best = Math.min(
      ...room.players.map(
        p => Math.abs(p.points - room.target)
      )
    );

    const winners = room.players.filter(
      p => Math.abs(p.points - room.target) === best
    );

    if (winners.length === 1) {
      winners[0].roundWins++;

      room.winner = {
        id: winners[0].id,
        name: winners[0].name,
        reason: "closest"
      };

      log(
        room,
        `${winners[0].name} est le plus proche de ${room.target}.`
      );
    } else {
      room.winner = {
        id: null,
        name: null,
        reason: "draw"
      };

      log(
        room,
        "Partie nulle : plusieurs joueurs sont à égale distance."
      );
    }

    return true;
  }

  return false;
}

function finishMatch(room) {
  const requiredWins = room.rounds;

  const winner = room.players.find(
    p => p.roundWins >= requiredWins
  );

  if (winner) {
    room.started = false;

    room.winner = {
      id: winner.id,
      name: winner.name,
      reason: "match"
    };

    log(
      room,
      `🏆 ${winner.name} remporte la partie avec ${winner.roundWins} manche(s) gagnée(s) !`
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

  room.target =
    TARGETS[room.players.length] ||
    TARGETS[room.maxPlayers] ||
    120;

  for (const p of room.players) {
    p.hand = [];
    p.points = 0;
    p.pile = [];
    p.skip = 0;
  }

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
    `🎴 Manche ${room.round}/${room.rounds} commencée. Objectif : ${room.target} points.`
  );

  broadcast(room);
  maybeBotTurn(room);
}

function endRound(room) {
  room.started = false;

  broadcast(room);

  if (finishMatch(room)) {
    broadcast(room);
    return;
  }

  if (room.round >= room.rounds) {
    /*
     * Même si aucune personne n'a atteint le nombre
     * de manches demandé, on désigne le meilleur.
     */
    const best = Math.max(
      ...room.players.map(p => p.roundWins)
    );

    const winners = room.players.filter(
      p => p.roundWins === best
    );

    if (winners.length === 1) {
      room.winner = {
        id: winners[0].id,
        name: winners[0].name,
        reason: "match"
      };

      log(
        room,
        `🏆 ${winners[0].name} remporte la partie !`
      );
    } else {
      room.winner = {
        id: null,
        name: null,
        reason: "draw"
      };

      log(room, "🏆 Partie nulle.");
    }

    broadcast(room);
    return;
  }

  room.round++;

  setTimeout(() => {
    if (!rooms.has(room.code)) return;
    startRound(room);
  }, 1800);
}

/* =========================================================
   TOURS
========================================================= */

function nextTurn(room) {
  const n = room.players.length;

  for (let i = 1; i <= n; i++) {
    const idx = (room.turn + i) % n;
    const p = room.players[idx];

    if (!p || p.hand.length === 0) {
      continue;
    }

    room.turn = idx;

    if (p.skip > 0) {
      p.skip--;

      log(
        room,
        `${p.name} passe son tour.`
      );

      continue;
    }

    return p;
  }

  return null;
}

/* =========================================================
   CARTES
========================================================= */

function counts(hand) {
  const map = new Map();

  for (const card of hand) {
    const key = cardKey(card);

    map.set(
      key,
      (map.get(key) || 0) + 1
    );
  }

  return map;
}

function forcedSet(player) {
  const c = counts(player.hand);

  if (c.has("7")) {
    return ["7"];
  }

  for (const [key, count] of c) {
    if (count >= 2) {
      return [key];
    }
  }

  return [];
}

function removeOne(hand, id) {
  const index = hand.findIndex(
    c => cardKey(c) === cardKey(id)
  );

  if (index < 0) return false;

  hand.splice(index, 1);
  return true;
}

function removeDouble(hand, id) {
  const first = removeOne(hand, id);

  if (!first) return false;

  const second = removeOne(hand, id);

  if (!second) {
    hand.push(id);
    return false;
  }

  return true;
}

/* =========================================================
   PILES
========================================================= */

function addPileCard(
  player,
  card,
  value = null,
  attachments = []
) {
  const item = {
    card,
    value:
      value === null
        ? pointValue(card)
        : value,

    attachments: [...attachments]
  };

  player.pile.push(item);
  player.points += item.value;

  return item;
}

function recalculatePoints(player) {
  player.points = player.pile.reduce(
    (sum, item) => sum + item.value,
    0
  );
}

function stealPoint(from, to, index = -1) {
  if (!from.pile.length) {
    return null;
  }

  let idx = index;

  if (idx < 0) {
    idx = from.pile.length - 1;
  }

  if (
    idx < 0 ||
    idx >= from.pile.length
  ) {
    return null;
  }

  const item = from.pile.splice(idx, 1)[0];

  from.points -= item.value;

  to.pile.push(item);
  to.points += item.value;

  return item;
}

/* =========================================================
   APPLICATION DES CARTES
========================================================= */

function applyCard(
  room,
  actor,
  card,
  targetId = null,
  extra = {}
) {
  const target = getPlayer(room, targetId);
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
    room.discard.push(1);

    if (target) {
      const item = stealPoint(target, actor);

      log(
        room,
        item
          ? `${actor.name} vole la dernière carte de points de ${target.name}.`
          : `${actor.name} joue 1, mais ${target.name} n'a aucune carte de points.`
      );
    }

    return;
  }

  if (n === 3) {
    room.discard.push(3);

    if (target) {
      target.points = Math.max(
        0,
        target.points - 20
      );

      log(
        room,
        `${actor.name} retire 20 points à ${target.name}.`
      );
    }

    return;
  }

  if (n === 5) {
    room.discard.push(5);

    const draws = extra.double ? 4 : 2;
    let drawn = 0;

    for (
      let i = 0;
      i < draws && room.deck.length;
      i++
    ) {
      actor.hand.push(room.deck.pop());
      drawn++;
    }

    log(
      room,
      `${actor.name} joue ${extra.double ? "double " : ""}5 et pioche ${drawn} carte(s).`
    );

    return;
  }

  if (n === 7) {
    room.discard.push(7);

    const value = extra.double ? 40 : 20;

    actor.points += value;

    log(
      room,
      `${actor.name} joue ${extra.double ? "double " : ""}7 et gagne ${value} points.`
    );

    return;
  }

  if (n === 9) {
    room.discard.push(9);

    if (target) {
      [actor.hand, target.hand] =
        [target.hand, actor.hand];

      log(
        room,
        `${actor.name} échange sa main avec ${target.name}.`
      );
    }

    return;
  }

  if (n === 11) {
    room.discard.push(11);

    const value =
      extra.choice === "minus"
        ? -(extra.double ? 20 : 10)
        : (extra.double ? 20 : 10);

    actor.points = Math.max(
      0,
      actor.points + value
    );

    log(
      room,
      `${actor.name} applique ${value > 0 ? "+" : ""}${value} avec ${extra.double ? "double " : ""}11.`
    );

    return;
  }

  if (n === 13) {
    room.discard.push(13);

    if (target) {
      const item = stealPoint(
        target,
        actor,
        Number.isInteger(extra.index)
          ? extra.index
          : -1
      );

      log(
        room,
        item
          ? `${actor.name} vole une carte de points à ${target.name}.`
          : `${actor.name} joue 13 mais ne vole aucune carte.`
      );
    }

    return;
  }

  if (n === 15) {
    room.discard.push(15);

    const idx =
      Number.isInteger(extra.index)
        ? extra.index
        : actor.pile.length - 1;

    const item = actor.pile[idx];

    if (item) {
      const oldValue = item.value;

      item.value *= extra.double ? 4 : 2;

      actor.points +=
        item.value - oldValue;

      item.attachments.push(
        ...(extra.double
          ? ["15", "15"]
          : ["15"])
      );

      log(
        room,
        `${actor.name} ${extra.double ? "quadruple" : "double"} une carte de points.`
      );
    }

    return;
  }

  if (n === 17) {
    room.discard.push(17);

    const count = extra.double ? 2 : 1;

    for (let i = 0; i < count; i++) {
      if (!target || !target.hand.length) {
        break;
      }

      const index = Math.floor(
        Math.random() * target.hand.length
      );

      const stolen =
        target.hand.splice(index, 1)[0];

      applyCard(
        room,
        actor,
        stolen,
        null,
        {}
      );
    }

    return;
  }

  if (n === 19) {
    room.discard.push(19);

    if (target) {
      const amount = extra.double ? 2 : 1;

      for (let k = 0; k < amount; k++) {
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

      recalculatePoints(actor);
      recalculatePoints(target);

      log(
        room,
        `${actor.name} échange ${amount} carte(s) de points avec ${target.name}.`
      );
    }

    return;
  }

  if (n === 21) {
    room.discard.push(21);

    const value =
      extra.choice === "minus"
        ? -(extra.double ? 40 : 20)
        : (extra.double ? 40 : 20);

    actor.points = Math.max(
      0,
      actor.points + value
    );

    log(
      room,
      `${actor.name} applique ${value > 0 ? "+" : ""}${value} avec ${extra.double ? "double " : ""}21.`
    );

    return;
  }

  if (String(card) === "J") {
    room.discard.push("J");

    if (extra.choice === "swap") {
      if (target) {
        [
          actor.points,
          target.points
        ] = [
          target.points,
          actor.points
        ];

        log(
          room,
          `${actor.name} échange tous ses points avec ${target.name}.`
        );
      }
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

    return;
  }
}

/* =========================================================
   JOUER UNE CARTE
========================================================= */

function play(
  room,
  player,
  card,
  targetId,
  extra = {}
) {
  if (!room.started) {
    throw new Error("Partie inactive.");
  }

  const forced = forcedSet(player);

  if (
    forced.length &&
    !forced.includes(cardKey(card))
  ) {
    throw new Error(
      "Une carte obligatoire doit être jouée en priorité."
    );
  }

  const count =
    player.hand.filter(
      c => cardKey(c) === cardKey(card)
    ).length;

  if (count <= 0) {
    throw new Error("Carte absente de la main.");
  }

  const isDouble =
    count >= 2 &&
    extra.forceDouble !== false;

  if (isDouble) {
    if (!removeDouble(player.hand, card)) {
      throw new Error("Impossible de jouer la paire.");
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

  /*
   * Pioche normale.
   */
  if (
    Number(card) !== 7 &&
    Number(card) !== 5 &&
    !(String(card) === "J" && isDouble) &&
    room.deck.length > 0
  ) {
    player.hand.push(room.deck.pop());
  }

  /*
   * Double Joker : deux tours sautés.
   */
  if (
    String(card) === "J" &&
    isDouble
  ) {
    player.skip += 2;
  }

  if (finishRound(room)) {
    endRound(room);
    return;
  }

  nextTurn(room);

  broadcast(room);

  maybeBotTurn(room);
}

/* =========================================================
   BOT
========================================================= */

function chooseBotTarget(room, bot, card) {
  const opponents = room.players.filter(
    p => p.id !== bot.id &&
         (p.hand.length || p.pile.length || p.points > 0)
  );

  if (!opponents.length) {
    return null;
  }

  /*
   * Pour les cartes offensives, le bot vise
   * généralement le joueur ayant le plus de points.
   */
  opponents.sort(
    (a, b) => b.points - a.points
  );

  return opponents[0];
}

function chooseBotCard(bot) {
  const forced = forcedSet(bot);

  if (forced.length) {
    return forced[0];
  }

  /*
   * Priorité aux cartes de points.
   */
  const pointCards = bot.hand
    .filter(isPointCard)
    .sort(
      (a, b) => Number(b) - Number(a)
    );

  if (pointCards.length) {
    return pointCards[0];
  }

  /*
   * Sinon cartes offensives.
   */
  const preferred = [
    "7", "5", "17", "13",
    "15", "1", "21", "11",
    "9", "19", "3", "J"
  ];

  for (const wanted of preferred) {
    const found = bot.hand.find(
      c => String(c) === wanted
    );

    if (found !== undefined) {
      return found;
    }
  }

  return bot.hand[0];
}

function botPlay(room) {
  if (!room.started) return;

  const bot = getCurrentPlayer(room);

  if (!bot || !bot.bot) return;

  if (!bot.hand.length) {
    nextTurn(room);
    broadcast(room);
    maybeBotTurn(room);
    return;
  }

  try {
    const card = chooseBotCard(bot);
    const n = Number(card);

    let target = null;
    let extra = {};

    if (
      [1, 3, 9, 13, 17, 19].includes(n) ||
      String(card) === "J"
    ) {
      target = chooseBotTarget(
        room,
        bot,
        card
      );
    }

    if (n === 11 || n === 21) {
      /*
       * Le bot choisit généralement le bonus.
       * S'il est très haut, il préfère retirer des points
       * à lui-même uniquement si nécessaire.
       */
      extra.choice = "plus";
    }

    if (n === 13 && target?.pile.length) {
      extra.index =
        target.pile.length - 1;
    }

    if (n === 15 && bot.pile.length) {
      extra.index =
        bot.pile.reduce(
          (best, item, index) =>
            item.value > bot.pile[best].value
              ? index
              : best,
          0
        );
    }

    if (String(card) === "J") {
      /*
       * Si le bot est proche de l'objectif,
       * il choisit +22.
       * Sinon +10.
       */
      if (
        bot.points < room.target &&
        room.target - bot.points <= 22
      ) {
        extra.choice = "22";
      } else {
        extra.choice = "10";
      }
    }

    play(
      room,
      bot,
      card,
      target?.id || null,
      extra
    );
  } catch (error) {
    console.error("Erreur bot :", error);

    /*
     * Sécurité pour éviter un bot bloqué.
     */
    if (bot.hand.length) {
      try {
        play(
          room,
          bot,
          bot.hand[0],
          null,
          {}
        );
      } catch {
        nextTurn(room);
        broadcast(room);
      }
    }
  }
}

function maybeBotTurn(room) {
  if (!room.started) return;

  const current = getCurrentPlayer(room);

  if (!current?.bot) {
    return;
  }

  clearTimeout(room.botTimer);

  room.botTimer = setTimeout(() => {
    botPlay(room);
  }, 900);
}

/* =========================================================
   WEBSOCKET
========================================================= */

wss.on("connection", ws => {
  ws.on("message", raw => {
    try {
      const msg =
        JSON.parse(raw.toString());

      /* =====================================================
         CREER
      ===================================================== */

      if (msg.type === "create") {
        const maxPlayers = Math.min(
          8,
          Math.max(
            2,
            Number(msg.maxPlayers) || 2
          )
        );

        const rounds =
          Number(msg.rounds) || 1;

        const name =
          String(
            msg.name || "Joueur"
          ).slice(0, 18);

        const room = newRoom(
          name,
          maxPlayers,
          rounds
        );

        const host = room.players[0];

        host.ws = ws;

        ws.room = room.code;
        ws.pid = host.id;

        rooms.set(
          room.code,
          room
        );

        send(ws, "room", {
          code: room.code,
          pid: ws.pid
        });

        broadcast(room);

        return;
      }

      /* =====================================================
         SOLO
      ===================================================== */

      if (msg.type === "solo") {
        const name =
          String(
            msg.name || "Joueur"
          ).slice(0, 18);

        const room = newRoom(
          name,
          2,
          1
        );

        const host = room.players[0];

        host.ws = ws;

        ws.room = room.code;
        ws.pid = host.id;

        rooms.set(
          room.code,
          room
        );

        addBot(room);

        send(ws, "room", {
          code: room.code,
          pid: ws.pid
        });

        broadcast(room);

        /*
         * Le mode solo démarre immédiatement.
         */
        startRound(room);

        return;
      }

      /* =====================================================
         REJOINDRE
      ===================================================== */

      if (msg.type === "join") {
        const code =
          String(
            msg.code || ""
          )
          .trim()
          .toUpperCase();

        const room = rooms.get(code);

        if (!room) {
          throw new Error(
            "Salon introuvable."
          );
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
          throw new Error(
            "Salon complet."
          );
        }

        const player = {
          id: randomId(),

          name: String(
            msg.name || "Joueur"
          ).slice(0, 18),

          ws,

          bot: false,

          hand: [],
          points: 0,
          pile: [],
          skip: 0,

          roundWins: 0
        };

        room.players.push(player);

        ws.room = room.code;
        ws.pid = player.id;

        send(ws, "room", {
          code: room.code,
          pid: ws.pid
        });

        broadcast(room);

        return;
      }

      /* =====================================================
         LANCER
      ===================================================== */

      if (msg.type === "start") {
        const room =
          rooms.get(ws.room);

        if (!room) {
          throw new Error(
            "Salon introuvable."
          );
        }

        if (
          room.players[0]?.id !==
          ws.pid
        ) {
          throw new Error(
            "Seul l'hôte peut lancer la partie."
          );
        }

        if (room.started) {
          throw new Error(
            "La partie est déjà commencée."
          );
        }

        if (room.players.length < 2) {
          throw new Error(
            "Il faut au moins 2 joueurs."
          );
        }

        startRound(room);
        return;
      }

      /* =====================================================
         JOUER
      ===================================================== */

      if (msg.type === "play") {
        const room =
          rooms.get(ws.room);

        if (
          !room ||
          !room.started
        ) {
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

        const current =
          room.players[room.turn];

        if (!current) {
          throw new Error(
            "Tour introuvable."
          );
        }

        if (current.id !== player.id) {
          throw new Error(
            "Ce n'est pas votre tour."
          );
        }

        if (player.hand.length === 0) {
          throw new Error(
            "Vous n'avez plus de cartes."
          );
        }

        /*
         * Un bot ne peut jamais être piloté
         * par un client.
         */
        if (player.bot) {
          throw new Error(
            "Ce joueur est un bot."
          );
        }

        play(
          room,
          player,
          msg.card,
          msg.targetId || null,
          msg.extra || {}
        );

        return;
      }

      /* =====================================================
         LOG
      ===================================================== */

      if (msg.type === "log") {
        const room =
          rooms.get(ws.room);

        send(ws, "log", {
          log: room?.log || []
        });

        return;
      }

    } catch (error) {
      console.error(error);

      send(ws, "error", {
        message:
          error?.message ||
          "Erreur serveur."
      });
    }
  });

  /* =======================================================
     DECONNEXION
  ======================================================= */

  ws.on("close", () => {
    const room =
      rooms.get(ws.room);

    if (!room) return;

    const player =
      room.players.find(
        p => p.id === ws.pid
      );

    if (player) {
      player.ws = null;

      log(
        room,
        `${player.name} est déconnecté.`
      );

      broadcast(room);
    }
  });
});

/* =========================================================
   SERVEUR
========================================================= */

server.listen(
  PORT,
  () => {
    console.log(
      `Atoumoulin listening on http://localhost:${PORT}`
    );
  }
);
```
