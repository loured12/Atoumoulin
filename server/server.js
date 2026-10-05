import http from "node:http";
import crypto from "node:crypto";
import { WebSocketServer } from "ws";
import { AtoumoulinEngine } from "./engine.js";
import { validateAction } from "./action-schema.js";

const PORT=Number(process.env.PORT||3000);
const rooms=new Map();

const id=()=>crypto.randomBytes(8).toString("hex");

const makeCode=()=>{
 const chars="ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
 let c;
 do c=Array.from({length:6},()=>chars[Math.floor(Math.random()*chars.length)]).join("");
 while(rooms.has(c));
 return c;
};

const name=n=>String(n||"Joueur").trim().replace(/[<>]/g,"").slice(0,24)||"Joueur";

function nomUnique(room, nomBase){

  const nomsPris = [
    ...room.players,
    ...room.spectators
  ].map(p => String(p.name || "").toLowerCase());

  let nom = nomBase;
  let numero = 2;

  while(nomsPris.includes(nom.toLowerCase())){
    nom = `${nomBase} ${numero}`;
    numero++;
  }

  return nom;
}

const send=(ws,m)=>{
 if(ws?.readyState===1)ws.send(JSON.stringify(m));
};

const broadcast=(r,m)=>{
 
  r.players.forEach(p=>{
    send(p.ws,m);
  });
 
  r.spectators.forEach(p=>{
    send(p.ws,m);
  });
 
};

const fail=(ws,m)=>send(ws,{type:"error",message:m});

function roomCreate(n,max){

 const r={
  code:makeCode(),
  seq:0,
  maxPlayers:8,
  started:false,
  hostId:null,
  players:[],
  spectators:[],
  engine:null,
  mode:1,
  chatMessages:[]
 };

 const p={
  id:id(),
  token:id(),
  name:name(n),
  bot:false,
  connected:true,
  ws:null,
  index:0,
  selection:null
 };

 r.players.push(p);
 r.hostId=p.id;
 rooms.set(r.code,r);

 return [r,p];
}

function supprimerRoomSiVide(room) {
    if (room.players.length === 0 && room.spectators.length === 0) {
        rooms.delete(room.code);
        return true;
    }

    return false;
}

function view(r){
 return {
  code:r.code,
  maxPlayers:r.maxPlayers,
  started:r.started,
  hostId:r.hostId,
  mode:r.mode,
  players:r.players.map(p=>({
   id:p.id,
   name:p.name,
   bot:p.bot,
   connected:p.connected
  })),

  spectators:r.spectators.map(p=>({
   id:p.id,
   name:p.name,
   connected:p.connected
  }))
 };
}

