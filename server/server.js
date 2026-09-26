import http from "node:http";
import crypto from "node:crypto";
import { WebSocketServer } from "ws";
import { AtoumoulinEngine } from "./engine.js";

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

const name=n=>String(n||"Joueur").trim().slice(0,24)||"Joueur";

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
  maxPlayers:Math.max(2,Math.min(8,Number(max)||8)),
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

  if (special !== null) {
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
    state:publicState(r,r.players[0])
  });
 
});
}

function lobby(r){
 broadcast(r,{type:"lobby:update",room:view(r)});
}

function runBots(r){

 if(!r.engine)return;

 for(let i=0;i<32;i++){

  const idx=r.engine.currentIndex();
  const p=r.players[idx];

  if(!p||!p.bot)break;

  const before=JSON.stringify(r.engine.stateFor(idx));

  r.engine.runBotTurn(idx);

  const after=JSON.stringify(r.engine.stateFor(idx));

  if(before===after)break;
 }

 sendState(r);
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

   room=wanted;

  // ---------------------------------------------------------
  // NOUVEAU JOUEUR
  // ---------------------------------------------------------

  // Maximum 8 joueurs actifs.
  // Les joueurs supplémentaires deviennent spectateurs.
  if(room.players.length < 8){

    player={
      id:id(),
      token:id(),
      name:name(m.name),
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
      name:name(m.name),
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
    Math.min(8, Number(m.players) || room.players.length)
  );

  const nombreBots = Math.max(
    0,
    Math.min(nombreJoueurs - room.players.length, Number(m.bots) || 0)
  );

  if(room.players.length > nombreJoueurs)
    throw Error(
      `Il y a déjà ${room.players.length} joueurs humains dans le salon.`
    );  

  room.mode = Number(m.mode) || 1;

  room.botLevel = m.botLevel || "facile";

    // Ajout des bots
  for(let i=0;i<nombreBots;i++){

    room.players.push({
      id:id(),
      token:id(),
      name:`Bot ${i+1}`,
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

 if(player.index!==room.engine.currentIndex())
  throw Error("Ce n'est pas votre tour.");

 if(Array.isArray(m.selection)){

  room.engine.setSelection(
   m.selection.map(Number)
  );

  player.selection=m.selection;

 }else{

  const idx=Number(m.selection);

  if(!Number.isInteger(idx)||idx<0)
   throw Error("Sélection invalide.");

  room.engine.selectCard(
   idx,
   player.index
  );

  player.selection=
   room.engine.stateFor(player.index).selection;
 }

 sendState(room);
 return;
}

if(m.type==="game:action"){

 if(!room.started)
  throw Error("La partie n'a pas commencé.");

 const fn=String(m.fn||"");

 let args=
  Array.isArray(m.args)
  ? m.args.slice(0,3)
  : [];

if(fn==="nouvellePartieMultijoueur"){

  if(player.id!==room.hostId)
    throw Error("Seul l'hôte peut lancer une nouvelle partie.");

  const nouveauMode=
    Number(args[0])||room.mode||1;

  const nombreJoueurs = Math.max(
    2,
    Math.min(8, Number(args[1]) || room.players.filter(p => !p.bot).length)
  );

  const joueursHumains =
  room.players.filter(p => !p.bot);

  const nombreHumains =
  joueursHumains.length;

if(nombreJoueurs < nombreHumains)
  throw Error(
    `Le nombre de joueurs ne peut pas être inférieur à ${nombreHumains}.`
  );

  const nombreBots =
  nombreJoueurs - nombreHumains;

  // On supprime les anciens bots
  room.players = joueursHumains;

  // On remet les index des joueurs humains
  room.players.forEach((p,i)=>{
    p.index=i;
    p.selection=null;
  });

  // On crée les nouveaux bots
  for(let i=0;i<nombreBots;i++){

    room.players.push({
      id:id(),
      token:id(),
      name:`Bot ${i+1}`,
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

  room.engine=new AtoumoulinEngine(
    room.players.map(p=>p.name),
    room.players.map(p=>p.bot),
    room.mode
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

 if(fn==="preparerNouvelleManche"){

  if(player.id!==room.hostId)
   throw Error("Seul l'hôte peut lancer une nouvelle manche.");

  const nouveauMode=
   Number(args[0])||room.mode||1;

  room.mode=nouveauMode;

  room.engine.apply(
   "preparerNouvelleManche",
   [nouveauMode]
  );

  sendState(room);

  return;
 }

 if(player.index!==room.engine.currentIndex())
  throw Error("Ce n'est pas votre tour.");

if(fn==="jouerCarte"){
  
  room.engine.setSelection(
    player.selection
  );
  args=[];
}

room.engine.setPlayerIndex(
    player.index
);

room.engine.apply(fn,args);

player.selection=null;

const state = room.engine.stateFor(player.index);

// Manche terminée
if(state.roundEnded){
  sendState(room);
  return;
}

// Partie gagnée (premier à X victoires)
if(state.winner){
  sendState(room);
  return;
}

runBots(room);

sendState(room);

return;

}

 }catch(e){

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
