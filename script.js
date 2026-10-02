const bouton = document.getElementById("nouvellePartie");
const zoneJeu = document.getElementById("jeu");
const choixJoueurs = document.getElementById("nombreJoueurs");
const choixBots = document.getElementById("nombreBots");

globalThis.__atoumoulinNombreBots = 0;

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

    globalThis.__atoumoulinNombreBots =
    Number(choixBots.value) || 0;

}

choixJoueurs.addEventListener("change", mettreAJourNombreBots);
choixBots.addEventListener("change", () => {
    globalThis.__atoumoulinNombreBots =
        Number(choixBots.value) || 0;
});

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
let niveauBots = "facile";
let premierJoueur = 0;

globalThis.__atoumoulinSetBotLevel = function(level){
    const niveaux = ["facile", "normal", "difficile", "expert"];

    if(niveaux.includes(String(level))){
        niveauBots = String(level);
    }
};

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

if(typeof Image !== "undefined"){

    const imagesCartes = [
        ...Array.from({length: 21}, (_, i) =>
            `cartes/${String(i + 1).padStart(2, "0")}.png`
        ),
        "cartes/joker.png",
        "cartes/dos.png"
    ];

    imagesCartes.forEach(src => {

        const img = new Image();

        img.src = src;

        if(img.decode){
            img.decode().catch(() => {});
        }

    });

}

function couleurJoueur(index){

    if(index === -1){
        return "";
    }

    return couleursJoueurs[index].rond;
}

function lancerNouvellePartie(){

let nombreJoueurs = Number(choixJoueurs.value);

modeJeu = Number(document.getElementById("modeJeu").value);

niveauBots =
    document.getElementById("niveauBots")?.value || "facile";

let nombreBots = Number(choixBots.value);

joueurs = [];
paquet = [];
cartesTable = [];
defaussePouvoirs = [];
historique = "";
    
joueurActuel = Math.floor(Math.random() * nombreJoueurs);
premierJoueur = joueurActuel;

actionEnCours = null;
cibleChoisie = null;
carteChoisie = null;
toursJoker = {};

gagnantPartie = null;
gagnantManche = null;
mancheTerminee = false;

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

}

