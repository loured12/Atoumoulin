export const ACTIONS = new Set([
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

export function validateAction(message) {
  if (!message || typeof message !== "object") return {ok:false,error:"Action invalide."};
  if (!ACTIONS.has(message.action)) return {ok:false,error:"Action non autorisée."};
  if (!Array.isArray(message.args)) return {ok:false,error:"Arguments invalides."};
  if (message.args.length > 12) return {ok:false,error:"Trop d'arguments."};
  return {ok:true};
}
