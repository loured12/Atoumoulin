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
  2:120,
  3:120,
  4:180,
  5:240,
  6:300,
  7:360,
  8:420
};

const CARD_IDS = [
  ...Array.from({length:21},(_,i)=>i+1),
  "J"
];

/* =========================
   OUTILS
========================= */

function cardKey(c){
  return String(c);
}

function shuffle(array){
  const a=[...array];

  for(let i=a.length-1;i>0;i--){
    const j=Math.floor(Math.random()*(i+1));
    [a[i],a[j]]=[a[j],a[i]];
  }

  return a;
}

function makeDeck(players){
  const copies=
    players===2 ? 2 :
    players===3 ? 2 :
    players;

  const deck=[];

  for(let c=0;c<copies;c++){
    for(const id of CARD_IDS){
      deck.push(id);
    }
  }

  return shuffle(deck);
}

function isPointCard(card){
  return [
    2,4,6,8,10,
    12,14,16,18,20
  ].includes(Number(card));
}

function pointValue(card){
  return Number(card);
}

/* =========================
   SALONS
========================= */

function newRoom(hostName,maxPlayers,rounds){

  const code=crypto
    .randomBytes(3)
    .toString("hex")
    .toUpperCase();

  return {
    code,
    maxPlayers,
    rounds,

    round:1,
    started:false,
    winner:null,

    players:[
      {
        id:crypto.randomUUID(),
        name:hostName,
        ws:null,
        hand:[],
        points:0,
        pile:[],
        skip:0
      }
    ],

    deck:[],
    discard:[],
    turn:0,

    target:TARGETS[maxPlayers] || 120,

    log:[]
  };
}

/* =========================
   ETAT PUBLIC
========================= */

function publicState(room){

  return {
    code:room.code,

    started:room.started,
    winner:room.winner,

    round:room.round,
    rounds:room.rounds,

    target:room.target,
    turn:room.turn,

    deckCount:room.deck.length,

    discard:room.discard.slice(-12),

    players:room.players.map(p=>({
      id:p.id,
      name:p.name,
      handCount:p.hand.length,
      points:p.points,
      pile:p.pile.slice(-12),
      skip:p.skip
    }))
  };
}

/* =========================
   COMMUNICATION
========================= */

function send(ws,type,payload={}){

  if(
    ws &&
    ws.readyState===1
  ){
    ws.send(
      JSON.stringify({
        type,
        ...payload
      })
    );
  }
}

function broadcast(room){

  const base=publicState(room);

  for(const p of room.players){

    send(
      p.ws,
      "state",
      {
        state:{
          ...base,

          /*
           * IMPORTANT :
           * Chaque joueur reçoit uniquement
           * sa propre main.
           */
          hand:[...p.hand]
        }
      }
    );
  }
}

function log(room,text){

  room.log.push(text);

  room.log=
    room.log.slice(-40);
}

/* =========================
   FIN DE PARTIE
========================= */

function exactWinner(room){

  return room.players.find(
    p=>p.points===room.target
  ) || null;
}

function allHandsEmpty(room){

  return room.players.every(
    p=>p.hand.length===0
  );
}

function finishIfNeeded(room){

  const exact=exactWinner(room);

  if(exact){

    room.winner={
      id:exact.id,
      name:exact.name,
      reason:"exact"
    };

    room.started=false;

    log(
      room,
      `${exact.name} atteint exactement ${room.target} points et gagne !`
    );

    return true;
  }

  if(
    room.deck.length===0 &&
    allHandsEmpty(room)
  ){

    const best=Math.min(
      ...room.players.map(
        p=>Math.abs(p.points-room.target)
      )
    );

    const winners=room.players.filter(
      p=>Math.abs(p.points-room.target)===best
    );

    if(winners.length===1){

      room.winner={
        id:winners[0].id,
        name:winners[0].name,
        reason:"closest"
      };

      log(
        room,
        `${winners[0].name} est le plus proche de ${room.target}.`
      );

    }else{

      room.winner={
        id:null,
        name:null,
        reason:"draw"
      };

      log(
        room,
        "Partie nulle : plusieurs joueurs sont à égale distance."
      );
    }

    room.started=false;

    return true;
  }

  return false;
}

