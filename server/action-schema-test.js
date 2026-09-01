import { ACTIONS, validateAction } from "./action-schema.js";
if (ACTIONS.size < 20) throw new Error("Liste d'actions incomplète");
for (const action of ACTIONS) {
  const r = validateAction({action,args:[]});
  if (!r.ok) throw new Error(`Action refusée: ${action}`);
}
if (validateAction({action:"hack",args:[]}).ok) throw new Error("Action inconnue acceptée");
if (validateAction({action:"jouerCarte",args:"bad"}).ok) throw new Error("Arguments invalides acceptés");
console.log(`OK action schema: ${ACTIONS.size} actions`);