function publicState(r,p){
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

function sendState(r){

 const seq=++r.seq;

 r.players.forEach(p=>{
  if(p.ws)
   send(p.ws,{
    type:"game:state",
    seq,
    playerIndex:p.index,
    state:publicState(r,p)
   });
 });

r.spectators.forEach(p=>{

  if(!p.ws || !r.engine)
    return;

  send(p.ws,{
    type:"game:state",
    seq,
    playerIndex:-1,
    state:publicState(r,{
    index:-1,
    selection:[]
    })
  });
 
});
}

function lobby(r){
 broadcast(r,{type:"lobby:update",room:view(r)});
}

function transfererHoteSiNecessaire(r){

  const hote=r.players.find(
    p=>p.id===r.hostId
  );

  // L'hôte actuel est toujours un humain connecté.
  if(
    hote &&
    !hote.bot &&
    hote.connected
  ){
    return;
  }

  // Cherche un joueur humain actuellement connecté.
  const nouveauHote=r.players.find(
    p=>
      !p.bot &&
      p.connected
  );

  if(!nouveauHote)
    return;

  r.hostId=nouveauHote.id;

  broadcast(r,{
    type:"host:changed",
    hostId:r.hostId
  });

  lobby(r);
}

function runBots(r){

 if(!r.engine)return;

 if(r.__botTimer){
   return;
 }

 function jouerBot(){

   r.__botTimer=null;

   if(!r.engine)return;

   const idx=r.engine.currentIndex();
   const p=r.players[idx];

   if(!p||!p.bot){
     sendState(r);
     return;
   }

   const before=
     JSON.stringify(r.engine.stateFor(idx));

   r.engine.runBotTurn(idx);

   const after=
     JSON.stringify(r.engine.stateFor(idx));

   const state=
     r.engine.stateFor(
       r.engine.currentIndex()
     );

   if(state.roundEnded || state.winner){

     transfererHoteSiNecessaire(r);
     sendState(r);
     return;
   }

   sendState(r);

   if(before===after){
     return;
   }

   const prochainIndex=
     r.engine.currentIndex();

   const prochainJoueur=
     r.players[prochainIndex];

   if(prochainJoueur && prochainJoueur.bot){

     r.__botTimer=setTimeout(
       jouerBot,
       1000
     );

   }

 }

 r.__botTimer=setTimeout(
   jouerBot,
   1000
 );

}

const httpServer=http.createServer((req,res)=>{
 res.writeHead(200,{"content-type":"application/json; charset=utf-8"});
 res.end(JSON.stringify({ok:true,service:"Atoumoulin multiplayer"}));
});

const wss=new WebSocketServer({server:httpServer});

setInterval(()=>{
 for(const ws of wss.clients){
  if(ws.isAlive===false){
   ws.terminate();
   continue;
  }
  ws.isAlive=false;
  ws.ping();
 }
},30000);

wss.on("connection",ws=>{

 ws.isAlive=true;
 ws.on("pong",()=>ws.isAlive=true);

 let room=null;
 let player=null;

 send(ws,{type:"connected"});

 ws.on("message",raw=>{

 let m;

 try{
  m=JSON.parse(raw.toString());
 }catch{
  return fail(ws,"Message invalide.");
 }

 try{

 if(m.type==="room:create"){

  if(room)throw Error("Vous êtes déjà dans un salon.");

  [room,player]=roomCreate(m.name,m.maxPlayers);

  player.ws=ws;

  send(ws,{
   type:"room:created",
   playerId:player.id,
   token:player.token,
   room:view(room)
  });

  lobby(room);
  return;
 }

 if(m.type==="room:join"){

  if(room)
    throw Error("Vous êtes déjà dans un salon.");

  const wanted=rooms.get(
    String(m.code||"").trim().toUpperCase()
  );

  if(!wanted)
    throw Error("Salon introuvable.");

  // ---------------------------------------------------------
  // RECONNEXION / RÉCUPÉRATION DE LA PLACE
  // ---------------------------------------------------------

  const existing=wanted.players.find(
    p =>
      m.playerId &&
      m.token &&
      p.id===m.playerId &&
      p.token===m.token
);

  const existingSpectator=wanted.spectators.find(
    p =>
      m.playerId &&
      m.token &&
      p.id===m.playerId &&
      p.token===m.token
);

  if(existing){

    if(existing.ws && existing.ws!==ws){
      try{
        existing.ws.close();
      }catch{}
    }

    room=wanted;
    player=existing;

    player.ws=ws;
    player.connected=true;
    player.bot=false;

    if(room.engine){
      room.engine.setBot(
        player.index,
        false
      );
    }

    send(ws,{
      type:"room:reconnected",
      playerId:player.id,
      token:player.token,
      room:view(room)
    });

    room.chatMessages.forEach(message=>{
      send(ws,{
       type:"chat:message",
       message
      });
    });

    if(room.engine)
      sendState(room);

    lobby(room);
    return;
  }

  if(existingSpectator){

   if(existingSpectator.ws &&
      existingSpectator.ws!==ws){

      try{
        existingSpectator.ws.close();
      }catch{}

    }

    room=wanted;
    player=existingSpectator;

    player.ws=ws;
    player.connected=true;

    send(ws,{
      type:"room:reconnected",
      playerId:player.id,
      token:player.token,
      spectator:true,
      room:view(room)
    });

    room.chatMessages.forEach(message=>{
      send(ws,{
        type:"chat:message",
        message
      });
    });

    if(room.engine)
      sendState(room);

    lobby(room);
    return;
  }

   room=wanted;

  // ---------------------------------------------------------
  // NOUVEAU JOUEUR
  // ---------------------------------------------------------

  // Maximum 8 joueurs actifs.
  // Les joueurs supplémentaires deviennent spectateurs.
  if(!room.started && room.players.length < 8){

    player={
      id:id(),
      token:id(),
      name:nomUnique(room, name(m.name)),
      bot:false,
      connected:true,
      ws,
      index:room.players.length,
      selection:null
    };

    room.players.push(player);

    send(ws,{
      type:"room:joined",
      playerId:player.id,
      token:player.token,
      room:view(room)
    });

  }else{

    const spectator={
      id:id(),
      token:id(),
      name:nomUnique(room, name(m.name)),
      bot:false,
      connected:true,
      ws
    };

    room.spectators.push(spectator);

    send(ws,{
      type:"room:joined",
      playerId:spectator.id,
      token:spectator.token,
      spectator:true,
      room:view(room)
    });

  }

  lobby(room);

  return;

  }

 if(!room||!player)
  throw Error("Rejoignez d'abord un salon.");

 if(m.type==="chat:send"){
  const t=String(m.text||"").trim().slice(0,300);
  if(!t)return;

  const message={
    playerName:player.name,
    text:t,
    at:Date.now()
  };

  room.chatMessages.push(message);

  broadcast(room,{
    type:"chat:message",
    message
  });

  return;
}

 if(m.type==="room:start"){
  if(player.id!==room.hostId)
    throw Error("Seul l'hôte peut lancer la partie.");

  const nombreJoueurs = Math.max(
    2,
    Math.min(
      8,
      Number(m.players) || room.players.length
    )
  );

  const nombreBots = Math.max(
    0,
    Math.min(nombreJoueurs - room.players.length, Number(m.bots) || 0)
  );

  if(room.players.length > nombreJoueurs)
    throw Error(
      `Il y a déjà ${room.players.length} joueurs humains dans le salon.`
    );  

  const nouveauMode=Number(m.mode)||1;

  if(![1,2,3,5,10].includes(nouveauMode))
    throw Error("Mode de jeu invalide.");

    room.mode=nouveauMode;

    room.botLevel = m.botLevel || "facile";

    // Ajout des bots
  for(let i=0;i<nombreBots;i++){

    room.players.push({
      id:id(),
      token:id(),
      name:nomUnique(room, `Bot ${i+1}`),
      bot:true,
      connected:true,
      ws:null,
      index:room.players.length,
      selection:null
    });

  }

  // Seul le 2e humain change de position
    if(room.players.length>1){

    const deuxiemeHumain=room.players[1];

    const position=
      1+Math.floor(Math.random()*(room.players.length-1));

    room.players.splice(1,1);
    room.players.splice(position,0,deuxiemeHumain);

}

  // Mise à jour des positions
  room.players.forEach((p,i)=>{
    p.index=i;
    p.selection=null;
  });

  room.started=true;

  room.engine=new AtoumoulinEngine(
    room.players.map(p=>p.name),
    room.players.map(p=>p.bot),
    room.mode,
    room.botLevel
  );

  broadcast(room,{
    type:"game:start",
    room:view(room)
  });

  runBots(room);

  sendState(room);
  lobby(room);
  return;
}

if(m.type==="game:select"){

 if(!room.started)
  throw Error("La partie n'a pas commencé.");

 if(room.spectators.some(p=>p.id===player.id))
  throw Error("Vous êtes spectateur.");

 if(player.index!==room.engine.currentIndex())
  throw Error("Ce n'est pas votre tour.");

 const state=room.engine.stateFor(player.index);
 const selection=m.selection;

if(state.action==="double13choix"){

  if(!Array.isArray(selection))
    throw Error("Sélection Double 13 invalide.");

  const indices=selection.map(Number);

  if(
    indices.some(i=>
      !Number.isInteger(i)||
      i<0||
      i>=state.table.length
    )||
    new Set(indices).size!==indices.length
  ){
    throw Error("Sélection Double 13 invalide.");
  }

  const cibleIndex=Number(state.target);

  if(
    !Number.isInteger(cibleIndex)||
    !state.players[cibleIndex]
  ){
    throw Error("Cible Double 13 invalide.");
  }

  const cibleNom=state.players[cibleIndex].name;

  const cartesDisponibles=state.table.filter(carte=>
    carte &&
    carte.proprietaire===cibleNom &&
    Number(carte.valeur)!==0
  );

  const nombreObligatoire=
    Math.min(2,cartesDisponibles.length);

  if(indices.length!==nombreObligatoire){
    throw Error(
      `Le Double 13 doit sélectionner ${nombreObligatoire} carte${nombreObligatoire>1?"s":""}.`
    );
  }

  for(const index of indices){

    const carte=state.table[index];

    if(!carte)
      throw Error("Carte Double 13 invalide.");

    if(carte.proprietaire!==cibleNom)
      throw Error("Cette carte n'appartient pas à la cible.");

    if(Number(carte.valeur)===0)
      throw Error(
        "Cette carte ne peut pas être volée avec le Double 13."
      );
  }

  room.engine.setSelection(indices);
  player.selection=indices;

  sendState(room);
  return;
}

 {
  const main=state.players[player.index]?.main || [];

  const nb7=main.filter(v=>v===7).length;

  if(nb7>0){

   if(Array.isArray(selection)){

    const indices=selection.map(Number);

    if(
     indices.some(i=>
      !Number.isInteger(i)||
      i<0||
      i>=main.length
     )||
     new Set(indices).size!==indices.length
    ){
     throw Error("Sélection de cartes invalide.");
    }

    if(nb7>=2){

     if(indices.length!==2)
      throw Error("Le Double 7 est obligatoire.");

     if(
      main[indices[0]]!==7||
      main[indices[1]]!==7
     ){
      throw Error("Le Double 7 est obligatoire.");
     }

    }else{

     throw Error("Le 7 est prioritaire.");
    }

    room.engine.setSelection(indices);
    player.selection=indices;

   }else{

    const idx=Number(selection);

    if(
     !Number.isInteger(idx)||
     idx<0||
     idx>=main.length
    ){
     throw Error("Sélection invalide.");
    }

    if(main[idx]!==7)
     throw Error("Le 7 est prioritaire.");

    room.engine.selectCard(
     idx,
     player.index
    );

    player.selection=
     room.engine.stateFor(player.index).selection;
   }

  }

  else{

   const valeurs=new Map();

   for(const valeur of main){
    valeurs.set(
     valeur,
     (valeurs.get(valeur)||0)+1
    );
   }

   const aUnDouble=
    [...valeurs.values()].some(
     nombre=>nombre>=2
    );

   if(aUnDouble){

    if(!Array.isArray(selection))
     throw Error("Un Double est prioritaire.");

    const indices=selection.map(Number);

    if(
     indices.length!==2||
     indices.some(i=>
      !Number.isInteger(i)||
      i<0||
      i>=main.length
     )||
     new Set(indices).size!==indices.length
    ){
     throw Error("Sélection du Double invalide.");
    }

    if(main[indices[0]]!==main[indices[1]])
     throw Error("Les deux cartes doivent être identiques.");

    room.engine.setSelection(indices);
    player.selection=indices;

   }

   else{

    if(Array.isArray(selection))
     throw Error("Aucun Double n'est disponible.");

    const idx=Number(selection);

    if(
     !Number.isInteger(idx)||
     idx<0||
     idx>=main.length
    ){
     throw Error("Sélection invalide.");
    }

    room.engine.selectCard(
     idx,
     player.index
    );

    player.selection=
     room.engine.stateFor(player.index).selection;
   }
  }
 }

 sendState(room);
 return;

if(m.type==="game:action"){

 if(!room.started)
  throw Error("La partie n'a pas commencé.");

 if(room.spectators.some(p=>p.id===player.id))
  throw Error("Vous êtes spectateur.");

 const fn=String(m.fn||"");
 const rawArgs=Array.isArray(m.args) ? m.args : [];

 /*
  * nouvellePartieMultijoueur est une action serveur spéciale.
  * Elle ne fait donc pas partie de ACTIONS/action-schema.js.
  */
 if(fn!=="nouvellePartieMultijoueur"){
  const validation=validateAction({
   action:fn,
   args:rawArgs
  });

  if(!validation.ok){
   throw Error(validation.error);
  }
 }

 if(rawArgs.length>12){
  throw Error("Trop d'arguments pour cette action.");
 }

 const args=rawArgs.slice();

 /* ---------------------------------------------------------
  * NOUVELLE PARTIE MULTIJOUEUR
  * --------------------------------------------------------- */
 if(fn==="nouvellePartieMultijoueur"){

  if(player.id!==room.hostId)
   throw Error("Seul l'hôte peut lancer une nouvelle partie.");

  if(args.length>3)
   throw Error("Arguments invalides pour la nouvelle partie.");

  const nouveauMode=Number(args[0])||room.mode||1;
    if(![1,2,3,5,10].includes(nouveauMode))
    throw Error("Mode de jeu invalide.");
  
  const nouveauNiveau=String(args[2]||room.botLevel||"facile");

  const joueursHumains=room.players.filter(p=>!p.bot);
  const spectateursDisponibles=room.spectators.slice();
  const nombreHumains=joueursHumains.length;

  const nombreJoueurs=Math.max(
   2,
   Math.min(
    8,
    Number(args[1])||nombreHumains
   )
  );

  if(nombreJoueurs<nombreHumains)
   throw Error(
    `Le nombre de joueurs ne peut pas être inférieur à ${nombreHumains}.`
   );

  const nombreSpectateurs=Math.min(
   spectateursDisponibles.length,
   nombreJoueurs-nombreHumains
  );

  const nombreBots=
   nombreJoueurs-
   nombreHumains-
   nombreSpectateurs;

  room.players=joueursHumains.slice();

  for(let i=0;i<nombreSpectateurs;i++){
   const spectateur=spectateursDisponibles[i];

   room.spectators=room.spectators.filter(
    p=>p.id!==spectateur.id
   );

   spectateur.bot=false;
   spectateur.connected=!!spectateur.ws;
   spectateur.selection=null;
   spectateur.index=room.players.length;

   room.players.push(spectateur);
  }

  for(let i=0;i<nombreBots;i++){
   room.players.push({
    id:id(),
    token:id(),
    name:nomUnique(room, `Bot ${i+1}`),
    bot:true,
    connected:true,
    ws:null,
    index:room.players.length,
    selection:null
   });
  }

  if(room.players.length>1){
   const deuxiemeHumain=room.players[1];
   const position=
    1+Math.floor(Math.random()*(room.players.length-1));

   room.players.splice(1,1);
   room.players.splice(position,0,deuxiemeHumain);
  }

  room.players.forEach((p,i)=>{
   p.index=i;
   p.selection=null;
  });

  room.mode=nouveauMode;
  room.botLevel=nouveauNiveau;

  room.engine=new AtoumoulinEngine(
   room.players.map(p=>p.name),
   room.players.map(p=>p.bot),
   room.mode,
   room.botLevel
  );

  broadcast(room,{type:"game:start",room:view(room)});
  runBots(room);
  sendState(room);
  lobby(room);
  return;
 }

 /* ---------------------------------------------------------
  * NOUVELLE MANCHE
  * --------------------------------------------------------- */
 if(fn==="preparerNouvelleManche"){

  if(player.id!==room.hostId)
   throw Error("Seul l'hôte peut lancer une nouvelle manche.");

  if(args.length!==1)
   throw Error("Arguments invalides pour la nouvelle manche.");

  const nouveauMode=Number(args[0]);
   if(![1,2,3,5,10].includes(nouveauMode))
   throw Error("Mode de jeu invalide.");

  room.mode=nouveauMode;

  room.engine.apply(
   "preparerNouvelleManche",
   [nouveauMode]
  );
  
  runBots(room);
  sendState(room);
  return;
 }

 /* ---------------------------------------------------------
  * TOUTES LES AUTRES ACTIONS SONT LIÉES AU TOUR COURANT
  * --------------------------------------------------------- */
 if(player.index!==room.engine.currentIndex())
  throw Error("Ce n'est pas votre tour.");

 const state=room.engine.stateFor(player.index);

 if(
  state.roundEnded ||
  state.winner ||
  state.action === "partieTerminee"
 ){
  throw Error("Cette partie est déjà terminée.");
 }

 /*
  * jouerCarte ne reçoit volontairement aucun index depuis
  * le client : le serveur utilise uniquement la sélection
  * déjà enregistrée par game:select.
  */
 if(fn==="jouerCarte"){
  if(args.length!==0)
   throw Error("Arguments invalides pour jouerCarte.");

  if(state.action!==null)
   throw Error("Vous ne pouvez pas jouer une carte maintenant.");

  if(
   state.roundEnded ||
   state.winner ||
   state.currentPlayer!==player.index
  ){
   throw Error("Cette partie n'accepte plus cette action.");
  }

  const selection=player.selection;

  console.log(
  "DEBUG JOUER",
  player.name,
  player.index,
  selection
);

  if(selection===null || selection===undefined)
   throw Error("Aucune carte sélectionnée.");

  const main=state.players[player.index]?.main||[];

  if(Array.isArray(selection)){
   if(selection.length!==2)
    throw Error("Sélection de cartes invalide.");

   const indices=selection.map(Number);

   if(
    indices.some(i=>!Number.isInteger(i)||i<0||i>=main.length) ||
    new Set(indices).size!==indices.length
   ){
    throw Error("Sélection de cartes invalide.");
   }

   if(main[indices[0]]!==main[indices[1]])
    throw Error("Les deux cartes doivent être identiques.");
  }else{
   const index=Number(selection);

   if(
    !Number.isInteger(index) ||
    index<0 ||
    index>=main.length
   ){
    throw Error("Sélection de carte invalide.");
   }
  }

  room.engine.setSelection(selection);
  room.engine.setPlayerIndex(player.index);
  room.engine.apply(fn,[]);

  player.selection=null;

  const stateApres=room.engine.stateFor(player.index);
  
  if(stateApres.roundEnded || stateApres.winner){
     transfererHoteSiNecessaire(room);
     sendState(room);
     return;
  }
  
  runBots(room);
  sendState(room);
  return;
 }

 room.engine.setPlayerIndex(player.index);

 /* ---------------------------------------------------------
  * CIBLES D'ADVERSAIRES
  * --------------------------------------------------------- */
 const actionsCibles={
  choisirAdversaireVol1:{actions:["vol1"],besoin:"points"},
  choisirAdversaireCarte3:{actions:["carte3"],besoin:"aucun"},
  choisirAdversaireCarte9:{actions:["carte9"],besoin:"aucun"},
  choisirAdversaireCarte13:{actions:["carte13"],besoin:"points"},
  choisirAdversaireCarte17:{actions:["carte17"],besoin:"main"},
  choisirAdversaireCarte19:{actions:["carte19"],besoin:"points"},
  choisirAdversaireDouble1:{actions:["double1"],besoin:"points"},
  choisirAdversaireDouble3:{actions:["double3"],besoin:"aucun"},
  choisirAdversaireDouble9:{actions:["double9"],besoin:"aucun"},
  choisirAdversaireDouble13:{actions:["double13"],besoin:"points"},
  choisirAdversaireDouble17:{actions:["double17"],besoin:"main"},
  choisirAdversaireDouble19:{actions:["double19"],besoin:"points"}
 };

 if(Object.prototype.hasOwnProperty.call(actionsCibles,fn)){
  if(args.length!==1)
   throw Error("Cible invalide.");

  const cibleIndex=Number(args[0]);

  if(
   !Number.isInteger(cibleIndex)||
   cibleIndex<0||
   cibleIndex>=room.players.length
  ){
   throw Error("Cible invalide.");
  }

  if(cibleIndex===player.index)
   throw Error("Vous ne pouvez pas vous cibler vous-même.");

  const regle=actionsCibles[fn];

  if(!regle.actions.includes(state.action))
   throw Error("Cette cible n'est pas autorisée à ce moment.");

  const cible=state.players[cibleIndex];

  if(!cible)
   throw Error("Cible invalide.");

  if(regle.besoin==="points"){
   const cartesPoints=state.table.filter(carte=>
    carte&&
    carte.proprietaire===cible.name&&
    typeof carte.valeur==="number"&&
    carte.valeur!==0
   );

   if(cartesPoints.length===0)
    throw Error("Cette cible ne possède aucune carte à points.");
  }

  if(regle.besoin==="main"&&cible.cardCount<=0)
   throw Error("Cette cible n'a aucune carte en main.");
 }

 /* ---------------------------------------------------------
  * VALEURS DES POUVOIRS
  * --------------------------------------------------------- */
if(fn==="effetCarte11"){

  if(state.action!=="carte11")
   throw Error("Cette action n'est pas autorisée à ce moment.");

  if(args.length!==1 || ![10,-10].includes(Number(args[0])))
   throw Error("Valeur invalide pour le 11.");
}

if(fn==="effetDouble11"){

  if(state.action!=="double11")
   throw Error("Cette action n'est pas autorisée à ce moment.");

  if(args.length!==1 || ![20,-20].includes(Number(args[0])))
   throw Error("Valeur invalide pour le Double 11.");
}

if(fn==="effetCarte21"){

  if(state.action!=="carte21")
   throw Error("Cette action n'est pas autorisée à ce moment.");

  if(args.length!==1 || ![20,-20].includes(Number(args[0])))
   throw Error("Valeur invalide pour le 21.");
}

if(fn==="effetDouble21"){

  if(state.action!=="double21")
   throw Error("Cette action n'est pas autorisée à ce moment.");

  if(args.length!==1 || ![40,-40].includes(Number(args[0])))
   throw Error("Valeur invalide pour le Double 21.");
}

if(fn==="effetJoker"){

  if(state.action!=="joker")
   throw Error("Cette action n'est pas autorisée à ce moment.");

  if(args.length!==1)
   throw Error("Choix Joker invalide.");

  const choix=args[0];

  if(
   choix!=="echange" &&
   Number(choix)!==10 &&
   Number(choix)!==22
  ){
   throw Error("Choix Joker invalide.");
  }
}

 /* ---------------------------------------------------------
  * 13 / Double 13
  * --------------------------------------------------------- */
 if(fn==="volerCarte13"){
  if(state.action!=="carte13choix")
   throw Error("Cette action n'est pas autorisée à ce moment.");

  if(args.length!==1)
   throw Error("Carte 13 invalide.");

  const index=Number(args[0]);
  const carte=state.table[index];
  const cibleIndex=Number(state.target);
  const cible=state.players[cibleIndex];

  if(!Number.isInteger(index)||!carte||!cible)
   throw Error("Carte 13 invalide.");

  if(carte.proprietaire!==cible.name)
   throw Error("Cette carte n'appartient pas à la cible.");

  if(typeof carte.valeur!=="number"||carte.valeur===0)
   throw Error("Cette carte ne peut pas être volée avec le 13.");
 }

if(fn==="volerCartesDouble13"){

  if(state.action!=="double13choix")
    throw Error("Cette action n'est pas autorisée à ce moment.");

  if(args.length!==0)
    throw Error("Arguments invalides pour le Double 13.");

  const selection=player.selection;
  const cibleIndex=Number(state.target);
  const cible=state.players[cibleIndex];

  if(!cible||!Array.isArray(selection))
    throw Error("Sélection Double 13 invalide.");

  const indices=selection.map(Number);

  if(
    indices.some(i=>
      !Number.isInteger(i)||
      i<0||
      i>=state.table.length
    )||
    new Set(indices).size!==indices.length
  ){
    throw Error("Sélection Double 13 invalide.");
  }

  const cartesDisponibles=state.table.filter(carte=>
    carte &&
    carte.proprietaire===cible.name &&
    Number(carte.valeur)!==0
  );

  const nombreObligatoire=
    Math.min(2,cartesDisponibles.length);

  if(indices.length!==nombreObligatoire){
    throw Error(
      `Le Double 13 doit sélectionner ${nombreObligatoire} carte${nombreObligatoire>1?"s":""}.`
    );
  }

  for(const index of indices){

    const carte=state.table[index];

    if(!carte)
      throw Error("Carte Double 13 invalide.");

    if(carte.proprietaire!==cible.name)
      throw Error("Cette carte n'appartient pas à la cible.");

    if(
      typeof carte.valeur!=="number"||
      carte.valeur===0
    ){
      throw Error(
        "Cette carte ne peut pas être volée avec le Double 13."
      );
    }
  }
}

 if(fn==="terminerDouble13"){
  if(args.length!==0)
   throw Error("Arguments invalides.");

  if(
   state.action!=="double13"&&
   state.action!=="double13choix"
  ){
   throw Error("Cette action n'est pas autorisée à ce moment.");
  }

  let cibleSansPoints=true;

  if(state.action==="double13"){
   cibleSansPoints=!state.players.some((p,i)=>
    i!==player.index&&
    state.table.some(carte=>
     carte&&
     carte.proprietaire===p.name&&
     typeof carte.valeur==="number"&&
     carte.valeur!==0
    )
   );
  }else{
   const cibleIndex=Number(state.target);
   const cible=state.players[cibleIndex];

   if(!cible)
    throw Error("Cible Double 13 invalide.");

   cibleSansPoints=!state.table.some(carte=>
    carte&&
    carte.proprietaire===cible.name&&
    typeof carte.valeur==="number"&&
    carte.valeur!==0
   );
  }

  if(!cibleSansPoints)
   throw Error("Le Double 13 possède encore une cible valide.");
 }

 /* ---------------------------------------------------------
  * 15 / Double 15
  * --------------------------------------------------------- */
 if(fn==="doublerCarte15"||fn==="triplerCarte15"){
  const actionAttendue=
   fn==="doublerCarte15" ? "carte15" : "double15";

  if(state.action!==actionAttendue)
   throw Error("Cette action n'est pas autorisée à ce moment.");

  if(args.length!==1)
   throw Error("Carte 15 invalide.");

  const index=Number(args[0]);
  const carte=state.table[index];

  if(
   !Number.isInteger(index)||
   !carte||
   carte.proprietaire!==state.players[player.index]?.name
  ){
   throw Error("Cette carte ne peut pas être modifiée.");
  }

  if(typeof carte.valeur!=="number"||carte.valeur===0)
   throw Error("Cette carte ne peut pas être modifiée.");
 }

 /* ---------------------------------------------------------
  * 17 / Double 17
  * --------------------------------------------------------- */
 if(fn==="continuerCarte17"){
  if(args.length!==0||state.action!=="carte17revelee")
   throw Error("Cette action n'est pas autorisée à ce moment.");
 }

 if(fn==="choisirCarteDouble17"){
  if(args.length!==1||state.action!=="double17revelee")
   throw Error("Cette action n'est pas autorisée à ce moment.");

  const index=Number(args[0]);

  if(
   !Number.isInteger(index)||
   !Array.isArray(state.double17Cards)||
   index<0||
   index>=state.double17Cards.length
  ){
   throw Error("Carte Double 17 invalide.");
  }
 }

 if(fn==="continuerDouble17"){
  if(args.length!==0||state.action!=="double17jouer")
   throw Error("Cette action n'est pas autorisée à ce moment.");
 }

 if(fn==="terminer17SansCarte"){
  if(args.length!==0)
   throw Error("Arguments invalides.");

  if(
   state.action!=="carte17"&&
   state.action!=="double17"
  ){
   throw Error("Cette action n'est pas autorisée à ce moment.");
  }

  const adversaireAvecMain=state.players.some(
   (p,i)=>i!==player.index&&p.cardCount>0
  );

  if(adversaireAvecMain)
   throw Error("Un adversaire possède encore une carte en main.");
 }

 /* ---------------------------------------------------------
  * CIBLES 21 / DOUBLE 21 / JOKER
  * --------------------------------------------------------- */
 if(fn==="cibleCarte21"||fn==="cibleDouble21"||fn==="echangeJoker"){
  const etatAttendu={
   cibleCarte21:"carte21cible",
   cibleDouble21:"double21cible",
   echangeJoker:"jokerCible"
  }[fn];

  if(state.action!==etatAttendu)
   throw Error("Cette cible n'est pas autorisée à ce moment.");

  if(args.length!==1)
   throw Error("Cible invalide.");

  const cibleIndex=Number(args[0]);

  if(
   !Number.isInteger(cibleIndex)||
   cibleIndex<0||
   cibleIndex>=room.players.length||
   cibleIndex===player.index
  ){
   throw Error("Cible invalide.");
  }
 }

 /*
  * effectuerEchangeDouble19 est une fonction interne appelée
  * par choisirAdversaireDouble19(). Le client n'a normalement
  * jamais à l'appeler directement.
  */
 if(fn==="effectuerEchangeDouble19"){
  throw Error("Cette action ne peut pas être appelée directement.");
 }

 /* ---------------------------------------------------------
  * Exécution finale
  * --------------------------------------------------------- */
 room.engine.apply(fn,args);

 player.selection=null;

 const stateApres=room.engine.stateFor(player.index);

 if(stateApres.roundEnded || stateApres.winner){

   transfererHoteSiNecessaire(room);

   sendState(room);
   return;
 }

 runBots(room);
 sendState(room);
 return;

 }

 }catch(e){

  console.error(e.stack || e);

  fail(
   ws,
   e.message||"Erreur serveur."
  );

}
  
 });

 ws.on("close",()=>{

  if(!room||!player)return;

  // Si ce n'est plus la connexion actuelle du joueur,
  // c'est une ancienne connexion : on ne touche pas à son état.
  if(player.ws!==ws)return;

  player.ws=null;
  player.connected=false;

  if(room.spectators.some(p=>p.id===player.id)){

    room.spectators =
      room.spectators.filter(
        p=>p!==player
      );

   if (supprimerRoomSiVide(room)) {
    return;
   }

   lobby(room);

    return;
  }

  if(room.started){
      player.bot=true;
      room.engine.setBot(player.index,true);

   broadcast(room,{
    type:"player:bot",
    name:player.name
   });

   runBots(room);

  }else{

   room.players=
    room.players.filter(
     p=>p!==player
    );

   room.players.forEach(
    (p,i)=>p.index=i
   );

   lobby(room);

  }

 });

});

httpServer.listen(
 PORT,
 "0.0.0.0",
 ()=>console.log(
  `Atoumoulin server listening on ${PORT}`
 )
);