/* =========================
   MANCHE
========================= */

function startRound(room){

  room.deck=makeDeck(room.players.length);

  room.discard=[];

  room.turn=0;

  room.winner=null;

  room.target=
    TARGETS[room.players.length] ||
    TARGETS[room.maxPlayers] ||
    120;

  for(const p of room.players){

    p.hand=[];
    p.points=0;
    p.pile=[];
    p.skip=0;
  }

  /*
   * 4 cartes à chaque joueur.
   */
  for(let i=0;i<4;i++){

    for(const p of room.players){

      if(room.deck.length){
        p.hand.push(
          room.deck.pop()
        );
      }
    }
  }

  room.started=true;

  log(
    room,
    `Manche ${room.round} commencée. Objectif : ${room.target} points.`
  );

  broadcast(room);
}

/* =========================
   TOURS
========================= */

function nextTurn(room){

  const n=room.players.length;

  for(let i=1;i<=n;i++){

    const idx=
      (room.turn+i)%n;

    const p=
      room.players[idx];

    if(p.hand.length===0){
      continue;
    }

    room.turn=idx;

    if(p.skip>0){

      p.skip--;

      log(
        room,
        `${p.name} passe son tour.`
      );

      return nextTurn(room);
    }

    return;
  }
}

/* =========================
   CARTES
========================= */

function counts(hand){

  const map=new Map();

  for(const card of hand){

    const key=cardKey(card);

    map.set(
      key,
      (map.get(key)||0)+1
    );
  }

  return map;
}

function forcedSet(player){

  const c=counts(player.hand);

  /*
   * Le 7 est prioritaire.
   */
  if(c.has("7")){
    return ["7"];
  }

  /*
   * Une paire est obligatoire.
   */
  for(const [key,count] of c){

    if(count>=2){
      return [key];
    }
  }

  return [];
}

function removeOne(hand,id){

  const index=
    hand.findIndex(
      c=>cardKey(c)===cardKey(id)
    );

  if(index<0){
    return false;
  }

  hand.splice(index,1);

  return true;
}

function removeDouble(hand,id){

  const first=removeOne(hand,id);

  if(!first){
    return false;
  }

  const second=removeOne(hand,id);

  if(!second){

    /*
     * Sécurité :
     * on remet la première carte.
     */
    hand.push(id);

    return false;
  }

  return true;
}

/* =========================
   PILES DE POINTS
========================= */

function addPileCard(
  player,
  card,
  value=null,
  attachments=[]
){

  const item={
    card,
    value:
      value===null
        ? pointValue(card)
        : value,

    attachments:[
      ...attachments
    ]
  };

  player.pile.push(item);

  player.points+=item.value;

  return item;
}

function stealPoint(
  from,
  to,
  index=-1
){

  if(!from.pile.length){
    return null;
  }

  let idx=index;

  if(idx<0){
    idx=
      from.pile.length-1;
  }

  if(
    idx<0 ||
    idx>=from.pile.length
  ){
    return null;
  }

  const item=
    from.pile.splice(idx,1)[0];

  from.points-=item.value;

  to.pile.push(item);

  to.points+=item.value;

  return item;
}

/* =========================
   APPLICATION DES CARTES
========================= */

