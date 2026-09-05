const bouton = document.getElementById("nouvellePartie");
const zoneJeu = document.getElementById("jeu");
const choixJoueurs = document.getElementById("nombreJoueurs");
const choixBots = document.getElementById("nombreBots");

function mettreAJourNombreBots(){

    let nombreJoueurs = Number(choixJoueurs.value);

    choixBots.innerHTML = "";

    for(let i = 0; i <= nombreJoueurs - 1; i++){

        let option = document.createElement("option");

        option.value = i;
        option.textContent =
            `${i} bot${i === 1 ? "" : "s"}`;

        choixBots.appendChild(option);

    }

}

choixJoueurs.addEventListener("change", mettreAJourNombreBots);

mettreAJourNombreBots();

const cartesBase = [
1,2,3,4,5,6,7,8,9,10,11,
12,13,14,15,16,17,18,19,20,21,
"Joker"
];

let joueurs = [];
let paquet = [];
let joueurActuel = 0;
let carteChoisie = null;
let cartesTable = [];
let defaussePouvoirs = [];
let historique = "";
let actionEnCours = null;
let cibleChoisie = null;
let modeJeu = 1;
let victoires = [];
let joueur17 = null;
let carte17EnAttente = null;
let cartesDouble17 = [];
let double17EnCours = false;
let joueur19 = null;
let toursJoker = {};
let gagnantPartie = null;
let gagnantManche = null;
let mancheTerminee = false;

const couleursJoueurs = [
    { couleur: "#FBC02D", rond: "🟡" }, // Joueur 1
    { couleur: "#F44336", rond: "🔴" }, // Joueur 2
    { couleur: "#4CAF50", rond: "🟢" }, // Joueur 3
    { couleur: "#2196F3", rond: "🔵" }, // Joueur 4
    { couleur: "#FF9800", rond: "🟠" }, // Joueur 5
    { couleur: "#9C27B0", rond: "🟣" }, // Joueur 6
    { couleur: "#795548", rond: "🟤" }, // Joueur 7
    { couleur: "#000000", rond: "⚫" }  // Joueur 8
];

function couleurJoueur(index){

    if(index === -1){
        return "";
    }

    return couleursJoueurs[index].rond;
}

bouton.onclick = function(){

let nombreJoueurs = Number(choixJoueurs.value);

modeJeu = Number(document.getElementById("modeJeu").value);

let nombreBots = Number(choixBots.value);

joueurs = [];
paquet = [];
cartesTable = [];
defaussePouvoirs = [];
historique = "";
joueurActuel = Math.floor(Math.random() * nombreJoueurs);

actionEnCours = null;
cibleChoisie = null;
carteChoisie = null;
toursJoker = {};

gagnantPartie = null;
gagnantManche = null;

// Nombre de paquets
let nombrePaquets;

if(nombreJoueurs <= 3){
    nombrePaquets = 2;
}else{
    nombrePaquets = nombreJoueurs - 1;
}

// Création paquet
for(let i=0;i<nombrePaquets;i++){
    paquet = paquet.concat(cartesBase);
}

// Mélange
paquet.sort(()=>Math.random()-0.5);

// Création joueurs
let positionsBots = [];

while(positionsBots.length < nombreBots){

    let position = Math.floor(
        Math.random() * (nombreJoueurs - 1)
    ) + 1;

    if(!positionsBots.includes(position)){
        positionsBots.push(position);
    }

}

for(let i=0;i<nombreJoueurs;i++){

    joueurs.push({
        nom:"Joueur "+(i+1),
        main:[],
        score:0,
        bot: positionsBots.includes(i)
    });

}

victoires = [];

joueurs.forEach(joueur => {
    victoires.push(0);
});

// Distribution
joueurs.forEach(joueur=>{

    for(let i=0;i<4;i++){
        joueur.main.push(paquet.pop());
    }

});

afficherJeu();

};

