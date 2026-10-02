import http from "node:http";
import crypto from "node:crypto";
import { WebSocketServer } from "ws";
import { AtoumoulinEngine } from "./engine.js";
import { validateAction } from "./action-schema.js";

const PORT = Number(process.env.PORT || 3000);
const rooms = new Map();

const id = () =>
  crypto.randomBytes(8).toString("hex");

const makeCode = () => {
  const chars = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  let c;

  do {
    c = Array.from(
      { length: 6 },
      () => chars[Math.floor(Math.random() * chars.length)]
    ).join("");
  } while (rooms.has(c));

  return c;
};

const name = n =>
  String(n || "Joueur").trim().slice(0, 24) || "Joueur";

function nomUnique(room, nomBase) {
  const nomsPris = [
    ...room.players,
    ...room.spectators
  ].map(p => String(p.name || "").toLowerCase());

  let nom = nomBase;
  let numero = 2;

  while (nomsPris.includes(nom.toLowerCase())) {
    nom = `${nomBase} ${numero}`;
    numero++;
  }

  return nom;
}

const send = (ws, m) => {
  if (ws?.readyState === 1) {
    ws.send(JSON.stringify(m));
  }
};

const broadcast = (r, m) => {
  r.players.forEach(p => {
    send(p.ws, m);
  });

  r.spectators.forEach(p => {
    send(p.ws, m);
  });
};

const fail = (ws, m) =>
  send(ws, {
    type: "error",
    message: m
  });

function roomCreate(n, max) {
  const r = {
    code: makeCode(),
    seq: 0,
    maxPlayers: 8,
    started: false,
    hostId: null,
    players: [],
    spectators: [],
    engine: null,
    mode: 1,
    chatMessages: []
  };

  const p = {
    id: id(),
    token: id(),
    name: name(n),
    bot: false,
    connected: true,
    ws: null,
    index: 0,
    selection: null
  };

  r.players.push(p);
  r.hostId = p.id;
  rooms.set(r.code, r);

  return [r, p];
}

function view(r) {
  return {
    code: r.code,
    maxPlayers: r.maxPlayers,
    started: r.started,
    hostId: r.hostId,
    mode: r.mode,

    players: r.players.map(p => ({
      id: p.id,
      name: p.name,
      bot: p.bot,
      connected: p.connected
    })),

    spectators: r.spectators.map(p => ({
      id: p.id,
      name: p.name,
      connected: p.connected
    }))
  };
}

function publicState(r, p) {
  const special =
    r.engine.getDouble9MultiplayerState?.(
      p.index,
      p?.selection ?? null
    );

  if (special !== null && special !== undefined) {
    return special;
  }

  return r.engine.stateFor(
    p.index,
    p?.selection ?? null
  );
}

function sendState(r) {
  const seq = ++r.seq;

  r.players.forEach(p => {
    if (p.ws) {
      send(p.ws, {
        type: "game:state",
        seq,
        playerIndex: p.index,
        state: publicState(r, p)
      });
    }
  });

  r.spectators.forEach(p => {
    if (!p.ws || !r.engine) {
      return;
    }

    send(p.ws, {
      type: "game:state",
      seq,
      playerIndex: -1,
      state: publicState(r, {
        index: -1,
        selection: []
      })
    });
  });
}

function lobby(r) {
  broadcast(r, {
    type: "lobby:update",
    room: view(r)
  });
}

function runBots(r) {
  if (!r.engine) {
    return;
  }

  for (let i = 0; i < 32; i++) {
    const idx = r.engine.currentIndex();
    const p = r.players[idx];

    if (!p || !p.bot) {
      break;
    }

    const before =
      JSON.stringify(r.engine.stateFor(idx));

    r.engine.runBotTurn(idx);

    const after =
      JSON.stringify(r.engine.stateFor(idx));

    if (before === after) {
      break;
    }
  }

  sendState(r);
}

