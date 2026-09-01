import { AtoumoulinEngine } from "./engine.js";
const names = ["Alice","Bob","Chloé","David","Emma","Farid","Gabi","Hugo"];
for (const n of [2,3,4,8]) {
  const e = new AtoumoulinEngine(names.slice(0,n));
  const s = e.stateFor(0);
  if (s.players.length !== n) throw new Error(`players=${s.players.length}`);
  if (s.players.some(p => p.cardCount !== 4)) throw new Error("initial deal");
  console.log(`OK ${n} joueurs — pioche ${s.deckCount}`);
}