function afficherJeu(){

if(actionEnCours === "partieTerminee"){

    if(!gagnantPartie){

    zoneJeu.innerHTML =
    `
    <div class="fin-partie">

    <h2>⚖️ PARTIE TERMINÉE !</h2>

    <div class="fin-egalite">
    <h3>Égalité : aucun joueur ne remporte la partie.</h3>
    </div>

    <div class="fin-scores">

    <h3>📊 Scores</h3>

    ${[...joueurs]
    .map((joueur, index) => ({
        joueur: joueur,
        index: index
    }))
    .sort((a, b) => b.joueur.score - a.joueur.score)
    .map(({joueur, index}) => {

        let couleurScore = couleursJoueurs[index];

        return `
            <p>
                ${couleurScore.rond} ${joueur.nom} :
                ${joueur.score}
                point${joueur.score === 1 ? "" : "s"}
            </p>
        `;

        }).join("")}

    </div>
    </div>
    `;

    return;
}

    let indexGagnant = joueurs.indexOf(gagnantPartie);

    let scoreVictoire = obtenirScoreVictoire();

    zoneJeu.innerHTML =
    `
    <div class="fin-partie">

    <h2> PARTIE TERMINÉE !</h2>

    <h3 class="fin-gagnant">
    🏆 ${couleurJoueur(indexGagnant)}
    ${gagnantPartie.nom}
    ${couleurJoueur(indexGagnant)} 🏆
    </h3>

    <div class="fin-scores">

    <h3>📊 Scores</h3>

${[...joueurs]
.map((joueur, index) => ({
    joueur: joueur,
    index: index
}))
.sort((a, b) => {

    const distanceA = Math.abs(a.joueur.score - scoreVictoire);
    const distanceB = Math.abs(b.joueur.score - scoreVictoire);

    return distanceA - distanceB;

})
.map(({joueur, index}) => {

    let couleurScore = couleursJoueurs[index];
    let ecart = joueur.score - scoreVictoire;

    return `
        <p>
            ${couleurScore.rond} ${joueur.nom} :
            ${joueur.score} point${joueur.score === 1 ? "" : "s"}${ecart === 0 ? "" : ` | Écart ${ecart >= 0 ? "+" : "−"}${Math.abs(ecart)}`}
        </p>
    `;

}).join("")}

${modeJeu > 1 ? `
    <h3>🏆 Victoires :</h3>

    ${joueurs
    .map((joueur, index) => ({
        joueur: joueur,
        index: index,
        victoires: victoires[index]
    }))
    .sort((a, b) => b.victoires - a.victoires)
    .map(item => {

        let couleurScore = couleursJoueurs[item.index];

        return `
            <p>
                ${couleurScore.rond} ${item.joueur.nom} :
                ${item.victoires}
                victoire${item.victoires === 1 ? "" : "s"}
            </p>
        `;

        }).join("")}
    ` : ""}

    </div>
    </div>
    `;

    return;
}

if(actionEnCours === "entreManches"){
    afficherFinManche(gagnantManche);
    return;
}

zoneJeu.innerHTML = "";

// Score à atteindre

let scoreVictoire = obtenirScoreVictoire();

zoneJeu.innerHTML +=
`
<div class="score-cible">
    <span class="score-cible-label">
        🎯 Score à atteindre :
    </span>

    <span class="score-cible-points">
        ${scoreVictoire} points
    </span>
</div>
`;

// Scores

zoneJeu.innerHTML +=
`
<div class="scores-fixes">

    <div class="scores-titre">
        SCORES
    </div>

    <div class="scores-joueurs">

        ${
            joueurs.map((joueur, index) => {

                let couleurScore = couleursJoueurs[index];

                return `
                <div class="score-joueur">

                    <span class="score-joueur-nom">
                        ${couleurScore.rond} ${joueur.nom}
                    </span>

                    <strong class="score-joueur-points">
                        ${joueur.score} pts
                    </strong>

                    <span class="score-joueur-cartes">
                        ${joueur.cardCount ?? joueur.main.length} carte${(joueur.cardCount ?? joueur.main.length) === 1 ? "" : "s"}
                    </span>

                    ${
                        modeJeu !== 1
                        ? `
                        <span class="score-joueur-victoires">
                            🏆${victoires[index]}
                        </span>
                        `
                        : ""
                    }

                </div>
                `;

            }).join("")
        }

    </div>

</div>
`;

// Table

zoneJeu.innerHTML +=
`
<div class="titre-section">
    🎴 Points marqués
</div>
`;

if(cartesTable.length > 0){

    joueurs.forEach(joueur => {

        let cartesJoueur = cartesTable.filter(carte =>
            carte.proprietaire === joueur.nom
        );

        let couleurJoueur =
            couleursJoueurs[joueurs.indexOf(joueur)];

        zoneJeu.innerHTML +=
        `
        <div class="points-marques-joueur">
            ${couleurJoueur.rond} ${joueur.nom} ${couleurJoueur.rond}
        </div>
        `;

        if(cartesJoueur.length > 0){

        zoneJeu.innerHTML +=
        `
        <div class="cartes-marquees">

        ${
        cartesJoueur.map(carte => {

        if(carte.historiqueCarte){

            return `
            <span class="historique-carte">
                (${carte.historiqueCarte.join("/")})
            </span>
            <strong class="points-score">
                ${carte.valeur}
            </strong>
            `;

            }

            return `
            <strong class="points-score">
            ${carte.valeur}
            </strong>
            `;

            }).join(
            ' <span class="separateur-score">➜</span> '
            )

            }

            </div>
            `;

            }else{

            zoneJeu.innerHTML +=
            `
            <div class="cartes-marquees vide"></div>
            `;

       }

   });

}

// Défausse

zoneJeu.innerHTML +=
`
<div class="titre-section">
    🪄 Défausse pouvoirs
</div>
`;

if(defaussePouvoirs.length === 0){

}else{

    zoneJeu.innerHTML +=
    `
    ${
        defaussePouvoirs.map(carte => `
            <strong class="defausse-pouvoir-carte">
            ${carte.valeur}
            </strong>
        `).join(
            ' <span class="separateur-score">➜</span> '
        )
    }
    <br>
    `;

}

let nombreCartesVisibles = Math.min(paquet.length, 3);

if(paquet.length === 0){

    zoneJeu.innerHTML +=
    `
    <div class="pioche-vide">
        Vide
    </div>
    `;

}else{

    zoneJeu.innerHTML +=
    `
    <div class="pioche-container">

        ${
            Array.from(
                {length: nombreCartesVisibles},
                (_, index) => `
                    <div class="carte-dos-pioche carte-pioche-${index + 1}">
                        ${
                            index === nombreCartesVisibles - 1
                            ? `
                            <div class="pioche-nombre">
                                ${paquet.length}
                            </div>
                            <div class="pioche-cartes">
                                cartes
                            </div>
                            `
                            : ""
                        }
                    </div>
                `
            ).join("")
        }

    </div>
    `;

}

let monIndex = globalThis.__atoumoulinRemote &&
               Number.isInteger(globalThis.__atoumoulinPlayerIndex)
    ? globalThis.__atoumoulinPlayerIndex
    : joueurActuel;

let joueur = joueurs[monIndex];
let joueurTour = joueurs[joueurActuel];

if(joueur.bot && !globalThis.__atoumoulinRemote){

    if(actionEnCours === null){

        jouerTourBot();

    }else{

        gererActionBot();

    }

    return;
}

// Vérifier si ce joueur doit passer un tour à cause du double Joker

if(toursJoker[joueurActuel] > 0 && actionEnCours === null){

toursJoker[joueurActuel]--;

passerJoueur();

afficherJeu();

return;

}

if(!globalThis.__atoumoulinRemote &&
   joueurTour.main.length === 0 &&
   actionEnCours === null){

    let joueursAvecCartes = joueurs.filter(j => j.main.length > 0);

    // PLUS PERSONNE N'A DE CARTE

   if(joueursAvecCartes.length === 0){

    historique +=
    `🏁 Plus aucun joueur n'a de carte. Fin de la manche.<br>`;

    verifierFinPartie();

    return;
}

    // CE JOUEUR N'A PLUS DE CARTE

    historique += `${joueurTour.nom} n'a plus de cartes et passe son tour.<br>`;

    // Chercher le prochain joueur possédant
    // encore au moins une carte

    let prochainJoueur = joueurActuel;

    do {

        prochainJoueur++;

        if(prochainJoueur >= joueurs.length){
            prochainJoueur = 0;
        }

    } while(
        joueurs[prochainJoueur].main.length === 0 &&
        prochainJoueur !== joueurActuel
    );

    joueurActuel = prochainJoueur;

    afficherJeu();

    return;
}

let couleurTour = couleursJoueurs[joueurActuel];

zoneJeu.innerHTML +=
`
<div class="tour-joueur">
    ${couleurTour.rond} Tour de ${joueurTour.nom} ${couleurTour.rond}
</div>
`;

// Cartes de l'adversaire si ce n'est pas mon tour

if(monIndex !== joueurActuel){

    zoneJeu.innerHTML +=
    `<h3>Cartes de ${joueurTour.nom} :</h3>`;

    for(let i = 0; i < Number(joueurTour.cardCount || joueurTour.main.length); i++){
        zoneJeu.innerHTML +=
        `
        <div class="carte carte-dos-adversaire"></div>
        `;
    }
}

// Ma propre main

zoneJeu.innerHTML +=
"<h3>Votre main :</h3>";

let maMain = joueurs[monIndex];

if(!maMain){
    return;
}

let aUn7 = maMain.main.includes(7);
let doubles = trouverDoubles(maMain.main);
let doublesAffichables = cartesDoublesAffichables(maMain.main);

maMain.main.forEach((carte,index)=>{

    if(aUn7 && carte !== 7){
        return;
    }

    if(!aUn7 &&
       doubles.length > 0 &&
       !doublesAffichables.includes(carte)){
        return;
    }

    let nombreDejaAffichees = maMain.main
        .slice(0,index)
        .filter(c => c === carte)
        .length;

    if(nombreDejaAffichees >= 2){
        return;
    }

    let selectionnable = monIndex === joueurActuel;

    zoneJeu.innerHTML +=
    `
    <button
        class="carte ${
            selectionnable &&
            (
                Array.isArray(carteChoisie)
                    ? carteChoisie.includes(index)
                    : carteChoisie === index
            ) &&
            actionEnCours === null
                ? "selectionnee"
                : ""
        }"
        ${selectionnable ? `onclick="selectionnerCarte(${index})"` : ""}
    >
    ${carte}
    </button>
    `;
});

if(monIndex === joueurActuel &&
   carteChoisie !== null &&
   actionEnCours === null){

    zoneJeu.innerHTML +=
    `
    <br><button onclick="jouerCarte()">Jouer</button>
    `;

}

if(actionEnCours === "double1"){

zoneJeu.innerHTML +=
`<h3>Choisir un adversaire :</h3>`;

joueurs.forEach((cible,index)=>{

if(index !== joueurActuel){

zoneJeu.innerHTML +=
`
<button onclick="choisirAdversaireDouble1(${index})">
${cible.nom}
</button>
`;

}

});

}

if(actionEnCours === "vol1"){

zoneJeu.innerHTML +=
"<h3>Choisir un adversaire :</h3>";

joueurs.forEach((adversaire,index)=>{

if(index !== joueurActuel){

zoneJeu.innerHTML +=
`
<button onclick="choisirAdversaireVol1(${index})">
${adversaire.nom}
</button>
`;

}

});

}

if(actionEnCours === "double3"){

zoneJeu.innerHTML +=
`<h3>Choisir un adversaire :</h3>`;

joueurs.forEach((adversaire,index)=>{

if(index !== joueurActuel){

zoneJeu.innerHTML +=
`
<button onclick="choisirAdversaireDouble3(${index})">
${adversaire.nom}
</button>
`;

}

});

}
  
if(actionEnCours === "carte3"){

zoneJeu.innerHTML +=
"<h3>Choisir un adversaire :</h3>";

joueurs.forEach((adversaire,index)=>{

if(index !== joueurActuel){

zoneJeu.innerHTML +=
`
<button onclick="choisirAdversaireCarte3(${index})">
${adversaire.nom}
</button>
`;

}

});

}

if(actionEnCours === "double9"){

    const afficherDouble9 =
    !globalThis.__atoumoulinRemote ||
    Number(globalThis.__atoumoulinPlayerIndex) ===
    Number(joueurActuel);

    if(afficherDouble9){

        zoneJeu.innerHTML +=
        "<h3>👀 Voici les mains de vos adversaires :</h3>";

        joueurs.forEach((adversaire,index)=>{

            if(index !== joueurActuel){

                zoneJeu.innerHTML +=
                `
                <h4>${adversaire.nom}</h4>
                `;

                if(adversaire.main.length === 0){

                    zoneJeu.innerHTML +=
                    "Aucune carte<br>";

                }else{

                    zoneJeu.innerHTML +=
                    `
                    ${adversaire.main.map(carte =>
                    `
                    <span class="carte-adversaire-double9">
                        ${carte}
                    </span>
                    `
                    ).join("")}
                    <br>
                    `;
                }

                zoneJeu.innerHTML +=
                `
                <button onclick="choisirAdversaireDouble9(${index})">
                    Échanger ma main avec ${adversaire.nom}
                </button>
                <br>
                `;
            }
        });
    }
}

if(actionEnCours === "carte9"){

zoneJeu.innerHTML +=
"<h3>Choisir un adversaire :</h3>";

joueurs.forEach((adversaire,index)=>{

if(index !== joueurActuel){

zoneJeu.innerHTML +=
`
<button onclick="choisirAdversaireCarte9(${index})">
${adversaire.nom}
</button>
`;

}

});

}

if(actionEnCours === "double11"){

zoneJeu.innerHTML +=
"<h3>Choisir l'effet du double 11 :</h3>";

zoneJeu.innerHTML +=
`
<button onclick="effetDouble11(20)">
+20 pour moi
</button>

<button onclick="effetDouble11(-20)">
-20 pour moi
</button>
`;

}

if(actionEnCours === "carte11"){

zoneJeu.innerHTML +=
"<h3>Choisir l'effet du 11 :</h3>";

zoneJeu.innerHTML +=
`
<button onclick="effetCarte11(10)">
+10 points
</button>

<button onclick="effetCarte11(-10)">
-10 points
</button>
`;

}

if(actionEnCours === "double13"){

zoneJeu.innerHTML +=
"<h3>Choisir un adversaire :</h3>";

joueurs.forEach((adversaire,index)=>{

if(index !== joueurActuel){

zoneJeu.innerHTML +=
`
<button onclick="choisirAdversaireDouble13(${index})">
${adversaire.nom}
</button>
`;

}

});

}

if(actionEnCours === "double13choix"){

    let cible = joueurs[cibleChoisie];

    let cartesDisponibles = cartesTable.filter(carte =>
        carte.proprietaire === cible.nom &&
        carte.valeur !== 0
    );

    let nombreASelectionner =
        Math.min(2, cartesDisponibles.length);

    if(nombreASelectionner === 0){

        zoneJeu.innerHTML +=
        `
        <h3>${cible.nom} n'a aucune carte à points à voler.</h3>

        <button onclick="terminerDouble13()">
            Continuer
        </button>
        `;

        return;
    }

    zoneJeu.innerHTML +=
    `
    <h3>
        Choisir ${nombreASelectionner} carte${nombreASelectionner > 1 ? "s" : ""}
        à voler à ${cible.nom} :
    </h3>
    `;

    cartesTable.forEach((carte, carteIndex)=>{

        if(
            carte.proprietaire === cible.nom &&
            carte.valeur !== 0
        ){

            let selectionnee =
                Array.isArray(carteChoisie) &&
                carteChoisie.includes(carteIndex);

            zoneJeu.innerHTML +=
            `
            <button
                class="${selectionnee ? "double13-selectionnee" : ""}"
                onclick="selectionnerCarteDouble13(${carteIndex})"
            >
                ${carte.valeur > 0 ? "+" : ""}${carte.valeur} points
            </button>
            `;

        }

    });

    if(
        Array.isArray(carteChoisie) &&
        carteChoisie.length === nombreASelectionner
    ){

        zoneJeu.innerHTML +=
        `
        <br>
        <button onclick="volerCartesDouble13()">
            Voler les ${nombreASelectionner} cartes
        </button>
        `;
    }

    return;
}

if(actionEnCours === "carte13"){

zoneJeu.innerHTML +=
"<h3>Choisir un adversaire :</h3>";

joueurs.forEach((adversaire,index)=>{

if(index !== joueurActuel){

zoneJeu.innerHTML +=
`
<button onclick="choisirAdversaireCarte13(${index})">
${adversaire.nom}
</button>
`;

}

});

}

if(actionEnCours === "carte13choix"){

let cible = joueurs[cibleChoisie];

let cartesDisponibles = cartesTable.filter(carte =>
    carte.proprietaire === cible.nom && carte.valeur !== 0
);

if(cartesDisponibles.length === 0){

historique +=
`${joueurs[joueurActuel].nom} joue 13, aucune carte disponible<br>`;

actionEnCours = null;

passerJoueur();

afficherJeu();

return;

}

zoneJeu.innerHTML +=
`<h3>Choisir une carte à points de ${cible.nom} :</h3>`;

cartesTable.forEach((carte, carteIndex)=>{

if(carte.proprietaire === cible.nom && carte.valeur !== 0){

zoneJeu.innerHTML +=
`
<button onclick="volerCarte13(${carteIndex})">
${carte.valeur > 0 ? "+" : ""}${carte.valeur} points
</button>
`;

}

});

}

if(actionEnCours === "double15"){

    let cartesDisponibles = cartesTable.filter(carte =>
        carte.proprietaire === joueur.nom &&
        carte.valeur !== 0
    );

    if(cartesDisponibles.length === 0){

        zoneJeu.innerHTML +=
        `
        <h3>${joueur.nom} n'a aucune carte à points à tripler.</h3>

        <button onclick="terminerDouble15()">
            Continuer
        </button>
        `;

        return;
    }

    zoneJeu.innerHTML +=
    `
    <h3>Choisir une carte à points à tripler :</h3>
    `;

    cartesTable.forEach((carte, carteIndex)=>{

        if(
            carte.proprietaire === joueur.nom &&
            carte.valeur !== 0
        ){

            zoneJeu.innerHTML +=
            `
            <button
                onclick="triplerCarte15(${carteIndex})"
            >
                ${carte.valeur > 0 ? "+" : ""}${carte.valeur} points
            </button>
            `;

        }

    });

    return;
}

if(actionEnCours === "carte15"){

let cartesADoubler = cartesTable.filter(carte =>
    carte.proprietaire === joueur.nom && carte.valeur !== 0
);

if(cartesADoubler.length === 0){

historique +=
`${joueur.nom} n'a aucune carte à points à doubler avec le 15.<br>`;

actionEnCours = null;

passerJoueur();

afficherJeu();

return;

}

zoneJeu.innerHTML +=
"<h3>Choisir une carte à points à doubler :</h3>";

cartesTable.forEach((carte, carteIndex)=>{

if(carte.proprietaire === joueur.nom && carte.valeur !== 0){

zoneJeu.innerHTML +=
`
<button onclick="doublerCarte15(${carteIndex})">
${carte.valeur > 0 ? "+" : ""}${carte.valeur} points
</button>
`;

}

});

}

if(actionEnCours === "double17"){

zoneJeu.innerHTML +=
"<h3>Choisir un adversaire :</h3>";

joueurs.forEach((adversaire,index)=>{

if(index !== joueurActuel){

zoneJeu.innerHTML +=
`
<button onclick="choisirAdversaireDouble17(${index})">
${adversaire.nom}
</button>
`;

}

});

return;

}

if(actionEnCours === "double17revelee"){

zoneJeu.innerHTML +=
`
<h3> Cartes volées :</h3>

<button onclick="choisirCarteDouble17(0)">
${cartesDouble17[0]}
</button>
`;

if(cartesDouble17.length > 1){

zoneJeu.innerHTML +=
`
<button onclick="choisirCarteDouble17(1)">
${cartesDouble17[1]}
</button>
`;

}

zoneJeu.innerHTML +=
`
<h3>Choisir quelle carte jouer en premier</h3>
`;

return;

}

if(actionEnCours === "double17jouer"){

zoneJeu.innerHTML +=
`
<h3> Carte choisie : ${carte17EnAttente}</h3>

<button onclick="continuerDouble17()">
Jouer cette carte
</button>
`;

return;

}

if(actionEnCours === "carte17"){

    zoneJeu.innerHTML +=
    "<h3>Choisir un adversaire :</h3>";

    let adversairesDisponibles = 0;

    joueurs.forEach((adversaire,index)=>{

        if(index !== joueurActuel && adversaire.main.length > 0){

            adversairesDisponibles++;

            zoneJeu.innerHTML +=
            `
            <button onclick="choisirAdversaireCarte17(${index})">
            ${adversaire.nom}
            </button>
            `;

        }

    });

    // Personne n'a plus de carte à donner
    if(adversairesDisponibles === 0){

        zoneJeu.innerHTML +=
        `
        <p>😔 Aucun adversaire n'a encore de carte à donner.</p>
        <button onclick="terminer17SansCarte()">
        Défausser le 17 et terminer
        </button>
        `;

    }

}

if(actionEnCours === "carte17revelee"){

zoneJeu.innerHTML +=
`
<h3> Carte tirée : ${carte17EnAttente}</h3>

<button onclick="continuerCarte17()">
Continuer
</button>
`;

}

if(actionEnCours === "double19"){

    zoneJeu.innerHTML +=
    "<h3>Choisir un adversaire pour le double 19 :</h3>";

    joueurs.forEach((adversaire,index)=>{

        if(index !== joueurActuel){

            zoneJeu.innerHTML +=
            `
            <button onclick="choisirAdversaireDouble19(${index})">
            ${adversaire.nom}
            </button>
            `;

        }

    });

}

if(actionEnCours === "carte19"){

zoneJeu.innerHTML +=
"<h3>Choisir un adversaire :</h3>";

joueurs.forEach((adversaire,index)=>{

if(index !== joueurActuel){

zoneJeu.innerHTML +=
`
<button onclick="choisirAdversaireCarte19(${index})">
${adversaire.nom}
</button>
`;

}

});

}

if(actionEnCours === "double21"){

zoneJeu.innerHTML +=
"<h3>Choisir l'effet du double 21 :</h3>";

zoneJeu.innerHTML +=
`
<button onclick="effetDouble21(40)">
+40 pour moi
</button>

<button onclick="effetDouble21(-40)">
-40 à un adversaire
</button>
`;

}

if(actionEnCours === "double21cible"){

zoneJeu.innerHTML +=
"<h3>Choisir l'adversaire qui perd 40 points :</h3>";

joueurs.forEach((adversaire,index)=>{

if(index !== joueurActuel){

zoneJeu.innerHTML +=
`
<button onclick="cibleDouble21(${index})">
${adversaire.nom}
</button>
`;

}

});

}

if(actionEnCours === "carte21"){

zoneJeu.innerHTML +=
"<h3>Choisir l'effet du 21 :</h3>";

zoneJeu.innerHTML +=
`
<button onclick="effetCarte21(20)">
+20 pour moi
</button>

<button onclick="effetCarte21(-20)">
-20 à un adversaire
</button>
`;

}

if(actionEnCours === "carte21cible"){

zoneJeu.innerHTML +=
"<h3>Choisir l'adversaire qui perd 20 points :</h3>";

joueurs.forEach((adversaire,index)=>{

if(index !== joueurActuel){

zoneJeu.innerHTML +=
`
<button onclick="cibleCarte21(${index})">
${adversaire.nom}
</button>
`;

}

});

}

if(actionEnCours === "doubleJoker"){

zoneJeu.innerHTML +=
`
<h3>🃏 Double Joker</h3>
<p>${joueur.nom} passe ses 2 prochains tours</p>
`;

actionEnCours = null;

}

if(actionEnCours === "joker"){

zoneJeu.innerHTML +=
"<h3>Choisir l'effet du Joker :</h3>";

zoneJeu.innerHTML +=
`
<button onclick="effetJoker(10)">
+10 points
</button>

<button onclick="effetJoker(22)">
+22 points
</button>

<button onclick="effetJoker('echange')">
Échanger mes points avec un adversaire
</button>
`;

}

if(actionEnCours === "jokerCible"){

zoneJeu.innerHTML +=
"<h3>Choisir l'adversaire avec qui échanger les points :</h3>";

joueurs.forEach((adversaire,index)=>{

if(index !== joueurActuel){

zoneJeu.innerHTML +=
`
<button onclick="echangeJoker(${index})">
${adversaire.nom}
</button>
`;

}

});

}

let historiqueInverse = historique
    .split("<br>")
    .filter(function(ligne){
        return ligne.trim() !== "" &&
               !ligne.includes("Score :");
    })
    .reverse()
    .map(function(ligne){

        let joueurTrouve = joueurs.find(function(joueur){
    return ligne.trim().startsWith(joueur.nom);
});

        if(joueurTrouve){

            let indexJoueur = joueurs.indexOf(joueurTrouve);

            return `${couleurJoueur(indexJoueur)} ${ligne}`;

        }

        return ligne;

    })
    .join("<br>");

zoneJeu.innerHTML +=

`
<br>
<button onclick="afficherRolesCartes()">
✨ Rôle des cartes
</button>
<br>
`;
  
zoneJeu.innerHTML += `
<div class="historique-jeu">
    <h3>Historique :</h3>
    <div class="historique-contenu">
        ${historiqueInverse}
    </div>
</div>
`;

}

