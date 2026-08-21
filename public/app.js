let ws=null, state=null;
const $=id=>document.getElementById(id);
const powers={
1:"Vole la dernière carte de points",3:"−20 à un adversaire",5:"Pioche 2",7:"+20, ne pioche pas",9:"Échange les mains",11:"+10 ou −10",13:"Vole une carte de points",15:"Double une carte de points",17:"Vole et joue une carte",19:"Échange la dernière carte",21:"+20 ou −20",J:"10 / 22 / échange les points"
};
function connect(){ ws=new WebSocket((location.protocol==="https:"?"wss://":"ws://")+location.host);
 ws.onopen=()=>toast("Connecté");
 ws.onmessage=e=>{const m=JSON.parse(e.data); if(m.type==="state"){state=m.state; render()} if(m.type==="room"){
  ws.pid=m.pid;
  $("roomBadge").textContent="Salon "+m.code;
} if(m.type==="error")toast(m.message)}
}
function send(o){if(ws?.readyState===1)ws.send(JSON.stringify(o))}
function createRoom(){connect(); const wait=setInterval(()=>{if(ws.readyState===1){clearInterval(wait);send({type:"create",name:$("createName").value||"Joueur",maxPlayers:+$("maxPlayers").value,rounds:+$("rounds").value})}},30)}
function createSolo(){
  connect();
  const wait=setInterval(()=>{
    if(ws.readyState===1){
      clearInterval(wait);
      send({
        type:"createSolo",
        name:$("createName").value||"Joueur"
      });
    }
  },30);
}
function joinRoom(){connect(); const wait=setInterval(()=>{if(ws.readyState===1){clearInterval(wait);send({type:"join",name:$("joinName").value||"Joueur",code:$("joinCode").value.trim()})}},30)}
function startGame(){send({type:"start"})}
function forced(hand){const c={};hand.forEach(x=>c[x]=(c[x]||0)+1);if(c["7"])return ["7"];for(const k in c)if(c[k]>=2)return [k];return []}
function render(){
 toast("Cartes : "+JSON.stringify(state.hand));
 $("lobby").classList.toggle("hidden",!!state);
 $("game").classList.toggle("hidden",!state); if(!state)return;
 $("target").textContent=`Objectif : ${state.target}`;
 const me=state.players.find(p=>p.id===getPid()); 
 $("startBtn").classList.toggle("hidden",state.started||!isHost());
 $("status").textContent=state.winner?(state.winner.reason==="draw"?"Partie nulle":`${state.winner.name} gagne !`):state.started?`Tour de ${state.players[state.turn]?.name}`:`En attente des joueurs`;
 $("players").innerHTML=state.players.map(p=>`<div class="player ${p.id===state.players[state.turn]?.id?"active":""} ${p.id===getPid()?"me":""}">
 <b>${escapeHtml(p.name)}</b><div class="score">${p.points}</div><div>${p.handCount} carte(s) en main</div>
 <div class="pile">${p.pile.map(x=>`<div class="mini" title="${x.value}">${x.card}</div>`).join("")}</div></div>`).join("");
 $("discardCards").innerHTML=state.discard.slice(-3).map(c=>`<span>${c}</span>`).join(" ");
 $("deck").innerHTML=`🂠<small>${state.deckCount} cartes</small>`;
 $("handCount").textContent=me?`(${me.hand.length})`:"";
 const f=forced(state.hand||[]);
 $("hand").innerHTML=(state.hand||[]).map((c,i)=>{
   const isF=f.includes(String(c));
   return `<button class="card ${isF?"forced":""}" onclick="chooseCard('${c}')">
     ${art(c)}${isF?'<span class="badge">OBLIGATOIRE</span>':""}
   </button>`
 }).join("");
}
let pendingAction=null;

