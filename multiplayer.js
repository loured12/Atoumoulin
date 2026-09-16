(() => {
  const params = new URLSearchParams(location.search);
  const SERVER_URL =
    window.ATOUMOULIN_SERVER_URL ||
    params.get("server") ||
    localStorage.getItem("atoumoulin_server_url") ||
    "wss://atoumoulin.onrender.com";

  const SAVED_NAME = localStorage.getItem("atoumoulin_name") || "Joueur";

    let messageConnexion = null;

  function afficherMessageConnexion(message) {
    if (!messageConnexion) {
      messageConnexion = document.createElement("div");
      messageConnexion.id = "messageConnexion";

      Object.assign(messageConnexion.style, {
        position: "fixed",
        top: "20px",
        left: "50%",
        transform: "translateX(-50%)",
        zIndex: "9999",
        padding: "12px 20px",
        borderRadius: "8px",
        background: "#222",
        color: "white",
        fontSize: "16px",
        textAlign: "center",
        boxShadow: "0 2px 8px rgba(0,0,0,0.3)"
      });

      document.body.appendChild(messageConnexion);
    }

    messageConnexion.textContent = message;
  }

  function cacherMessageConnexion() {
    if (messageConnexion) {
      messageConnexion.remove();
      messageConnexion = null;
    }
  }

  let chatBadge = null;
  let chatOuvert = false;
  let ws = null, myId = localStorage.getItem("atoumoulin_player_id") || null, sessionToken = localStorage.getItem("atoumoulin_player_token") || null, room = null, started = false, lastSeq = 0, reconnectTimer = null;

  // Action à envoyer dès que la connexion WebSocket est ouverte
  let pendingAction = null;

  const ACTIONS = new Set([
    "jouerCarte","effetCarte11","effetCarte21","effetDouble11","effetDouble21","effetJoker",
    "choisirAdversaireVol1","choisirAdversaireCarte3","choisirAdversaireCarte9",
    "choisirAdversaireCarte13","volerCarte13","doublerCarte15","choisirAdversaireCarte17",
    "continuerCarte17","choisirAdversaireCarte19","cibleCarte21","echangeJoker",
    "choisirAdversaireDouble1","choisirAdversaireDouble3","choisirAdversaireDouble9",
    "choisirAdversaireDouble13","volerCartesDouble13","terminerDouble13","triplerCarte15",
    "terminerDouble15","choisirAdversaireDouble17","choisirCarteDouble17","continuerDouble17",
    "choisirAdversaireDouble19","effectuerEchangeDouble19","cibleDouble21",
    "terminer17SansCarte","preparerNouvelleManche"
  ]);

  const $ = id => document.getElementById(id);

  const boutonNouvellePartie = $("nouvellePartie");

  if(boutonNouvellePartie){
  boutonNouvellePartie.addEventListener("click", e => {

    if(!started)
      return;

    e.stopImmediatePropagation();

    if(!room || myId !== room.hostId){
      return status("⚠️ Seul l'hôte peut lancer une nouvelle manche.");
    }

    const confirmer = confirm(
      "La manche actuelle sera réinitialisée pour tous les joueurs.\n\nContinuer ?"
    );

    if(!confirmer)
      return;

    send({
      type:"game:action",
      fn:"nouvellePartieMultijoueur",
      args:[
      Number(document.getElementById("modeJeu").value || 1)
      ]
    });

  }, true);
  }

  const send = m => {

  if (!ws || ws.readyState !== WebSocket.OPEN)
    return false;

  ws.send(JSON.stringify(m));

  return true;
};

  const status = t => {
    if ($("multiStatus")) $("multiStatus").textContent = t;
  };

  const style = document.createElement("style");
  style.textContent = `#multiBox{margin:16px auto;max-width:700px;padding:16px;border:1px solid #aaa;border-radius:12px;background:#fff}
  #multiBox input,#multiBox select,#multiBox button{margin:4px;padding:8px;font-size:16px}
  #multiStatus{font-weight:bold;margin:8px 0}.mp-player{padding:4px 0}
  #multiChat{height:150px;overflow:auto;border:1px solid #bbb;padding:8px}`;
  document.head.appendChild(style);

  const box = document.createElement("section");
  box.id = "multiBox";

  box.innerHTML = `<h2>🌐 Multijoueur</h2>
  <div id="multiStatus">${SERVER_URL ? "Prêt à se connecter" : "Version solo disponible"}</div>
  <input id="mpName" maxlength="24" value="${SAVED_NAME.replace(/"/g,"&quot;")}" placeholder="Ton nom">
  <select id="mpMax">${[2,3,4,5,6,7,8].map(n=>`<option value="${n}">${n} joueurs max</option>`).join("")}</select>
  <button id="mpCreate">Créer un salon</button>
  <input id="mpCode" maxlength="6" placeholder="CODE">
  <button id="mpJoin">Rejoindre</button>
  <div id="mpRoom" hidden>
    <div>Salon : <strong id="mpRoomCode"></strong></div>
    <div id="multiPlayers"></div>
    <button id="mpStart">Lancer la partie</button>
  </div>`;

  document.body.insertBefore(box, document.body.firstChild);

  function afficherBulleChat() {

  if (document.getElementById("chatBulle"))
    return;

  const chatBulle = document.createElement("div");

  chatBulle.id = "chatBulle";
  chatBulle.textContent = "💬";

  Object.assign(chatBulle.style, {
    position: "fixed",
    right: "20px",
    bottom: "20px",
    width: "55px",
    height: "55px",
    borderRadius: "50%",
    background: "#222",
    color: "white",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    fontSize: "28px",
    cursor: "pointer",
    zIndex: "10000",
    boxShadow: "0 3px 10px rgba(0,0,0,0.3)",
    userSelect: "none",
    touchAction: "none"
  });

  document.body.appendChild(chatBulle);

  chatBadge = document.createElement("div");

chatBadge.id = "chatBadge";

Object.assign(chatBadge.style, {
  position: "absolute",
  top: "2px",
  right: "2px",
  width: "10px",
  height: "10px",
  borderRadius: "50%",
  background: "red",
  display: "none"
});

chatBulle.appendChild(chatBadge);

const chatFenetre = document.createElement("div");

chatFenetre.id = "chatFenetre";

Object.assign(chatFenetre.style, {
  position: "fixed",
  right: "20px",
  bottom: "90px",
  width: "280px",
  maxWidth: "calc(100vw - 40px)",
  height: "320px",
  background: "#d4af37",
  border: "2px solid #9e1717",
  borderRadius: "12px",
  boxShadow: "0 4px 15px rgba(0,0,0,0.3)",
  zIndex: "9999",
  display: "none",
  overflow: "hidden"
});

chatFenetre.innerHTML = `
  <div style="
    padding:10px;
    background:#9e1717;
    color:white;
    font-weight:bold;
  ">
    💬 Chat
  </div>

  <div id="chatFenetreMessages" style="
    height:225px;
    overflow-y:auto;
    padding:8px;
    color:#17351f;
    text-align:left;
  "></div>

  <div style="
    display:flex;
    padding:6px;
    gap:4px;
  ">
    <input
      id="chatFenetreTexte"
      maxlength="300"
      placeholder="Écris ici..."
      style="
        flex:1;
        min-width:0;
        padding:5px 7px;
        border:1px solid #9e1717;
        border-radius:8px;
        background:#b8d8bd !important;
        color:#17351f;
        outline:none;
      "
    >

    <button
      id="chatFenetreEnvoyer"
      style="
        padding:7px 10px;
        border-radius:8px;
        background:linear-gradient(145deg,#245c31,#12381c);
        color:#fff1a8;
        border:1px solid #9e1717;
        cursor:pointer;
      "
    >
      Envoyer
    </button>
  </div>
`;

document.body.appendChild(chatFenetre);

    $("chatFenetreEnvoyer").onclick = () => {
  const i = $("chatFenetreTexte");

  if (i.value.trim())
    send({type:"chat:send",text:i.value});

  i.value = "";
  };

    $("chatFenetreTexte").addEventListener("keydown", e => {
  if (e.key === "Enter") {
    $("chatFenetreEnvoyer").click();
  }
});

  const chatInfo = document.createElement("div");

  chatInfo.textContent = "💬 Chat — déplace-moi si besoin";

  Object.assign(chatInfo.style, {
    position: "fixed",
    right: "20px",
    bottom: "85px",
    padding: "8px 12px",
    borderRadius: "8px",
    background: "#222",
    color: "white",
    fontSize: "14px",
    zIndex: "10000",
    boxShadow: "0 2px 6px rgba(0,0,0,0.25)"
  });

  document.body.appendChild(chatInfo);

chatBulle.addEventListener("click", e => {
  if (deplacement)
    return;

  chatOuvert = !chatOuvert;

  chatFenetre.style.display = chatOuvert ? "block" : "none";

  if (chatOuvert && chatBadge) {
    chatBadge.style.display = "none";
  }
});

document.addEventListener("click", e => {

  if (!chatOuvert)
    return;

  if (
    !chatFenetre.contains(e.target) &&
    e.target !== chatBulle
  ) {
    chatOuvert = false;
    chatFenetre.style.display = "none";
  }

});

  let deplacement = false;
  let debutX = 0;
  let debutY = 0;
  let positionX = 0;
  let positionY = 0;

  chatBulle.addEventListener("pointerdown", e => {
    deplacement = true;

    debutX = e.clientX;
    debutY = e.clientY;

    const rect = chatBulle.getBoundingClientRect();

    positionX = rect.left;
    positionY = rect.top;

    chatBulle.setPointerCapture(e.pointerId);

    chatInfo.remove();
  });

  chatBulle.addEventListener("pointermove", e => {
    if (!deplacement)
      return;

    positionX += e.clientX - debutX;
    positionY += e.clientY - debutY;

    debutX = e.clientX;
    debutY = e.clientY;

    const largeur = chatBulle.offsetWidth;
    const hauteur = chatBulle.offsetHeight;

    positionX = Math.max(
    0,
    Math.min(positionX, window.innerWidth - largeur)
    );

    positionY = Math.max(
    0,
    Math.min(positionY, window.innerHeight - hauteur)
    );

    chatBulle.style.left = `${positionX}px`;
    chatBulle.style.top = `${positionY}px`;
    chatBulle.style.right = "auto";
    chatBulle.style.bottom = "auto";
  });

  chatBulle.addEventListener("pointerup", () => {
    deplacement = false;
  });

  chatBulle.addEventListener("pointercancel", () => {
    deplacement = false;
  });

  setTimeout(() => {
    chatInfo.remove();
  }, 5000);
}
  
  function renderRoom(r) {
    room = r;
    $("mpRoom").hidden = false;
    $("mpRoomCode").textContent = r.code;

    $("multiPlayers").innerHTML =
      `<strong>${r.players.length}/${r.maxPlayers} joueurs</strong>` +
      r.players.map(p =>
        `<div class="mp-player">${p.bot?"🤖":"👤"} ${p.name}${p.id===r.hostId?" 👑":""}</div>`
      ).join("");

    $("mpStart").disabled =
      myId !== r.hostId ||
      r.players.length < 2 ||
      r.started;

    $("mpStart").style.display =
      myId === r.hostId && !r.started ? "" : "none";

    if(boutonNouvellePartie){
    boutonNouvellePartie.style.display =
        myId === r.hostId ? "" : "none";
    }

    const configurationJeu = document.querySelector(".configuration-jeu");

    if(configurationJeu){
    configurationJeu.style.display =
    myId === r.hostId ? "" : "none";
    }
  }

    function applyGameState(state, seq = 0, playerIndex) {
    if (seq && seq < lastSeq) return;
    if (seq) lastSeq = seq;

    if (typeof window.__atoumoulinApplyState === "function") {
    window.__atoumoulinApplyState(state, playerIndex);
    }
  }

  function connect() {
    if (!SERVER_URL) {
      status("Serveur non configuré — le mode solo fonctionne normalement.");
      return false;
    }

    if (
      ws &&
      (
        ws.readyState === WebSocket.OPEN ||
        ws.readyState === WebSocket.CONNECTING
      )
     ) return true;

    try {
      afficherMessageConnexion("Connexion au serveur… veuillez patienter.");
      ws = new WebSocket(SERVER_URL);
    } catch(e) {
      status("Adresse serveur invalide.");
      return false;
    }

    ws.onopen = () => {
      cacherMessageConnexion();
      status("Connecté au serveur");

      // Envoie l'action demandée au premier clic
      if (pendingAction) {
        const action = pendingAction;
        pendingAction = null;
        send(action);
      }
    };

    ws.onclose = () => {
      started = false;
      status("Connexion perdue — le mode solo reste disponible");
    };

    ws.onerror = () => {
      status("Impossible de joindre le serveur");
    };

    ws.onmessage = e => {
      let m;

      try {
        m = JSON.parse(e.data);
      } catch {
        return;
      }

      if (m.type === "error" || m.type === "fail")
    return status("⚠️ " + (m.message || "Erreur serveur."));

      if (m.playerId) {
        myId = m.playerId;
        localStorage.setItem("atoumoulin_player_id", myId);
      }

      if (m.token) {
        sessionToken = m.token;
        localStorage.setItem("atoumoulin_player_token", sessionToken);
      }

      if (m.room) {
        localStorage.setItem("atoumoulin_room_code", m.room.code);
        renderRoom(m.room);
      }

      if (m.type === "game:start") {
        started = true;
        status("Partie lancée");

        afficherBulleChat();

        setTimeout(() => {
        window.scrollTo({
        top: document.documentElement.scrollHeight,
        behavior: "smooth"
        });
       }, 300);
      }

      if (m.type === "game:state") {

        started = true;

        applyGameState(m.state, m.seq || 0, m.playerIndex);
      }

      if (m.type === "player:bot")
        status(`${m.name} est maintenant contrôlé par un bot`);

      if (m.type === "chat:message") {       
      const x = m.message;
      const d = document.createElement("div");

      const nom = document.createElement("strong");
        nom.textContent = `${x.playerName} : `;

        d.appendChild(nom);
        d.appendChild(document.createTextNode(x.text));

      const zoneChat = $("chatFenetreMessages");

      if (zoneChat) {
      zoneChat.appendChild(d);
      zoneChat.scrollTop = zoneChat.scrollHeight;
      }

      if (!chatOuvert && chatBadge) {
      chatBadge.style.display = "block";
      }       
     }
    };

    return true;
  }

  // Création du salon : fonctionne en un seul clic
  $("mpCreate").onclick = () => {
    localStorage.setItem("atoumoulin_name", $("mpName").value);

    const action = {
      type: "room:create",
      name: $("mpName").value,
      maxPlayers: Number($("mpMax").value)
    };

    if (ws && ws.readyState === WebSocket.OPEN) {
      send(action);
    } else if (connect()) {
      pendingAction = action;
    }
  };

  // Rejoindre ou récupérer sa place dans une partie en cours
  $("mpJoin").onclick = () => {

  localStorage.setItem(
    "atoumoulin_name",
    $("mpName").value
  );

  const code=$("mpCode").value
    .trim()
    .toUpperCase();

  if(!code){
    return status("⚠️ Entre le code du salon.");
  }

  const action={
    type:"room:join",
    name:$("mpName").value,
    code,
    playerId:myId,
    token:sessionToken
  };

  if(ws && ws.readyState===WebSocket.OPEN){
    
    send(action);
    
    }else{

    pendingAction=action;

    connect();
  }
};

  $("mpStart").onclick = () => send({
  type:"room:start",
  mode: Number($("modeJeu").value)
  });

  // Intercepte les fonctions de mutation du jeu uniquement quand une partie
  // réseau est réellement démarrée. Hors réseau, le jeu original est inchangé.
  function hook(name) {
    const original = window[name];

    if (typeof original !== "function") return;

    window[name] = function(...args) {

  if (!started)
    return original.apply(this,args);

  if(name === "preparerNouvelleManche"){

    if(!room || myId !== room.hostId){
      return status("⚠️ Seul l'hôte peut lancer une nouvelle manche.");
    }

    const confirmer = confirm(
      "La manche actuelle sera réinitialisée pour tous les joueurs.\n\nContinuer ?"
    );

    if(!confirmer)
      return;

  }

  return send({
    type:"game:action",
    fn:name,
    args
  });
  };
  }

  for (const fn of ACTIONS)
    hook(fn);

  function hookSelection(name) {
    const original = window[name];

    if (typeof original !== "function") return;

    window[name] = function(index) {
        if (!started)
            return original.call(this,index);

        original.call(this,index);

        return send({
            type:"game:select",
            selection: carteChoisie
        });
    };
}
  
  hookSelection("selectionnerCarte");
  hookSelection("selectionnerCarteDouble13");

  window.AtoumoulinMultiplayer = {
    enabled:() => started,

    sendAction:(fn,args=[]) =>
      send({
        type:"game:action",
        fn,
        args
      }),

    select:index =>
      send({
        type:"game:select",
        selection:Number(index)
      }),

    room:() => room,
    playerId:() => myId
  };
  
})();
