import fs from "node:fs";
import vm from "node:vm";
import path from "node:path";

const gameSource = fs.readFileSync(
  path.join(process.cwd(), "..", "script.js"),
  "utf8"
);

function element(id) {
  return {
    id,
    value:
      id === "nombreJoueurs"
        ? "2"
        : id === "nombreBots"
        ? "0"
        : id === "modeJeu"
        ? "1"
        : "",
    innerHTML: "",
    style: { display: "" },
    children: [],
    classList: {
      add() {},
      remove() {},
      toggle() {}
    },
    appendChild(x) {
      this.children.push(x);
    },
    removeChild() {},
    addEventListener() {},
    querySelector() {
      return null;
    },
    querySelectorAll() {
      return [];
    },
    onclick: null,
    textContent: ""
  };
}

function makeSandbox() {
  const els = new Map(
    [
      "nouvellePartie",
      "jeu",
      "nombreJoueurs",
      "nombreBots",
      "modeJeu",
      "fenetreRegles",
      "fenetreRolesCartes"
    ].map(id => [id, element(id)])
  );

  const document = {
    getElementById(id) {
      if (!els.has(id)) els.set(id, element(id));
      return els.get(id);
    },
    createElement() {
      return element("created");
    }
  };

  return {
    console,
    document,
    globalThis: null,
    window: null,
    setTimeout,
    clearTimeout,
    Math,
    JSON,
    Array,
    Object,
    Number,
    String,
    Boolean,
    Date,
    RegExp,
    parseInt,
    parseFloat,
    isNaN
  };
}

export class AtoumoulinEngine {
  constructor(names, bots = [], mode = 1){
    this.sandbox = makeSandbox();

    this.sandbox.globalThis = this.sandbox;
    this.sandbox.window = this.sandbox;

    vm.createContext(this.sandbox);

    vm.runInContext(gameSource, this.sandbox, {
      filename: "script.js"
    });

    this.sandbox.__atoumoulinInitMultiplayer(
    names,
    bots,
    mode
    );
  }

  stateFor(viewIndex, selection = null) {
    const s = this.sandbox;

    if (
      selection === null &&
      typeof s.__atoumoulinGetSelection === "function"
    ) {
      selection = s.__atoumoulinGetSelection();
    }

    const raw =
      typeof s.__atoumoulinGetState === "function"
        ? s.__atoumoulinGetState()
        : null;

    if (!raw) {
      throw new Error(
        "Le moteur Atoumoulin n'a pas été initialisé."
      );
    }

    const revealDouble9 =
       Number(viewIndex) === Number(raw.joueurActuel) &&
       raw.actionEnCours === "double9";

    const players = raw.joueurs.map((p, i) => {
    const own = i === viewIndex;

       return {
        id: i,
        name: p.nom,
        score: p.score,
        bot: !!p.bot,
        cardCount: p.main.length,
        main: own || revealDouble9
            ? p.main.slice()
            : Array(p.main.length).fill(null)
        };
    });

    return {
      players,
      deckCount: raw.paquet.length,
      table: raw.cartesTable,
      discard: raw.defaussePouvoirs,
      history: String(raw.historique || ""),
      currentPlayer: raw.joueurActuel,
      action: raw.actionEnCours,
      target: raw.cibleChoisie,
      selection,
      toursJoker: raw.toursJoker,
      winner:
      raw.gagnantPartie == null
      ? null
      : typeof raw.gagnantPartie === "number"
      ? raw.joueurs[raw.gagnantPartie]?.nom ?? null
      : raw.gagnantPartie.nom ?? null,
      roundWinner:
        raw.gagnantManche == null
          ? null
          : raw.joueurs[raw.gagnantManche]?.nom ?? null,
      roundEnded: !!raw.mancheTerminee,
      player17: raw.joueur17,
      card17Pending: raw.carte17EnAttente,
      double17Cards: raw.cartesDouble17,
      double17Active: !!raw.double17EnCours,
      player19: raw.joueur19,
      victories: raw.victoires
    };
  }

  currentIndex() {
    return Number(
      this.sandbox.__atoumoulinGetState().joueurActuel
    );
  }

  setBot(index, value = true) {
    this.sandbox.__atoumoulinSetBot(index, value);
  }

  runBotTurn(index) {
    const s = this.sandbox;

    const state = s.__atoumoulinGetState();

    if (
      !state ||
      !state.joueurs[index] ||
      !state.joueurs[index].bot
    ) {
      return false;
    }

    if (
      Number(state.joueurActuel) !== Number(index)
    ) {
      return false;
    }

    const previousRemote = !!s.__atoumoulinRemote;

    s.__atoumoulinRemote = false;

    try {
      if (state.actionEnCours === null) {
        s.jouerTourBot();
      } else {
        s.gererActionBot();
      }
    } finally {
      s.__atoumoulinRemote = previousRemote;
    }

    return true;
  }

  setPlayerIndex(index) {
    this.sandbox.__atoumoulinPlayerIndex = Number(index);
}

setSelection(value) {
    this.sandbox.__atoumoulinSetSelection(value);
}

selectCard(index, playerIndex) {
    this.setPlayerIndex(playerIndex);
    this.sandbox.__atoumoulinSelectCard(index);
}

selectDouble13(index, playerIndex) {
    this.setPlayerIndex(playerIndex);
    this.sandbox.__atoumoulinSelectDouble13(index);
}

  apply(fn, args = []) {
    const allowed = new Set([
      "jouerCarte",
      "effetCarte11",
      "effetCarte21",
      "effetDouble11",
      "effetDouble21",
      "effetJoker",
      "choisirAdversaireVol1",
      "choisirAdversaireCarte3",
      "choisirAdversaireCarte9",
      "choisirAdversaireCarte13",
      "volerCarte13",
      "doublerCarte15",
      "choisirAdversaireCarte17",
      "continuerCarte17",
      "choisirAdversaireCarte19",
      "cibleCarte21",
      "echangeJoker",
      "choisirAdversaireDouble1",
      "choisirAdversaireDouble3",
      "choisirAdversaireDouble9",
      "choisirAdversaireDouble13",
      "volerCartesDouble13",
      "terminerDouble13",
      "triplerCarte15",
      "terminerDouble15",
      "choisirAdversaireDouble17",
      "choisirCarteDouble17",
      "continuerDouble17",
      "choisirAdversaireDouble19",
      "effectuerEchangeDouble19",
      "cibleDouble21",
      "terminer17SansCarte",
      "preparerNouvelleManche"
    ]);

    if (!allowed.has(fn)) {
      throw new Error("Action non autorisée.");
    }

    const f = this.sandbox[fn];

    if (typeof f !== "function") {
      throw new Error("Action introuvable.");
    }

    f(...args);
  }
}