function chooseCard(card){
 if(!state.started)return;
 const me=state.players.find(p=>p.id===getPid()); if(!me)return;
 const f=forced(state.hand||[]);
 if(f.length && !f.includes(String(card))){toast("Tu dois jouer la carte obligatoire.");return}

 const n=Number(card);
 pendingAction={card,targetId:null,extra:{}};

 if([1,3,9,13,17,19].includes(n)){
   const eligible=state.players.filter(p=>p.id!==getPid());
   return showTargets(card, eligible);
 }
 if([11,21].includes(n)){
   const vals=n===11?["+10 pour toi","−10 pour toi"]:["+20 pour toi","−20 pour toi"];
   return showOptions(`Carte ${card}`,`Choisis l'effet de la carte ${card}.`,[
     {label:vals[0],action:()=>submitPending({choice:"plus"})},
     {label:vals[1],action:()=>submitPending({choice:"minus"})}
   ]);
 }
 if(card==="J"){
   return showOptions("Joker","Choisis une des trois possibilités.",[
     {label:"+10 points",action:()=>submitPending({choice:"10"})},
     {label:"+22 points",action:()=>submitPending({choice:"22"})},
     {label:"Échanger tous tes points",action:()=>showTargets(card,state.players.filter(p=>p.id!==getPid()),"swap")}
   ]);
 }
 if(n===15){
   if(!me.pile.length){toast("Tu n'as aucune carte de points à doubler.");return;}
   return showPileChoice(me,"Choisis la carte de points à doubler.",false);
 }
 submitPending({});
}

function showTargets(card, players, mode="target"){
 if(!players.length){toast("Aucune cible disponible.");return;}
 showOptions(`Carte ${card}`,"Choisis un adversaire.",players.map(p=>({
   label:`${p.name} — ${p.points} points • ${p.handCount} cartes`,
   action:()=>{ pendingAction.targetId=p.id;
     if(Number(card)===13) {
       const t=state.players.find(x=>x.id===p.id);
       if(!t?.pile.length){toast("Cet adversaire n'a aucune carte de points.");return;}
       return showPileChoice(t,"Choisis la carte de points à voler.",true);
     }
     submitPending(mode==="swap"?{choice:"swap"}:{});
   }
 })));
}

function showPileChoice(player,text,forSteal){
 const pile=player.pile||[];
 showOptions("Choix de carte",text,pile.map((item,i)=>({
   label:`${i+1}. ${item.card} — ${item.value} points`,
   action:()=>{pendingAction.extra.index=i;submitPending({});}
 })));
}

function showOptions(title,text,options){
 $("choiceTitle").textContent=title;
 $("choiceText").textContent=text;
 $("choiceOptions").innerHTML=options.map((o,i)=>`<button class="choiceBtn" onclick="choicePick(${i})">${escapeHtml(o.label)}</button>`).join("");
 window._choiceOptions=options;
 $("choiceModal").classList.remove("hidden");
}
function choicePick(i){
 const o=window._choiceOptions?.[i];
 if(o?.action)o.action();
}
function closeChoice(){
 $("choiceModal").classList.add("hidden");
 window._choiceOptions=null;
 pendingAction=null;
}
function submitPending(extra){
 if(!pendingAction)return;
 pendingAction.extra={...pendingAction.extra,...extra};
 const payload={type:"play",card:pendingAction.card,targetId:pendingAction.targetId,extra:pendingAction.extra};
 closeChoice();
 send(payload);
}
function isHost(){return state?.players?.[0]?.id===getPid()}
function getPid(){return ws?.pid||""}
function art(c){return `<div style="background:white;color:black;width:100%;height:100%;display:flex;align-items:center;justify-content:center;font-size:40px;font-weight:bold;border-radius:15px">${c}</div>`}
function toast(t){const x=$("toast");x.textContent=t;x.style.opacity=1;setTimeout(()=>x.style.opacity=0,2200)}
function escapeHtml(s){return String(s).replace(/[&<>"']/g,m=>({"&":"&amp;","<":"&lt;",">":"&gt;","\"":"&quot;","'":"&#39;"}[m]))}