function selectionnerCarte(index){

    let monIndex = globalThis.__atoumoulinRemote
    ? Number(globalThis.__atoumoulinPlayerIndex)
    : joueurActuel;

    if(!Number.isInteger(monIndex) || !joueurs[monIndex]){
    monIndex = joueurActuel;
    }

    let joueur = joueurs[monIndex];
    let carte = joueur.main[index];
    let doubles = trouverDoubles(joueur.main);

    if(doubles.includes(carte)){

        carteChoisie = [];

        let nombreSelectionnees = 0;

        joueur.main.forEach((c,i)=>{

            if(c === carte && nombreSelectionnees < 2){

                carteChoisie.push(i);
                nombreSelectionnees++;

            }

        });

    }else{

        carteChoisie = index;

    }

    afficherJeu();
}

function jouerCarte(){

let joueur = joueurs[joueurActuel];
let cartesJouees = [];

// Cas double

if(Array.isArray(carteChoisie)){

carteChoisie.sort((a,b)=>b-a);

carteChoisie.forEach(index=>{

cartesJouees.push(joueur.main[index]);

joueur.main.splice(index,1);

});

}else{

cartesJouees.push(joueur.main[carteChoisie]);

joueur.main.splice(carteChoisie,1);

}

carteChoisie = null;

let carte = cartesJouees[0];

// Double

if(cartesJouees.length === 2){

let valeurDouble = cartesJouees[0];

// Double pair = points

if(valeurDouble % 2 === 0){

let resultat = valeurDouble * 2;

joueur.score += resultat;

// Le double pair devient une nouvelle carte
// avec les deux cartes identiques dans son historique

cartesTable.push({
    valeur: resultat,
    proprietaire: joueur.nom,
    liee: false,
    historiqueCarte: [valeurDouble, valeurDouble]
});

historique +=
`${joueur.nom} joue un double ${valeurDouble} (+${resultat})<br>`;

if(verifierFinPartie()){
    return;
}

}

// Double impair = pouvoir

else{

if(valeurDouble === 1){

defaussePouvoirs.push({
    valeur: valeurDouble,
    joueur: joueur.nom
});

defaussePouvoirs.push({
    valeur: valeurDouble,
    joueur: joueur.nom
});

actionEnCours = "double1";

afficherJeu();

return;

}

if(valeurDouble === 3){

defaussePouvoirs.push({
    valeur: 3,
    joueur: joueur.nom
});

defaussePouvoirs.push({
    valeur: 3,
    joueur: joueur.nom
});

actionEnCours = "double3";

afficherJeu();

return;

}

if(valeurDouble === 5){

defaussePouvoirs.push({
    valeur: valeurDouble,
    joueur: joueur.nom
});

defaussePouvoirs.push({
    valeur: valeurDouble,
    joueur: joueur.nom
});

let cartesPiochees = 0;

while(cartesPiochees < 4 && paquet.length > 0){

joueur.main.push(paquet.pop());
cartesPiochees++;

}

if(cartesPiochees === 0){

    historique +=
    `${joueur.nom} joue le double 5, aucune carte disponible<br>`;

}
else if(cartesPiochees === 1){

    historique +=
    `${joueur.nom} pioche 1 carte avec le double 5<br>`;

}
else{

    historique +=
    `${joueur.nom} pioche ${cartesPiochees} cartes avec le double 5<br>`;

}

// Tour suivant

passerJoueur();

carteChoisie = null;

afficherJeu();

return;

}

if(valeurDouble === 7){

    joueur.score += 40;

    cartesTable.push({
        valeur: 40,
        proprietaire: joueur.nom,
        liee: false,
        historiqueCarte: [7, 7]
    });

    defaussePouvoirs.push({
        valeur: 7,
        joueur: joueur.nom
    });

    defaussePouvoirs.push({
        valeur: 7,
        joueur: joueur.nom
    });

    historique +=
    `${joueur.nom} joue un double 7 (+40)<br>`;

    if(verifierFinPartie()){
        return;
    }

    if(gererMainVideMultijoueur()){
    return;
    }

    // Pas de pioche pour le double 7

    passerJoueur();

    carteChoisie = null;

    afficherJeu();

    return;

}

if(valeurDouble === 9){

defaussePouvoirs.push({
    valeur: valeurDouble,
    joueur: joueur.nom
});

defaussePouvoirs.push({
    valeur: valeurDouble,
    joueur: joueur.nom
});

// Pioche 1 carte immédiatement

piocherCarte(joueur);

// Ensuite, voir les mains adverses

actionEnCours = "double9";

afficherJeu();

return;

}

if(valeurDouble === 11){

    defaussePouvoirs.push({
        valeur: 11,
        joueur: joueur.nom
    });

    defaussePouvoirs.push({
        valeur: 11,
        joueur: joueur.nom
    });

    actionEnCours = "double11";
  
    afficherJeu();

    return;

}

if(valeurDouble === 13){

defaussePouvoirs.push({
    valeur: valeurDouble,
    joueur: joueur.nom
});

defaussePouvoirs.push({
    valeur: valeurDouble,
    joueur: joueur.nom
});

actionEnCours = "double13";

afficherJeu();

return;

}

if(valeurDouble === 15){

defaussePouvoirs.push({
    valeur: 15,
    joueur: joueur.nom
});

defaussePouvoirs.push({
    valeur: 15,
    joueur: joueur.nom
});

actionEnCours = "double15";

afficherJeu();

return;

}

if(valeurDouble === 17){

defaussePouvoirs.push({
    valeur: valeurDouble,
    joueur: joueur.nom
});

defaussePouvoirs.push({
    valeur: valeurDouble,
    joueur: joueur.nom
});

actionEnCours = "double17";

afficherJeu();

return;

}

if(valeurDouble === 19){

defaussePouvoirs.push({
    valeur: valeurDouble,
    joueur: joueur.nom
});

defaussePouvoirs.push({
    valeur: valeurDouble,
    joueur: joueur.nom
});

actionEnCours = "double19";

afficherJeu();

return;

}

if(valeurDouble === 21){

    defaussePouvoirs.push({
        valeur: 21,
        joueur: joueur.nom
    });

    defaussePouvoirs.push({
        valeur: 21,
        joueur: joueur.nom
    });

    actionEnCours = "double21";

    afficherJeu();

    return;

}

if(valeurDouble === "Joker"){

defaussePouvoirs.push({
    valeur: valeurDouble,
    joueur: joueur.nom
});

defaussePouvoirs.push({
    valeur: valeurDouble,
    joueur: joueur.nom
});

// Le joueur devra passer ses 2 prochains tours
toursJoker[joueurActuel] = 2;

actionEnCours = "doubleJoker";

historique +=
`${joueur.nom} joue un double Joker et devra passer ses 2 prochains tours<br>`;

// Pioche 1 carte

piocherCarte(joueur);

// Tour suivant

actionEnCours = null;

passerJoueur();

carteChoisie = null;

afficherJeu();

return;

}

}
  
piocherCarte(joueur);

passerJoueur();

carteChoisie = null;

afficherJeu();

return;

}

if(typeof carte==="number" && carte%2===0){

// Carte à points

joueur.score += carte;

if(verifierFinPartie()){
    return;
}

cartesTable.push({

valeur: carte,
proprietaire: joueur.nom,
liee: false

});

historique +=
`${joueur.nom} joue ${carte} (+${carte})<br>`;

}else{

// Cartes pouvoirs

if(carte === 1){

defaussePouvoirs.push({
valeur: carte,
joueur: joueur.nom
});

actionEnCours = "vol1";

afficherJeu();

return;

}
  
if(carte === 3){

defaussePouvoirs.push({
valeur: carte,
joueur: joueur.nom
});

actionEnCours = "carte3";

afficherJeu();

return;

}

if(carte === 5){

defaussePouvoirs.push({
valeur: carte,
joueur: joueur.nom
});

let cartesPiochees = 0;

while(cartesPiochees < 2 && paquet.length > 0){

joueur.main.push(paquet.pop());
cartesPiochees++;

}

if(cartesPiochees === 2){

    historique +=
    `${joueur.nom} pioche 2 cartes avec le 5<br>`;

}else if(cartesPiochees === 1){

    historique +=
    `${joueur.nom} pioche 1 carte avec le 5<br>`;

}else{

    historique +=
    `${joueur.nom} joue 5, aucune carte disponible<br>`;

}

// Tour suivant

passerJoueur();

afficherJeu();

return;

}

if(carte === 7){

defaussePouvoirs.push({
valeur: carte,
joueur: joueur.nom
});

joueur.score += 20;

if(verifierFinPartie()){
    return;
}

cartesTable.push({
valeur: 20,
proprietaire: joueur.nom,
liee: false,
historiqueCarte: [7]
});

historique +=
`${joueur.nom} joue 7 (+20)<br>`;

if(gererMainVideMultijoueur()){
    return;
}

passerJoueur();

afficherJeu();

return;

}

if(carte === 9){

defaussePouvoirs.push({
valeur: carte,
joueur: joueur.nom
});

// Le joueur pioche 1 carte avant l'échange

piocherCarte(joueur);

actionEnCours = "carte9";

afficherJeu();

return;

}

if(carte === 11){

defaussePouvoirs.push({
valeur: carte,
joueur: joueur.nom
});

actionEnCours = "carte11";

afficherJeu();

return;

}

if(carte === 13){

defaussePouvoirs.push({
valeur: carte,
joueur: joueur.nom
});

actionEnCours = "carte13";

afficherJeu();

return;

}

if(carte === 15){

defaussePouvoirs.push({
valeur: carte,
joueur: joueur.nom
});

actionEnCours = "carte15";

afficherJeu();

return;

}

if(carte === 17){

joueur17 = joueurActuel;

defaussePouvoirs.push({
valeur: carte,
joueur: joueur.nom
});

actionEnCours = "carte17";

afficherJeu();

return;

}

if(carte === 19){

defaussePouvoirs.push({
valeur: carte,
joueur: joueur.nom
});

actionEnCours = "carte19";

afficherJeu();

return;

}

if(carte === 21){

defaussePouvoirs.push({
valeur: carte,
joueur: joueur.nom
});

actionEnCours = "carte21";

afficherJeu();

return;

}

if(carte === "Joker"){

defaussePouvoirs.push({
valeur: carte,
joueur: joueur.nom
});

actionEnCours = "joker";

afficherJeu();

return;

}

defaussePouvoirs.push({

valeur: carte,
joueur: joueur.nom

});

historique +=
`${joueur.nom} joue ${carte}<br>`;

}

if(paquet.length>0){

joueur.main.push(paquet.pop());

}

if(gererMainVideMultijoueur()){
    return;
}

joueurActuel++;

if(joueurActuel>=joueurs.length){

joueurActuel=0;

}

carteChoisie=null;

afficherJeu();

}

function jouerTourBot(){

    let joueur = joueurs[joueurActuel];

    // Vérifier que le joueur actuel est bien un bot
    if(!joueur.bot){
        return;
    }

    // Chercher les doubles dans la main
    let doubles = trouverDoubles(joueur.main);

    // Le joueur doit obligatoirement jouer un double
    if(doubles.length > 0){

        let valeurDouble =
            doubles[Math.floor(Math.random() * doubles.length)];

        carteChoisie = [];

        let nombreSelectionnees = 0;

        joueur.main.forEach((carte,index)=>{

            if(carte === valeurDouble && nombreSelectionnees < 2){

                carteChoisie.push(index);
                nombreSelectionnees++;

            }

        });

        jouerCarte();

        return;
    }

    // Aucun double : choisir une carte simple
    let index =
        Math.floor(Math.random() * joueur.main.length);

    carteChoisie = index;

    jouerCarte();

}