bouton.onclick = function(){

    if(mancheTerminee){

        afficherConfirmationNouvellePartie();

        return;

    }

    lancerNouvellePartie();

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

    <div class="historique-jeu">
        <h3>Historique :</h3>
        <div class="historique-contenu">
            ${historique
                .split("<br>")
                .filter(function(ligne){
                    return ligne.trim() !== "" &&
                           !ligne.includes("Score :");
                })
                .reverse()
                .map(function(ligne){

                    let joueurTrouve = joueurs
                        .slice()
                        .sort(function(a, b){
                            return b.nom.length - a.nom.length;
                        })
                        .find(function(joueur){
                            return ligne.trim().startsWith(joueur.nom);
                        });

                    if(joueurTrouve){

                        let indexJoueur = joueurs.indexOf(joueurTrouve);

                        return `${couleurJoueur(indexJoueur)} ${ligne}`;
                    }

                    return ligne;
                })
                .join("<br>")}
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

    <div class="fin-gagnant">

    <h2>
        🏆 ${couleurJoueur(indexGagnant)}
        ${gagnantPartie.nom}
        ${couleurJoueur(indexGagnant)} 🏆
    </h2>

    <h3>
        Remporte la partie !
    </h3>

    </div>

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

    <div class="historique-jeu">
        <h3>Historique :</h3>
        <div class="historique-contenu">
            ${historique
                .split("<br>")
                .filter(function(ligne){
                    return ligne.trim() !== "" &&
                           !ligne.includes("Score :");
                })
                .reverse()
                .map(function(ligne){

                    let joueurTrouve = joueurs
                        .slice()
                        .sort(function(a, b){
                            return b.nom.length - a.nom.length;
                        })
                        .find(function(joueur){
                            return ligne.trim().startsWith(joueur.nom);
                        });

                    if(joueurTrouve){

                        let indexJoueur = joueurs.indexOf(joueurTrouve);

                        return `${couleurJoueur(indexJoueur)} ${ligne}`;
                    }

                    return ligne;
                })
                .join("<br>")}
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
    <div class="defausse-pouvoirs">
    ${
        defaussePouvoirs.map(carte => `
            <strong class="defausse-pouvoir-carte">
            ${carte.valeur}
            </strong>
        `).join(
            ' <span class="separateur-score">➜</span> '
        )
    }
    </div>
    `;

}

let nombreCartesVisibles = Math.min(paquet.length, 3);

if(paquet.length === 0){

    zoneJeu.innerHTML +=
    `
    <div class="pioche-vide">
        Pioche vide
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

// Vérifier si ce joueur doit passer un tour à cause du double Joker

if(toursJoker[joueurActuel] > 0 && actionEnCours === null){

    toursJoker[joueurActuel]--;

    passerJoueur();

    afficherJeu();

    return;
}

if(joueur.bot && !globalThis.__atoumoulinRemote){

    if(actionEnCours === null){

        jouerTourBot();

    }else{

        gererActionBot();

    }

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
        <img src="cartes/dos.png" class="carte-dos-adversaire" alt="Dos de carte">
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
    <img src="cartes/${carte === "Joker" ? "joker" : String(carte).padStart(2, "0")}.png" class="image-carte" alt="Carte">
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

const afficherActions =
    !globalThis.__atoumoulinRemote ||
    Number(globalThis.__atoumoulinPlayerIndex) ===
    Number(joueurActuel);

if(afficherActions){

if(actionEnCours === "double1"){

    let adversairesDisponibles = joueurs.filter((cible,index) => {

        if(index === joueurActuel){
            return false;
        }

        return cartesTable.some(carte =>
            carte.proprietaire === cible.nom &&
            carte.valeur !== 0
        );

    });

    // Aucun adversaire avec une carte à points posée

    if(adversairesDisponibles.length === 0){

        historique +=
        `${joueurs[joueurActuel].nom} ne trouve aucune carte à voler avec le Double 1<br>`;

        piocherCarte(joueur);
        
        actionEnCours = null;

        if(!gererFinTourMultijoueur()){
        passerJoueur();
        }

        afficherJeu();

        return;

    }
    else{

        zoneJeu.innerHTML +=
        `<h3>Choisir un adversaire :</h3>`;

        adversairesDisponibles.forEach(cible => {

            let index = joueurs.indexOf(cible);

            zoneJeu.innerHTML +=
            `
            <button onclick="choisirAdversaireDouble1(${index})">
            ${cible.nom}
            </button>
            `;

        });

    }

}

if(actionEnCours === "vol1"){

    let adversairesDisponibles = joueurs.filter((adversaire,index) => {

        if(index === joueurActuel){
            return false;
        }

        return cartesTable.some(carte =>
            carte.proprietaire === adversaire.nom &&
            carte.valeur !== 0
        );

    });

    // Aucun adversaire avec une carte à points posée

    if(adversairesDisponibles.length === 0){

        historique +=
        `${joueurs[joueurActuel].nom} ne trouve aucune carte à voler avec le 1<br>`;

        piocherCarte(joueur);
        
        actionEnCours = null;

        if(double17EnCours){
            reprendreDouble17();
            return;
        }


        if(!gererFinTourMultijoueur()){
        passerJoueur();
        }

        afficherJeu();

        return;

    }
    else{

        zoneJeu.innerHTML +=
        "<h3>Choisir un adversaire :</h3>";

        adversairesDisponibles.forEach(adversaire => {

            let index = joueurs.indexOf(adversaire);

            zoneJeu.innerHTML +=
            `
            <button onclick="choisirAdversaireVol1(${index})">
            ${adversaire.nom}
            </button>
            `;

        });

    }

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

    let adversairesDisponibles = joueurs.filter((adversaire,index) => {

        if(index === joueurActuel){
            return false;
        }

        return cartesTable.some(carte =>
            carte.proprietaire === adversaire.nom &&
            carte.valeur !== 0
        );

    });

    // Aucun adversaire avec une carte à points posée

    if(adversairesDisponibles.length === 0){

        historique +=
        `${joueurs[joueurActuel].nom} ne trouve aucune carte à voler avec le Double 13<br>`;

        piocherCarte(joueur);
        
        actionEnCours = null;

        if(!gererFinTourMultijoueur()){
        passerJoueur();
        }

        afficherJeu();

        return;

    }
    else{

        zoneJeu.innerHTML +=
        "<h3>Choisir un adversaire :</h3>";

        adversairesDisponibles.forEach(adversaire => {

            let index = joueurs.indexOf(adversaire);

            zoneJeu.innerHTML +=
            `
            <button onclick="choisirAdversaireDouble13(${index})">
            ${adversaire.nom}
            </button>
            `;

        });

    }

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

}

if(actionEnCours === "carte13"){

    let adversairesDisponibles = joueurs.filter((adversaire,index) => {

        if(index === joueurActuel){
            return false;
        }

        return cartesTable.some(carte =>
            carte.proprietaire === adversaire.nom &&
            carte.valeur !== 0
        );

    });

    // Aucun adversaire avec une carte à points posée

    if(adversairesDisponibles.length === 0){

        historique +=
        `${joueurs[joueurActuel].nom} ne trouve aucune carte à voler avec le 13<br>`;

        piocherCarte(joueur);
        
        actionEnCours = null;

        if(double17EnCours){
            reprendreDouble17();
            return;
        }

        if(!gererFinTourMultijoueur()){
        passerJoueur();
        }

        afficherJeu();

        return;

    }
    else{

        zoneJeu.innerHTML +=
        "<h3>Choisir un adversaire :</h3>";

        adversairesDisponibles.forEach(adversaire => {

            let index = joueurs.indexOf(adversaire);

            zoneJeu.innerHTML +=
            `
            <button onclick="choisirAdversaireCarte13(${index})">
            ${adversaire.nom}
            </button>
            `;

        });

    }

}

if(actionEnCours === "carte13choix"){

let cible = joueurs[cibleChoisie];

let cartesDisponibles = cartesTable.filter(carte =>
    carte.proprietaire === cible.nom && carte.valeur !== 0
);

if(cartesDisponibles.length === 0){
    terminerCarte13SansCible();
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

historique +=
`${joueur.nom} n'a aucune carte à points à tripler avec le Double 15<br>`;

piocherCarte(joueur);
        
actionEnCours = null;

if(!gererFinTourMultijoueur()){
passerJoueur();
}

afficherJeu();

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

}

if(actionEnCours === "carte15"){

let cartesADoubler = cartesTable.filter(carte =>
    carte.proprietaire === joueur.nom && carte.valeur !== 0
);

if(cartesADoubler.length === 0){

historique +=
`${joueur.nom} n'a aucune carte à points à doubler avec le 15<br>`;

piocherCarte(joueur);
    
actionEnCours = null;

if(double17EnCours){
    reprendreDouble17();
    return;
}


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

let adversairesDisponibles = 0;

joueurs.forEach((adversaire,index)=>{

if(index !== joueurActuel && adversaire.main.length > 0){

adversairesDisponibles++;

}

});

if(adversairesDisponibles === 0){

terminerDouble17();

return;

}

zoneJeu.innerHTML +=
"<h3>Choisir un adversaire :</h3>";

joueurs.forEach((adversaire,index)=>{

if(index !== joueurActuel && adversaire.main.length > 0){

zoneJeu.innerHTML +=
`
<button onclick="choisirAdversaireDouble17(${index})">
${adversaire.nom}
</button>
`;

}

});

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

}

if(actionEnCours === "double17jouer"){

zoneJeu.innerHTML +=
`
<h3> Carte choisie : ${carte17EnAttente}</h3>

<button onclick="continuerDouble17()">
Jouer cette carte
</button>
`;

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

        terminer17SansCarte();

        return;

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

    let cartesJoueur = cartesTable.filter(carte =>
        carte.proprietaire === joueur.nom &&
        carte.valeur !== 0
    );

    if(cartesJoueur.length === 0){

        historique +=
        `${joueur.nom} ne trouve aucune carte à échanger avec le Double 19<br>`;

        piocherCarte(joueur);

        actionEnCours = null;
        cibleChoisie = null;
        carteChoisie = null;

        if(!gererFinTourMultijoueur()){
            passerJoueur();
        }

        afficherJeu();

        return;
    }

    let adversairesDisponibles = joueurs.filter((adversaire,index) => {

        if(index === joueurActuel){
            return false;
        }

        return cartesTable.some(carte =>
            carte.proprietaire === adversaire.nom &&
            carte.valeur !== 0
        );

    });

    // Aucun adversaire avec une carte à points posée

    if(adversairesDisponibles.length === 0){

        historique +=
        `${joueurs[joueurActuel].nom} ne trouve aucune carte à échanger avec le Double 19<br>`;

        piocherCarte(joueur);
            
        actionEnCours = null;

        if(!gererFinTourMultijoueur()){
        passerJoueur();
        }

        afficherJeu();

        return;

    }
    else{

        zoneJeu.innerHTML +=
        "<h3>Choisir un adversaire :</h3>";

        adversairesDisponibles.forEach(adversaire => {

            let index = joueurs.indexOf(adversaire);

            zoneJeu.innerHTML +=
            `
            <button onclick="choisirAdversaireDouble19(${index})">
            ${adversaire.nom}
            </button>
            `;

        });

    }

}

if(actionEnCours === "carte19"){

    let cartesJoueur = cartesTable.filter(carte =>
        carte.proprietaire === joueur.nom &&
        carte.valeur !== 0
    );

    if(cartesJoueur.length === 0){

        historique +=
        `${joueur.nom} ne trouve aucune carte à échanger avec le 19<br>`;

        actionEnCours = null;
        cibleChoisie = null;
        carteChoisie = null;
        
        if(double17EnCours){

            reprendreDouble17();
            return;
        }

        piocherCarte(joueur);

        if(!gererFinTourMultijoueur()){
            passerJoueur();
        }

        afficherJeu();

        return;
    }

    let adversairesDisponibles = joueurs.filter((adversaire,index) => {

        if(index === joueurActuel){
            return false;
        }

        return cartesTable.some(carte =>
            carte.proprietaire === adversaire.nom &&
            carte.valeur !== 0
        );

    });

    // Aucun adversaire avec une carte à points posée

    if(adversairesDisponibles.length === 0){

        historique +=
        `${joueurs[joueurActuel].nom} ne trouve aucune carte à échanger avec le 19<br>`;

        piocherCarte(joueur);
        
        actionEnCours = null;

        if(double17EnCours){
            reprendreDouble17();
            return;
        }

        if(!gererFinTourMultijoueur()){
        passerJoueur();
        }

        afficherJeu();

        return;

    }
    else{

        zoneJeu.innerHTML +=
        "<h3>Choisir un adversaire :</h3>";

        adversairesDisponibles.forEach(adversaire => {

            let index = joueurs.indexOf(adversaire);

            zoneJeu.innerHTML +=
            `
            <button onclick="choisirAdversaireCarte19(${index})">
            ${adversaire.nom}
            </button>
            `;

        });

    }

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

}

let historiqueInverse = historique
    .split("<br>")
    .filter(function(ligne){
        return ligne.trim() !== "" &&
               !ligne.includes("Score :");
    })
    .reverse()
    .map(function(ligne){

        let joueurTrouve = joueurs
            .slice()
            .sort(function(a, b){
                return b.nom.length - a.nom.length;
            })
            .find(function(joueur){
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
        `${joueur.nom} joue Double ${valeurDouble} (+${resultat})<br>`;

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
                `${joueur.nom} joue le Double 5, aucune carte disponible<br>`;

            }
            else if(cartesPiochees === 1){

                historique +=
                `${joueur.nom} pioche une carte avec le Double 5<br>`;

            }
            else if(cartesPiochees === 2){

                historique +=
                `${joueur.nom} pioche deux cartes avec le Double 5<br>`;

            }
            else if(cartesPiochees === 3){

                historique +=
                `${joueur.nom} pioche trois cartes avec le Double 5<br>`;

            }
            else if(cartesPiochees === 4){

                historique +=
                `${joueur.nom} pioche quatre cartes avec le Double 5<br>`;

            }

            // Tour suivant

            if(!gererFinTourMultijoueur()){
                passerJoueur();
            }

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
            `${joueur.nom} joue Double 7 (+40)<br>`;

            if(verifierFinPartie()){
                return;
            }

            // Pas de pioche pour le double 7

            if(!gererFinTourMultijoueur()){
                passerJoueur();
            }

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
            `${joueur.nom} joue Double Joker et devra passer ses deux prochains tours<br>`;

            // Pioche 1 carte

            piocherCarte(joueur);

            // Tour suivant

            actionEnCours = null;

            if(!gererFinTourMultijoueur()){
                passerJoueur();
            }

            carteChoisie = null;

            afficherJeu();

            return;

        }

    }

    // Fin normale d'un double pair

    piocherCarte(joueur);

    if(!gererFinTourMultijoueur()){
        passerJoueur();
    }

    carteChoisie = null;

    afficherJeu();

    return;

}

// Carte simple paire

if(typeof carte === "number" && carte % 2 === 0){

    // Carte à points

    joueur.score += carte;

    cartesTable.push({

        valeur: carte,
        proprietaire: joueur.nom,
        liee: false

    });

    historique +=
    `${joueur.nom} joue ${carte} (+${carte})<br>`;

    if(verifierFinPartie()){
        return;
    }

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
            `${joueur.nom} pioche deux cartes avec le 5<br>`;

        }
        else if(cartesPiochees === 1){

            historique +=
            `${joueur.nom} pioche une carte avec le 5<br>`;

        }
        else{

            historique +=
            `${joueur.nom} joue 5, aucune carte disponible<br>`;

        }

        // Tour suivant

        if(!gererFinTourMultijoueur()){
            passerJoueur();
        }

        afficherJeu();

        return;

    }

    if(carte === 7){

        defaussePouvoirs.push({
            valeur: carte,
            joueur: joueur.nom
        });

        joueur.score += 20;

        cartesTable.push({
            valeur: 20,
            proprietaire: joueur.nom,
            liee: false,
            historiqueCarte: [7]
        });

        historique +=
        `${joueur.nom} joue 7 (+20)<br>`;

        if(verifierFinPartie()){
            return;
        }        

        if(!gererFinTourMultijoueur()){
            passerJoueur();
        }

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

// Pioche de fin de tour

if(paquet.length > 0){

    joueur.main.push(paquet.pop());

}

if(!gererFinTourMultijoueur()){
    passerJoueur();
}

carteChoisie = null;

afficherJeu();

}

function botConfig(){
    const configs = {
        facile:{strategique:0,tolerance:1000000},
        normal:{strategique:.60,tolerance:25},
        difficile:{strategique:.90,tolerance:10},
        expert:{strategique:1,tolerance:0}
    };
    return configs[niveauBots] || configs.normal;
}

function botAdversaires(){
    return joueurs.map((j,i)=>i).filter(i=>i!==joueurActuel);
}

function botCartesScore(proprietaire){
    return cartesTable.filter(c=>c.proprietaire===proprietaire && typeof c.valeur==='number' && c.valeur!==0);
}

function botDerniereCarte(proprietaire){
    for(let i=cartesTable.length-1;i>=0;i--){
        if(cartesTable[i].proprietaire===proprietaire && typeof cartesTable[i].valeur==='number' && cartesTable[i].valeur!==0){
            return cartesTable[i];
        }
    }
    return null;
}

/* =========================================================
   IA STRATEGIQUE V3
   - La cible est exacte : dépasser la cible ne gagne pas.
   - La menace d'un adversaire dépend de l'écart ET des
     valeurs réellement intéressantes dans le jeu.
   - Le score du joueur humain n'a aucun traitement spécial.
   - Les cartes d'interaction comparent les conséquences
     complètes de leurs différentes cibles.
   ========================================================= */
function botEtatFinPartie(){
    const mains = joueurs.reduce((n,j)=>n+j.main.length,0);
    const total = paquet.length + mains;
    const seuil = Math.max(joueurs.length * 3, 10);
    return {
        restantes: total,
        finissante: total <= seuil,
        tresFinissante: total <= Math.max(joueurs.length, 6)
    };
}

function botEcartsInteressants(){
    return {
        tresBonne:[20],
        bonne:[16,12,10,8,4,-20],
        possible:[22,18,14,6,2,-10]
    };
}

function botMenaceScore(score){
    const cible=obtenirScoreVictoire();
    const ecart=cible-score;
    if(ecart===0)return 10000;

    const groupes=botEcartsInteressants();
    let menace=0;

    if(groupes.tresBonne.includes(ecart)) menace=900;
    else if(groupes.bonne.includes(ecart)) menace=650;
    else if(groupes.possible.includes(ecart)) menace=400;
    else {
        const distance=Math.abs(ecart);
        // Faible menace de base. La proximité brute n'écrase
        // pas les catégories de cartes réellement favorables.
        menace=Math.max(0,80-distance*1.5);
    }

    const fin=botEtatFinPartie();
    if(fin.finissante){
        // En fin de partie, si personne n'atteint exactement la cible,
        // le joueur le plus proche remporte la manche. La proximité
        // devient donc progressivement plus importante.
        menace += Math.max(0,260-Math.abs(ecart)*8);
    }
    if(fin.tresFinissante){
        menace += Math.max(0,360-Math.abs(ecart)*10);
    }

    // Un joueur au-dessus de la cible peut encore être dangereux :
    // il faut surtout regarder sa distance à la cible, pas son score brut.
    return menace;
}

function botDeltaScoreJoueur(index,delta){
    const score=joueurs[index].score;
    const cible=obtenirScoreVictoire();
    const apres=score+delta;
    return {
        avant:score,
        apres,
        delta,
        victoire:apres===cible,
        depasse:apres>cible,
        menaceAvant:botMenaceScore(score),
        menaceApres:botMenaceScore(apres)
    };
}

function botScoreValeur(valeur){
    const joueur=joueurs[joueurActuel];
    const cible=obtenirScoreVictoire();
    const apres=joueur.score+valeur;
    const etat=botDeltaScoreJoueur(joueurActuel,valeur);
    let v=valeur*1.05;

    if(apres===cible)return 10000+v;
    if(apres>cible)return -900-(apres-cible)*12+Math.max(0,valeur);

    v += (Math.abs(cible-joueur.score)-Math.abs(cible-apres))*4;
    v += botMenaceScore(apres)*0.08;
    if(etat.menaceApres>etat.menaceAvant)v+=12;
    return v;
}

function botProximiteStrategique(score){
    const cible=obtenirScoreVictoire();
    const ecart=cible-score;
    const distance=Math.abs(ecart);

    // En début/milieu de partie, la proximité ne remplace PAS les
    // catégories de menace : elle sert surtout à départager les joueurs
    // qui ne sont dans aucune zone dangereuse.
    if(ecart===20)return 900;
    if([16,12,10,8,4,-20].includes(ecart))return 650;
    if([22,18,14,6,2,-10].includes(ecart))return 400;

    // Pour les positions lointaines, plus on est proche de la cible,
    // plus l'adversaire mérite d'être surveillé. Cette composante est
    // volontairement bornée pour ne jamais écraser les zones ci-dessus.
    return Math.max(0,220-distance*2.2);
}

function botDangerStrategique(score){
    return botMenaceScore(score) + botProximiteStrategique(score)*0.65;
}

function botEvalAction(cible,selfDelta,targetDelta){
    const moi=joueurs[joueurActuel];
    const cibleVictoire=obtenirScoreVictoire();
    const moiAvant=moi.score;
    const moiApres=moiAvant+selfDelta;
    const adversaire=joueurs[cible];
    const adversaireAvant=adversaire.score;
    const adversaireApres=adversaireAvant+targetDelta;
    const avantDanger=botDangerStrategique(adversaireAvant);
    const apresDanger=botDangerStrategique(adversaireApres);

    let v=0;

    // La priorité absolue reste notre propre possibilité d'atteindre
    // exactement la cible. Dépasser la cible est généralement mauvais.
    if(moiApres===cibleVictoire)return 100000;
    if(moiApres>cibleVictoire)v-=1400+(moiApres-cibleVictoire)*20;
    else v+=(Math.abs(cibleVictoire-moiAvant)-Math.abs(cibleVictoire-moiApres))*8;

    // Pour une action contre un adversaire, on compare sa situation
    // complète AVANT/APRES. Cela évite de choisir un joueur très loin
    // simplement parce qu'on peut lui retirer beaucoup de points.
    v += (avantDanger-apresDanger)*3.8;

    // Si deux adversaires sont hors des zones de menace, la proximité
    // à la cible sert de départage stratégique.
    if(avantDanger < 500 && apresDanger < 500){
        v += (botProximiteStrategique(adversaireAvant)-botProximiteStrategique(adversaireApres))*1.8;
    }

    if(adversaireApres===cibleVictoire)v-=2500;

    // Le transfert reste intéressant quand il améliore notre propre score,
    // mais sa valeur ne doit jamais masquer la qualité stratégique de la cible.
    v += selfDelta*0.8;
    return v;
}

// Version transfert : le bot gagne exactement ce que l'adversaire perd.
function botValeurCible(cible,delta){
    return botEvalAction(cible,delta,-delta);
}

// Version purement offensive : l'adversaire perd des points, le bot n'en gagne pas.
function botValeurCibleSansGain(cible,deltaPerte){
    return botEvalAction(cible,0,-Math.abs(deltaPerte));
}

function botQualiteMain(index){
    const main=joueurs[index].main;
    if(!main.length)return -20;
    let q=main.length*3;
    main.forEach(c=>{
        if(c===7)q+=15;
        else if(typeof c==='number' && c%2===1)q+=7;
        else if(typeof c==='number')q+=Math.max(0,c/4);
        else if(c==='Joker')q+=12;
    });
    return q;
}

function botValeurCarte15(carteIndex,multiplicateur){
    const carte=cartesTable[carteIndex];
    const moi=joueurs[joueurActuel];
    if(!carte || carte.proprietaire!==moi.nom || typeof carte.valeur!=='number' || carte.valeur<=0)return -Infinity;
    const ancienne=carte.valeur;
    const delta=ancienne*(multiplicateur-1);
    const apres=moi.score+delta;
    const cible=obtenirScoreVictoire();
    if(apres===cible)return 100000;
    if(apres>cible)return -1800-(apres-cible)*18;

    let v=delta*1.4;
    v+=(Math.abs(cible-moi.score)-Math.abs(cible-apres))*7;
    // Une carte déjà issue d'un pouvoir peut être moins intéressante si
    // elle pousse inutilement au-delà de la cible.
    if(carte.liee)v-=4;
    return v;
}

function botEvalCarteSimple(carte){
    const moi=joueurs[joueurActuel];
    if(typeof carte==='number' && carte%2===0)return botScoreValeur(carte);

    if(carte===1){
        let best=-Infinity;
        botAdversaires().forEach(i=>{
            const c=botDerniereCarte(joueurs[i].nom);
            if(c)best=Math.max(best,botValeurCible(i,c.valeur));
        });
        return isFinite(best)?best:0;
    }

    if(carte===3){
        return Math.max(...botAdversaires().map(i=>botValeurCibleSansGain(i,20)), -50);
    }

    if(carte===5){
        // La valeur du 5 est surtout sa capacité à augmenter les possibilités
        // futures. Elle devient plus utile quand la main est courte et la pioche disponible.
        return 22 + Math.max(0,5-moi.main.length)*5 + (paquet.length>4?5:0);
    }

    if(carte===9){
        let best=-Infinity;
        botAdversaires().forEach(i=>{
            const menace=botMenaceScore(joueurs[i].score);
            const diffMain=joueurs[i].main.length-moi.main.length;
            best=Math.max(best,menace*0.15+diffMain*20);
        });
        return isFinite(best)?best:0;
    }

    if(carte===11){
        return Math.max(botScoreValeur(10),botScoreValeur(-10));
    }

    if(carte===13){
        let best=-Infinity;
        botAdversaires().forEach(i=>{
            botCartesScore(joueurs[i].nom).forEach(c=>best=Math.max(best,botValeurCible(i,c.valeur)));
        });
        return isFinite(best)?best:0;
    }

    if(carte===15){
        let best=-Infinity;
        botCartesScore(moi.nom).forEach((c,i)=>{
            const idx=cartesTable.indexOf(c);
            best=Math.max(best,botValeurCarte15(idx,2));
        });
        return isFinite(best)?best:0;
    }

    if(carte===17){
        let best=-Infinity;
        botAdversaires().forEach(i=>{
            // Pas de lecture de la main adverse : on estime seulement
            // l'intérêt de la cible via ses informations publiques.
            const menace=botMenaceScore(joueurs[i].score);
            const q=botQualiteMain(i);
            best=Math.max(best,menace*0.8+q*0.5);
        });
        return isFinite(best)?best:0;
    }

    if(carte===19){
        let best=-Infinity;
        botAdversaires().forEach(i=>best=Math.max(best,botEval19Target(i,false)));
        return isFinite(best)?best:0;
    }

    if(carte===21){
        let best=botScoreValeur(20);
        botAdversaires().forEach(i=>best=Math.max(best,botValeurCibleSansGain(i,20)));
        return best;
    }

    if(carte==='Joker')return botEvalJoker();
    return 0;
}

function botEvalDouble(valeur){
    const moi=joueurs[joueurActuel];
    if(typeof valeur==='number' && valeur%2===0)return botScoreValeur(valeur*2);

    if(valeur===1){
        let best=-Infinity;
        botAdversaires().forEach(i=>best=Math.max(best,botValeurDoubleVol1(i)));
        return isFinite(best)?best:0;
    }

    if(valeur===3){
        let best=-Infinity;
        botAdversaires().forEach(i=>best=Math.max(best,botValeurCibleSansGain(i,40)));
        return isFinite(best)?best:0;
    }

    if(valeur===5)return 34 + Math.max(0,4-moi.main.length)*5;

    if(valeur===9){
        let best=-Infinity;
        botAdversaires().forEach(i=>best=Math.max(best,botMenaceScore(joueurs[i].score)*0.7+botQualiteMain(i)-botQualiteMain(joueurActuel)));
        return isFinite(best)?best:0;
    }

    if(valeur===11)return Math.max(botScoreValeur(20),botScoreValeur(-20));

    if(valeur===13){
        let best=-Infinity;
        botAdversaires().forEach(i=>{
            const vals=botCartesScore(joueurs[i].nom).map(c=>c.valeur);
            for(let a=0;a<vals.length;a++){
                for(let b=a+1;b<vals.length;b++)best=Math.max(best,botValeurCible(i,vals[a]+vals[b]));
            }
        });
        return isFinite(best)?best:0;
    }

    if(valeur===15){
        let best=-Infinity;
        botCartesScore(moi.nom).forEach(c=>{
            const idx=cartesTable.indexOf(c);
            best=Math.max(best,botValeurCarte15(idx,3));
        });
        return isFinite(best)?best:0;
    }

    if(valeur===17){
        let best=-Infinity;
        botAdversaires().forEach(i=>best=Math.max(best,botMenaceScore(joueurs[i].score)*0.9+botQualiteMain(i)));
        return isFinite(best)?best:0;
    }

    if(valeur===19){
        let best=-Infinity;
        botAdversaires().forEach(i=>best=Math.max(best,botEval19Target(i,true)));
        return isFinite(best)?best:0;
    }

    if(valeur===21){
        let best=botScoreValeur(40);
        botAdversaires().forEach(i=>best=Math.max(best,botValeurCibleSansGain(i,40)));
        return best;
    }

    if(valeur==='Joker')return 50;
    return 0;
}

function botValeurDoubleVol1(cible){
    const cartes=botCartesScore(joueurs[cible].nom).slice(-2);
    const total=cartes.reduce((s,c)=>s+c.valeur,0);
    return botValeurCible(cible,total);
}

function botExpectedStolenValue(cible){
    const main=joueurs[cible].main;
    if(!main.length)return -20;
    // Le 17 simple ne révèle pas la main adverse avant le tirage.
    // On n'utilise donc ni le contenu ni la valeur d'une carte cachée.
    return main.length*2.5 + botMenaceScore(joueurs[cible].score)*0.4;
}

function botEval19Target(index,doubleMode){
    const moi=joueurs[joueurActuel];
    const cartesA=botCartesScore(moi.nom);
    const cartesB=botCartesScore(joueurs[index].nom);
    if(!cartesA.length||!cartesB.length)return -20;

    let delta;
    if(doubleMode){
        const a=cartesA.slice(-2).reduce((s,c)=>s+c.valeur,0);
        const b=cartesB.slice(-2).reduce((s,c)=>s+c.valeur,0);
        delta=b-a;
    }else{
        delta=cartesB[cartesB.length-1].valeur-cartesA[cartesA.length-1].valeur;
    }

    return botValeurCible(index,delta);
}

function botEvalJoker(){

    const moi = joueurs[joueurActuel];

    let best = Math.max(
        botScoreValeur(10),
        botScoreValeur(22)
    );

    botAdversaires().forEach(i => {

        const adversaire = joueurs[i];

        // Simulation de l'échange :
        // le bot prend le score de l'adversaire
        // l'adversaire prend le score du bot.
        const nouveauScoreMoi = adversaire.score;
        const nouveauScoreAdversaire = moi.score;

        let valeur = 0;

        // Valeur de notre nouvelle position
        valeur += botScoreValeur(
            nouveauScoreMoi - moi.score
        );

        // Valeur de la nouvelle position de l'adversaire.
        // Plus l'adversaire devient dangereux, plus cette option
        // doit être pénalisée.
        valeur -= botMenaceScore(
            nouveauScoreAdversaire
        );

        // Victoire immédiate du bot
        if(nouveauScoreMoi === obtenirScoreVictoire()){
            valeur += 100000;
        }

        // L'adversaire atteint exactement la cible
        if(nouveauScoreAdversaire === obtenirScoreVictoire()){
            valeur -= 100000;
        }

        best = Math.max(best, valeur);

    });

    return best;
}

function botChoisirOption(options){
    // La difficulté ne s'applique qu'une fois les choix légaux déterminés.
    // options = [{value: ..., score: ...}]
    const valides=options.filter(o=>o && Number.isFinite(o.score));
    if(!valides.length)return null;

    valides.sort((a,b)=>b.score-a.score);
    const cfg=botConfig();

    // Expert : meilleur choix stratégique sans aléa.
    if(niveauBots==='expert')return valides[0];

    // Une partie des décisions reste volontairement optimale selon le niveau.
    if(Math.random() < cfg.strategique)return valides[0];

    // Sinon, on autorise une erreur dans la tolérance prévue par le niveau.
    const proches=valides.filter(o=>o.score>=valides[0].score-cfg.tolerance);
    if(proches.length>1){
        return proches[1 + Math.floor(Math.random()*(proches.length-1))];
    }

    // Si les scores sont très éloignés, la tolérance ne doit pas rendre
    // les niveaux artificiellement identiques : le choix imparfait se fait
    // parmi les meilleures options légales restantes.
    const largeur=Math.min(valides.length,Math.max(2,Math.ceil(valides.length*(1-cfg.strategique))));
    return valides[1 + Math.floor(Math.random()*Math.max(1,largeur-1))] || valides[0];
}

function botChoisirValeurInitiale(){
    const joueur=joueurs[joueurActuel];
    let candidats=[];

    // Règle absolue : le 7 est prioritaire.
    // S'il existe au moins deux 7, c'est donc le Double 7 qui doit être joué.
    const indicesSept=joueur.main
        .map((carte,index)=>carte===7?index:-1)
        .filter(index=>index!==-1);

    if(indicesSept.length>=2){
        return {type:'double',valeur:7,score:Infinity};
    }

    if(indicesSept.length===1){
        return {type:'simple',index:indicesSept[0],score:Infinity};
    }

    // Deux cartes identiques ou plus : un seul double est joué.
    // S'il y a trois exemplaires, le troisième reste donc en main.
    const doubles=trouverDoubles(joueur.main);
    if(doubles.length){
        doubles.forEach(v=>candidats.push({type:'double',valeur:v,score:botEvalDouble(v)}));
    }else{
        joueur.main.forEach((c,i)=>candidats.push({type:'simple',index:i,carte:c,score:botEvalCarteSimple(c)}));
    }

    candidats.sort((a,b)=>b.score-a.score);
    if(!candidats.length)return null;

    const cfg=botConfig();
    const pool=candidats.filter(c=>c.score>=candidats[0].score-cfg.tolerance);
    if(niveauBots==='expert')return candidats[0];

    if(niveauBots === 'facile'){
        return pool[Math.floor(Math.random()*pool.length)];
    }

    if(Math.random()>cfg.strategique){
        const largeur=Math.min(pool.length,Math.max(1,Math.ceil(pool.length*.80)));
        return pool[Math.floor(Math.random()*largeur)];
    }
    return pool[0];
}

function jouerTourBot(){
    const joueur=joueurs[joueurActuel];
    if(!joueur.bot)return;
    const choix=botChoisirValeurInitiale();
    if(!choix)return;
    if(choix.type==='double'){
        carteChoisie=[];
        let n=0;
        joueur.main.forEach((c,i)=>{if(c===choix.valeur&&n<2){carteChoisie.push(i);n++;}});
    }else{
        carteChoisie=choix.index;
    }
    jouerCarte();
}

function botChoisirCibleStrategique(mode){
    // Ne proposer que des cibles légalement sélectionnables.
    // 1,Double1,13,Double13,19,Double19 : la cible doit posséder au moins une carte à points sur la table.
    // 17,Double17 : la cible doit avoir au moins une carte en main à voler.
    const adversaires=botAdversaires().filter(i=>{

    if(
        mode==='1' ||
        mode==='double1' ||
        mode==='13' ||
        mode==='double13' ||
        mode==='19' ||
        mode==='double19'
    ){
        return botCartesScore(joueurs[i].nom).length > 0;
    }

    if(mode==='17' || mode==='double17'){
        return joueurs[i].main.length > 0;
    }

    return true;
    });
    if(!adversaires.length)return null;
    const evals=adversaires.map(i=>{
        let score=-Infinity;
        if(mode==='1')score=botValeurDoubleVol1(i);
        else if(mode==='3')score=botValeurCibleSansGain(i,20);
        else if(mode==='9')score=(joueurs[i].main.length-joueurs[joueurActuel].main.length)*20+botDangerStrategique(joueurs[i].score)*0.15;
        else if(mode==='13')score=botCartesScore(joueurs[i].nom).reduce((m,c)=>Math.max(m,botValeurCible(i,c.valeur)),-Infinity);
        else if(mode==='17')score=botExpectedStolenValue(i)+botProximiteStrategique(joueurs[i].score)*0.8;
        else if(mode==='19')score=botEval19Target(i,false);
        else if(mode==='21')score=botValeurCibleSansGain(i,20);
        else if(mode==='double3')score=botValeurCibleSansGain(i,40);
        else if(mode==='double9')score=botQualiteMain(i)*2+(joueurs[i].main.length-joueurs[joueurActuel].main.length)*5+botDangerStrategique(joueurs[i].score)*0.15;
        else if(mode==='double13'){
            const vals=botCartesScore(joueurs[i].nom).map(c=>c.valeur);
            for(let a=0;a<vals.length;a++)for(let b=a+1;b<vals.length;b++)score=Math.max(score,botValeurCible(i,vals[a]+vals[b]));
        }
        else if(mode==='double17')score=botExpectedStolenValue(i)+botProximiteStrategique(joueurs[i].score)*0.8;
        else if(mode==='double19')score=botEval19Target(i,true);
        else if(mode==='double21')score=botValeurCibleSansGain(i,40);
        else if(mode==='joker'){
            const avant=botMenaceScore(joueurs[i].score);
            const apres=botMenaceScore(joueurs[joueurActuel].score);
            score=avant-apres;
            if(joueurs[i].score-joueurs[joueurActuel].score>0)score+=30;
        }
        return {index:i,score};
    }).sort((a,b)=>{
        const d=b.score-a.score;
        if(Math.abs(d)>0.000001)return d;
        const da=Math.abs(obtenirScoreVictoire()-joueurs[a.index].score);
        const db=Math.abs(obtenirScoreVictoire()-joueurs[b.index].score);
        if(da!==db)return da-db;
        // Aucun statut humain/bot ni numéro de joueur n'entre dans le choix.
        // En dernier recours, conserver l'ordre circulaire après le joueur actif.
        const ra=(a.index-joueurActuel+joueurs.length)%joueurs.length;
        const rb=(b.index-joueurActuel+joueurs.length)%joueurs.length;
        return ra-rb;
    });

    if(!evals.length)return null;
    const cfg=botConfig();
    const pool=evals.filter(x=>x.score>=evals[0].score-cfg.tolerance);
    if(niveauBots==='expert')return evals[0].index;
    return Math.random()>cfg.strategique
        ? pool[Math.floor(Math.random()*pool.length)].index
        : pool[0].index;
}

function botChoisirCartesScore(cibleNom,nombre){
    const disponibles=cartesTable.map((c,i)=>({c,i}))
        .filter(x=>x.c.proprietaire===cibleNom && typeof x.c.valeur==='number' && x.c.valeur!==0);
    if(!disponibles.length)return [];
    const cible=joueurs.findIndex(j=>j.nom===cibleNom);
    if(cible<0)return disponibles.slice(0,nombre).map(x=>x.i);

    if(nombre===1){
        const options=disponibles.map(x=>({value:[x.i],score:botValeurCible(cible,x.c.valeur)}));
        return botChoisirOption(options)?.value || [];
    }

    if(nombre===2){
        const options=[];
        for(let a=0;a<disponibles.length;a++){
            for(let b=a+1;b<disponibles.length;b++){
                const somme=disponibles[a].c.valeur+disponibles[b].c.valeur;
                options.push({
                    value:[disponibles[a].i,disponibles[b].i],
                    score:botValeurCible(cible,somme)
                });
            }
        }
        return botChoisirOption(options)?.value || [];
    }

    return disponibles.slice(0,nombre).map(x=>x.i);
}

function botChoisirCarte17(){
    if(!cartesDouble17.length)return null;
    const scores=cartesDouble17.map((c,i)=>({i,score:botEvalCarteSimple(c)})).sort((a,b)=>b.score-a.score);
    const cfg=botConfig();
    const proches=scores.filter(x=>x.score>=scores[0].score-cfg.tolerance);
    if(niveauBots==='expert')return scores[0].i;
    return Math.random()>cfg.strategique?proches[Math.floor(Math.random()*proches.length)].i:proches[0].i;
}

function terminerPouvoirSansCible(valeur){
    const joueur=joueurs[joueurActuel];
    historique +=
        `${joueur.nom} joue ${valeur}, aucune carte disponible<br>`;
    // Cas particulier : le pouvoir vient d'un Double 17.
    // On doit continuer avec la deuxième carte du Double 17.
    if(double17EnCours){
        actionEnCours=null;
        carteChoisie=null;
        cibleChoisie=null;
        reprendreDouble17();     
        return;
    }
    // Pouvoir normal : pioche de fin de tour.
    piocherCarte(joueur);
    actionEnCours=null;
    cibleChoisie=null;
    carteChoisie=null;
    if(!gererFinTourMultijoueur()){
        passerJoueur();
    }
    afficherJeu();
}

function gererActionBot(){
    const joueur=joueurs[joueurActuel];
    if(!joueur.bot||actionEnCours===null)return;
    let cible=null;
    switch(actionEnCours){
        case 'vol1': cible=botChoisirCibleStrategique('1'); if(cible!==null) {choisirAdversaireVol1(cible); }else{ terminerPouvoirSansCible(1);} return;
        case 'double1': cible=botChoisirCibleStrategique('double1'); if(cible!==null) {choisirAdversaireDouble1(cible); }else{ terminerPouvoirSansCible('Double 1');} return;
        case 'carte3': cible=botChoisirCibleStrategique('3'); if(cible!==null) choisirAdversaireCarte3(cible); return;
        case 'double3': cible=botChoisirCibleStrategique('double3'); if(cible!==null) choisirAdversaireDouble3(cible); return;
        case 'carte9': cible=botChoisirCibleStrategique('9'); if(cible!==null) choisirAdversaireCarte9(cible); return;
        case 'double9': cible=botChoisirCibleStrategique('double9'); if(cible!==null) choisirAdversaireDouble9(cible); return;
        case 'carte11': { const choix=botChoisirOption([{value:10,score:botScoreValeur(10)},{value:-10,score:botScoreValeur(-10)}]); if(choix)effetCarte11(choix.value); return; }
        case 'double11': { const choix=botChoisirOption([{value:20,score:botScoreValeur(20)},{value:-20,score:botScoreValeur(-20)}]); if(choix)effetDouble11(choix.value); return; }
        case 'carte13': { cible=botChoisirCibleStrategique('13'); if(cible!==null) {choisirAdversaireCarte13(cible); } else { terminerCarte13SansCible();} return; }
        case 'carte13choix': { const cibleValide = joueurs[cibleChoisie] && botCartesScore(joueurs[cibleChoisie].nom).length > 0; const choix = cibleValide ? botChoisirCartesScore(joueurs[cibleChoisie].nom,1) : []; if(choix.length) volerCarte13(choix[0]); else terminerCarte13SansCible(); return; }
        case 'double13': { cible=botChoisirCibleStrategique('double13'); if(cible!==null) choisirAdversaireDouble13(cible); else terminerDouble13(); return; }
        case 'double13choix': { const choix=botChoisirCartesScore(joueurs[cibleChoisie].nom,2); carteChoisie=choix; if(choix.length)volerCartesDouble13(); else terminerDouble13(); return; }
        case 'carte15': { const options=botCartesScore(joueur.nom).map(c=>{ const idx=cartesTable.indexOf(c); return {value:idx,score:botValeurCarte15(idx,2)};}); const choix=botChoisirOption(options); if(choix)doublerCarte15(choix.value); else{ if(double17EnCours) {reprendreDouble17(); }else{ terminerActionPouvoir();}} return; }
        case 'double15': { const options=botCartesScore(joueur.nom).map(c=>{ const idx=cartesTable.indexOf(c); return {value:idx,score:botValeurCarte15(idx,3)};}); const choix=botChoisirOption(options); if(choix)triplerCarte15(choix.value); else terminerActionPouvoir(); return; }
        case 'carte17': { cible=botChoisirCibleStrategique('17'); if(cible!==null) choisirAdversaireCarte17(cible); else terminer17SansCarte(); return; }
        case 'carte17revelee': continuerCarte17(); return;
        case 'double17': cible=botChoisirCibleStrategique('double17'); if(cible!==null) choisirAdversaireDouble17(cible); else terminerDouble17(); return;
        case 'double17revelee': { const i=botChoisirCarte17(); if(i!==null)choisirCarteDouble17(i); return; }
        case 'double17jouer': continuerDouble17(); return;
        case 'carte19': cible=botChoisirCibleStrategique('19'); if(cible!==null){ choisirAdversaireCarte19(cible); }else{ terminerPouvoirSansCible(19);} return;
        case 'double19': cible=botChoisirCibleStrategique('double19'); if(cible!==null){ choisirAdversaireDouble19(cible); }else{ terminerPouvoirSansCible('Double 19');} return;
        case 'carte21': { const options=[{value:20,score:botScoreValeur(20)}]; botAdversaires().forEach(i=>options.push({value:-20,score:botValeurCibleSansGain(i,20)})); const choix=botChoisirOption(options); if(choix)effetCarte21(choix.value); return; }
        case 'carte21cible': cible=botChoisirCibleStrategique('21'); if(cible!==null)cibleCarte21(cible); return;
        case 'double21': { const options=[{value:40,score:botScoreValeur(40)}]; botAdversaires().forEach(i=>options.push({value:-40,score:botValeurCibleSansGain(i,40)})); const choix=botChoisirOption(options); if(choix)effetDouble21(choix.value); return; }
        case 'double21cible': cible=botChoisirCibleStrategique('double21'); if(cible!==null)cibleDouble21(cible); return;
        case 'joker': { const moi = joueurs[joueurActuel]; const vals = [{v:10,s: botScoreValeur(10)},{v:22,s: botScoreValeur(22)}];

    // Comparer chaque échange possible avec le même moteur stratégique
    botAdversaires().forEach(i => {

        const adversaire = joueurs[i];

        // Simulation de l'échange :
        // moi -> score de l'adversaire
        // adversaire -> mon score
        const nouveauScoreMoi = adversaire.score;
        const nouveauScoreAdversaire = moi.score;

        const deltaMoi =
            nouveauScoreMoi - moi.score;

        let scoreOption =
            botScoreValeur(deltaMoi);

        // L'adversaire doit également être évalué
        scoreOption -=
            botMenaceScore(nouveauScoreAdversaire);

        // Victoire immédiate
        if(nouveauScoreMoi === obtenirScoreVictoire()){
            scoreOption += 100000;
        }

        // On évite de donner immédiatement la cible
        // au joueur adverse.
        if(nouveauScoreAdversaire === obtenirScoreVictoire()){
            scoreOption -= 100000;
        }

        vals.push({
            v: 'echange',
            cible: i,
            s: scoreOption
        });

    });

    // Meilleure option en premier
    vals.sort((a, b) => b.s - a.s);

    const cfg = botConfig();

    // Expert = meilleure option exacte.
    // Autres niveaux = possibilité de choisir parmi
    // les options suffisamment proches de la meilleure.
    const pool = vals.filter(option =>
        option.s >= vals[0].s - cfg.tolerance
    );

    const choix =
        niveauBots === 'expert'
            ? vals[0]
            : (
                Math.random() > cfg.strategique
                    ? pool[Math.floor(Math.random() * pool.length)]
                    : pool[0]
            );

    if(choix.v === 'echange'){

        actionEnCours = 'jokerCible';
        cibleChoisie = choix.cible;

        echangeJoker(choix.cible);

    }else{

        effetJoker(choix.v);

    }

    return;
}
        case 'jokerCible': if(cibleChoisie!==null)echangeJoker(cibleChoisie); return;
    }
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

        historique +=
        `${joueur.nom} vole la dernière carte (${carteVolee.valeur}) de ${cible.nom} avec le 1<br>`;

        if(verifierFinPartie()){
            afficherJeu();
            return;
        }
        
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

    if(!gererFinTourMultijoueur()){
        passerJoueur();
    }

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

    historique +=
    `${joueurs[joueurActuel].nom} inflige (-20) à ${cible.nom} avec le 3<br>`;

    if(verifierFinPartie()){
        afficherJeu();
        return;
    }
    
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

    if(!gererFinTourMultijoueur()){
        passerJoueur();
    }

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

    if(!gererFinTourMultijoueur()){
        passerJoueur();
    }

    carteChoisie = null;

    afficherJeu();

}

function effetCarte11(valeur){

    let joueur = joueurs[joueurActuel];

    joueur.score += valeur;

    cartesTable.push({
        valeur: valeur,
        proprietaire: joueur.nom,
        liee: false,
        historiqueCarte: [11]
    });

    historique +=
    `${joueur.nom} (${valeur > 0 ? "+" : ""}${valeur}) avec le 11<br>`;

    if(verifierFinPartie()){
        return;
    }

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

    if(!gererFinTourMultijoueur()){
        passerJoueur();
    }

    carteChoisie = null;

    afficherJeu();

}

function terminerCarte13SansCible(){
    const joueur = joueurs[joueurActuel];
    historique +=
        `${joueur.nom} ne trouve aucune carte à voler avec le 13<br>`;

    if(double17EnCours){
        actionEnCours = null;
        cibleChoisie = null;
        carteChoisie = null;
        reprendreDouble17();
        return;
    }

    piocherCarte(joueur);
    
    actionEnCours = null;
    cibleChoisie = null;
    carteChoisie = null;

    if(!gererFinTourMultijoueur()){
        passerJoueur();
    }

    afficherJeu();
}

function choisirAdversaireCarte13(index){

    const cible = joueurs[index];
    const joueur = joueurs[joueurActuel];

    if(!cible || index === joueurActuel || botCartesScore(cible.nom).length === 0){
        terminerCarte13SansCible();
        return;
    }

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
        `${joueur.nom} ne peut pas voler sa propre carte avec le 13<br>`;

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
    `${joueur.nom} vole (${carte.valeur}) à ${cible.nom} avec le 13<br>`;

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
    if(!gererFinTourMultijoueur()){
        passerJoueur();
    }

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
    `${joueur.nom} double (${ancienneValeur}) en (${nouvelleValeur}) avec le 15<br>`;

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

    if(!gererFinTourMultijoueur()){
        passerJoueur();
    }

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
        `${joueur.nom} ne trouve aucune carte à voler avec le 17<br>`;

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

    // IMPORTANT :
    // Si la cible arrive à 0 carte, on ne termine pas
    // l'action du 17. Le joueur actif doit continuer
    // son action normalement.

    // Mémoriser la carte volée

    carte17EnAttente = cartePiochee;

    historique +=
    `${joueur.nom} vole une carte dans la main de ${cible.nom} avec le 17<br>`;

    // Afficher la carte avant de la jouer

    actionEnCours = "carte17revelee";

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

    // Une carte pouvoir volée avec le 17
    // va dans la défausse des pouvoirs.
    if(
    carte === 1 ||
    carte === 3 ||
    carte === 9 ||
    carte === 11 ||
    carte === 13 ||
    carte === 15 ||
    carte === 17 ||
    carte === 19 ||
    carte === 21 ||
    carte === "Joker"
    ){

    defaussePouvoirs.push({
        valeur: carte,
        joueur: joueur.nom
    });
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

        if(!gererFinTourMultijoueur()){
            passerJoueur();
        }

        afficherJeu();

        return;
    }

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

        if(!gererFinTourMultijoueur()){
            passerJoueur();
        }

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

        if(!gererFinTourMultijoueur()){
            passerJoueur();
        }

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
        `${joueur.nom} ne trouve aucune carte à echanger avec le 19<br>`;

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

        if(!gererFinTourMultijoueur()){
            passerJoueur();
        }

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

    // Échange des propriétaires

    carteJoueur.proprietaire = cible.nom;
    carteCible.proprietaire = joueur.nom;

    historique +=
    `${joueur.nom} échange sa dernière carte jouée (${valeurJoueur}) avec la dernière (${valeurCible}) de ${cible.nom} avec le 19<br>`;

    if(verifierFinPartie()){
        return;
    }

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

    if(!gererFinTourMultijoueur()){
        passerJoueur();
    }

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
        `${joueur.nom} (+20) avec le 21<br>`;

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
        // En multijoueur, si le joueur est à 0,
        // on cherche directement le prochain joueur ayant des cartes.

        if(!gererFinTourMultijoueur()){
            passerJoueur();
        }

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
    `${joueur.nom} inflige (-20) à ${cible.nom} avec le 21<br>`;

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
    // En multijoueur, si le joueur actif est à 0,
    // on passe au prochain joueur ayant des cartes.

    if(!gererFinTourMultijoueur()){
        passerJoueur();
    }

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

        historique +=
        `${joueur.nom} (+10) avec le Joker<br>`;

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

        if(!gererFinTourMultijoueur()){
            passerJoueur();
        }

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

        historique +=
        `${joueur.nom} (+22) avec le Joker<br>`;

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

        if(!gererFinTourMultijoueur()){
            passerJoueur();
        }

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

    if(!gererFinTourMultijoueur()){
        passerJoueur();
    }

    carteChoisie = null;

    afficherJeu();

}

function genererHistoriqueFinHTML(){

    let historiqueInverse = historique
        .split("<br>")
        .filter(function(ligne){
            return ligne.trim() !== "" &&
                   !ligne.includes("Score :");
        })
        .reverse()
        .map(function(ligne){

            let joueurTrouve = joueurs
                .slice()
                .sort(function(a, b){
                    return b.nom.length - a.nom.length;
                })
                .find(function(joueur){
                    return ligne.trim().startsWith(joueur.nom);
                });

            if(joueurTrouve){

                let indexJoueur = joueurs.indexOf(joueurTrouve);

                return `${couleurJoueur(indexJoueur)} ${ligne}`;

            }

            return ligne;

        })
        .join("<br>");

    return `
        <div class="historique-jeu">
            <h3>Historique :</h3>
            <div class="historique-contenu">
                ${historiqueInverse}
            </div>
        </div>
    `;
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

    // Si personne n'a atteint exactement le score, vérifier si toutes les cartes sont épuisées

    if(!gagnant){

        let toutesCartesEpuisees =
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

    ${genererHistoriqueFinHTML()}

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

    // Partie unique : le joueur remporte directement la partie
    if(modeJeu === 1){

        historique +=
        `🏆 ${gagnant.nom} remporte la partie !<br>`;

    } else {

    // Plusieurs manches : le joueur remporte la manche
        historique +=
        `🏆 ${gagnant.nom} remporte la manche ! (${victoires[indexGagnant]} victoire${victoires[indexGagnant] > 1 ? "s" : ""})<br>`;

    }

// Partie unique

if(modeJeu === 1){

    gagnantPartie = gagnant;
    actionEnCours = "partieTerminee";

    let scoreVictoire = obtenirScoreVictoire();

    zoneJeu.innerHTML =
    `
    <div class="fin-partie">

    <h2> PARTIE TERMINÉE !</h2>

    <div class="fin-gagnant">

    <h2>
        🏆 ${couleurJoueur(indexGagnant)}
        ${gagnant.nom}
        ${couleurJoueur(indexGagnant)} 🏆
    </h2>

    <h3>
        Remporte la partie !
    </h3>

    </div>

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

    ${genererHistoriqueFinHTML()}

    `;

    return true;

}

  // Vérifier si le joueur a atteint le nombre de victoires nécessaire

if(modeJeu > 1 && victoires[indexGagnant] >= modeJeu){

    gagnantPartie = gagnant;
    actionEnCours = "partieTerminee";

  let scoreVictoire = obtenirScoreVictoire();

    zoneJeu.innerHTML =
    `
    <div class="fin-partie">

    <h2> PARTIE TERMINÉE !</h2>

    <div class="fin-gagnant">

    <h2>
        🏆 ${couleurJoueur(indexGagnant)}
        ${gagnant.nom}
        ${couleurJoueur(indexGagnant)} 🏆
    </h2>

    <h3>
        Remporte la partie !
    </h3>

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

    ${genererHistoriqueFinHTML()}

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

    // Vérifier maintenant si le score provoque la fin de la partie.
    if(verifierFinPartie()){
        return;
    }

    // Le joueur doit normalement piocher 1 carte après avoir terminé son pouvoir.

    if(paquet.length > 0){

        joueur.main.push(paquet.pop());

    }else{

        // Plus aucune carte à piocher. On vérifie maintenant la fin de la manche.

        if(verifierFinPartie()){
            return;
        }
    }
    // Tour suivant
    // En multijoueur, si le joueur actif est à 0, on passe au prochain joueur ayant des cartes.

    if(!gererFinTourMultijoueur()){
        passerJoueur();
    }

    carteChoisie = null;
    cibleChoisie = null;

    afficherJeu();
}

function passerJoueur(){

    // Si personne n'a plus de carte, on termine normalement la manche.
    let joueursAvecCartes = joueurs.filter(
        joueur => joueur.main.length > 0
    );

    if(joueursAvecCartes.length === 0){

        verifierFinPartie();

        return;
    }

    let prochain = joueurActuel + 1;

    if(prochain >= joueurs.length){
        prochain = 0;
    }

    let tentatives = 0;

    while(
        joueurs[prochain] &&
        joueurs[prochain].main.length === 0 &&
        tentatives < joueurs.length
    ){

        prochain++;

        if(prochain >= joueurs.length){
            prochain = 0;
        }

        tentatives++;
    }

    joueurActuel = prochain;
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
    premierJoueur++;

    if(premierJoueur >= joueurs.length){
        premierJoueur = 0;
    }

    joueurActuel = premierJoueur;

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
        `${joueur.nom} vole les deux dernières cartes de ${cible.nom} (${cartesVolees[0].valeur}) (${cartesVolees[1].valeur}) avec le Double 1<br>`;
        
    }
    else if(cartesVolees.length === 1){

        historique +=
        `${joueur.nom} vole la dernière carte de ${cible.nom} (${cartesVolees[0].valeur}) avec le Double 1<br>`;

    }
    else{

        historique +=
        `${joueur.nom} aucune carte à voler avec le Double 1<br>`;

    }

    if(verifierFinPartie()){
        return;
    }

    // Pioche 1 carte

    piocherCarte(joueur);

    actionEnCours = null;
    cibleChoisie = null;

    if(!gererFinTourMultijoueur()){
        passerJoueur();
    }

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
    `${joueurs[joueurActuel].nom} inflige (-40) à ${cible.nom} avec le Double 3<br>`;

    if(verifierFinPartie()){
        return;
    }

    // Pioche 1 carte

    piocherCarte(joueur);

    actionEnCours = null;
    cibleChoisie = null;
    carteChoisie = null;

    // Tour suivant

    if(!gererFinTourMultijoueur()){
        passerJoueur();
    }

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
    `${joueur.nom} échange sa main avec ${cible.nom} avec le Double 9<br>`;

    // Fin du pouvoir

    actionEnCours = null;
    cibleChoisie = null;
    carteChoisie = null;

    // Tour suivant

    if(!gererFinTourMultijoueur()){
        passerJoueur();
    }

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
    `${joueur.nom} (${valeur > 0 ? "+20" : "-20"}) avec le Double 11<br>`;

    if(verifierFinPartie()){
        return;
    }

    // Pioche 1 carte

    piocherCarte(joueur);

    actionEnCours = null;
    cibleChoisie = null;
    carteChoisie = null;

    // Tour suivant

    if(!gererFinTourMultijoueur()){
        passerJoueur();
    }

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
        `${joueur.nom} joue le Double 13, aucune carte disponible à voler à ${cible.nom}<br>`;

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
            `${joueur.nom} vole deux cartes à ${cible.nom} (${cartesVolees[0].valeur}) (${cartesVolees[1].valeur}) avec le Double 13<br>`;

        }
        else if(cartesVolees.length === 1){

            historique +=
            `${joueur.nom} vole une carte à ${cible.nom} (${cartesVolees[0].valeur}) avec le Double 13<br>`;

        }
        else{

            historique +=
            `${joueur.nom} joue le Double 13, aucune carte disponible à voler à ${cible.nom}<br>`;

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

    if(!gererFinTourMultijoueur()){
        passerJoueur();
    }

    afficherJeu();

}

function terminerDouble13(){

    let joueur = joueurs[joueurActuel];
    let cible = cibleChoisie !== null
        ? joueurs[cibleChoisie]
        : null;

    if(cible){
        historique +=
        `${joueur.nom} joue le Double 13, aucune carte disponible à voler à ${cible.nom}<br>`;
    }else{
        historique +=
        `${joueur.nom} joue le Double 13, aucune carte disponible à voler<br>`;
    }

    piocherCarte(joueur);

    actionEnCours=null;
    cibleChoisie=null;
    carteChoisie=null;

    if(!gererFinTourMultijoueur()){
        passerJoueur();
    }

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

    // Le double 15 ajoute DEUX 15 mais multiplie la carte une seule fois par 3

    carte.historiqueCarte.push(15);
    carte.historiqueCarte.push(15);

    // Mise à jour de la carte

    carte.valeur = nouvelleValeur;
    carte.liee = true;

    historique +=
    `${joueur.nom} triple (${ancienneValeur}) en (${nouvelleValeur}) avec le Double 15<br>`;

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

    if(!gererFinTourMultijoueur()){
        passerJoueur();
    }

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
        `${joueur.nom} joue le Double 17, aucune carte disponible dans la main de ${cible.nom}<br>`;

        piocherCarte(joueur);

        actionEnCours = null;
        cibleChoisie = null;

        if(!gererFinTourMultijoueur()){
            passerJoueur();
        }

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
        `${joueur.nom} vole deux cartes dans la main de ${cible.nom} avec le Double 17<br>`;

    }
    else if(cartesDouble17.length === 1){

        historique +=
        `${joueur.nom} vole une carte dans la main de ${cible.nom} avec le Double 17<br>`;

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

// Une carte pouvoir volée avec le double 17 va dans la défausse des pouvoirs.
if(
    carte === 1 ||
    carte === 3 ||
    carte === 9 ||
    carte === 11 ||
    carte === 13 ||
    carte === 15 ||
    carte === 17 ||
    carte === 19 ||
    carte === 21 ||
    carte === "Joker"
){

    defaussePouvoirs.push({
        valeur: carte,
        joueur: joueur.nom
    });
}

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
`${joueur.nom} joue ${carte} avec le Double 17 (+${carte})<br>`;

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
    `${joueur.nom} joue 5 avec le Double 17 et pioche deux cartes<br>`;

}else if(cartesPiochees === 1){

    historique +=
    `${joueur.nom} joue 5 avec le Double 17 et pioche une carte<br>`;

}else{

    historique +=
    `${joueur.nom} joue 5 avec le Double 17, aucune carte disponible<br>`;

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
    `${joueur.nom} joue 7 avec le Double 17 (+20)<br>`;

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

function terminerDouble17(){

    let joueur = joueurs[joueurActuel];

    // Pioche 1 carte

    piocherCarte(joueur);

    actionEnCours = null;
    double17EnCours = false;

    cibleChoisie = null;
    carte17EnAttente = null;
    cartesDouble17 = [];
    carteChoisie = null;

    if(!gererFinTourMultijoueur()){
        passerJoueur();
    }

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
    `${joueur.nom} ne peut plus voler de carte avec le 17<br>`;

    if(double17EnCours){
        carte17EnAttente = null;
        joueur17 = null;
        actionEnCours = null;
        carteChoisie = null;
        cibleChoisie = null;
        reprendreDouble17();
        return;
    }
    
    piocherCarte(joueur);

    // Vérifier si la manche est terminée avant de changer de joueur

    if(verifierFinPartie()){
        return;
    }

    carte17EnAttente = null;
    joueur17 = null;
    actionEnCours = null;
    carteChoisie = null;

    // 17 normal : tour suivant

    if(!gererFinTourMultijoueur()){
        passerJoueur();
    }

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
        `${joueur.nom} échange ses deux dernières cartes jouées (${cartesJoueur[cartesJoueur.length - 2].valeur}) (${cartesJoueur[cartesJoueur.length - 1].valeur}) avec les deux dernières (${cartesCible[cartesCible.length - 2].valeur}) (${cartesCible[cartesCible.length - 1].valeur}) de ${cible.nom} avec le Double 19<br>`;
   
    }
    else if(nombreEchange === 1){

        historique +=
        `${joueur.nom} échange sa dernière carte jouée (${cartesJoueur[cartesJoueur.length - 1].valeur}) avec la dernière (${cartesCible[cartesCible.length - 1].valeur}) de ${cible.nom} avec le Double 19<br>`;
    }
    else{

        historique +=
        `${joueur.nom} aucune carte à echanger avec le Double 19<br>`;

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
    if(!gererFinTourMultijoueur()){
        passerJoueur();
    }

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
        `${joueur.nom} (+40) avec le Double 21<br>`;

        if(verifierFinPartie()){
            return;
        }

        // Pioche 1 carte

        piocherCarte(joueur);

        actionEnCours = null;

        if(!gererFinTourMultijoueur()){
            passerJoueur();
        }

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
    `${joueur.nom} inflige (-40) à ${cible.nom} avec le Double 21<br>`;

    // Vérifier la fin de partie

    if(verifierFinPartie()){
        return;
    }

    // Le joueur pioche 1 carte

    piocherCarte(joueur);

    actionEnCours = null;

    if(!gererFinTourMultijoueur()){
        passerJoueur();
    }

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
    ? `Remporte la manche !`
    : `Aucun joueur ne remporte la manche.`;

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

        <div class="historique-jeu">
            <h3>Historique :</h3>
            <div class="historique-contenu">
                ${historique
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
                    .join("<br>")}
            </div>
        </div>

        `;
}

function ajusterLargeurModeJeu(){

    const select = document.getElementById("modeJeu");

    if(!select){
        return;
    }

    const option = select.options[select.selectedIndex];

    const texte = document.createElement("span");
    const style = getComputedStyle(select);

    texte.style.position = "absolute";
    texte.style.visibility = "hidden";
    texte.style.whiteSpace = "nowrap";
    texte.style.font = style.font;

    texte.textContent = option.textContent;

    document.body.appendChild(texte);

    select.style.width = `${texte.offsetWidth + 45}px`;

    texte.remove();

}

const modeJeuSelect = document.getElementById("modeJeu");

modeJeuSelect.addEventListener(
    "change",
    ajusterLargeurModeJeu
);

ajusterLargeurModeJeu();

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

function afficherConfirmationNouvellePartie(){

    document.getElementById(
        "fenetreConfirmationNouvellePartie"
    ).style.display = "flex";

}

function fermerConfirmationNouvellePartie(){

    document.getElementById(
        "fenetreConfirmationNouvellePartie"
    ).style.display = "none";

}

function annulerNouvellePartie(){

    fermerConfirmationNouvellePartie();

}

function confirmerNouvellePartie(){

    fermerConfirmationNouvellePartie();

    mancheTerminee = false;

    lancerNouvellePartie();

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

function gererFinTourMultijoueur(){

    // En solo : absolument aucun changement.
    if(!globalThis.__atoumoulinRemote){
        return false;
    }

    // Une action spéciale est encore en cours :
    // surtout ne pas changer de joueur maintenant.
    if(actionEnCours !== null){
        return false;
    }

    // Il reste au moins un joueur avec des cartes.
    const joueursAvecCartes =
        joueurs.filter(j => j.main.length > 0);

    // Tout le monde est à 0 :
    // on laisse la fonction existante gérer la fin normale.
    if(joueursAvecCartes.length === 0){
        gererMainVideMultijoueur();
        return true;
    }

    // Le joueur actuel a encore des cartes :
    // son tour peut se terminer normalement.
    if(joueurs[joueurActuel].main.length > 0){
        return false;
    }

    // Le joueur actuel est à 0.
    // On cherche le prochain joueur qui possède au moins une carte.
    let prochain = joueurActuel;

    for(let i = 0; i < joueurs.length; i++){

        prochain++;

        if(prochain >= joueurs.length){
            prochain = 0;
        }

        if(joueurs[prochain].main.length > 0){

            joueurActuel = prochain;

            return true;
        }
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

    window.__atoumoulinSetCarteChoisie = function(value){
        carteChoisie = value;
    };

    window.__atoumoulinGetState = function(){
        return {
            joueurs: joueurs.map(j=>({
                nom:j.nom,
                main:[...j.main],
                score:j.score,
                bot:!!j.bot
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

    for(let i=0;i<nombrePaquets;i++){
        paquet = paquet.concat(cartesBase);
    }

    paquet.sort(() => Math.random() - 0.5);

    joueurActuel = Math.floor(Math.random() * joueurs.length);
    premierJoueur = joueurActuel;

    joueurs.forEach(j => {
        for(let i=0;i<4;i++){
            if(paquet.length) j.main.push(paquet.pop());
        }
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

    paquet = Array(Math.max(0, Number(state.deckCount) || 0)).fill(null);
    cartesTable = Array.isArray(state.table) ? state.table : [];
    defaussePouvoirs = Array.isArray(state.discard) ? state.discard : [];
    historique = String(state.history || "");
    joueurActuel = Number(state.currentPlayer) || 0;
    modeJeu = Number(state.modeJeu) || modeJeu || 1;
    
    actionEnCours = state.action ?? null;
    cibleChoisie = state.target ?? null;
    carteChoisie = state.selection ?? null;
    toursJoker = state.toursJoker || {};

    gagnantPartie =
        state.winner == null
            ? null
            : joueurs.find(j => j.nom === state.winner) || null;

    gagnantManche =
        state.roundWinner == null
            ? null
            : joueurs.find(j => j.nom === state.roundWinner) || null;

    mancheTerminee = !!state.roundEnded;
    joueur17 = state.player17 == null ? null : Number(state.player17);
    carte17EnAttente = state.card17Pending ?? null;
    cartesDouble17 = Array.isArray(state.double17Cards)
        ? state.double17Cards
        : [];
    double17EnCours = !!state.double17Active;
    joueur19 = state.player19 == null ? null : Number(state.player19);
    victoires = Array.isArray(state.victories)
        ? state.victories.slice()
        : joueurs.map(() => 0);

    afficherJeu();
};

globalThis.__atoumoulinSelectCard = function(index){
    selectionnerCarte(Number(index));
};

globalThis.__atoumoulinSelectDouble13 = function(index){
    selectionnerCarteDouble13(Number(index));
};