/*
 * ---------------------------------------------------------
 * VALIDATION SERVEUR DES ACTIONS MULTIJOUEUR
 * ---------------------------------------------------------
 *
 * Cette fonction ne modifie jamais la partie.
 *
 * Elle vérifie uniquement que l'action demandée est
 * cohérente avec l'état actuel du moteur.
 */
function validerActionMultijoueur(
  room,
  player,
  fn,
  args,
  state
) {
  /*
   * Les actions qui correspondent à une sélection
   * d'adversaire.
   */
  const actionsAvecCible = new Set([
    "choisirAdversaireVol1",
    "choisirAdversaireCarte3",
    "choisirAdversaireCarte9",
    "choisirAdversaireCarte13",
    "choisirAdversaireCarte17",
    "choisirAdversaireCarte19",
    "choisirAdversaireDouble1",
    "choisirAdversaireDouble3",
    "choisirAdversaireDouble9",
    "choisirAdversaireDouble13",
    "choisirAdversaireDouble17",
    "choisirAdversaireDouble19"
  ]);

  /*
   * Correspondance entre une action réseau et l'état
   * dans lequel cette action est réellement attendue.
   */
  const actionsCibles = {
    choisirAdversaireVol1: {
      actions: ["vol1"],
      besoin: "points"
    },

    choisirAdversaireCarte3: {
      actions: ["carte3"],
      besoin: "aucun"
    },

    choisirAdversaireCarte9: {
      actions: ["carte9"],
      besoin: "aucun"
    },

    choisirAdversaireCarte13: {
      actions: ["carte13"],
      besoin: "points"
    },

    choisirAdversaireCarte17: {
      actions: ["carte17"],
      besoin: "main"
    },

    choisirAdversaireCarte19: {
      actions: ["carte19"],
      besoin: "points"
    },

    choisirAdversaireDouble1: {
      actions: ["double1"],
      besoin: "points"
    },

    choisirAdversaireDouble3: {
      actions: ["double3"],
      besoin: "aucun"
    },

    choisirAdversaireDouble9: {
      actions: ["double9"],
      besoin: "aucun"
    },

    choisirAdversaireDouble13: {
      actions: ["double13"],
      besoin: "points"
    },

    choisirAdversaireDouble17: {
      actions: ["double17"],
      besoin: "main"
    },

    choisirAdversaireDouble19: {
      actions: ["double19"],
      besoin: "points"
    }
  };

  /*
   * -------------------------------------------------------
   * ACTIONS AVEC CIBLE
   * -------------------------------------------------------
   */

  if (actionsAvecCible.has(fn)) {
    if (args.length !== 1) {
      throw Error("Cible invalide.");
    }

    const cibleIndex = Number(args[0]);

    if (
      !Number.isInteger(cibleIndex) ||
      cibleIndex < 0 ||
      cibleIndex >= room.players.length
    ) {
      throw Error("Cible invalide.");
    }

    if (cibleIndex === player.index) {
      throw Error(
        "Vous ne pouvez pas vous cibler vous-même."
      );
    }

    if (!room.players[cibleIndex]) {
      throw Error("Cible invalide.");
    }

    const regleCible = actionsCibles[fn];

    if (!regleCible) {
      throw Error("Action de ciblage invalide.");
    }

    /*
     * Le pouvoir correspondant doit être actuellement actif.
     */
    if (!regleCible.actions.includes(state.action)) {
      throw Error(
        "Cette cible n'est pas autorisée à ce moment."
      );
    }

    const cibleState = state.players[cibleIndex];

    if (!cibleState) {
      throw Error("Cible invalide.");
    }

    /*
     * Pouvoirs volant une carte à points.
     */
    if (regleCible.besoin === "points") {
      const cartesPoints = state.table.filter(carte =>
        carte &&
        carte.proprietaire === cibleState.name &&
        typeof carte.valeur === "number" &&
        carte.valeur !== 0
      );

      if (cartesPoints.length === 0) {
        throw Error(
          "Cette cible ne possède aucune carte à points."
        );
      }
    }

    /*
     * 17 / Double 17 :
     * la cible doit avoir au moins une carte en main.
     */
    if (regleCible.besoin === "main") {
      if (cibleState.cardCount <= 0) {
        throw Error(
          "Cette cible n'a aucune carte en main."
        );
      }
    }

    return;
  }

  /*
   * -------------------------------------------------------
   * ACTIONS SANS CIBLE
   * -------------------------------------------------------
   *
   * Chaque action intermédiaire est autorisée uniquement
   * dans l'état où le moteur l'attend.
   */

  const actionsParEtat = {
    effetCarte11: ["carte11"],
    effetCarte21: ["carte21"],
    effetDouble11: ["double11"],
    effetDouble21: ["double21"],
    effetJoker: ["joker"],

    volerCarte13: ["carte13"],
    doublerCarte15: ["carte15"],
    triplerCarte15: ["double15"],

    continuerCarte17: ["carte17"],

    choisirCarteDouble17: ["double17"],
    continuerDouble17: ["double17"],

    effectuerEchangeDouble19: ["double19"],

    cibleCarte21: ["carte21"],
    cibleDouble21: ["double21"],

    echangeJoker: ["joker"]
  };

  if (Object.prototype.hasOwnProperty.call(actionsParEtat, fn)) {
    const etatsAutorises = actionsParEtat[fn];

    if (!etatsAutorises.includes(state.action)) {
      throw Error(
        "Cette action n'est pas autorisée à ce moment."
      );
    }
  }

  /*
   * Les actions qui terminent directement un pouvoir
   * doivent elles aussi correspondre à leur état.
   */
  if (fn === "terminer17SansCarte") {
    if (
      state.action !== "carte17" &&
      state.action !== "double17"
    ) {
      throw Error(
        "Cette action n'est pas autorisée à ce moment."
      );
    }
  }

  /*
   * préparer une nouvelle manche est traité séparément
   * dans server.js.
   */
}