function gererActionBot(){

    let joueur = joueurs[joueurActuel];

    if(!joueur.bot){
        return;
    }

    if(actionEnCours === null){
        return;
    }

    // CHOISIR UN ADVERSAIRE

  function choisirAdversaireAleatoire(){

    let adversaires = joueurs
        .map((joueur,index) => index)
        .filter(index => index !== joueurActuel);

    if(adversaires.length === 0){
        return null;
    }

    return adversaires[
        Math.floor(Math.random() * adversaires.length)
    ];

}

  function choisirMeilleureCible(){

    let adversaires = joueurs
        .map((joueur,index) => index)
        .filter(index => index !== joueurActuel);

    if(adversaires.length === 0){
        return null;
    }

    let meilleureCible = adversaires[0];

    adversaires.forEach(index => {

        if(joueurs[index].score > joueurs[meilleureCible].score){

            meilleureCible = index;

        }

    });

    return meilleureCible;
}

    // CARTE 1

    if(actionEnCours === "vol1"){

        let cible = choisirAdversaireAleatoire();

        if(cible !== null){
            choisirAdversaireVol1(cible);
        }

        return;
    }

    // DOUBLE 1

    if(actionEnCours === "double1"){

        let cible = choisirAdversaireAleatoire();

        if(cible !== null){
            choisirAdversaireDouble1(cible);
        }

        return;
    }

    // CARTE 3

    if(actionEnCours === "carte3"){

        let cible = choisirAdversaireAleatoire();

        if(cible !== null){
            choisirAdversaireCarte3(cible);
        }

        return;
    }

    // DOUBLE 3

    if(actionEnCours === "double3"){

        let cible = choisirAdversaireAleatoire();

        if(cible !== null){
            choisirAdversaireDouble3(cible);
        }

        return;
    }

    // CARTE 9

    if(actionEnCours === "carte9"){

        let cible = choisirAdversaireAleatoire();

        if(cible !== null){
            choisirAdversaireCarte9(cible);
        }

        return;
    }

    // DOUBLE 9

    if(actionEnCours === "double9"){

        let cible = choisirAdversaireAleatoire();

        if(cible !== null){
            choisirAdversaireDouble9(cible);
        }

        return;
    }

    // CARTE 11

    if(actionEnCours === "carte11"){

        let choix = Math.random() < 0.5 ? 10 : -10;

        effetCarte11(choix);

        return;
    }

    // DOUBLE 11

    if(actionEnCours === "double11"){

        let choix = Math.random() < 0.5 ? 20 : -20;

        effetDouble11(choix);

        return;
    }

    // CARTE 13

    if(actionEnCours === "carte13"){

        let cible = choisirAdversaireAleatoire();

        if(cible !== null){
            choisirAdversaireCarte13(cible);
        }

        return;
    }

    // CARTE 13 : CHOIX DE LA CARTE

    if(actionEnCours === "carte13choix"){

        let cible = joueurs[cibleChoisie];

        let cartesDisponibles = cartesTable
            .map((carte,index) => ({carte,index}))
            .filter(element =>
                element.carte.proprietaire === cible.nom &&
                element.carte.valeur !== 0
            );

        if(cartesDisponibles.length === 0){
            return;
        }

        let choix =
            cartesDisponibles[
                Math.floor(Math.random() * cartesDisponibles.length)
            ];

        volerCarte13(choix.index);

        return;
    }

    // DOUBLE 13

    if(actionEnCours === "double13"){

        let cible = choisirAdversaireAleatoire();

        if(cible !== null){
            choisirAdversaireDouble13(cible);
        }

        return;
    }

    // DOUBLE 13 : CHOIX DES CARTES

    if(actionEnCours === "double13choix"){

        let cible = joueurs[cibleChoisie];

        let cartesDisponibles = cartesTable
            .map((carte,index) => ({carte,index}))
            .filter(element =>
                element.carte.proprietaire === cible.nom &&
                element.carte.valeur !== 0
            );

        let nombreASelectionner =
            Math.min(2, cartesDisponibles.length);

        if(nombreASelectionner === 0){
            terminerDouble13();
            return;
        }

        carteChoisie = [];

        cartesDisponibles
            .slice(0,nombreASelectionner)
            .forEach(element => {

                carteChoisie.push(element.index);

            });

        volerCartesDouble13();

        return;
    }

    // CARTE 15
 
    if(actionEnCours === "carte15"){

        let cartesDisponibles = cartesTable
            .map((carte,index) => ({carte,index}))
            .filter(element =>
                element.carte.proprietaire === joueur.nom &&
                element.carte.valeur !== 0
            );

        if(cartesDisponibles.length === 0){
            return;
        }

        let choix =
            cartesDisponibles[
                Math.floor(Math.random() * cartesDisponibles.length)
            ];

        doublerCarte15(choix.index);

        return;
    }

    // DOUBLE 15

    if(actionEnCours === "double15"){

        let cartesDisponibles = cartesTable
            .map((carte,index) => ({carte,index}))
            .filter(element =>
                element.carte.proprietaire === joueur.nom &&
                element.carte.valeur !== 0
            );

        if(cartesDisponibles.length === 0){
            terminerDouble15();
            return;
        }

        let choix =
            cartesDisponibles[
                Math.floor(Math.random() * cartesDisponibles.length)
            ];

        triplerCarte15(choix.index);

        return;
    }

    // CARTE 17

    if(actionEnCours === "carte17"){

        let adversaires = joueurs
            .map((joueur,index) => index)
            .filter(index =>
                index !== joueurActuel &&
                joueurs[index].main.length > 0
            );

        if(adversaires.length === 0){
            terminer17SansCarte();
            return;
        }

        let cible =
            adversaires[
                Math.floor(Math.random() * adversaires.length)
            ];

        choisirAdversaireCarte17(cible);

        return;
    }

    // CARTE 17 : CARTE REVELEE

    if(actionEnCours === "carte17revelee"){

        continuerCarte17();

        return;
    }

    // DOUBLE 17

    if(actionEnCours === "double17"){

        let adversaires = joueurs
            .map((joueur,index) => index)
            .filter(index =>
                index !== joueurActuel &&
                joueurs[index].main.length > 0
            );

        if(adversaires.length === 0){
            return;
        }

        let cible =
            adversaires[
                Math.floor(Math.random() * adversaires.length)
            ];

        choisirAdversaireDouble17(cible);

        return;
    }

    // DOUBLE 17 : CARTE REVELEE

    if(actionEnCours === "double17revelee"){

        if(cartesDouble17.length === 0){
            return;
        }

        let choix =
            Math.floor(Math.random() * cartesDouble17.length);

        choisirCarteDouble17(choix);

        return;
    }

    // DOUBLE 17 : JOUER LA CARTE

    if(actionEnCours === "double17jouer"){

        continuerDouble17();

        return;
    }

    // CARTE 19

    if(actionEnCours === "carte19"){

        let cible = choisirAdversaireAleatoire();

        if(cible !== null){
            choisirAdversaireCarte19(cible);
        }

        return;
    }

    // DOUBLE 19

    if(actionEnCours === "double19"){

        let cible = choisirAdversaireAleatoire();

        if(cible !== null){
            choisirAdversaireDouble19(cible);
        }

        return;
    }

    // CARTE 21

    if(actionEnCours === "carte21"){

        let choix = Math.random() < 0.5 ? 20 : -20;

        effetCarte21(choix);

        return;
    }

    // CARTE 21 : CHOIX DE LA CIBLE

    if(actionEnCours === "carte21cible"){

        let cible = choisirAdversaireAleatoire();

        if(cible !== null){
            cibleCarte21(cible);
        }

        return;
    }

    // DOUBLE 21

    if(actionEnCours === "double21"){

        let choix = Math.random() < 0.5 ? 40 : -40;

        effetDouble21(choix);

        return;
    }

    // DOUBLE 21 : CHOIX DE LA CIBLE

    if(actionEnCours === "double21cible"){

        let cible = choisirAdversaireAleatoire();

        if(cible !== null){
            cibleDouble21(cible);
        }

        return;
    }

    // JOKER

    if(actionEnCours === "joker"){

        let choix = Math.floor(Math.random() * 3);

        if(choix === 0){

            effetJoker(10);

        }else if(choix === 1){

            effetJoker(22);

        }else{

            effetJoker("echange");

        }

        return;
    }

    // JOKER : CHOIX DE LA CIBLE

    if(actionEnCours === "jokerCible"){

        let cible = choisirAdversaireAleatoire();

        if(cible !== null){
            echangeJoker(cible);
        }

        return;
    }

}

function choisirCibleBot(){

    let adversaires = joueurs
        .map((joueur,index) => index)
        .filter(index => index !== joueurActuel);

    if(adversaires.length === 0){
        return null;
    }

    return adversaires.reduce((meilleur, index) => {

        if(joueurs[index].score > joueurs[meilleur].score){
            return index;
        }

        return meilleur;

    }, adversaires[0]);
}

function afficherChoixCible(){

let joueur = joueurs[joueurActuel];

zoneJeu.innerHTML += "<h3>Choisir un adversaire :</h3>";

joueurs.forEach((adversaire,index)=>{

if(index !== joueurActuel){

zoneJeu.innerHTML +=
`
<button onclick="choisirCible(${index})">
${adversaire.nom}
</button>
`;

}

});

}

function choisirCible(index){

cibleChoisie = index;

historique +=
`${joueurs[joueurActuel].nom} cible ${joueurs[index].nom}<br>`;

afficherJeu();

}

function choisirAdversaireVol1(index){

let cible = joueurs[index];
let joueur = joueurs[joueurActuel];
let carteVolee = null;

// Recherche de la dernière carte à points de la cible

for(let i = cartesTable.length - 1; i >= 0; i--){

if(cartesTable[i].proprietaire === cible.nom){

carteVolee = cartesTable[i];
cartesTable.splice(i,1);

break;

}

}

// Si une carte est trouvée

if(carteVolee !== null){

cible.score -= carteVolee.valeur;

joueur.score += carteVolee.valeur;

carteVolee.proprietaire = joueur.nom;

cartesTable.push(carteVolee);

if(verifierFinPartie()){
    afficherJeu();
    return;
}

historique +=
`${joueur.nom} vole la dernière carte de ${cible.nom} avec le 1<br>`;

}else{

historique +=
`${joueur.nom} ne trouve aucune carte à voler avec le 1<br>`;

}

// Si le 1 vient du double 17,
// on ne pioche pas encore et on ne change pas de joueur

if(double17EnCours){

actionEnCours = null;

reprendreDouble17();

return;

}

// Fonctionnement normal du 1

piocherCarte(joueur);

actionEnCours = null;

// Tour suivant

passerJoueur();

// Actualiser l'affichage
afficherJeu();

}

function choisirAdversaireCarte3(index){

let cible = joueurs[index];

cible.score -= 20;

cartesTable.push({
    valeur: -20,
    proprietaire: cible.nom,
    liee: false,
    historiqueCarte: [3]
});

if(verifierFinPartie()){
    afficherJeu();
    return;
}

historique +=
`${joueurs[joueurActuel].nom} inflige -20 à ${cible.nom} avec le 3<br>`;

// Si le 3 vient du double 17,
// on revient à la deuxième carte

if(double17EnCours){

actionEnCours = null;

carteChoisie = null;

reprendreDouble17();

return;

}

// Fonctionnement normal du 3

piocherCarte(joueurs[joueurActuel]);

actionEnCours = null;

// Passage au joueur suivant

passerJoueur();

carteChoisie = null;

afficherJeu();

}

function choisirAdversaireCarte9(index){

let cible = joueurs[index];
let joueur = joueurs[joueurActuel];

// Échange des mains

let mainTemporaire = joueur.main;

joueur.main = cible.main;

cible.main = mainTemporaire;

historique +=
`${joueur.nom} échange sa main avec ${cible.nom} avec le 9<br>`;

// Si le 9 vient du double 17,
// on continue avec la deuxième carte

if(double17EnCours){

actionEnCours = null;

carteChoisie = null;

reprendreDouble17();

return;

}

// Fonctionnement normal du 9

actionEnCours = null;

// Tour suivant

passerJoueur();

carteChoisie = null;

afficherJeu();

}

function effetCarte11(valeur){

let joueur = joueurs[joueurActuel];

joueur.score += valeur;

if(verifierFinPartie()){
    return;
}

cartesTable.push({
valeur: valeur,
proprietaire: joueur.nom,
liee: false,
historiqueCarte: [11]
});

historique +=
`${joueur.nom} choisit ${valeur > 0 ? "+" : ""}${valeur} avec le 11<br>`;

// Si le 11 vient du double 17,
// on continue avec la deuxième carte

if(double17EnCours){

actionEnCours = null;

carteChoisie = null;

reprendreDouble17();

return;

}

// Fonctionnement normal du 11

// Pioche 1 carte

piocherCarte(joueur);

actionEnCours = null;

// Tour suivant

passerJoueur();

carteChoisie = null;

afficherJeu();

}

function choisirAdversaireCarte13(index){

cibleChoisie = index;

actionEnCours = "carte13choix";

afficherJeu();

}

