import { AtoumoulinEngine } from "./engine.js";

const e = new AtoumoulinEngine(["A","B"]);
e.setBot(0,true);
let s = e.stateFor(0);
if (s.players.length !== 2) throw new Error("2 joueurs attendus");
if (s.players.some(p => p.cardCount !== 4)) throw new Error("Distribution invalide");

const before = e.currentIndex();
if (before === 0) {
  e.runBotTurn(0);
  const after = e.stateFor(0);
  if (JSON.stringify(after) === JSON.stringify(s)) {
    throw new Error("Le bot n'a pas fait évoluer l'état");
  }
}
console.log("OK step5 : moteur + bot serveur");