function applyCard(
  room,
  actor,
  card,
  targetId=null,
  extra={}
){

  const target=
    room.players.find(
      p=>p.id===targetId
    );

  const n=Number(card);

  /*
   * CARTES DE POINTS
   */
  if(isPointCard(card)){

    const item=
      addPileCard(actor,card);

    log(
      room,
      `${actor.name} joue ${card} et marque ${item.value} points.`
    );

    return;
  }

  /*
   * 1 — voler la dernière carte
   */
  if(n===1){

    room.discard.push(1);

    if(target){

      const item=
        stealPoint(
          target,
          actor
        );

      log(
        room,
        item
          ? `${actor.name} vole la dernière carte de points de ${target.name}.`
          : `${actor.name} joue 1 mais ${target.name} n'a aucune carte de points.`
      );
    }

    return;
  }

  /*
   * 3 — -20
   */
  if(n===3){

    room.discard.push(3);

    if(target){

      target.points-=20;

      /*
       * On évite de descendre
       * sous zéro.
       */
      if(target.points<0){
        target.points=0;
      }

      log(
        room,
        `${actor.name} retire 20 points à ${target.name}.`
      );
    }

    return;
  }

  /*
   * 5 — pioche
   */
  if(n===5){

    room.discard.push(5);

    const draws=
      extra.double
        ? 4
        : 2;

    let drawn=0;

    for(
      let i=0;
      i<draws && room.deck.length;
      i++
    ){

      actor.hand.push(
        room.deck.pop()
      );

      drawn++;
    }

    log(
      room,
      `${actor.name} joue ${extra.double?"double ":""}5 et pioche ${drawn} cartes.`
    );

    return;
  }

  /*
   * 7 — +20 / +40
   */
  if(n===7){

    room.discard.push(7);

    const value=
      extra.double
        ? 40
        : 20;

    actor.points+=value;

    log(
      room,
      `${actor.name} joue ${extra.double?"double ":""}7 et gagne ${value} points sans piocher.`
    );

    return;
  }

  /*
   * 9 — échange des mains
   */
  if(n===9){

    room.discard.push(9);

    if(target){

      [
        actor.hand,
        target.hand
      ]=[
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

  /*
   * 11 — +10 / -10
   */
  if(n===11){

    room.discard.push(11);

    const value=
      extra.choice==="minus"
        ? -(extra.double?20:10)
        : (extra.double?20:10);

    actor.points+=value;

    if(actor.points<0){
      actor.points=0;
    }

    log(
      room,
      `${actor.name} applique ${value>0?"+":""}${value} avec ${extra.double?"double ":""}11.`
    );

    return;
  }

  /*
   * 13 — voler une carte précise
   */
  if(n===13){

    room.discard.push(13);

    if(target){

      const item=
        stealPoint(
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
          : `${actor.name} joue 13 mais aucune carte n'a pu être volée.`
      );
    }

    return;
  }

  /*
   * 15 — double une carte
   */
  if(n===15){

    room.discard.push(15);

    const idx=
      Number.isInteger(extra.index)
        ? extra.index
        : actor.pile.length-1;

    const item=
      actor.pile[idx];

    if(item){

      const oldValue=item.value;

      item.value*=
        extra.double
          ? 4
          : 2;

      actor.points+=
        item.value-oldValue;

      item.attachments.push(
        ...(extra.double
          ? ["15","15"]
          : ["15"])
      );

      log(
        room,
        `${actor.name} double une carte de points.`
      );
    }

    return;
  }

  /*
   * 17 — voler et jouer
   */
  if(n===17){

    room.discard.push(17);

    const count=
      extra.double
        ? 2
        : 1;

    for(let i=0;i<count;i++){

      if(
        !target ||
        !target.hand.length
      ){
        break;
      }

      const index=
        Math.floor(
          Math.random()*
          target.hand.length
        );

      const stolen=
        target.hand.splice(index,1)[0];

      /*
       * La carte volée est jouée.
       * Elle ne consomme pas une carte
       * de la main de l'acteur.
       */
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

  /*
   * 19 — échange de cartes de points
   */
  if(n===19){

    room.discard.push(19);

    if(target){

      const amount=
        extra.double
          ? 2
          : 1;

      for(let k=0;k<amount;k++){

        const ai=
          actor.pile.length-1-k;

        const bi=
          target.pile.length-1-k;

        if(
          ai>=0 &&
          bi>=0
        ){

          [
            actor.pile[ai],
            target.pile[bi]
          ]=[
            target.pile[bi],
            actor.pile[ai]
          ];
        }
      }

      actor.points=
        actor.pile.reduce(
          (sum,item)=>sum+item.value,
          0
        );

      target.points=
        target.pile.reduce(
          (sum,item)=>sum+item.value,
          0
        );

      log(
        room,
        `${actor.name} échange ${amount} carte(s) de points avec ${target.name}.`
      );
    }

    return;
  }

  /*
   * 21 — +20 / -20
   */
  if(n===21){

    room.discard.push(21);

    const value=
      extra.choice==="minus"
        ? -(extra.double?40:20)
        : (extra.double?40:20);

    actor.points+=value;

    if(actor.points<0){
      actor.points=0;
    }

    log(
      room,
      `${actor.name} applique ${value>0?"+":""}${value} avec ${extra.double?"double ":""}21.`
    );

    return;
  }

  /*
   * JOKER
   */
  if(String(card)==="J"){

    room.discard.push("J");

    if(extra.choice==="swap"){

      if(target){

        const temp=
          actor.points;

        actor.points=
          target.points;

        target.points=
          temp;

        log(
          room,
          `${actor.name} échange tous ses points avec ${target.name}.`
        );
      }

    }else{

      const value=
        extra.choice==="22"
          ? 22
          : 10;

      actor.points+=value;

      log(
        room,
        `${actor.name} choisit +${value} avec le Joker.`
      );
    }

    return;
  }
}

/* =========================
   JOUER UNE CARTE
========================= */

function play(
  room,
  player,
  card,
  targetId,
  extra={}
){

  const forced=
    forcedSet(player);

  if(
    forced.length &&
    !forced.includes(cardKey(card))
  ){

    throw new Error(
      "Une carte obligatoire doit être jouée en priorité."
    );
  }

  const count=
    player.hand.filter(
      c=>cardKey(c)===cardKey(card)
    ).length;

  /*
   * Une paire est automatiquement
   * jouée en double.
   */
  const isDouble=
    count>=2 &&
    extra.forceDouble!==false;

  if(isDouble){

    if(!removeDouble(player.hand,card)){
      throw new Error(
        "Impossible de retirer la paire."
      );
    }

  }else{

    if(!removeOne(player.hand,card)){
      throw new Error(
        "Carte absente de la main."
      );
    }
  }

  applyCard(
    room,
    player,
    card,
    targetId,
    {
      ...extra,
      double:isDouble
    }
  );

  /*
   * Pioche normale.
   *
   * 7 : aucune pioche
   * 5 : sa propre pioche
   * Joker double : aucune pioche
   */
  if(
    Number(card)!==7 &&
    Number(card)!==5 &&
    !(String(card)==="J" && isDouble) &&
    room.deck.length>0
  ){

    player.hand.push(
      room.deck.pop()
    );
  }

  /*
   * Double Joker :
   * le joueur saute deux tours.
   */
  if(
    String(card)==="J" &&
    isDouble
  ){

    player.skip+=2;
  }

  if(finishIfNeeded(room)){
    broadcast(room);
    return;
  }

  nextTurn(room);

  broadcast(room);
}

/* =========================
   WEBSOCKET
========================= */

wss.on("connection",ws=>{

  ws.on("message",raw=>{

    try{

      const msg=
        JSON.parse(raw.toString());

      /* =====================
         CREER
      ===================== */

      if(msg.type==="create"){

        const maxPlayers=
          Math.min(
            8,
            Math.max(
              2,
              Number(msg.maxPlayers)||2
            )
          );

        const rounds=
          Number(msg.rounds)||1;

        const name=
          String(
            msg.name||"Joueur"
          ).slice(0,18);

        const room=
          newRoom(
            name,
            maxPlayers,
            rounds
          );

        const host=
          room.players[0];

        host.ws=ws;

        ws.room=
          room.code;

        ws.pid=
          host.id;

        rooms.set(
          room.code,
          room
        );

        /*
         * IMPORTANT :
         * le client reçoit son pid.
         */
        send(
          ws,
          "room",
          {
            code:room.code,
            pid:ws.pid
          }
        );

        broadcast(room);

        return;
      }

      /* =====================
         REJOINDRE
      ===================== */

      if(msg.type==="join"){

        const code=
          String(
            msg.code||""
          )
          .trim()
          .toUpperCase();

        const room=
          rooms.get(code);

        if(!room){
          throw new Error(
            "Salon introuvable."
          );
        }

        if(room.started){
          throw new Error(
            "La partie a déjà commencé."
          );
        }

        if(
          room.players.length>=
          room.maxPlayers
        ){

          throw new Error(
            "Salon complet."
          );
        }

        const player={
          id:crypto.randomUUID(),

          name:String(
            msg.name||"Joueur"
          ).slice(0,18),

          ws,

          hand:[],
          points:0,
          pile:[],
          skip:0
        };

        room.players.push(player);

        ws.room=
          room.code;

        ws.pid=
          player.id;

        /*
         * Le joueur reçoit également
         * son identifiant.
         */
        send(
          ws,
          "room",
          {
            code:room.code,
            pid:ws.pid
          }
        );

        broadcast(room);

        return;
      }

      /* =====================
         LANCER
      ===================== */

      if(msg.type==="start"){

        const room=
          rooms.get(ws.room);

        if(!room){
          throw new Error(
            "Salon introuvable."
          );
        }

        if(
          room.players[0]?.id!==ws.pid
        ){

          throw new Error(
            "Seul l'hôte peut lancer la partie."
          );
        }

        if(room.started){
          throw new Error(
            "La partie est déjà commencée."
          );
        }

        if(room.players.length<2){

          throw new Error(
            "Il faut au moins 2 joueurs."
          );
        }

        startRound(room);

        return;
      }

      /* =====================
         JOUER
      ===================== */

      if(msg.type==="play"){

        const room=
          rooms.get(ws.room);

        if(
          !room ||
          !room.started
        ){

          throw new Error(
            "Partie inactive."
          );
        }

        const player=
          room.players.find(
            p=>p.id===ws.pid
          );

        if(!player){

          throw new Error(
            "Joueur introuvable."
          );
        }

        const current=
          room.players[room.turn];

        if(
          !current ||
          current.id!==player.id
        ){

          throw new Error(
            "Ce n'est pas votre tour."
          );
        }

        if(player.hand.length===0){

          throw new Error(
            "Vous n'avez plus de cartes."
          );
        }

        play(
          room,
          player,
          msg.card,
          msg.targetId||null,
          msg.extra||{}
        );

        return;
      }

      /* =====================
         LOG
      ===================== */

      if(msg.type==="log"){

        const room=
          rooms.get(ws.room);

        send(
          ws,
          "log",
          {
            log:room?.log||[]
          }
        );

        return;
      }

    }catch(error){

      console.error(error);

      send(
        ws,
        "error",
        {
          message:
            error?.message||
            "Erreur serveur."
        }
      );
    }
  });

  /* =======================
     DECONNEXION
  ======================= */

  ws.on("close",()=>{

    /*
     * On ne supprime pas le joueur.
     * Cela évite de casser le salon
     * lors d'un simple rechargement.
     */

    const room=
      rooms.get(ws.room);

    if(!room){
      return;
    }

    const player=
      room.players.find(
        p=>p.id===ws.pid
      );

    if(player){

      /*
       * On conserve ses données,
       * mais on retire l'ancienne
       * connexion.
       */
      player.ws=null;
    }

    broadcast(room);
  });
});

/* =========================
   SERVEUR
========================= */

server.listen(
  PORT,
  ()=>{
    console.log(
      `Atoumoulin listening on http://localhost:${PORT}`
    );
  }
);
```