function volerCarte13(carteIndex){

    let joueur = joueurs[joueurActuel];
    let carte = cartesTable[carteIndex];

    // Sécurité
    if(!carte){
        return;
    }

    // Trouver le propriétaire actuel
    let cible = joueurs.find(j =>
        j.nom === carte.proprietaire
    );

    // Sécurité
    if(!cible){
        return;
    }

    // Empêcher de voler sa propre carte
    if(cible === joueur){

        historique +=
        `${joueur.nom} ne peut pas voler sa propre carte avec le 13.<br>`;

        afficherJeu();
        return;
    }

    // TRANSFERT DES POINTS

    joueur.score += carte.valeur;
    cible.score -= carte.valeur;

    // RETIRER LA CARTE

    let indexCarte = cartesTable.indexOf(carte);

    if(indexCarte !== -1){
        cartesTable.splice(indexCarte, 1);
    }

    // NOUVEAU PROPRIÉTAIRE

    carte.proprietaire = joueur.nom;

    // METTRE LA CARTE À LA FIN

    cartesTable.push(carte);

    historique +=
    `${joueur.nom} vole ${carte.valeur} à ${cible.nom} avec le 13<br>`;

    // FIN DE PARTIE

    if(verifierFinPartie()){
        afficherJeu();
        return;
    }

    // SI LE 13 VIENT DU DOUBLE 17

    if(double17EnCours){

        actionEnCours = null;
        carteChoisie = null;

        reprendreDouble17();

        return;
    }

    // 13 NORMAL

    piocherCarte(joueur);

    actionEnCours = null;

    // Joueur suivant
    passerJoueur();

    carteChoisie = null;

    afficherJeu();

}

function doublerCarte15(carteIndex){

    let joueur = joueurs[joueurActuel];

    let carte = cartesTable[carteIndex];

    let ancienneValeur = carte.valeur;
    let nouvelleValeur = ancienneValeur * 2;

    // Ajustement du score

    joueur.score += nouvelleValeur - ancienneValeur;

    // Initialiser l'historique de la carte
    // si elle n'en possède pas encore

    if(!carte.historiqueCarte){

        carte.historiqueCarte = [carte.valeur];

    }

    // Ajouter le 15 à l'historique

    carte.historiqueCarte.push(15);

    // Mise à jour de la valeur

    carte.valeur = nouvelleValeur;

    carte.liee = true;

    historique +=
    `${joueur.nom} double ${ancienneValeur} en ${nouvelleValeur} avec le 15<br>`;

    // Vérifier la victoire

    if(verifierFinPartie()){
        afficherJeu();
        return;
    }

    // SI LE 15 VIENT DU DOUBLE 17

    if(double17EnCours){

        actionEnCours = null;
        carteChoisie = null;

        reprendreDouble17();

        return;
    }

    // 15 NORMAL

    // Pioche 1 carte

    piocherCarte(joueur);

    actionEnCours = null;

    // Tour suivant

    passerJoueur();

    carteChoisie = null;

    afficherJeu();

}

function choisirAdversaireCarte17(index){

    let joueur = joueurs[joueurActuel];
    let cible = joueurs[index];

    joueur17 = joueurActuel;
  
    // VÉRIFIER QU'IL RESTE UNE CARTE

    if(cible.main.length === 0){

        historique +=
`${joueur.nom} joue 17, aucune carte disponible<br>`;

        afficherJeu();

        return;
    }

    // TIRAGE AU HASARD

    let indexAleatoire =
        Math.floor(Math.random() * cible.main.length);

    let cartePiochee =
        cible.main.splice(indexAleatoire, 1)[0];

    if(cartePiochee === undefined){
    return;
    }
    
    if(gererMainVideMultijoueur()){
    return;
    }

    // Mémoriser la carte volée
    carte17EnAttente = cartePiochee;

    historique +=
`${joueur.nom} vole 1 carte dans la main de ${cible.nom} avec le 17<br>`;

    // Afficher la carte avant de la jouer
    actionEnCours = "carte17revelee";

    afficherJeu();

}

function jouerCarte17(){

let joueur = joueurs[joueur17];
let carte = carte17EnAttente;

carte17EnAttente = null;

joueurActuel = joueur17;

// Carte paire : elle marque simplement sa valeur

if(carte % 2 === 0){

joueur.score += carte;

  if(verifierFinPartie()){
    return;
}

historique +=
`${joueur.nom} joue ${carte} obtenue avec le 17 (+${carte})<br>`;

// Pioche finale

piocherCarte(joueur);

actionEnCours = null;

joueurActuel = joueur17 + 1;

if(joueurActuel >= joueurs.length){
    joueurActuel = 0;
}

joueur17 = null;

carteChoisie = null;

afficherJeu();

return;

}

// Carte impaire : lancer son pouvoir

if(carte === 1){
    actionEnCours = "vol1";
}

else if(carte === 3){
    actionEnCours = "carte3";
}

else if(carte === 5){

    let cartesPiochees = 0;

    while(cartesPiochees < 2 && paquet.length > 0){

        joueur.main.push(paquet.pop());
        cartesPiochees++;

    }

    historique +=
    `${joueur.nom} joue 5 obtenue avec le 17 et pioche ${cartesPiochees} carte(s)<br>`;

    actionEnCours = null;

    joueurActuel = joueur17 + 1;

    if(joueurActuel >= joueurs.length){
        joueurActuel = 0;
    }

    joueur17 = null;

  carteChoisie = null;

}

else if(carte === 7){

    joueur.score += 20;

    cartesTable.push({
        valeur: 20,
        proprietaire: joueur.nom,
        liee: false
    });

    historique +=
    `${joueur.nom} joue 7 obtenue avec le 17 (+20)<br>`;

    actionEnCours = null;

    joueurActuel = joueur17 + 1;

    if(joueurActuel >= joueurs.length){
        joueurActuel = 0;
    }

    joueur17 = null;

  carteChoisie = null;

}

else if(carte === 9){
    actionEnCours = "carte9";
}

else if(carte === 11){
    actionEnCours = "carte11";
}

else if(carte === 13){
    actionEnCours = "carte13";
}

else if(carte === 15){
    actionEnCours = "carte15";
}

else if(carte === 17){
    actionEnCours = "carte17";
}

else if(carte === 19){
    actionEnCours = "carte19";
}

else if(carte === 21){
    actionEnCours = "carte21";
}

else if(carte === "Joker"){
    actionEnCours = "joker";
}

afficherJeu();

}

