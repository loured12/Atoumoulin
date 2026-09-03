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

const broadcast=(r,m)=>r.players.forEach(p=>send(p.ws,m));

const fail=(ws,m)=>send(ws,{type:"error",message:m});

function roomCreate(n,max){

 const r={
  code:makeCode(),
  seq:0,
  maxPlayers:Math.max(2,Math.min(8,Number(max)||8)),
  started:false,
  hostId:null,
  players:[],
  engine:null,
  mode:1
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
  }))
 };
}

function publicState(r,p){
 return r.engine.stateFor(
  p.index,
  p?.selection??null
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

  if(room)throw Error("Vous êtes déjà dans un salon.");

  room=rooms.get(
   String(m.code||"").trim().toUpperCase()
  );

  if(!room)throw Error("Salon introuvable.");

  if(room.started)
   throw Error("La partie a déjà commencé.");

  if(room.players.length>=room.maxPlayers)
   throw Error("Salon complet.");

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

  lobby(room);
  return;
 }

 if(!room||!player)
  throw Error("Rejoignez d'abord un salon.");

 if(m.type==="chat:send"){

  const t=String(m.text||"").trim().slice(0,300);

  if(!t)return;

  broadcast(room,{
   type:"chat:message",
   message:{
    playerName:player.name,
    text:t,
    at:Date.now()
   }
  });

  return;
 }

 if(m.type==="room:start"){

  if(player.id!==room.hostId)
   throw Error("Seul l'hôte peut lancer la partie.");

  if(room.players.length<2)
   throw Error("Il faut au moins 2 joueurs.");

  room.mode=Number(m.mode)||1;

  room.started=true;

  room.engine=new AtoumoulinEngine(
   room.players.map(p=>p.name),
   room.players.map(p=>p.bot),
   room.mode
  );

  broadcast(room,{
   type:"game:start",
   room:view(room)
  });

  sendState(room);
  lobby(room);

  return;
 }

if(m.type==="room:reconnect"){

 const wanted=rooms.get(
  String(m.code||"").trim().toUpperCase()
 );

 if(!wanted)
  throw Error("Salon introuvable.");

 const existing=wanted.players.find(
  p=>p.id===m.playerId && p.token===m.token
 );

 if(!existing)
  throw Error("Session introuvable.");

 if(existing.ws && existing.ws!==ws){
  try{existing.ws.close()}catch{}
 }

 room=wanted;
 player=existing;
 player.ws=ws;
 player.connected=true;

 send(ws,{
  type:"room:reconnected",
  playerId:player.id,
  token:player.token,
  room:view(room)
 });

 if(room.engine)
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

 console.log("GAME ACTION RECUE :", m.fn, m.args);

 if(!room.started)
  throw Error("La partie n'a pas commencé.");

 const fn=String(m.fn||"");

 let args=
  Array.isArray(m.args)
  ? m.args.slice(0,3)
  : [];

 if(fn==="preparerNouvelleManche"){

  if(player.id!==room.hostId)
   throw Error("Seul l'hôte peut lancer une nouvelle manche.");

  const nouveauMode=
   Number(args[0])||room.mode||1;

  console.log(
   "CHANGEMENT MODE :",
   room.mode,
   "=>",
   nouveauMode
  );

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

console.log("AVANT APPLY", fn);

try{

 room.engine.apply(
 fn,
 args
);

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

throw Error("Action inconnue.");

 }catch(e){

  fail(
   ws,
   e.message||"Erreur serveur."
  );

 }

 });

 ws.on("close",()=>{

  if(!room||!player)return;

  player.ws=null;
  player.connected=false;

  if(room.started){

   player.bot=true;

   room.engine.setBot(
    player.index,
    true
   );

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
