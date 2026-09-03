(() => {
  const params = new URLSearchParams(location.search);
  const SERVER_URL =
    window.ATOUMOULIN_SERVER_URL ||
    params.get("server") ||
    localStorage.getItem("atoumoulin_server_url") ||
    "wss://atoumoulin.onrender.com";

  const SAVED_NAME = localStorage.getItem("atoumoulin_name") || "Joueur";
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
  fn:"preparerNouvelleManche",
  args:[
  Number(document.getElementById("modeJeu").value || 1)
  ]
});

  }, true);
  }

  const send = m => {
    if (!ws || ws.readyState !== WebSocket.OPEN) return false;
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
    <h3>💬 Chat</h3><div id="multiChat"></div>
    <input id="mpText" maxlength="300" placeholder="Message"><button id="mpSend">Envoyer</button>
  </div>`;

  document.body.insertBefore(box, document.body.firstChild);

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

    if(boutonNouvellePartie){
    boutonNouvellePartie.style.display =
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

    if (ws && ws.readyState === WebSocket.OPEN) return true;

    try {
      ws = new WebSocket(SERVER_URL);
    } catch(e) {
      status("Adresse serveur invalide.");
      return false;
    }

    ws.onopen = () => {
      status("Connecté au serveur");

      const code = localStorage.getItem("atoumoulin_room_code");

      if (code && myId && sessionToken) {
        send({
          type:"room:reconnect",
          code,
          playerId:myId,
          token:sessionToken
        });
      }

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

      if (m.type === "error")
        return status("⚠️ " + m.message);

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

        d.textContent = `${x.playerName} : ${x.text}`;

        $("multiChat").appendChild(d);
        $("multiChat").scrollTop = $("multiChat").scrollHeight;
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

  // Rejoindre : fonctionne en un seul clic
  $("mpJoin").onclick = () => {
    localStorage.setItem("atoumoulin_name", $("mpName").value);

    const action = {
      type: "room:join",
      name: $("mpName").value,
      code: $("mpCode").value
    };

    if (ws && ws.readyState === WebSocket.OPEN) {
      send(action);
    } else if (connect()) {
      pendingAction = action;
    }
  };

  $("mpStart").onclick = () => send({
  type:"room:start",
  mode: Number($("modeJeu").value)
  });

  $("mpSend").onclick = () => {
    const i = $("mpText");

    if (i.value.trim())
      send({type:"chat:send",text:i.value});

    i.value = "";
  };

  $("mpText").addEventListener("keydown", e => {
    if (e.key === "Enter")
      $("mpSend").click();
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