function continuerCarte17(){

    let joueur = joueurs[joueur17];
    let carte = carte17EnAttente;

    carte17EnAttente = null;

    // Sécurité
    if(carte === null || carte === undefined){
        actionEnCours = null;
        afficherJeu();
        return;
    }

    // CARTE PAIRE = POINTS

    if(typeof carte === "number" && carte % 2 === 0){

        joueur.score += carte;

        cartesTable.push({
            valeur: carte,
            proprietaire: joueur.nom,
            liee: false
        });

        historique +=
        `${joueur.nom} joue ${carte} obtenue avec le 17 (+${carte})<br>`;

        if(verifierFinPartie()){
            return;
        }

        // Pioche finale
        piocherCarte(joueur);

        actionEnCours = null;
        carteChoisie = null;

        // Si le 17 venait d'un double 17,
        // on revient jouer la carte restante du double 17
        if(double17EnCours){
        joueur17 = null;
        reprendreDouble17();
        return;
        }

        // 17 normal : fin du tour
        joueur17 = null;
        passerJoueur();

        afficherJeu();

        return;

    // CARTE 1

    if(carte === 1){

        actionEnCours = "vol1";

        afficherJeu();

        return;
    }

    // CARTE 3

    if(carte === 3){

        actionEnCours = "carte3";

        afficherJeu();

        return;
    }

    // CARTE 5

    if(carte === 5){

        let cartesPiochees = 0;

        while(cartesPiochees < 2 && paquet.length > 0){

            joueur.main.push(paquet.pop());
            cartesPiochees++;

        }

        if(cartesPiochees === 2){

    historique +=
    `${joueur.nom} joue 5 obtenue avec le 17 et pioche 2 cartes<br>`;

}else if(cartesPiochees === 1){

    historique +=
    `${joueur.nom} joue 5 obtenue avec le 17 et pioche 1 carte<br>`;

}else{

    historique +=
    `${joueur.nom} joue 5 obtenue avec le 17, aucune carte disponible<br>`;

}

        actionEnCours = null;
        carteChoisie = null;

        if(double17EnCours){
        joueur17 = null;
        reprendreDouble17();
        return;
    }

        joueur17 = null;
        passerJoueur();

        afficherJeu();

        return;
    }

    // CARTE 7

    if(carte === 7){

        joueur.score += 20;

        cartesTable.push({
            valeur: 20,
            proprietaire: joueur.nom,
            liee: false
        });

        historique +=
        `${joueur.nom} joue 7 obtenue avec le 17 (+20)<br>`;

        if(verifierFinPartie()){
            return;
        }

        piocherCarte(joueur);

        actionEnCours = null;
        carteChoisie = null;

        if(double17EnCours){
        joueur17 = null;
        reprendreDouble17();
        return;
        }

        joueur17 = null;
        passerJoueur();

        afficherJeu();

        return;
    }

    // AUTRES CARTES POUVOIRS

    if(carte === 9){
        actionEnCours = "carte9";
    }

    else if(carte === 11){
        actionEnCours = "carte11";
    }

    else if(carte === 13){
        actionEnCours = "carte13";
    }

    else if(carte === 15){
        actionEnCours = "carte15";
    }

    else if(carte === 17){
        actionEnCours = "carte17";
    }

    else if(carte === 19){
        actionEnCours = "carte19";
    }

    else if(carte === 21){
        actionEnCours = "carte21";
    }

    else if(carte === "Joker"){
        actionEnCours = "joker";
    }

    afficherJeu();

}

function choisirAdversaireCarte19(index){

    let joueur = joueurs[joueurActuel];
    let cible = joueurs[index];
    let carteJoueur = null;
    let indexJoueur = -1;
    let carteCible = null;
    let indexCible = -1;

    // Chercher la dernière carte à points du joueur

    for(let i = cartesTable.length - 1; i >= 0; i--){

        if(cartesTable[i].proprietaire === joueur.nom &&
           cartesTable[i].valeur !== 0){

            carteJoueur = cartesTable[i];
            indexJoueur = i;
            break;

        }

    }

    // Chercher la dernière carte à points de la cible

    for(let i = cartesTable.length - 1; i >= 0; i--){

        if(cartesTable[i].proprietaire === cible.nom &&
           cartesTable[i].valeur !== 0){

            carteCible = cartesTable[i];
            indexCible = i;
            break;

        }

    }

    // Si l'un des deux n'a pas de carte à points

    if(carteJoueur === null || carteCible === null){

        historique +=
        `${joueur.nom} joue 19, aucune carte disponible<br>`;

        // SI LE 19 VIENT DU DOUBLE 17

        if(double17EnCours){

            actionEnCours = null;
            carteChoisie = null;

            reprendreDouble17();

            return;
        }

        // 19 NORMAL : pioche

        piocherCarte(joueur);

        actionEnCours = null;

        passerJoueur();

        carteChoisie = null;

        afficherJeu();

        return;

    }

    // Échange des valeurs

    let valeurJoueur = carteJoueur.valeur;
    let valeurCible = carteCible.valeur;

    // Ajustement des scores

    joueur.score += valeurCible - valeurJoueur;
    cible.score += valeurJoueur - valeurCible;

    if(verifierFinPartie()){
        return;
    }

    // Échange des propriétaires

    carteJoueur.proprietaire = cible.nom;
    carteCible.proprietaire = joueur.nom;

    historique +=
    `${joueur.nom} échange avec ${cible.nom} sa dernière carte jouée avec le 19<br>`;

    // SI LE 19 VIENT DU DOUBLE 17

    if(double17EnCours){

        actionEnCours = null;
        carteChoisie = null;

        reprendreDouble17();

        return;
    }

    // 19 NORMAL

    // Pioche 1 carte

    piocherCarte(joueur);

    actionEnCours = null;

    // Tour suivant

    passerJoueur();

    carteChoisie = null;

    afficherJeu();

}

function effetCarte21(valeur){

    let joueur = joueurs[joueurActuel];

    // +20 POUR SOI

    if(valeur === 20){

        joueur.score += 20;

        cartesTable.push({
            valeur: 20,
            proprietaire: joueur.nom,
            liee: false,
            historiqueCarte: [21]
        });

        // Historique AVANT de continuer le Double 17
        historique +=
        `${joueur.nom} +20 avec le 21<br>`;

        // Vérifier la victoire
        if(verifierFinPartie()){
            return;
        }

        // SI LE 21 VIENT DU DOUBLE 17

        if(double17EnCours){

            actionEnCours = null;
            carteChoisie = null;

            reprendreDouble17();

            return;
        }

        // 21 NORMAL

        // Pioche 1 carte

        piocherCarte(joueur);

        actionEnCours = null;

        // Tour suivant

        passerJoueur();

        carteChoisie = null;

        afficherJeu();

        return;
    }

    // -20 : CHOISIR UN ADVERSAIRE

    if(valeur === -20){

        actionEnCours = "carte21cible";

        afficherJeu();

    }

}

function cibleCarte21(index){

    let joueur = joueurs[joueurActuel];
    let cible = joueurs[index];

    cible.score -= 20;

    cartesTable.push({
        valeur: -20,
        proprietaire: cible.nom,
        liee: false,
        historiqueCarte: [21]
    });

    // Historique AVANT de continuer le Double 17
    historique +=
    `${joueur.nom} inflige -20 à ${cible.nom} avec le 21<br>`;

    // Vérifier la victoire
    if(verifierFinPartie()){
        return;
    }

    // SI LE 21 VIENT DU DOUBLE 17

    if(double17EnCours){

        actionEnCours = null;
        carteChoisie = null;

        reprendreDouble17();

        return;
    }

    // 21 NORMAL

    // Pioche 1 carte

    piocherCarte(joueur);

    actionEnCours = null;

    // Tour suivant

    passerJoueur();

    carteChoisie = null;

    afficherJeu();

}

function effetJoker(choix){

    let joueur = joueurs[joueurActuel];

    // +10

    if(choix === 10){

        joueur.score += 10;

        cartesTable.push({
            valeur: 10,
            proprietaire: joueur.nom,
            liee: false,
            joker: true,
            historiqueCarte: ["Joker"]
        });

        if(verifierFinPartie()){
            return;
        }

        historique +=
        `${joueur.nom} choisit +10 avec le Joker<br>`;

        // SI LE JOKER VIENT DU DOUBLE 17

        if(double17EnCours){

            actionEnCours = null;
            carteChoisie = null;

            reprendreDouble17();

            return;
        }

        // JOKER NORMAL

        piocherCarte(joueur);

        actionEnCours = null;

        passerJoueur();

        carteChoisie = null;

        afficherJeu();

        return;
    }

    // +22

    if(choix === 22){

        joueur.score += 22;

        cartesTable.push({
            valeur: 22,
            proprietaire: joueur.nom,
            liee: false,
            joker: true
        });

        if(verifierFinPartie()){
            return;
        }

        historique +=
        `${joueur.nom} choisit +22 avec le Joker<br>`;

        // SI LE JOKER VIENT DU DOUBLE 17

        if(double17EnCours){

            actionEnCours = null;
            carteChoisie = null;

            reprendreDouble17();

            return;
        }

        // JOKER NORMAL

        piocherCarte(joueur);

        actionEnCours = null;

        passerJoueur();

        carteChoisie = null;

        afficherJeu();

        return;
    }

    // ÉCHANGE

    if(choix === "echange"){

        actionEnCours = "jokerCible";

        afficherJeu();

    }

}

function echangeJoker(index){

    let joueur = joueurs[joueurActuel];
    let cible = joueurs[index];

    let ancienScoreJoueur = joueur.score;
    let ancienScoreCible = cible.score;

    // Échanger les propriétaires des points marqués

    cartesTable.forEach(carte => {

        if(carte.proprietaire === joueur.nom){

            carte.proprietaire = cible.nom;

        }else if(carte.proprietaire === cible.nom){

            carte.proprietaire = joueur.nom;

        }

    });

    // Échanger les scores

    joueur.score = ancienScoreCible;
    cible.score = ancienScoreJoueur;

    historique +=
    `${joueur.nom} échange ses points (${ancienScoreJoueur}) avec ${cible.nom} (${ancienScoreCible}) grâce au Joker<br>`;

    if(verifierFinPartie()){
        return;
    }

    // SI LE JOKER VIENT DU DOUBLE 17

    if(double17EnCours){

        actionEnCours = null;
        carteChoisie = null;

        reprendreDouble17();

        return;
    }
  
    // JOKER NORMAL

    piocherCarte(joueur);

    actionEnCours = null;

    // Tour suivant

    passerJoueur();

    carteChoisie = null;

    afficherJeu();

}

function verifierFinDeManche(){

    // Si un pouvoir est encore en cours,
    // on laisse d'abord ce pouvoir se terminer.
    if(actionEnCours !== null){
        return false;
    }

    // S'il reste des cartes dans la pioche,
    // la manche peut encore continuer.
    if(paquet.length > 0){
        return false;
    }

    // Vérifier si au moins un joueur possède encore des cartes
    let joueurAvecCarte = joueurs.some(joueur =>
    joueur.main.length > 0
    );

    // Tant qu'un seul joueur possède encore
    // une carte, la manche continue.
    if(joueurAvecCarte){
    return false;
    }

    // Plus de pioche ET plus aucune carte en main :
    // la manche est terminée.
    historique +=
    `🏁 Plus aucune carte n'est disponible. Fin de la manche.<br>`;

    verifierFinPartie();

    return true;
}

function verifierFinPartie(){

    if(mancheTerminee){
        return true;
    }

    let scoreVictoire = obtenirScoreVictoire();

    // Recherche d'un gagnant exact

    let gagnant = joueurs.find(joueur =>
        joueur.score === scoreVictoire
    );

    // Si personne n'a atteint exactement le score,
    // vérifier si toutes les cartes sont épuisées

    if(!gagnant){

        let toutesCartesEpuisees =
            paquet.length === 0 &&
            joueurs.every(joueur => joueur.main.length === 0);

        if(!toutesCartesEpuisees){
            return false;
        }

        // Chercher le joueur le plus proche

        let distances = joueurs.map(joueur =>
            Math.abs(joueur.score - scoreVictoire)
        );

        let distanceMin = Math.min(...distances);

        let joueursProches = joueurs.filter((joueur, index) =>
            distances[index] === distanceMin
        );

        // Égalité : aucun vainqueur

        if(joueursProches.length > 1){

            historique +=
            `⚖️ Fin de manche : égalité, aucun joueur ne remporte la manche.<br>`;

            // Partie unique

if(modeJeu === 1){

    gagnantPartie = null;
    actionEnCours = "partieTerminee";

    zoneJeu.innerHTML =
    `
    <div class="fin-partie">

    <h2>⚖️ PARTIE TERMINÉE !</h2>

     <div class="fin-egalite">
    <h3>Égalité : aucun joueur ne remporte la partie.</h3>
    </div>

    <div class="fin-scores">

    <h3>📊 Scores</h3>

    ${[...joueurs]
    .map((joueur, index) => ({
        joueur: joueur,
        index: index
    }))
    .sort((a, b) => b.joueur.score - a.joueur.score)
    .map(({joueur, index}) => {

        let couleurScore = couleursJoueurs[index];

        return `
            <p>
                ${couleurScore.rond} ${joueur.nom} :
                ${joueur.score}
                point${joueur.score === 1 ? "" : "s"}
            </p>
        `;

    }).join("")}

    </div>
    </div>
    `;

    return true;

}

            // Plusieurs manches :
            // afficher l'écran entre les manches

            afficherFinManche(null);

            return true;

        }

        // Un seul joueur est le plus proche

        gagnant = joueursProches[0];

    }

    // Enregistrer la victoire

    let indexGagnant = joueurs.indexOf(gagnant);

    victoires[indexGagnant]++;

    gagnantManche = gagnant;

    historique +=
    `🏆 ${gagnant.nom} remporte la manche ! (${victoires[indexGagnant]} victoire${victoires[indexGagnant] > 1 ? "s" : ""})<br>`;

// Partie unique

if(modeJeu === 1){

    gagnantPartie = gagnant;
    actionEnCours = "partieTerminee";

    let scoreVictoire = obtenirScoreVictoire();

    zoneJeu.innerHTML =
    `
    <div class="fin-partie">

    <h2> PARTIE TERMINÉE !</h2>

    <h3 class="fin-gagnant">
    🏆 ${couleurJoueur(indexGagnant)}
    ${gagnantPartie.nom}
    ${couleurJoueur(indexGagnant)} 🏆
    </h3>

    <div class="fin-scores">

    <h3>📊 Scores</h3>

    ${[...joueurs]
    .map((joueur, index) => ({
        joueur: joueur,
        index: index
    }))
    .sort((a, b) => {

    const distanceA = Math.abs(a.joueur.score - scoreVictoire);
    const distanceB = Math.abs(b.joueur.score - scoreVictoire);

    return distanceA - distanceB;

})
    .map(({joueur, index}) => {

    let couleurScore = couleursJoueurs[index];

    let ecart = joueur.score - scoreVictoire;

    let affichageEcart = ecart === 0
        ? ""
        : ` | Écart ${ecart > 0 ? "+" : "−"}${Math.abs(ecart)}`;

    return `
        <p>
            ${couleurScore.rond} ${joueur.nom} :
            ${joueur.score} point${joueur.score === 1 ? "" : "s"}
            ${affichageEcart}
        </p>
    `;

        }).join("")}

    </div>
    </div>
    `;

    return true;

}

  // Vérifier si le joueur a atteint
  // le nombre de victoires nécessaire

if(modeJeu > 1 && victoires[indexGagnant] >= modeJeu){

    gagnantPartie = gagnant;
    actionEnCours = "partieTerminee";

  let scoreVictoire = obtenirScoreVictoire();

    zoneJeu.innerHTML =
    `
    <div class="fin-partie">

    <h2> PARTIE TERMINÉE !</h2>

    <div class="fin-gagnant">

    <h3>
        🏆 ${couleurJoueur(indexGagnant)}
        ${gagnant.nom}
        ${couleurJoueur(indexGagnant)} 🏆
    </h3>

    <div>
        remporte la partie !
    </div>

    </div>

    <div class="fin-scores">

    <h3>📊 Score de la dernière manche</h3>

    ${[...joueurs]
    .map((joueur, index) => ({
        joueur: joueur,
        index: index
    }))
    .sort((a, b) => {

    const distanceA = Math.abs(a.joueur.score - scoreVictoire);
    const distanceB = Math.abs(b.joueur.score - scoreVictoire);

    return distanceA - distanceB;

})
    .map(({joueur, index}) => {

        let couleurScore = couleursJoueurs[index];

        return `
            <p>
                ${couleurScore.rond} ${joueur.nom} : ${joueur.score} point${joueur.score === 1 ? "" : "s"}
            </p>
        `;

    }).join("")}

    <h3>🏆 Victoires :</h3>

    ${joueurs
    .map((joueur, index) => ({
        joueur: joueur,
        index: index,
        victoires: victoires[index]
    }))
    .sort((a, b) => b.victoires - a.victoires)
    .map(item => {

        let couleurScore = couleursJoueurs[item.index];

        return `
            <p>
                ${couleurScore.rond} ${item.joueur.nom} : ${item.victoires} victoire${item.victoires === 1 ? "" : "s"}
            </p>
        `;

        }).join("")}

    </div>
    </div>
    `;

    return true;

}

    // Plusieurs manches :
    // attendre le clic sur le bouton

    afficherFinManche(gagnantManche);

    return true;

}

function obtenirScoreVictoire(){

    if(joueurs.length === 2 || joueurs.length === 3){
        return 120;
    }

    if(joueurs.length === 4){
        return 160;
    }

    if(joueurs.length === 5){
        return 200;
    }

    if(joueurs.length === 6){
        return 220;
    }

    if(joueurs.length === 7){
        return 240;
    }

    if(joueurs.length === 8){
        return 260;
    }

}

function terminerActionPouvoir(){

    let joueur = joueurs[joueurActuel];

    // Le pouvoir est complètement terminé
    actionEnCours = null;

    // Vérifier maintenant si le score provoque
    // la fin de la partie.
    if(verifierFinPartie()){
        return;
    }

    // Le joueur doit normalement piocher 1 carte
    // après avoir terminé son pouvoir.

    if(paquet.length > 0){

        joueur.main.push(paquet.pop());

    }else{

        // Plus aucune carte à piocher.
        // On vérifie maintenant la fin de la manche.

        verifierFinPartie();
        return;
    }

    // Tour suivant

    passerJoueur();

    carteChoisie = null;
    cibleChoisie = null;

    afficherJeu();
}

function passerJoueur(){

    joueurActuel++;

    if(joueurActuel >= joueurs.length){
        joueurActuel = 0;
    }

}

function piocherCarte(joueur){

    if(paquet.length > 0){
        joueur.main.push(paquet.pop());
    }

}

function nouvelleManche(nouveauMode){

    if(nouveauMode !== undefined){
        modeJeu = Number(nouveauMode) || 1;
    }

    // Le joueur suivant commence
    passerJoueur();

    // Réinitialisation de la manche
    paquet = [];
    cartesTable = [];
    defaussePouvoirs = [];
    historique = "";

    actionEnCours = null;
    cibleChoisie = null;
    carteChoisie = null;
    gagnantManche = null;

    joueur17 = null;
    carte17EnAttente = null;
    cartesDouble17 = [];
    double17EnCours = false;

    joueur19 = null;
    toursJoker = {};

    mancheTerminee = false;

    // Réinitialisation des scores et des mains
    joueurs.forEach(joueur => {

        joueur.score = 0;
        joueur.main = [];

    });

    // Nombre de paquets
    let nombrePaquets;

    if(joueurs.length <= 3){
        nombrePaquets = 2;
    }else{
        nombrePaquets = joueurs.length - 1;
    }

    // Création du paquet
    for(let i = 0; i < nombrePaquets; i++){
        paquet = paquet.concat(cartesBase);
    }

    // Mélange
    paquet.sort(() => Math.random() - 0.5);

    // Distribution de 4 cartes
    joueurs.forEach(joueur => {

        for(let i = 0; i < 4; i++){
            joueur.main.push(paquet.pop());
        }

    });

    afficherJeu();

}

function preparerNouvelleManche(nouveauMode){

    nouvelleManche(nouveauMode);

}

function trouverDoubles(main){

let doubles = [];

for(let i = 0; i < main.length; i++){

    for(let j = i + 1; j < main.length; j++){

        if(main[i] === main[j]){

            if(!doubles.includes(main[i])){

                doubles.push(main[i]);

            }

        }

    }

}

return doubles;

}

function cartesDoublesAffichables(main){

    let doubles = trouverDoubles(main);
    let resultat = [];

    doubles.forEach(valeur => {

        resultat.push(valeur);
        resultat.push(valeur);

    });

    return resultat;

}

function choisirAdversaireDouble1(index){

let joueur = joueurs[joueurActuel];
let cible = joueurs[index];

cibleChoisie = index;

volerDouble1();

}

function volerDouble1(){

let joueur = joueurs[joueurActuel];
let cible = joueurs[cibleChoisie];

let cartesVolees = [];

// Chercher les 2 dernières cartes à points

for(let i = cartesTable.length - 1; i >= 0 && cartesVolees.length < 2; i--){

if(cartesTable[i].proprietaire === cible.nom &&
   cartesTable[i].valeur !== 0){

cartesVolees.push(cartesTable[i]);

}

}

// Transférer les cartes

cartesVolees.forEach(carte => {

cible.score -= carte.valeur;
joueur.score += carte.valeur;

carte.proprietaire = joueur.nom;

// Retirer la carte de sa position actuelle
let indexCarte = cartesTable.indexOf(carte);

if(indexCarte !== -1){
    cartesTable.splice(indexCarte, 1);
}

// La remettre à la fin des Points marqués
cartesTable.push(carte);

});

if(cartesVolees.length === 2){

    historique +=
    `${joueur.nom} vole les deux dernières cartes de ${cible.nom} avec le double 1<br>`;

}
else if(cartesVolees.length === 1){

    historique +=
    `${joueur.nom} vole la dernière carte de ${cible.nom} avec le double 1<br>`;

}
else{

    historique +=
    `${joueur.nom} joue double 1, aucune carte disponible<br>`;

}

if(verifierFinPartie()){
    return;
}

// Pioche 1 carte

piocherCarte(joueur);

actionEnCours = null;
cibleChoisie = null;

passerJoueur();

carteChoisie = null;

afficherJeu();

}

function choisirAdversaireDouble3(index){

let joueur = joueurs[joueurActuel];
let cible = joueurs[index];

cible.score -= 40;

cartesTable.push({
    valeur: -40,
    proprietaire: cible.nom,
    liee: false
});

historique +=
`${joueurs[joueurActuel].nom} inflige -40 à ${cible.nom} avec le double 3<br>`;

if(verifierFinPartie()){
    return;
}

// Pioche 1 carte

piocherCarte(joueur);

actionEnCours = null;
cibleChoisie = null;
carteChoisie = null;

// Tour suivant

passerJoueur();

afficherJeu();

}

function choisirAdversaireDouble9(index){

let joueur = joueurs[joueurActuel];
let cible = joueurs[index];

// Échange des mains

let mainTemporaire = joueur.main;

joueur.main = cible.main;
cible.main = mainTemporaire;

historique +=
`${joueur.nom} échange sa main avec ${cible.nom} avec le double 9<br>`;

// Fin du pouvoir

actionEnCours = null;
cibleChoisie = null;
carteChoisie = null;

// Tour suivant

passerJoueur();

afficherJeu();

}

function effetDouble11(valeur){

let joueur = joueurs[joueurActuel];

joueur.score += valeur;

cartesTable.push({
    valeur: valeur,
    proprietaire: joueur.nom,
    liee: false,
    historiqueCarte: [11, 11]
});

historique +=
`${joueur.nom} choisit ${valeur > 0 ? "+20" : "-20"} avec le double 11<br>`;

if(verifierFinPartie()){
    return;
}

// Pioche 1 carte

piocherCarte(joueur);

actionEnCours = null;
cibleChoisie = null;
carteChoisie = null;

// Tour suivant

passerJoueur();

afficherJeu();

}

function choisirAdversaireDouble13(index){

cibleChoisie = index;
actionEnCours = "double13choix";

afficherJeu();

}

function selectionnerCarteDouble13(carteIndex){

if(!Array.isArray(carteChoisie)){
    carteChoisie = [];
}

// Si la carte est déjà sélectionnée → on la désélectionne

if(carteChoisie.includes(carteIndex)){

carteChoisie = carteChoisie.filter(index =>
    index !== carteIndex
);

}else{

// Maximum 2 cartes

if(carteChoisie.length >= 2){
    return;
}

carteChoisie.push(carteIndex);

}

// Actualiser l'affichage

afficherJeu();

}

function volerCartesDouble13(){

let joueur = joueurs[joueurActuel];
let cible = joueurs[cibleChoisie];

// Si aucune carte à points

let cartesDisponibles = cartesTable.filter(carte =>
    carte.proprietaire === cible.nom &&
    carte.valeur !== 0
);

if(cartesDisponibles.length === 0){

historique +=
`${joueur.nom} joue le double 13, aucune carte disponible à voler à ${cible.nom}<br>`;

}else{

// Récupérer les cartes sélectionnées

let cartesVolees = carteChoisie.map(index =>
    cartesTable[index]
);

// Retirer les cartes de la table

cartesVolees.forEach(carte => {

let index = cartesTable.indexOf(carte);

if(index !== -1){
    cartesTable.splice(index,1);
}

});

// Ajouter les cartes volées à la fin

cartesVolees.forEach(carte => {

carte.proprietaire = joueur.nom;

cartesTable.push(carte);

});

// Mise à jour des scores

cartesVolees.forEach(carte => {

joueur.score += carte.valeur;
cible.score -= carte.valeur;

});

if(cartesVolees.length === 2){

    historique +=
    `${joueur.nom} vole deux cartes à ${cible.nom} avec le double 13<br>`;

}
else if(cartesVolees.length === 1){

    historique +=
    `${joueur.nom} vole une carte à ${cible.nom} avec le double 13<br>`;

}
else{

    historique +=
    `${joueur.nom} joue le double 13, aucune carte disponible à voler à ${cible.nom}<br>`;

}
  
}

if(verifierFinPartie()){
    return;
}

// Pioche 1 carte

piocherCarte(joueur);

// Réinitialisation

actionEnCours = null;
cibleChoisie = null;
carteChoisie = null;

// Tour suivant

passerJoueur();

afficherJeu();

}

function terminerDouble13(){

    let joueur = joueurs[joueurActuel];
    let cible = joueurs[cibleChoisie];

    historique +=
    `${joueur.nom} joue le double 13, aucune carte disponible à voler à ${cible.nom}<br>`;

    piocherCarte(joueur);

    actionEnCours = null;
    cibleChoisie = null;
    carteChoisie = null;

    passerJoueur();

    afficherJeu();

}

function triplerCarte15(carteIndex){

    let joueur = joueurs[joueurActuel];

    let carte = cartesTable[carteIndex];

    let ancienneValeur = carte.valeur;
    let nouvelleValeur = ancienneValeur * 3;

    // Ajustement du score

    joueur.score += nouvelleValeur - ancienneValeur;

    // Initialiser l'historique si nécessaire

    if(!Array.isArray(carte.historiqueCarte)){

        carte.historiqueCarte = [ancienneValeur];

    }

    // Le double 15 ajoute DEUX 15
    // mais multiplie la carte une seule fois par 3

    carte.historiqueCarte.push(15);
    carte.historiqueCarte.push(15);

    // Mise à jour de la carte

    carte.valeur = nouvelleValeur;
    carte.liee = true;

    historique +=
    `${joueur.nom} triple ${ancienneValeur} en ${nouvelleValeur} avec le double 15<br>`;

    if(verifierFinPartie()){
        afficherJeu();
        return;
    }

    // Pioche 1 carte

    piocherCarte(joueur);

    // Fin du pouvoir

    actionEnCours = null;
    cibleChoisie = null;
    carteChoisie = null;

    // Joueur suivant

    passerJoueur();

    afficherJeu();

}

function terminerDouble15(){

let joueur = joueurs[joueurActuel];

historique +=
`${joueur.nom} ne peut pas utiliser le double 15 car il n'a aucune carte à points.<br>`;

if(verifierFinPartie()){
    return;
}

// Pioche quand même 1 carte

piocherCarte(joueur);

actionEnCours = null;
cibleChoisie = null;
carteChoisie = null;

// Tour suivant

passerJoueur();

afficherJeu();

}

function choisirAdversaireDouble17(index){

let joueur = joueurs[joueurActuel];
let cible = joueurs[index];

cibleChoisie = index;

let nombreCartes =
Math.min(2, cible.main.length);

if(nombreCartes === 0){

historique +=
`${joueur.nom} joue le double 17, aucune carte disponible dans la main de ${cible.nom}<br>`;

piocherCarte(joueur);

actionEnCours = null;
cibleChoisie = null;

passerJoueur();

afficherJeu();

return;

}

// Tirer les cartes au hasard

cartesDouble17 = [];

for(let i = 0; i < nombreCartes; i++){

let indexAleatoire =
Math.floor(Math.random() * cible.main.length);

cartesDouble17.push(
    cible.main.splice(indexAleatoire, 1)[0]
);

}

if(cartesDouble17.length === 2){

    historique +=
    `${joueur.nom} vole deux cartes dans la main de ${cible.nom} avec le double 17<br>`;

}
else if(cartesDouble17.length === 1){

    historique +=
    `${joueur.nom} vole une carte dans la main de ${cible.nom} avec le 17<br>`;

}

double17EnCours = true;

actionEnCours = "double17revelee";

afficherJeu();

}

function choisirCarteDouble17(index){

let joueur = joueurs[joueurActuel];
let carte = cartesDouble17[index];

// Retirer la carte choisie de la liste

cartesDouble17.splice(index, 1);

// Mémoriser la carte en attente

carte17EnAttente = carte;

// La carte doit être jouée immédiatement

actionEnCours = "double17jouer";

afficherJeu();

}

function continuerDouble17(){

let joueur = joueurs[joueurActuel];
let carte = carte17EnAttente;

carte17EnAttente = null;

// Jouer la carte

if(typeof carte === "number" && carte % 2 === 0){

// Carte à points

joueur.score += carte;

cartesTable.push({
    valeur: carte,
    proprietaire: joueur.nom,
    liee: false
});

historique +=
`${joueur.nom} joue ${carte} avec le double 17 (+${carte})<br>`;

// Vérifier la victoire

if(verifierFinPartie()){
    return;
}

// S'il reste une deuxième carte

if(cartesDouble17.length > 0){

actionEnCours = "double17revelee";

afficherJeu();

return;

}

// Fin du double 17

terminerDouble17();

return;

}

// Carte pouvoir

if(carte === 1){

actionEnCours = "vol1";

}else if(carte === 3){

actionEnCours = "carte3";

}else if(carte === 5){

let cartesPiochees = 0;

while(cartesPiochees < 2 && paquet.length > 0){

joueur.main.push(paquet.pop());

cartesPiochees++;

}

if(cartesPiochees === 2){

    historique +=
    `${joueur.nom} joue 5 avec le double 17 et pioche 2 cartes<br>`;

}else if(cartesPiochees === 1){

    historique +=
    `${joueur.nom} joue 5 avec le double 17 et pioche 1 carte<br>`;

}else{

    historique +=
    `${joueur.nom} joue 5 avec le double 17, aucune carte disponible<br>`;

}

if(cartesDouble17.length > 0){

actionEnCours = "double17revelee";

afficherJeu();

return;

}

terminerDouble17();

return;

}else if(carte === 7){

    joueur.score += 20;

    cartesTable.push({
        valeur: 20,
        proprietaire: joueur.nom,
        liee: false
    });

    historique +=
    `${joueur.nom} joue 7 avec le double 17 (+20)<br>`;

    if(verifierFinPartie()){
        return;
    }

    // S'il reste une deuxième carte du double 17
    if(cartesDouble17.length > 0){

        actionEnCours = "double17revelee";

        afficherJeu();

        return;
    }

    // Le double 17 est terminé
    terminerDouble17();

    return;

}else if(carte === 9){

actionEnCours = "carte9";

}else if(carte === 11){

actionEnCours = "carte11";

}else if(carte === 13){

actionEnCours = "carte13";

}else if(carte === 15){

actionEnCours = "carte15";

}else if(carte === 17){

actionEnCours = "carte17";

}else if(carte === 19){

actionEnCours = "carte19";

}else if(carte === 21){

actionEnCours = "carte21";

}else if(carte === "Joker"){

actionEnCours = "joker";

}

afficherJeu();

}

function continuerApresDouble17(){

let joueur = joueurs[joueurActuel];

// S'il reste une deuxième carte

if(cartesDouble17.length > 0){

actionEnCours = "double17revelee";

afficherJeu();

return;

}

// Plus de carte à jouer

terminerDouble17();

}

function terminerDouble17(){

    let joueur = joueurs[joueurActuel];

    // Pioche 1 carte

    piocherCarte(joueur);

    historique +=
    `${joueur.nom} termine son double 17 <br>`;

    actionEnCours = null;
    double17EnCours = false;

    cibleChoisie = null;
    carte17EnAttente = null;
    cartesDouble17 = [];
    carteChoisie = null;

    passerJoueur();

    afficherJeu();

}

function reprendreDouble17(){

if(cartesDouble17.length > 0){

actionEnCours = "double17revelee";

afficherJeu();

return;

}

terminerDouble17();

}

function terminer17SansCarte(){

    let joueur = joueurs[joueurActuel];

    historique +=
    `${joueur.nom} ne peut plus voler de carte avec le 17. Le 17 est défaussé sans effet.<br>`;

    // Le 17 va dans la défausse

    defaussePouvoirs.push({
        valeur: 17,
        joueur: joueur.nom
    });

    // Vérifier si la manche est terminée
    // avant de changer de joueur

    if(verifierFinPartie()){
        return;
    }

    carte17EnAttente = null;
    joueur17 = null;
    actionEnCours = null;
    carteChoisie = null;

    // Si ce 17 faisait partie d'un double 17,
    // on revient jouer la carte restante.
    if(double17EnCours){
    reprendreDouble17();
    return;
    }

    // 17 normal : tour suivant
    passerJoueur();
    afficherJeu();

}

function choisirAdversaireDouble19(index){

    let joueur = joueurs[joueurActuel];
    let cible = joueurs[index];

    // Mémoriser l'adversaire choisi
    joueur19 = index;

    // Lancer l'échange
    effectuerEchangeDouble19();

}

function effectuerEchangeDouble19(){

    let joueur = joueurs[joueurActuel];
    let cible = joueurs[joueur19];

    // Récupérer les cartes à points de chaque joueur
    let cartesJoueur = cartesTable.filter(carte =>
        carte.proprietaire === joueur.nom
    );

    let cartesCible = cartesTable.filter(carte =>
        carte.proprietaire === cible.nom
    );

    // Nombre de cartes échangeables
    let nombreEchange =
        Math.min(cartesJoueur.length, cartesCible.length, 2);

    // Échange des dernières cartes à points
    for(let i = 0; i < nombreEchange; i++){

        let carteJoueur =
            cartesJoueur[cartesJoueur.length - 1 - i];
        let carteCible =
            cartesCible[cartesCible.length - 1 - i];

        // Échanger les propriétaires
        carteJoueur.proprietaire = cible.nom;
        carteCible.proprietaire = joueur.nom;

        // Échanger les scores
        joueur.score -= carteJoueur.valeur;
        joueur.score += carteCible.valeur;

        cible.score -= carteCible.valeur;
        cible.score += carteJoueur.valeur;

    }

    if(nombreEchange >= 2){

    historique +=
    `${joueur.nom} échange avec ${cible.nom} les deux dernières cartes jouées avec le double 19<br>`;

}
else if(nombreEchange === 1){

    historique +=
    `${joueur.nom} échange avec ${cible.nom} la dernière carte jouée avec le double 19<br>`;

}
else{

    historique +=
    `${joueur.nom} joue le double 19, aucune carte disponible<br>`;

}

  if(verifierFinPartie()){
    return;
}

    // Le joueur ayant joué le double 19 pioche 1 carte
    piocherCarte(joueur);

    // Réinitialiser
    joueur19 = null;
    actionEnCours = null;

    // Joueur suivant
    passerJoueur();

    carteChoisie = null;

    afficherJeu();

}

function effetDouble21(valeur){

let joueur = joueurs[joueurActuel];

// +40 POUR SOI

if(valeur === 40){

joueur.score += 40;

cartesTable.push({
    valeur: 40,
    proprietaire: joueur.nom,
    liee: false,
    historiqueCarte: [21, 21]
});

historique +=
`${joueur.nom} +40 points avec le double 21<br>`;

if(verifierFinPartie()){
    return;
}

// Pioche 1 carte

piocherCarte(joueur);

actionEnCours = null;

passerJoueur();

afficherJeu();

return;

}

// -40 À UN ADVERSAIRE

if(valeur === -40){

actionEnCours = "double21cible";

afficherJeu();

return;

}

}

function cibleDouble21(index){

let joueur = joueurs[joueurActuel];
let cible = joueurs[index];

cible.score -= 40;

// Ajouter le -40 aux Points marqués de la cible

cartesTable.push({
    valeur: -40,
    proprietaire: cible.nom,
    liee: false,
    historiqueCarte: [21, 21]
});

historique +=
`${joueur.nom} inflige -40 points à ${cible.nom} avec le double 21.<br>`;

// Vérifier la fin de partie

if(verifierFinPartie()){
    return;
}

// Le joueur pioche 1 carte

piocherCarte(joueur);

actionEnCours = null;

passerJoueur();

afficherJeu();

}

function afficherFinManche(gagnant){

    mancheTerminee = true;
    actionEnCours = "entreManches";

    let scoreVictoire = obtenirScoreVictoire();

    if(gagnant !== null){
        gagnantManche = gagnant;
    }

    let indexGagnant = gagnant
        ? joueurs.indexOf(gagnant)
        : -1;

    let titreGagnant = gagnant
    ? `🏆 ${couleurJoueur(indexGagnant)} ${gagnant.nom} ${couleurJoueur(indexGagnant)} 🏆`
    : `⚖️ ÉGALITÉ`;

    let messageGagnant = gagnant
    ? `remporte la manche !`
    : `aucun joueur ne remporte la manche.`;

    zoneJeu.innerHTML = `
    
        <div class="fin-manche">

     <h2> MANCHE TERMINÉE !</h2>

     <div class="fin-gagnant">

     <h2>
        ${titreGagnant}
     </h2>

     <h3>
        ${messageGagnant}
     </h3>

     </div>

     <div class="fin-scores">

     <h3>📊 Score de la manche</h3>

        ${joueurs
        .map((joueur, index) => ({
            joueur: joueur,
            index: index
        }))
        .sort((a, b) => {

      const distanceA = Math.abs(a.joueur.score - scoreVictoire);
      const distanceB = Math.abs(b.joueur.score - scoreVictoire);

      return distanceA - distanceB;

})
        .map(({joueur, index}) => {

            let couleurScore = couleursJoueurs[index];
            let ecart = joueur.score - scoreVictoire;

            return `
                <p>
                    ${couleurScore.rond} ${joueur.nom} : ${joueur.score} point${joueur.score === 1 ? "" : "s"}${ecart === 0 ? "" : ` | Écart ${ecart > 0 ? "+" : "−"}${Math.abs(ecart)}`}
                </p>
            `;

        }).join("")}

        <h3>🏆 Victoires :</h3>

        ${joueurs
        .map((joueur, index) => ({
            joueur: joueur,
            index: index
        }))
        .sort((a, b) => victoires[b.index] - victoires[a.index])
        .map(({joueur, index}) => {

            let couleurScore = couleursJoueurs[index];

            return `
                <p>
                    ${couleurScore.rond} ${joueur.nom} : ${victoires[index]} victoire${victoires[index] === 1 ? "" : "s"}
                </p>
            `;

        }).join("")}

        <br>

                <button onclick="preparerNouvelleManche(Number(document.getElementById('modeJeu').value))">
                🎴 Distribuer les nouvelles cartes
                </button>

        </div>
        </div>
        `;
}

function afficherRegles(){

    document.getElementById("fenetreRegles").style.display = "flex";

}

function fermerRegles(event){

    if(event && event.target !== event.currentTarget){
        return;
    }

    document.getElementById("fenetreRegles").style.display = "none";

}

function afficherRolesCartes(){

    document.getElementById("fenetreRolesCartes").style.display = "flex";

}

function fermerRolesCartes(event){

    if(event && event.target !== event.currentTarget){
        return;
    }

    document.getElementById("fenetreRolesCartes").style.display = "none";

}

function gererMainVideMultijoueur(){

    if(!globalThis.__atoumoulinRemote){
        return false;
    }

    const joueursAvecCartes =
        joueurs.filter(j => j.main.length > 0);

    if(joueursAvecCartes.length === 0){
        verifierFinPartie();
        return true;
    }

    return false;
}

/* =========================================================
   ATOUMOULIN - PONT MULTIJOUEUR
   Ajouté sans modifier les règles existantes.
   ========================================================= */
(function(){
    let __mpRandom = null;

    function __seededRandom(seed){
        let x = (Number(seed) >>> 0) || 1;
        return function(){
            x ^= x << 13;
            x ^= x >>> 17;
            x ^= x << 5;
            return ((x >>> 0) / 4294967296);
        };
    }

    window.__atoumoulinSetSeed = function(seed){
        __mpRandom = __seededRandom(seed);
        Math.random = function(){
            return __mpRandom();
        };
    };

    window.__atoumoulinInitMultiplayer = function(names, mode, seed){
        window.__atoumoulinSetSeed(seed);

        const nombreJoueurs = Math.max(2, Math.min(8, names.length));

        modeJeu = Number(mode) || 1;
        joueurs = [];
        paquet = [];
        cartesTable = [];
        defaussePouvoirs = [];
        historique = "";
        joueurActuel = Math.floor(Math.random() * nombreJoueurs);
        actionEnCours = null;
        cibleChoisie = null;
        carteChoisie = null;
        toursJoker = {};
        gagnantPartie = null;
        gagnantManche = null;
        mancheTerminee = false;
        joueur17 = null;
        carte17EnAttente = null;
        cartesDouble17 = [];
        double17EnCours = false;
        joueur19 = null;

        let nombrePaquets = nombreJoueurs <= 3 ? 2 : nombreJoueurs - 1;

        for(let i=0;i<nombrePaquets;i++){
            paquet = paquet.concat(cartesBase);
        }

        paquet.sort(()=>Math.random()-0.5);

        for(let i=0;i<nombreJoueurs;i++){
            joueurs.push({
                nom: String(names[i] || ("Joueur "+(i+1))),
                main: [],
                score: 0,
                bot: false
            });
        }

        victoires = joueurs.map(()=>0);

        joueurs.forEach(joueur=>{
            for(let i=0;i<4;i++){
                joueur.main.push(paquet.pop());
            }
        });

        afficherJeu();
    };

    window.__atoumoulinGetSelection = function(){ return carteChoisie; };

    window.__atoumoulinSetCarteChoisie = function(value){
        carteChoisie = value;
    };

    window.__atoumoulinSetBot = function(index, value){
        if(joueurs[index]) joueurs[index].bot = !!value;
        afficherJeu();
    };

    window.__atoumoulinGetState = function(){
        return {
            joueurs: joueurs.map(j=>({
                nom:j.nom, main:[...j.main], score:j.score, bot:!!j.bot
            })),
            paquet:[...paquet],
            joueurActuel,
            cartesTable: JSON.parse(JSON.stringify(cartesTable)),
            defaussePouvoirs: JSON.parse(JSON.stringify(defaussePouvoirs)),
            historique,
            actionEnCours,
            cibleChoisie,
            modeJeu,
            victoires:[...victoires],
            joueur17,
            carte17EnAttente,
            cartesDouble17:[...cartesDouble17],
            double17EnCours,
            joueur19,
            toursJoker:{...toursJoker},
            gagnantPartie: gagnantPartie ? joueurs.indexOf(gagnantPartie) : null,
            gagnantManche: gagnantManche ? joueurs.indexOf(gagnantManche) : null,
            mancheTerminee
        };
    };
})();


/* ===== Atoumoulin multiplayer bridge ===== */
globalThis.__atoumoulinRemote = false;

globalThis.__atoumoulinInitMultiplayer = function(noms, bots, mode = 1){
    globalThis.__atoumoulinRemote = true;

    joueurs = [];
    paquet = [];
    cartesTable = [];
    defaussePouvoirs = [];
    historique = "";
    joueurActuel = 0;
    carteChoisie = null;
    actionEnCours = null;
    cibleChoisie = null;
    toursJoker = {};
    gagnantPartie = null;
    gagnantManche = null;
    mancheTerminee = false;
    joueur17 = null;
    carte17EnAttente = null;
    cartesDouble17 = [];
    double17EnCours = false;
    joueur19 = null;
    victoires = [];
    modeJeu = Number(mode) || 1;

    (noms || []).forEach((nom, index) => {
        joueurs.push({
            nom: String(nom || `Joueur ${index+1}`),
            main: [],
            score: 0,
            bot: !!(bots && bots[index])
        });
        victoires.push(0);
    });

    const nombrePaquets = joueurs.length <= 3 ? 2 : joueurs.length - 1;
    for(let i=0;i<nombrePaquets;i++) paquet = paquet.concat(cartesBase);
    paquet.sort(() => Math.random() - 0.5);

    joueurActuel = Math.floor(Math.random() * joueurs.length);

    joueurs.forEach(j => {
        for(let i=0;i<4;i++) if(paquet.length) j.main.push(paquet.pop());
    });

    afficherJeu();
};

globalThis.__atoumoulinSetBot = function(index, value=true){
    if(joueurs[index]){
        joueurs[index].bot = !!value;
        afficherJeu();
    }
};

globalThis.__atoumoulinSetSelection = function(value){
    carteChoisie = value;
    afficherJeu();
};

globalThis.__atoumoulinGetSelection = function(){
    return carteChoisie;
};

globalThis.__atoumoulinApplyState = function(state, playerIndex){
    globalThis.__atoumoulinRemote = true;
    globalThis.__atoumoulinPlayerIndex = playerIndex;
    joueurs = (state.players || []).map(p => ({
    nom: p.name,
    main: Array.isArray(p.main) ? p.main.slice() : [],
    cardCount: Number(p.cardCount) || 0,
    score: Number(p.score) || 0,
    bot: !!p.bot
}));
    paquet = Array(Math.max(0, Number(state.deckCount)||0)).fill(null);
    cartesTable = Array.isArray(state.table) ? state.table : [];
    defaussePouvoirs = Array.isArray(state.discard) ? state.discard : [];
    historique = String(state.history || "");
    joueurActuel = Number(state.currentPlayer)||0;
    actionEnCours = state.action ?? null;
    cibleChoisie = state.target ?? null;
    carteChoisie = state.selection ?? null;
    toursJoker = state.toursJoker || {};
    gagnantPartie = state.winner == null ? null : joueurs.find(j=>j.nom===state.winner) || null;
    gagnantManche = state.roundWinner == null ? null : joueurs.find(j=>j.nom===state.roundWinner) || null;
    mancheTerminee = !!state.roundEnded;
    joueur17 = state.player17 == null ? null : Number(state.player17);
    carte17EnAttente = state.card17Pending ?? null;
    cartesDouble17 = Array.isArray(state.double17Cards) ? state.double17Cards : [];
    double17EnCours = !!state.double17Active;
    joueur19 = state.player19 == null ? null : Number(state.player19);
    victoires = Array.isArray(state.victories) ? state.victories.slice() : joueurs.map(()=>0);
    afficherJeu();
};

globalThis.__atoumoulinSelectCard = function(index){
    selectionnerCarte(Number(index));
};
globalThis.__atoumoulinSelectDouble13 = function(index){
    selectionnerCarteDouble13(Number(index));
};