const httpServer = http.createServer((req, res) => {
  res.writeHead(200, {
    "content-type": "application/json; charset=utf-8"
  });

  res.end(
    JSON.stringify({
      ok: true,
      service: "Atoumoulin multiplayer"
    })
  );
});

const wss = new WebSocketServer({
  server: httpServer
});

setInterval(() => {
  for (const ws of wss.clients) {
    if (ws.isAlive === false) {
      ws.terminate();
      continue;
    }

    ws.isAlive = false;
    ws.ping();
  }
}, 30000);

wss.on("connection", ws => {
  ws.isAlive = true;

  ws.on("pong", () => {
    ws.isAlive = true;
  });

  let room = null;
  let player = null;

  send(ws, {
    type: "connected"
  });

  ws.on("message", raw => {
    let m;

    try {
      m = JSON.parse(raw.toString());
    } catch {
      return fail(ws, "Message invalide.");
    }

    try {
      if (m.type === "room:create") {
        if (room) {
          throw Error(
            "Vous êtes déjà dans un salon."
          );
        }

        [room, player] = roomCreate(
          m.name,
          m.maxPlayers
        );

        player.ws = ws;

        send(ws, {
          type: "room:created",
          playerId: player.id,
          token: player.token,
          room: view(room)
        });

        lobby(room);
        return;
      }

      if (m.type === "room:join") {
        if (room) {
          throw Error(
            "Vous êtes déjà dans un salon."
          );
        }

        const wanted = rooms.get(
          String(m.code || "")
            .trim()
            .toUpperCase()
        );

        if (!wanted) {
          throw Error("Salon introuvable.");
        }

        /*
         * ---------------------------------------------------
         * RECONNEXION JOUEUR
         * ---------------------------------------------------
         */

        const existing = wanted.players.find(
          p =>
            m.playerId &&
            m.token &&
            p.id === m.playerId &&
            p.token === m.token
        );

        const existingSpectator =
          wanted.spectators.find(
            p =>
              m.playerId &&
              m.token &&
              p.id === m.playerId &&
              p.token === m.token
          );

        if (existing) {
          if (
            existing.ws &&
            existing.ws !== ws
          ) {
            try {
              existing.ws.close();
            } catch {}
          }

          room = wanted;
          player = existing;

          player.ws = ws;
          player.connected = true;
          player.bot = false;

          if (room.engine) {
            room.engine.setBot(
              player.index,
              false
            );
          }

          send(ws, {
            type: "room:reconnected",
            playerId: player.id,
            token: player.token,
            room: view(room)
          });

          room.chatMessages.forEach(message => {
            send(ws, {
              type: "chat:message",
              message
            });
          });

          if (room.engine) {
            sendState(room);
          }

          lobby(room);
          return;
        }

        if (existingSpectator) {
          if (
            existingSpectator.ws &&
            existingSpectator.ws !== ws
          ) {
            try {
              existingSpectator.ws.close();
            } catch {}
          }

          room = wanted;
          player = existingSpectator;

          player.ws = ws;
          player.connected = true;

          send(ws, {
            type: "room:reconnected",
            playerId: player.id,
            token: player.token,
            spectator: true,
            room: view(room)
          });

          room.chatMessages.forEach(message => {
            send(ws, {
              type: "chat:message",
              message
            });
          });

          if (room.engine) {
            sendState(room);
          }

          lobby(room);
          return;
        }

        room = wanted;

        /*
         * ---------------------------------------------------
         * NOUVEAU JOUEUR
         * ---------------------------------------------------
         */

        if (
          !room.started &&
          room.players.length < 8
        ) {
          player = {
            id: id(),
            token: id(),
            name: nomUnique(
              room,
              name(m.name)
            ),
            bot: false,
            connected: true,
            ws,
            index: room.players.length,
            selection: null
          };

          room.players.push(player);

          send(ws, {
            type: "room:joined",
            playerId: player.id,
            token: player.token,
            room: view(room)
          });
        } else {
          const spectator = {
            id: id(),
            token: id(),
            name: nomUnique(
              room,
              name(m.name)
            ),
            bot: false,
            connected: true,
            ws
          };

          room.spectators.push(spectator);

          send(ws, {
            type: "room:joined",
            playerId: spectator.id,
            token: spectator.token,
            spectator: true,
            room: view(room)
          });
        }

        lobby(room);
        return;
      }

      if (!room || !player) {
        throw Error(
          "Rejoignez d'abord un salon."
        );
      }

      /*
       * -----------------------------------------------------
       * CHAT
       * -----------------------------------------------------
       */

      if (m.type === "chat:send") {
        const t = String(m.text || "")
          .trim()
          .slice(0, 300);

        if (!t) {
          return;
        }

        const message = {
          playerName: player.name,
          text: t,
          at: Date.now()
        };

        room.chatMessages.push(message);

        broadcast(room, {
          type: "chat:message",
          message
        });

        return;
      }

      /*
       * -----------------------------------------------------
       * START
       * -----------------------------------------------------
       */

      if (m.type === "room:start") {
        if (player.id !== room.hostId) {
          throw Error(
            "Seul l'hôte peut lancer la partie."
          );
        }

        const nombreJoueurs = Math.max(
          2,
          Math.min(
            8,
            Number(m.players) ||
              room.players.length
          )
        );

        const nombreBots = Math.max(
          0,
          Math.min(
            nombreJoueurs -
              room.players.length,
            Number(m.bots) || 0
          )
        );

        if (
          room.players.length >
          nombreJoueurs
        ) {
          throw Error(
            `Il y a déjà ${room.players.length} joueurs humains dans le salon.`
          );
        }

        room.mode =
          Number(m.mode) || 1;

        room.botLevel =
          m.botLevel || "facile";

        for (
          let i = 0;
          i < nombreBots;
          i++
        ) {
          room.players.push({
            id: id(),
            token: id(),
            name: `Bot ${i + 1}`,
            bot: true,
            connected: true,
            ws: null,
            index: room.players.length,
            selection: null
          });
        }

        /*
         * Seul le deuxième humain change
         * de position, comme dans ton code original.
         */
        if (room.players.length > 1) {
          const deuxiemeHumain =
            room.players[1];

          const position =
            1 +
            Math.floor(
              Math.random() *
              (room.players.length - 1)
            );

          room.players.splice(
            1,
            1
          );

          room.players.splice(
            position,
            0,
            deuxiemeHumain
          );
        }

        room.players.forEach((p, i) => {
          p.index = i;
          p.selection = null;
        });

        room.started = true;

        room.engine =
          new AtoumoulinEngine(
            room.players.map(
              p => p.name
            ),
            room.players.map(
              p => p.bot
            ),
            room.mode,
            room.botLevel
          );

        broadcast(room, {
          type: "game:start",
          room: view(room)
        });

        runBots(room);

        sendState(room);
        lobby(room);

        return;
      }

      /*
       * -----------------------------------------------------
       * SÉLECTION
       * -----------------------------------------------------
       */

      if (m.type === "game:select") {
        if (!room.started) {
          throw Error(
            "La partie n'a pas commencé."
          );
        }

        if (
          room.spectators.some(
            p => p.id === player.id
          )
        ) {
          throw Error(
            "Vous êtes spectateur."
          );
        }

        if (
          player.index !==
          room.engine.currentIndex()
        ) {
          throw Error(
            "Ce n'est pas votre tour."
          );
        }

        const state =
          room.engine.stateFor(
            player.index
          );

        const selection =
          m.selection;

        /*
         * DOUBLE 13
         */

        if (
          state.action ===
          "double13choix"
        ) {
          if (!Array.isArray(selection)) {
            throw Error(
              "Sélection Double 13 invalide."
            );
          }

          if (
            selection.length < 1 ||
            selection.length > 2
          ) {
            throw Error(
              "Le Double 13 permet de sélectionner 1 ou 2 cartes."
            );
          }

          const indices =
            selection.map(Number);

          if (
            indices.some(
              i =>
                !Number.isInteger(i)
            ) ||
            new Set(indices).size !==
              indices.length
          ) {
            throw Error(
              "Sélection Double 13 invalide."
            );
          }

          const cibleIndex =
            Number(state.target);

          if (
            !Number.isInteger(
              cibleIndex
            ) ||
            !state.players[cibleIndex]
          ) {
            throw Error(
              "Cible Double 13 invalide."
            );
          }

          const cibleNom =
            state.players[
              cibleIndex
            ].name;

          for (
            const index of indices
          ) {
            const carte =
              state.table[index];

            if (!carte) {
              throw Error(
                "Carte Double 13 invalide."
              );
            }

            if (
              carte.proprietaire !==
              cibleNom
            ) {
              throw Error(
                "Cette carte n'appartient pas à la cible."
              );
            }

            if (
              Number(carte.valeur) === 0
            ) {
              throw Error(
                "Cette carte ne peut pas être volée avec le Double 13."
              );
            }
          }

          room.engine.setSelection(
            indices
          );

          player.selection =
            indices;

          sendState(room);
          return;
        }

        /*
         * Sélection de cartes en main.
         */

        if (Array.isArray(selection)) {
          if (selection.length !== 2) {
            throw Error(
              "Une sélection multiple doit contenir exactement 2 cartes."
            );
          }

          const main =
            state.players[
              player.index
            ]?.main || [];

          const indices =
            selection.map(Number);

          if (
            indices.some(
              i =>
                !Number.isInteger(i) ||
                i < 0 ||
                i >= main.length
            ) ||
            new Set(indices).size !==
              indices.length
          ) {
            throw Error(
              "Sélection de cartes invalide."
            );
          }

          if (
            main[indices[0]] !==
            main[indices[1]]
          ) {
            throw Error(
              "Les deux cartes doivent être identiques."
            );
          }

          room.engine.setSelection(
            indices
          );

          player.selection =
            indices;
        } else {
          const idx =
            Number(selection);

          const main =
            state.players[
              player.index
            ]?.main || [];

          if (
            !Number.isInteger(idx) ||
            idx < 0 ||
            idx >= main.length
          ) {
            throw Error(
              "Sélection invalide."
            );
          }

          room.engine.selectCard(
            idx,
            player.index
          );

          player.selection =
            room.engine.stateFor(
              player.index
            ).selection;
        }

        sendState(room);
        return;
      }

      /*
       * -----------------------------------------------------
       * ACTION
       * -----------------------------------------------------
       */

      if (m.type === "game:action") {
        if (!room.started) {
          throw Error(
            "La partie n'a pas commencé."
          );
        }

        if (
          room.spectators.some(
            p => p.id === player.id
          )
        ) {
          throw Error(
            "Vous êtes spectateur."
          );
        }

        const fn =
          String(m.fn || "");

        const validation =
          validateAction({
            action: fn,
            args:
              Array.isArray(m.args)
                ? m.args
                : []
          });

        if (!validation.ok) {
          throw Error(
            validation.error
          );
        }

        const args =
          Array.isArray(m.args)
            ? m.args.slice(0, 3)
            : [];

        /*
         * ---------------------------------------------------
         * NOUVELLE PARTIE
         * ---------------------------------------------------
         */

        if (
          fn ===
          "nouvellePartieMultijoueur"
        ) {
          if (
            player.id !==
            room.hostId
          ) {
            throw Error(
              "Seul l'hôte peut lancer une nouvelle partie."
            );
          }

          const nouveauMode =
            Number(args[0]) ||
            room.mode ||
            1;

          const nouveauNiveau =
            String(
              args[2] ||
                room.botLevel ||
                "facile"
            );

          const joueursHumains =
            room.players.filter(
              p => !p.bot
            );

          const spectateursDisponibles =
            room.spectators.slice();

          const nombreHumains =
            joueursHumains.length;

          const nombreJoueurs =
            Math.max(
              2,
              Math.min(
                8,
                Number(args[1]) ||
                  nombreHumains
              )
            );

          if (
            nombreJoueurs <
            nombreHumains
          ) {
            throw Error(
              `Le nombre de joueurs ne peut pas être inférieur à ${nombreHumains}.`
            );
          }

          const nombreSpectateurs =
            Math.min(
              spectateursDisponibles.length,
              nombreJoueurs -
                nombreHumains
            );

          const nombreBots =
            nombreJoueurs -
            nombreHumains -
            nombreSpectateurs;

          room.players =
            joueursHumains.slice();

          for (
            let i = 0;
            i < nombreSpectateurs;
            i++
          ) {
            const spectateur =
              spectateursDisponibles[i];

            room.spectators =
              room.spectators.filter(
                p =>
                  p.id !==
                  spectateur.id
              );

            spectateur.bot = false;
            spectateur.connected =
              !!spectateur.ws;
            spectateur.selection =
              null;
            spectateur.index =
              room.players.length;

            room.players.push(
              spectateur
            );
          }

          for (
            let i = 0;
            i < nombreBots;
            i++
          ) {
            room.players.push({
              id: id(),
              token: id(),
              name: `Bot ${i + 1}`,
              bot: true,
              connected: true,
              ws: null,
              index:
                room.players.length,
              selection: null
            });
          }

          if (
            room.players.length > 1
          ) {
            const deuxiemeHumain =
              room.players[1];

            const position =
              1 +
              Math.floor(
                Math.random() *
                (room.players.length - 1)
              );

            room.players.splice(
              1,
              1
            );

            room.players.splice(
              position,
              0,
              deuxiemeHumain
            );
          }

          room.players.forEach(
            (p, i) => {
              p.index = i;
              p.selection = null;
            }
          );

          room.mode =
            nouveauMode;

          room.botLevel =
            nouveauNiveau;

          room.engine =
            new AtoumoulinEngine(
              room.players.map(
                p => p.name
              ),
              room.players.map(
                p => p.bot
              ),
              room.mode,
              room.botLevel
            );

          broadcast(room, {
            type: "game:start",
            room: view(room)
          });

          runBots(room);

          sendState(room);
          lobby(room);

          return;
        }

        /*
         * ---------------------------------------------------
         * NOUVELLE MANCHE
         * ---------------------------------------------------
         */

        if (
          fn ===
          "preparerNouvelleManche"
        ) {
          if (
            player.id !==
            room.hostId
          ) {
            throw Error(
              "Seul l'hôte peut lancer une nouvelle manche."
            );
          }

          const nouveauMode =
            Number(args[0]) ||
            room.mode ||
            1;

          room.mode =
            nouveauMode;

          room.engine.apply(
            "preparerNouvelleManche",
            [nouveauMode]
          );

          sendState(room);
          return;
        }

        /*
         * Toutes les autres actions nécessitent
         * le tour du joueur.
         */

        if (
          player.index !==
          room.engine.currentIndex()
        ) {
          throw Error(
            "Ce n'est pas votre tour."
          );
        }

        /*
         * jouerCarte utilise la sélection
         * déjà validée par game:select.
         */
        if (fn === "jouerCarte") {
          if (
            player.selection === null ||
            player.selection === undefined
          ) {
            throw Error(
              "Aucune carte sélectionnée."
            );
          }

          room.engine.setSelection(
            player.selection
          );
        }

        room.engine.setPlayerIndex(
          player.index
        );

        /*
         * Récupération de l'état AVANT
         * d'exécuter l'action.
         */
        const state =
          room.engine.stateFor(
            player.index
          );

        /*
         * Validation centrale.
         */
        validerActionMultijoueur(
          room,
          player,
          fn,
          args,
          state
        );

        /*
         * Exécution uniquement après
         * toutes les validations.
         */
        room.engine.apply(
          fn,
          fn === "jouerCarte"
            ? []
            : args
        );

        player.selection = null;

        const stateApres =
          room.engine.stateFor(
            player.index
          );

        /*
         * Manche terminée.
         */
        if (stateApres.roundEnded) {
          sendState(room);
          return;
        }

        /*
         * Partie gagnée.
         */
        if (stateApres.winner) {
          sendState(room);
          return;
        }

        runBots(room);

        sendState(room);

        return;
      }
    } catch (e) {
      console.error(
        e.stack || e
      );

      fail(
        ws,
        e.message ||
          "Erreur serveur."
      );
    }
  });

  ws.on("close", () => {
    if (!room || !player) {
      return;
    }

    /*
     * Si ce n'est plus la connexion actuelle
     * du joueur, on ne touche pas à son état.
     */
    if (player.ws !== ws) {
      return;
    }

    player.ws = null;
    player.connected = false;

    if (
      room.spectators.some(
        p => p.id === player.id
      )
    ) {
      room.spectators =
        room.spectators.filter(
          p => p !== player
        );

      lobby(room);
      return;
    }

    if (room.started) {
      player.bot = true;

      room.engine.setBot(
        player.index,
        true
      );

      broadcast(room, {
        type: "player:bot",
        name: player.name
      });

      runBots(room);
    } else {
      room.players =
        room.players.filter(
          p => p !== player
        );

      room.players.forEach(
        (p, i) => {
          p.index = i;
        }
      );

      lobby(room);
    }
  });
});

httpServer.listen(
  PORT,
  "0.0.0.0",
  () =>
    console.log(
      `Atoumoulin server listening on ${PORT}`
    )
);
