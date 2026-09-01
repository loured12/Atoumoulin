import { AtoumoulinEngine } from "./engine.js";

for (let n = 2; n <= 8; n++) {
  const names = Array.from({length:n}, (_,i)=>`P${i+1}`);
  const e = new AtoumoulinEngine(names);
  const s = e.stateFor(0);

  if (s.players.length !== n) throw new Error(`${n} joueurs: nombre incorrect`);
  if (s.players.some(p => p.cardCount !== 4)) {
    throw new Error(`${n} joueurs: distribution initiale incorrecte`);
  }
  if (s.players.some(p => !p.name)) {
    throw new Error(`${n} joueurs: nom manquant`);
  }

  // Vérifie que tous les sièges peuvent devenir bots sans casser l'état.
  for (let i=0;i<n;i++) e.setBot(i,true);
  const after = e.stateFor(0);
  if (after.players.length !== n) throw new Error(`${n} joueurs: bots cassent la partie`);
  if (after.players.some(p => !p.bot)) throw new Error(`${n} joueurs: bot non enregistré`);
  console.log(`OK ${n} joueurs`);
}
console.log("OK : tests 2 à 8 joueurs terminés");
