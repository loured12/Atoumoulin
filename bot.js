// =====================================================
// POSSIBILITÉS COMPLÈTES
// =====================================================

const Simulator = window.AtoumoulinBotSimulator;
const GameState = window.AtoumoulinGameState;


// -----------------------------------------------------
// Création d'une possibilité
// -----------------------------------------------------

function creerPossibilite({
    type = "carte",
    valeur = null,
    cartes = [],
    joueur = null,
    cible = null,
    carteCible = null,
    cartesCibles = [],
    choix = null,
    description = ""
}) {
    return {
        type,
        valeur,
        cartes: [...cartes],
        joueur,
        cible,
        carteCible,
        cartesCibles: [...cartesCibles],
        choix,
        description
    };
}

// -----------------------------------------------------
// Références joueurs
// -----------------------------------------------------

function referenceJoueur(joueur) {

    if (joueur === null || joueur === undefined) {
        return null;
    }

    return Simulator.obtenirReferenceJoueur(joueur);
}

// -----------------------------------------------------
// Tous les adversaires accessibles
// -----------------------------------------------------

function obtenirAdversaires(etat, joueurActuel) {

    const joueur =
        Simulator.trouverJoueur(
            etat,
            joueurActuel
        );

    if (!joueur) {
        return [];
    }

    return etat.joueurs.filter(
        autre =>
            autre.index !== joueur.index
    );
}

// -----------------------------------------------------
// Cartes identiques disponibles
// -----------------------------------------------------

function compterCarte(main, valeur) {

    return main.filter(
        carte =>
            Simulator.obtenirValeurCarte(carte) === valeur
    ).length;
}

// -----------------------------------------------------
// Possibilités d'une carte simple
// -----------------------------------------------------

function genererPossibilitesCarteSimple(
    etat,
    joueur,
    carte
) {

    const valeur =
        Simulator.obtenirValeurCarte(carte);

    const possibilites = [];

    // -------------------------------------------------
    // 1
    // -------------------------------------------------

    if (valeur === 1) {

        for (const cible of obtenirAdversaires(
            etat,
            joueur
        )) {

            possibilites.push(
                creerPossibilite({
                    type: "carte",
                    valeur: 1,
                    cartes: [carte],
                    joueur: referenceJoueur(joueur),
                    cible: referenceJoueur(cible),
                    description:
                        "Voler la dernière carte de points"
                })
            );
        }

        return possibilites;
    }

    // -------------------------------------------------
    // 3
    // -------------------------------------------------

    if (valeur === 3) {

        for (const cible of obtenirAdversaires(
            etat,
            joueur
        )) {

            possibilites.push(
                creerPossibilite({
                    type: "carte",
                    valeur: 3,
                    cartes: [carte],
                    joueur: referenceJoueur(joueur),
                    cible: referenceJoueur(cible),
                    description:
                        "-20 points à un adversaire"
                })
            );
        }

        return possibilites;
    }


    // -------------------------------------------------
    // 9
    // -------------------------------------------------

    if (valeur === 9) {

        for (const cible of obtenirAdversaires(
            etat,
            joueur
        )) {

            possibilites.push(
                creerPossibilite({
                    type: "carte",
                    valeur: 9,
                    cartes: [carte],
                    joueur: referenceJoueur(joueur),
                    cible: referenceJoueur(cible),
                    description:
                        "Échanger sa main avec un adversaire"
                })
            );
        }

        return possibilites;
    }


    // -------------------------------------------------
    // 11
    // -------------------------------------------------

    if (valeur === 11) {

        // +10 pour soi
        possibilites.push(
            creerPossibilite({
                type: "carte",
                valeur: 11,
                cartes: [carte],
                joueur: referenceJoueur(joueur),
                choix: "plus10",
                description:
                    "+10 points pour soi"
            })
        );

        // -10 pour chaque adversaire
        for (const cible of obtenirAdversaires(
            etat,
            joueur
        )) {

            possibilites.push(
                creerPossibilite({
                    type: "carte",
                    valeur: 11,
                    cartes: [carte],
                    joueur: referenceJoueur(joueur),
                    cible: referenceJoueur(cible),
                    choix: "moins10",
                    description:
                        "-10 points à un adversaire"
                })
            );
        }

        return possibilites;
    }


    // -------------------------------------------------
    // 13
    // -------------------------------------------------

    if (valeur === 13) {

        for (const cible of obtenirAdversaires(
            etat,
            joueur
        )) {

            const cartesPoints =
                Simulator.obtenirCartesPointsJoueur(
                    etat,
                    cible
                );

            for (
                let index = 0;
                index < cartesPoints.length;
                index++
            ) {

                possibilites.push(
                    creerPossibilite({
                        type: "carte",
                        valeur: 13,
                        cartes: [carte],
                        joueur: referenceJoueur(joueur),
                        cible: referenceJoueur(cible),
                        carteCible: cartesPoints[index],
                        choix: null,
                        description:
                            "Voler une carte de points"
                    })
                );
            }
        }

        return possibilites;
    }


    // -------------------------------------------------
    // 15
    // -------------------------------------------------

    if (valeur === 15) {

        const cartesPoints =
            Simulator.obtenirCartesPointsJoueur(
                etat,
                joueur
            );

        for (
            let index = 0;
            index < cartesPoints.length;
            index++
        ) {

            possibilites.push(
                creerPossibilite({
                    type: "carte",
                    valeur: 15,
                    cartes: [carte],
                    joueur: referenceJoueur(joueur),
                    carteCible: cartesPoints[index],
                    choix: null,
                    description:
                        "Doubler une carte de points personnelle"
                })
            );
        }

        return possibilites;
    }


    // -------------------------------------------------
    // 17
    // -------------------------------------------------

    if (valeur === 17) {

        for (const cible of obtenirAdversaires(
            etat,
            joueur
        )) {

            if (
                Simulator.obtenirMain(cible).length === 0
            ) {
                continue;
            }

            possibilites.push(
                creerPossibilite({
                    type: "carte",
                    valeur: 17,
                    cartes: [carte],
                    joueur: referenceJoueur(joueur),
                    cible: referenceJoueur(cible),
                    description:
                        "Voler et jouer une carte aléatoire"
                })
            );
        }

        return possibilites;
    }


    // -------------------------------------------------
    // 19
    // -------------------------------------------------

    if (valeur === 19) {

        for (const cible of obtenirAdversaires(
            etat,
            joueur
        )) {

            possibilites.push(
                creerPossibilite({
                    type: "carte",
                    valeur: 19,
                    cartes: [carte],
                    joueur: referenceJoueur(joueur),
                    cible: referenceJoueur(cible),
                    description:
                        "Échanger la dernière carte de points"
                })
            );
        }

        return possibilites;
    }


    // -------------------------------------------------
    // 21
    // -------------------------------------------------

    if (valeur === 21) {

        // +20 pour soi
        possibilites.push(
            creerPossibilite({
                type: "carte",
                valeur: 21,
                cartes: [carte],
                joueur: referenceJoueur(joueur),
                choix: "plus20",
                description:
                    "+20 points pour soi"
            })
        );

        // -20 pour un adversaire
        for (const cible of obtenirAdversaires(
            etat,
            joueur
        )) {

            possibilites.push(
                creerPossibilite({
                    type: "carte",
                    valeur: 21,
                    cartes: [carte],
                    joueur: referenceJoueur(joueur),
                    cible: referenceJoueur(cible),
                    choix: "moins20",
                    description:
                        "-20 points à un adversaire"
                })
            );
        }

        return possibilites;
    }


    // -------------------------------------------------
    // Joker
    // -------------------------------------------------

    if (
        carte === "Joker" ||
        valeur === "Joker"
    ) {

        // +10
        possibilites.push(
            creerPossibilite({
                type: "carte",
                valeur: "Joker",
                cartes: [carte],
                joueur: referenceJoueur(joueur),
                choix: "plus10",
                description:
                    "+10 points"
            })
        );

        // +22
        possibilites.push(
            creerPossibilite({
                type: "carte",
                valeur: "Joker",
                cartes: [carte],
                joueur: referenceJoueur(joueur),
                choix: "plus22",
                description:
                    "+22 points"
            })
        );

        // échange de score
        for (const cible of obtenirAdversaires(
            etat,
            joueur
        )) {

            possibilites.push(
                creerPossibilite({
                    type: "carte",
                    valeur: "Joker",
                    cartes: [carte],
                    joueur: referenceJoueur(joueur),
                    cible: referenceJoueur(cible),
                    choix: "echangeScores",
                    description:
                        "Échanger les scores"
                })
            );
        }

        return possibilites;
    }


    // -------------------------------------------------
    // Cartes simples sans cible
    // -------------------------------------------------

    possibilites.push(
        creerPossibilite({
            type: "carte",
            valeur,
            cartes: [carte],
            joueur: referenceJoueur(joueur),
            description:
                `Jouer la carte ${valeur}`
        })
    );

    return possibilites;
}

function genererPossibilitesCartesSimples(
    etat,
    joueur
) {

    const joueurEtat =
        Simulator.trouverJoueur(
            etat,
            joueur
        );

    if (!joueurEtat) {
        return [];
    }

    const possibilites = [];

    for (const carte of joueurEtat.main) {

        possibilites.push(
            ...genererPossibilitesCarteSimple(
                etat,
                joueurEtat,
                carte
            )
        );
    }

    return possibilites;
}

// =====================================================
// POSSIBILITÉS — DOUBLES
// =====================================================

function creerPossibiliteDouble(
    etat,
    joueur,
    cartes,
    choix = null,
    cible = null,
    carteCible = null,
    description = "",
    cartesCibles = []
) {

    const valeur =
        cartes.length > 0
            ? Simulator.obtenirValeurCarte(
                cartes[0]
            )
            : null;

    return creerPossibilite({
        type: "double",
        valeur,
        cartes,
        joueur:
            referenceJoueur(joueur),
        cible:
            referenceJoueur(cible),
        carteCible,
        cartesCibles,
        choix,
        description
    });
}

// -----------------------------------------------------
// Construire un double à partir de deux cartes
// -----------------------------------------------------


// -----------------------------------------------------
// Doubles disponibles dans une main
// -----------------------------------------------------

function obtenirDoublesMain(joueur) {

    const main = Simulator.obtenirMain(joueur);

    const groupes = new Map();

    for (const carte of main) {

        const valeur =
            Simulator.obtenirValeurCarte(carte);

        if (!groupes.has(valeur)) {
            groupes.set(valeur, []);
        }

        groupes.get(valeur).push(carte);
    }

    const doubles = [];

    for (const [valeur, cartes] of groupes) {

        if (cartes.length >= 2) {

            /*
             * Même s'il existe 3, 4 ou davantage
             * de cartes identiques, on ne forme
             * qu'un seul double.
             */
            doubles.push({
                valeur,
                cartes: [
                    cartes[0],
                    cartes[1]
                ]
            });
        }
    }

    return doubles;
}


// -----------------------------------------------------
// Possibilités d'un double
// -----------------------------------------------------

function genererPossibilitesDouble(
    etat,
    joueur,
    double
) {

    const valeur = double.valeur;
    const cartes = double.cartes;

    const possibilites = [];


    // -------------------------------------------------
    // Double 1
    // -------------------------------------------------

    if (valeur === 1) {

        for (const cible of obtenirAdversaires(
            etat,
            joueur
        )) {

            const cartesPoints =
                Simulator.obtenirCartesPointsJoueur(
                    etat,
                    cible
                );

            if (cartesPoints.length === 0) {
                continue;
            }

            possibilites.push(
                creerPossibiliteDouble(
                    etat,
                    joueur,
                    cartes,
                    null,
                    cible,
                    null,
                    "Voler jusqu'à 2 dernières cartes de points"
                )
            );
        }

        return possibilites;
    }


    // -------------------------------------------------
    // Double 3
    // -------------------------------------------------

    if (valeur === 3) {

        for (const cible of obtenirAdversaires(
            etat,
            joueur
        )) {

            possibilites.push(
                creerPossibiliteDouble(
                    etat,
                    joueur,
                    cartes,
                    null,
                    cible,
                    null,
                    "-40 points à un adversaire"
                )
            );
        }

        return possibilites;
    }


    // -------------------------------------------------
    // Double 5
    // -------------------------------------------------

    if (valeur === 5) {

        possibilites.push(
            creerPossibiliteDouble(
                etat,
                joueur,
                cartes,
                null,
                null,
                null,
                "Piocher jusqu'à 4 cartes"
            )
        );

        return possibilites;
    }


    // -------------------------------------------------
    // Double 7
    // -------------------------------------------------

    if (valeur === 7) {

        possibilites.push(
            creerPossibiliteDouble(
                etat,
                joueur,
                cartes,
                null,
                null,
                null,
                "+14 points"
            )
        );

        return possibilites;
    }


    // -------------------------------------------------
    // Double 9
    // -------------------------------------------------

    if (valeur === 9) {

        for (const cible of obtenirAdversaires(
            etat,
            joueur
        )) {

            if (
                Simulator.obtenirMain(cible).length === 0
            ) {
                continue;
            }

            possibilites.push(
                creerPossibiliteDouble(
                    etat,
                    joueur,
                    cartes,
                    null,
                    cible,
                    null,
                    "Révéler puis échanger les mains"
                )
            );
        }

        return possibilites;
    }


    // -------------------------------------------------
    // Double 11
    // -------------------------------------------------

    if (valeur === 11) {

        // +20
        possibilites.push(
            creerPossibiliteDouble(
                etat,
                joueur,
                cartes,
                "plus20",
                null,
                null,
                "+20 points"
            )
        );

        // -20
        for (const cible of obtenirAdversaires(
            etat,
            joueur
        )) {

            possibilites.push(
                creerPossibiliteDouble(
                    etat,
                    joueur,
                    cartes,
                    "moins20",
                    cible,
                    null,
                    "-20 points à un adversaire"
                )
            );
        }

        return possibilites;
    }


    // -------------------------------------------------
    // Double 13
    // -------------------------------------------------

    if (valeur === 13) {

        for (const cible of obtenirAdversaires(
            etat,
            joueur
        )) {

            const cartesPoints =
                Simulator.obtenirCartesPointsJoueur(
                    etat,
                    cible
                );

            if (cartesPoints.length === 0) {
                continue;
            }

            /*
             * Le double 13 peut voler jusqu'à
             * deux cartes précises.
             *
             * On génère :
             * - chaque carte seule
             * - chaque paire de cartes
             */

            for (
                let i = 0;
                i < cartesPoints.length;
                i++
            ) {

                possibilites.push(
                   creerPossibiliteDouble(
                   etat,
                   joueur,
                   cartes,
                   null,
                   cible,
                   i,
                   "Voler 1 carte de points"
                  )
                );

                for (
                    let j = i + 1;
                    j < cartesPoints.length;
                    j++
                ) {

                    possibilites.push(
                       creerPossibiliteDouble(
                       etat,
                       joueur,
                       cartes,
                       null,
                       cible,
                       null,
                       "Voler 2 cartes de points",
                       [i, j]
                       
                       )
                    );
                }
            }
        }

        return possibilites;
    }


    // -------------------------------------------------
    // Double 15
    // -------------------------------------------------

    if (valeur === 15) {

        const cartesPoints =
            Simulator.obtenirCartesPointsJoueur(
                etat,
                joueur
            );

        for (
            let index = 0;
            index < cartesPoints.length;
            index++
        ) {

            possibilites.push(
                creerPossibiliteDouble(
                    etat,
                    joueur,
                    cartes,
                    null,
                    null,
                    index,
                    "Tripler une carte de points personnelle"
                )
            );
        }

        return possibilites;
    }


    // -------------------------------------------------
    // Double 17
    // -------------------------------------------------

    if (valeur === 17) {

        for (const cible of obtenirAdversaires(
            etat,
            joueur
        )) {

            if (
                Simulator.obtenirMain(cible).length === 0
            ) {
                continue;
            }

            possibilites.push(
                creerPossibiliteDouble(
                    etat,
                    joueur,
                    cartes,
                    null,
                    cible,
                    null,
                    "Voler puis jouer jusqu'à 2 cartes"
                )
            );
        }

        return possibilites;
    }


    // -------------------------------------------------
    // Double 19
    // -------------------------------------------------

    if (valeur === 19) {

        for (const cible of obtenirAdversaires(
            etat,
            joueur
        )) {

            const cartesPoints =
                Simulator.obtenirCartesPointsJoueur(
                    etat,
                    cible
                );

            if (cartesPoints.length === 0) {
                continue;
            }

            /*
             * Même logique que Double 1 :
             * l'action peut récupérer jusqu'à deux
             * dernières cartes de points.
             */
            possibilites.push(
                creerPossibiliteDouble(
                    etat,
                    joueur,
                    cartes,
                    null,
                    cible,
                    null,
                    "Échanger jusqu'à 2 dernières cartes de points"
                )
            );
        }

        return possibilites;
    }


    // -------------------------------------------------
    // Double 21
    // -------------------------------------------------

    if (valeur === 21) {

        // +40
        possibilites.push(
            creerPossibiliteDouble(
                etat,
                joueur,
                cartes,
                "plus40",
                null,
                null,
                "+40 points"
            )
        );

        // -40
        for (const cible of obtenirAdversaires(
            etat,
            joueur
        )) {

            possibilites.push(
                creerPossibiliteDouble(
                    etat,
                    joueur,
                    cartes,
                    "moins40",
                    cible,
                    null,
                    "-40 points à un adversaire"
                )
            );
        }

        return possibilites;
    }


    // -------------------------------------------------
    // Double Joker
    // -------------------------------------------------

    if (
        valeur === "Joker"
    ) {

        possibilites.push(
            creerPossibiliteDouble(
                etat,
                joueur,
                cartes,
                "toursJoker",
                null,
                null,
                "Passer 2 tours"
            )
        );

        return possibilites;
    }


    // -------------------------------------------------
    // Doubles numériques classiques
    // -------------------------------------------------

    if (
        typeof valeur === "number" &&
        valeur % 2 === 0
    ) {

        possibilites.push(
            creerPossibiliteDouble(
                etat,
                joueur,
                cartes,
                null,
                null,
                null,
                `Double ${valeur} → +${valeur * 2}`
            )
        );

        return possibilites;
    }


    return possibilites;
}


// -----------------------------------------------------
// Toutes les possibilités doubles
// -----------------------------------------------------

function genererPossibilitesDoubles(
    etat,
    joueur
) {

    const joueurEtat =
        Simulator.trouverJoueur(
            etat,
            joueur
        );

    if (!joueurEtat) {
        return [];
    }

    const doubles =
        obtenirDoublesMain(joueurEtat);

    const possibilites = [];

    for (const double of doubles) {

        possibilites.push(
            ...genererPossibilitesDouble(
                etat,
                joueurEtat,
                double
            )
        );
    }

    return possibilites;
}

// =====================================================
// GÉNÉRATEUR GLOBAL
// =====================================================

function genererToutesPossibilites(
    etat,
    joueur
) {

    const joueurEtat =
        Simulator.trouverJoueur(
            etat,
            joueur
        );

    if (!joueurEtat) {
        return [];
    }


    // -------------------------------------------------
    // DOUBLES
    // -------------------------------------------------

    const doubles =
        genererPossibilitesDoubles(
            etat,
            joueurEtat
        );


    // -------------------------------------------------
    // CARTES SIMPLES
    // -------------------------------------------------

    const simples =
        genererPossibilitesCartesSimples(
            etat,
            joueurEtat
        );


    /*
     * Pour l'instant on retourne toutes les possibilités.
     *
     * Le classement par priorité sera fait dans le
     * moteur de décision, car une priorité de type
     * "Double 7" ne signifie pas automatiquement
     * "jouer Double 7".
     */

    return [
        ...doubles,
        ...simples
    ];
}

// =====================================================
// PRIORITÉ DES ACTIONS
// =====================================================

function obtenirPrioritePossibilite(possibilite) {

    const valeur = possibilite.valeur;
    const type = possibilite.type;

    // ---------------------------------------------
    // 1. Double 7
    // ---------------------------------------------

    if (
        type === "double" &&
        valeur === 7
    ) {
        return 1;
    }

    // ---------------------------------------------
    // 2. 7 simple
    // ---------------------------------------------

    if (
        type !== "double" &&
        valeur === 7
    ) {
        return 2;
    }

    // ---------------------------------------------
    // 3. Tous les autres doubles
    // ---------------------------------------------

    if (type === "double") {
        return 3;
    }

    // ---------------------------------------------
    // 4. Toutes les cartes simples
    // ---------------------------------------------

    return 4;
}


// =====================================================
// CLASSER LES POSSIBILITÉS PAR PRIORITÉ
// =====================================================

function classerPossibilitesParPriorite(
    possibilites
) {

    return [...possibilites]
        .map((possibilite, index) => ({
            possibilite,
            indexOriginal: index,
            priorite:
                obtenirPrioritePossibilite(
                    possibilite
                )
        }))
        .sort((a, b) => {

            if (a.priorite !== b.priorite) {
                return a.priorite - b.priorite;
            }

            return a.indexOriginal - b.indexOriginal;
        })
        .map(element => element.possibilite);
}


// =====================================================
// GROUPER PAR PRIORITÉ
// =====================================================

function grouperPossibilitesParPriorite(
    possibilites
) {

    const groupes = {
        1: [],
        2: [],
        3: [],
        4: []
    };

    for (const possibilite of possibilites) {

        const priorite =
            obtenirPrioritePossibilite(
                possibilite
            );

        groupes[priorite].push(
            possibilite
        );
    }

    return groupes;
}


// =====================================================
// RÉSUMÉ D'UNE POSSIBILITÉ
// =====================================================

function decrirePossibilite(
    possibilite
) {

    const type =
        possibilite.type === "double"
            ? "Double"
            : "Simple";

    let texte =
        `${type} ${possibilite.valeur}`;

    if (possibilite.choix) {
        texte += ` → ${possibilite.choix}`;
    }

    if (possibilite.cible) {
        texte +=
            ` → ${possibilite.cible.nom}`;
    }

    if (
    possibilite.carteCible !== null &&
    possibilite.carteCible !== undefined
) {
    texte +=
        ` → carte ${JSON.stringify(
            possibilite.carteCible
        )}`;
}

    if (
    Array.isArray(possibilite.cartesCibles) &&
    possibilite.cartesCibles.length > 0
) {
    texte +=
        ` → cartes ${JSON.stringify(
            possibilite.cartesCibles
        )}`;
}

    return texte;
}

// =====================================================
// CONTEXTE DE DÉCISION
// =====================================================

function construireContexteDecision(
    etat,
    joueur
) {

    const joueurEtat =
        Simulator.trouverJoueur(
            etat,
            joueur
        );

    if (!joueurEtat) {
        return null;
    }

    const possibilites =
        genererToutesPossibilites(
            etat,
            joueurEtat
        );

    const possibilitesClassees =
        classerPossibilitesParPriorite(
            possibilites
        );

    const groupes =
        grouperPossibilitesParPriorite(
            possibilites
        );

    return {

        etat,

        joueur: {
            index: joueurEtat.index,
            nom: joueurEtat.nom,
            score: joueurEtat.score,
            main: [...joueurEtat.main],
            nombreCartes:
                joueurEtat.main.length
        },

        possibilites:
            possibilitesClassees,

        groupesPriorite:
            groupes,

        nombrePossibilites:
            possibilitesClassees.length
    };
}

// =====================================================
// SIMULATION DES POSSIBILITÉS
// =====================================================

function simulerPossibilite(
    etat,
    possibilite
) {

    const scenarios =
        Simulator.simulerAvecScenarios(
            etat,
            possibilite
        );

    if (!Array.isArray(scenarios)) {
        return [];
    }

    return scenarios.map(scenario => ({

        possibilite,

        etat:
            scenario.etat,

        probabilite:
            Number(scenario.probabilite) || 0,

        description:
            scenario.description || "",

        metadata:
            scenario.metadata || {}

    }));
}

function simulerPossibilites(
    etat,
    possibilites
) {

    const resultats = [];

    for (const possibilite of possibilites) {

        const scenarios =
            simulerPossibilite(
                etat,
                possibilite
            );

        resultats.push({
            possibilite,
            scenarios,
            nombreScenarios:
                scenarios.length
        });
    }

    return resultats;
}

function calculerValeurMoyenneScenarios(
    scenarios,
    fonctionEvaluation
) {

    if (
        !Array.isArray(scenarios) ||
        scenarios.length === 0
    ) {
        return 0;
    }

    let total = 0;
    let probabiliteTotale = 0;

    for (const scenario of scenarios) {

        const probabilite =
            Number(scenario.probabilite) || 0;

        if (probabilite <= 0) {
            continue;
        }

        const valeur =
            Number(
                fonctionEvaluation(
                    scenario.etat,
                    scenario
                )
            ) || 0;

        total +=
            probabilite * valeur;

        probabiliteTotale +=
            probabilite;
    }

    if (probabiliteTotale <= 0) {
        return 0;
    }

    return total / probabiliteTotale;
}

// =====================================================
// MOTEUR D'ÉVALUATION DÉFINITIF
// =====================================================

function clamp(valeur, min = 0, max = 100) {

    const nombre = Number(valeur);

    if (!Number.isFinite(nombre)) {
        return min;
    }

    return Math.max(
        min,
        Math.min(max, nombre)
    );
}


function moyenne(valeurs) {

    if (!Array.isArray(valeurs) || valeurs.length === 0) {
        return 0;
    }

    return valeurs.reduce(
        (total, valeur) =>
            total + Number(valeur || 0),
        0
    ) / valeurs.length;
}


// =====================================================
// CIBLE
// =====================================================

function obtenirCibleEtat(etat) {

    const proprietes = [
        "scoreCible",
        "cibleScore",
        "objectifScore",
        "pointsVictoire",
        "scoreVictoire",
        "objectif"
    ];

    for (const propriete of proprietes) {

        const valeur =
            Number(etat[propriete]);

        if (
            Number.isFinite(valeur) &&
            valeur > 0
        ) {
            return valeur;
        }
    }

    /*
     * Certaines versions du jeu peuvent stocker
     * la cible dans une configuration.
     */

    if (
        etat.configuration &&
        Number.isFinite(
            Number(etat.configuration.scoreCible)
        )
    ) {
        return Number(
            etat.configuration.scoreCible
        );
    }

    /*
     * Ne jamais inventer une cible silencieusement.
     * 0 signifie ici que la cible n'est pas connue.
     */
    return 0;
}


// =====================================================
// FINITION
// =====================================================

function calculerValeurTours(tours) {

    if (tours === 1) return 100;
    if (tours === 2) return 70;
    if (tours === 3) return 45;
    if (tours === 4) return 25;
    if (tours >= 5) return 10;

    return 0;
}


function calculerCertitudeFinition(certitude) {

    if (certitude === "certain") return 100;
    if (certitude === "tres-probable") return 80;
    if (certitude === "possible") return 55;
    if (certitude === "faible") return 30;

    return 0;
}


function analyserFinition(etat, joueur) {

    const joueurEtat =
        Simulator.trouverJoueur(
            etat,
            joueur
        );

    if (!joueurEtat) {
        return {
            tours: Infinity,
            certitude: 0,
            valeur: 0
        };
    }

    const cible =
        obtenirCibleEtat(etat);

    if (cible <= 0) {
        return {
            tours: Infinity,
            certitude: 0,
            valeur: 0
        };
    }

    const score =
        Number(joueurEtat.score) || 0;

    if (score === cible) {
        return {
            tours: 0,
            certitude: 100,
            valeur: 100
        };
    }

    const possibilites =
        analyserPossibilitesRestantes(
            etat,
            joueurEtat
        );

    let meilleurTour = Infinity;
    let meilleureCertitude = "faible";

    for (const possibilite of possibilites.possibilites) {

        const valeur =
            Number(
                possibilite.valeur
            );

        /*
         * Les cartes à effet ne possèdent pas
         * nécessairement une valeur directe.
         */
        if (!Number.isFinite(valeur)) {
            continue;
        }

        if (score + valeur === cible) {

            meilleurTour = 1;
            meilleureCertitude = "certain";
            break;
        }

        /*
         * Si le score est au-dessus de la cible,
         * le retour exact est également recherché.
         */
        if (
            score > cible &&
            score - valeur === cible
        ) {

            meilleurTour = 1;
            meilleureCertitude = "certain";
            break;
        }
    }

    if (meilleurTour === Infinity) {

        /*
         * Beaucoup de possibilités de finition :
         * 2-3 tours envisageables.
         */
        if (
            possibilites.finition >= 60 &&
            possibilites.actions >= 40
        ) {
            meilleurTour = 3;
            meilleureCertitude = "possible";
        }

        else if (
            possibilites.finition > 0
        ) {
            meilleurTour = 4;
            meilleureCertitude = "faible";
        }
    }

    const valeurTours =
        calculerValeurTours(
            meilleurTour
        );

    const certitude =
        calculerCertitudeFinition(
            meilleureCertitude
        );

    return {

        tours: meilleurTour,

        certitude,

        valeur:
            valeurTours *
            certitude /
            100
    };
}


// =====================================================
// QUALITÉ DE LA MAIN
// =====================================================

function analyserQualiteMain(
    etat,
    joueur
) {

    const main =
        Simulator.obtenirMain(joueur);

    if (main.length === 0) {
        return {
            actions: 0,
            finition: 0,
            manipulation: 0,
            doubles: 0,
            synergies: 0,
            total: 0
        };
    }

    let actions = 0;
    let finition = 0;
    let manipulation = 0;

    const compteurs =
        new Map();

    for (const carte of main) {

        const valeur =
            Simulator.obtenirValeurCarte(carte);

        compteurs.set(
            valeur,
            (compteurs.get(valeur) || 0) + 1
        );

        /*
         * Actions.
         */
        if (
            [
                1, 3, 5, 9,
                11, 13, 15,
                17, 19, 21
            ].includes(valeur) ||
            valeur === "Joker"
        ) {
            actions++;
        }

        /*
         * Finition / progression directe.
         */
        if (
            [
                2, 4, 6, 7, 8,
                10, 12, 14, 16,
                18, 20
            ].includes(valeur)
        ) {
            finition++;
        }

        /*
         * Manipulation.
         */
        if (
            [
                1, 3, 9, 11,
                13, 15, 17,
                19, 21
            ].includes(valeur) ||
            valeur === "Joker"
        ) {
            manipulation++;
        }
    }

    let nombreDoubles = 0;

    for (const nombre of compteurs.values()) {

        if (nombre >= 2) {
            nombreDoubles++;
        }
    }

    /*
     * Diversité de valeurs.
     */
    const diversite =
        compteurs.size /
        Math.max(1, main.length);

    const synergies =
        clamp(
            diversite * 100 +
            nombreDoubles * 10
        );

    const scoreActions =
        clamp(actions * 15);

    const scoreFinition =
        clamp(finition * 20);

    const scoreManipulation =
        clamp(manipulation * 15);

    const scoreDoubles =
        clamp(nombreDoubles * 25);

    const total =
        (
            scoreActions * 25 +
            scoreFinition * 25 +
            scoreManipulation * 20 +
            scoreDoubles * 15 +
            synergies * 15
        ) / 100;

    return {

        actions: scoreActions,

        finition: scoreFinition,

        manipulation:
            scoreManipulation,

        doubles:
            scoreDoubles,

        synergies,

        total:
            clamp(total)
    };
}


// =====================================================
// POSSIBILITÉS RESTANTES
// =====================================================

function analyserPossibilitesRestantes(
    etat,
    joueur
) {

    const generator =
        window.AtoumoulinBotPossibilities;

    if (
        !generator ||
        typeof generator.genererToutesPossibilites !==
            "function"
    ) {
        return {
            actions: 0,
            diversite: 0,
            finition: 0,
            manipulation: 0,
            reponses: 0,
            plans: 0,
            total: 0,
            possibilites: []
        };
    }

    const possibilites =
        generator.genererToutesPossibilites(
            etat,
            joueur
        );

    if (
        !Array.isArray(possibilites) ||
        possibilites.length === 0
    ) {
        return {
            actions: 0,
            diversite: 0,
            finition: 0,
            manipulation: 0,
            reponses: 0,
            plans: 0,
            total: 0,
            possibilites: []
        };
    }

    const valeurs =
        new Set();

    let finition = 0;
    let manipulation = 0;
    let reponses = 0;
    let plans = 0;

    for (const possibilite of possibilites) {

        valeurs.add(
            possibilite.valeur
        );

        if (
            [
                2, 4, 6, 7,
                8, 10, 12,
                14, 16, 18,
                20, 21
            ].includes(
                possibilite.valeur
            )
        ) {
            finition++;
        }

        if (
            [
                1, 3, 9, 11,
                13, 15, 17,
                19, 21
            ].includes(
                possibilite.valeur
            ) ||
            possibilite.valeur === "Joker"
        ) {
            manipulation++;
        }

        if (
            possibilite.cible ||
            possibilite.choix === "moins10" ||
            possibilite.choix === "moins20" ||
            possibilite.choix === "moins40"
        ) {
            reponses++;
        }

        if (
            possibilite.cible ||
            possibilite.choix ||
            possibilite.carteCible !== null
        ) {
            plans++;
        }
    }

    const actions =
        clamp(
            possibilites.length * 7
        );

    const diversite =
        clamp(
            valeurs.size * 12
        );

    const scoreFinition =
        clamp(
            finition * 12
        );

    const scoreManipulation =
        clamp(
            manipulation * 10
        );

    const scoreReponses =
        clamp(
            reponses * 10
        );

    const scorePlans =
        clamp(
            plans * 8
        );

    const total =
        (
            actions * 25 +
            diversite * 20 +
            scoreFinition * 20 +
            scoreManipulation * 15 +
            scoreReponses * 10 +
            scorePlans * 10
        ) / 100;

    return {

        actions,

        diversite,

        finition:
            scoreFinition,

        manipulation:
            scoreManipulation,

        reponses:
            scoreReponses,

        plans:
            scorePlans,

        total:
            clamp(total),

        possibilites
    };
}


// =====================================================
// PROGRESSION
// =====================================================

function analyserProgression(
    etat,
    joueur
) {

    const joueurEtat =
        Simulator.trouverJoueur(
            etat,
            joueur
        );

    if (!joueurEtat) {
        return 0;
    }

    const cible =
        obtenirCibleEtat(etat);

    if (cible <= 0) {
        return 0;
    }

    const score =
        Number(joueurEtat.score) || 0;

    const amelioration =
        clamp(
            Math.abs(score) *
            100 /
            cible
        );

    const finition =
        analyserFinition(
            etat,
            joueurEtat
        ).valeur;

    const possibilites =
        analyserPossibilitesRestantes(
            etat,
            joueurEtat
        );

    const qualite =
        analyserQualiteMain(
            etat,
            joueurEtat
        ).total;

    const adaptation =
        possibilites.reponses;

    return clamp(
        (
            amelioration * 25 +
            finition * 30 +
            possibilites.diversite * 20 +
            qualite * 15 +
            adaptation * 10
        ) / 100
    );
}


// =====================================================
// STABILITÉ
// =====================================================

function analyserStabilite(
    etat,
    joueur
) {

    const possibilites =
        analyserPossibilitesRestantes(
            etat,
            joueur
        );

    const qualite =
        analyserQualiteMain(
            etat,
            joueur
        );

    const plans =
        clamp(
            (
                possibilites.plans +
                possibilites.diversite
            ) / 2
        );

    const independance =
        clamp(
            (
                qualite.actions +
                possibilites.actions +
                possibilites.diversite
            ) / 3
        );

    const recuperation =
        clamp(
            (
                possibilites.reponses +
                possibilites.manipulation
            ) / 2
        );

    return clamp(
        (
            plans * 35 +
            possibilites.diversite * 30 +
            independance * 20 +
            recuperation * 15
        ) / 100
    );
}


// =====================================================
// POSITION
// =====================================================

function analyserPosition(
    etat,
    joueur
) {

    const finition =
        analyserFinition(
            etat,
            joueur
        ).valeur;

    const progression =
        analyserProgression(
            etat,
            joueur
        );

    const stabilite =
        analyserStabilite(
            etat,
            joueur
        );

    return clamp(
        (
            finition * 90 +
            progression * 65 +
            stabilite * 55
        ) / 210
    );
}


// =====================================================
// FLEXIBILITÉ
// =====================================================

function analyserFlexibilite(
    etat,
    joueur
) {

    const possibilites =
        analyserPossibilitesRestantes(
            etat,
            joueur
        );

    const diversite =
        possibilites.diversite;

    const independance =
        clamp(
            (
                possibilites.actions +
                possibilites.plans
            ) / 2
        );

    const adaptationAdversaires =
        possibilites.reponses;

    const progression =
        analyserProgression(
            etat,
            joueur
        );

    return clamp(
        (
            diversite * 35 +
            independance * 25 +
            adaptationAdversaires * 25 +
            progression * 15
        ) / 100
    );
}


// =====================================================
// POTENTIEL FUTUR
// =====================================================

function analyserPotentielFutur(
    etat,
    joueur
) {

    const possibilites =
        analyserPossibilitesRestantes(
            etat,
            joueur
        );

    const main =
        analyserQualiteMain(
            etat,
            joueur
        );

    const flexibilite =
        analyserFlexibilite(
            etat,
            joueur
        );

    const creation =
        clamp(
            (
                possibilites.plans +
                possibilites.diversite
            ) / 2
        );

    return clamp(
        (
            possibilites.total * 35 +
            main.total * 30 +
            flexibilite * 30 +
            creation * 10
        ) / 105
    );
}


// =====================================================
// DANGER ADVERSE
// =====================================================

function analyserDangerAdversaire(
    etat,
    adversaire
) {

    const finition =
        analyserFinition(
            etat,
            adversaire
        ).valeur;

    const position =
        analyserPosition(
            etat,
            adversaire
        );

    const possibilites =
        analyserPossibilitesRestantes(
            etat,
            adversaire
        );

    const stabilite =
        analyserStabilite(
            etat,
            adversaire
        );

    const nombrePossibilites =
        clamp(
            possibilites.actions
        );

    const diversite =
        clamp(
            possibilites.diversite
        );

    const scorePossibilites =
        (
            nombrePossibilites +
            diversite +
            possibilites.finition +
            possibilites.manipulation +
            possibilites.plans
        ) / 5;

    return clamp(
        (
            finition * 50 +
            position * 20 +
            scorePossibilites * 20 +
            stabilite * 10
        ) / 100
    );
}


// =====================================================
// POTENTIEL FUTUR ADVERSE
// =====================================================

function analyserPotentielFuturAdversaire(
    etat,
    adversaire
) {

    const progression =
        analyserProgression(
            etat,
            adversaire
        );

    const possibilites =
        analyserPossibilitesRestantes(
            etat,
            adversaire
        );

    const main =
        analyserQualiteMain(
            etat,
            adversaire
        );

    const manipulation =
        possibilites.manipulation;

    const creation =
        possibilites.plans;

    return clamp(
        (
            progression * 40 +
            manipulation * 30 +
            main.finition * 20 +
            creation * 10
        ) / 100
    );
}


// =====================================================
// SITUATION ADVERSE
// =====================================================

function analyserSituationAdverse(
    etat,
    adversaire
) {

    const danger =
        analyserDangerAdversaire(
            etat,
            adversaire
        );

    const potentiel =
        analyserPotentielFuturAdversaire(
            etat,
            adversaire
        );

    const stabilite =
        analyserStabilite(
            etat,
            adversaire
        );

    return clamp(
        (
            danger * 100 +
            potentiel * 65 +
            stabilite * 50
        ) / 215
    );
}


// =====================================================
// TOUS LES ADVERSAIRES
// =====================================================

function analyserAdversaires(
    etat,
    joueur
) {

    const joueurEtat =
        Simulator.trouverJoueur(
            etat,
            joueur
        );

    if (!joueurEtat) {
        return {
            dangerMax: 0,
            dangerMoyen: 0,
            situationMax: 0,
            situationMoyenne: 0,
            adversaires: []
        };
    }

    const adversaires =
        etat.joueurs.filter(
            autre =>
                autre.index !== joueurEtat.index
        );

    const analyses =
        adversaires.map(
            adversaire => ({

                joueur: adversaire,

                danger:
                    analyserDangerAdversaire(
                        etat,
                        adversaire
                    ),

                situation:
                    analyserSituationAdverse(
                        etat,
                        adversaire
                    )
            })
        );

    return {

        dangerMax:
            analyses.length
                ? Math.max(
                    ...analyses.map(
                        a => a.danger
                    )
                )
                : 0,

        dangerMoyen:
            moyenne(
                analyses.map(
                    a => a.danger
                )
            ),

        situationMax:
            analyses.length
                ? Math.max(
                    ...analyses.map(
                        a => a.situation
                    )
                )
                : 0,

        situationMoyenne:
            moyenne(
                analyses.map(
                    a => a.situation
                )
            ),

        adversaires:
            analyses
    };
}


// =====================================================
// IMPACT PERSONNEL
// =====================================================

function analyserImpactPersonnel(
    etatAvant,
    etatApres,
    joueur
) {

    const position =
        analyserPosition(
            etatApres,
            joueur
        );

    const main =
        analyserQualiteMain(
            etatApres,
            joueur
        );

    const possibilites =
        analyserPossibilitesRestantes(
            etatApres,
            joueur
        );

    return clamp(
        (
            position * 95 +
            main.total * 60 +
            possibilites.total * 45
        ) / 200
    );
}


// =====================================================
// IMPACT ADVERSAIRE
// =====================================================

function analyserImpactAdversaire(
    etatAvant,
    etatApres,
    joueur
) {

    const avant =
        analyserAdversaires(
            etatAvant,
            joueur
        );

    const apres =
        analyserAdversaires(
            etatApres,
            joueur
        );

    /*
     * Une diminution de la situation adverse
     * constitue un impact positif.
     */
    const reductionMax =
        avant.situationMax -
        apres.situationMax;

    const reductionMoyenne =
        avant.situationMoyenne -
        apres.situationMoyenne;

    return clamp(
        (
            reductionMax * 70 +
            reductionMoyenne * 30
        )
    );
}


// =====================================================
// COÛT D'OPPORTUNITÉ
// =====================================================

function analyserCoutOpportunite(
    etatAvant,
    etatApres,
    possibilite
) {

    const joueur =
        possibilite.joueur;

    const mainAvant =
        analyserQualiteMain(
            etatAvant,
            joueur
        ).total;

    const mainApres =
        analyserQualiteMain(
            etatApres,
            joueur
        ).total;

    const possibilitesAvant =
        analyserPossibilitesRestantes(
            etatAvant,
            joueur
        );

    const joueurEtat =
        Simulator.trouverJoueur(
            etatAvant,
            joueur
        );

    const tailleMain =
        joueurEtat
            ? Simulator.obtenirMain(
                joueurEtat
            ).length
            : 1;

    const nombreCartesJouees =
        Array.isArray(
            possibilite.cartes
        )
            ? possibilite.cartes.length
            : 1;

    const sacrifice =
        clamp(
            mainAvant -
            mainApres
        );

    const alternativesAbandonnees =
        clamp(
            possibilitesAvant.total *
            Math.min(
                1,
                nombreCartesJouees /
                Math.max(1, tailleMain)
            )
        );

    /*
     * Une main peu diversifiée signifie qu'une carte
     * peut être difficile à remplacer.
     */
    const rarete =
        clamp(
            100 -
            possibilitesAvant.diversite
        );

    return clamp(
        (
            sacrifice * 50 +
            alternativesAbandonnees * 30 +
            rarete * 20
        ) / 100
    );
}


// =====================================================
// RISQUE
// =====================================================

function analyserRisque(
    etatAvant,
    etatApres,
    possibilite
) {

    const impactAdverseAvant =
        analyserAdversaires(
            etatAvant,
            possibilite.joueur
        );

    const impactAdverseApres =
        analyserAdversaires(
            etatApres,
            possibilite.joueur
        );

    const progressionAvant =
        analyserProgression(
            etatAvant,
            possibilite.joueur
        );

    const progressionApres =
        analyserProgression(
            etatApres,
            possibilite.joueur
        );

    /*
     * Hausse de la menace adverse.
     */
    const hausseAdverse =
        Math.max(
            0,
            impactAdverseApres.situationMax -
            impactAdverseAvant.situationMax
        );

    /*
     * Perte de progression personnelle.
     */
    const perteProgression =
        Math.max(
            0,
            progressionAvant -
            progressionApres
        );

    /*
     * Gravité = conséquence potentielle.
     */
    const gravite =
        clamp(
            (
                hausseAdverse +
                perteProgression
            ) / 2
        );

    /*
     * Difficulté à récupérer.
     */
    const recuperation =
        clamp(
            100 -
            analyserStabilite(
                etatApres,
                possibilite.joueur
            )
        );

    /*
     * L'incertitude seule n'est pas un risque.
     */
    const probabiliteDefavorable =
        gravite;

    return clamp(
        (
            probabiliteDefavorable * 40 +
            gravite * 40 +
            recuperation * 20
        ) / 100
    );
}


// =====================================================
// ÉVALUATION DÉFINITIVE D'UN ÉTAT
// =====================================================

function evaluerEtat(
    etatAvant,
    etatApres,
    possibilite
) {

    const joueur =
        possibilite.joueur;

    const impactPersonnel =
        analyserImpactPersonnel(
            etatAvant,
            etatApres,
            joueur
        );

    const impactAdversaire =
        analyserImpactAdversaire(
            etatAvant,
            etatApres,
            joueur
        );

    const potentielFutur =
        analyserPotentielFutur(
            etatApres,
            joueur
        );

    const coutOpportunite =
        analyserCoutOpportunite(
            etatAvant,
            etatApres,
            possibilite
        );

    const risque =
        analyserRisque(
            etatAvant,
            etatApres,
            possibilite
        );

    /*
     * FORMULE DÉFINITIVE
     *
     * 40 % personnel
     * 30 % adversaire
     * 15 % futur
     * -10 % coût
     * -5 % risque
     */
    const scoreFinal =
        impactPersonnel * 0.40 +
        impactAdversaire * 0.30 +
        potentielFutur * 0.15 -
        coutOpportunite * 0.10 -
        risque * 0.05;

    return {

        score: scoreFinal,

        impactPersonnel,

        impactAdversaire,

        potentielFutur,

        coutOpportunite,

        risque,

        details: {

            finition:
                analyserFinition(
                    etatApres,
                    joueur
                ),

            progression:
                analyserProgression(
                    etatApres,
                    joueur
                ),

            stabilite:
                analyserStabilite(
                    etatApres,
                    joueur
                ),

            position:
                analyserPosition(
                    etatApres,
                    joueur
                ),

            qualiteMain:
                analyserQualiteMain(
                    etatApres,
                    joueur
                ),

            possibilites:
                analyserPossibilitesRestantes(
                    etatApres,
                    joueur
                ),

            adversaires:
                analyserAdversaires(
                    etatApres,
                    joueur
                )
        }
    };
}


// =====================================================
// ÉVALUATION D'UNE POSSIBILITÉ
// =====================================================

function evaluerPossibilite(
    etat,
    possibilite
) {

    const scenarios =
        simulerPossibilite(
            etat,
            possibilite
        );

    if (
        !Array.isArray(scenarios) ||
        scenarios.length === 0
    ) {
        return {

            possibilite,

            score: -Infinity,

            scenarios: [],

            details: null
        };
    }

    let total = 0;
    let probabiliteTotale = 0;

    const evaluations = [];

    for (const scenario of scenarios) {

        const evaluation =
            evaluerEtat(
                etat,
                scenario.etat,
                possibilite
            );

        const probabilite =
            Number(
                scenario.probabilite
            ) || 0;

        total +=
            evaluation.score *
            probabilite;

        probabiliteTotale +=
            probabilite;

        evaluations.push({

            ...scenario,

            evaluation
        });
    }

    const score =
        probabiliteTotale > 0
            ? total / probabiliteTotale
            : -Infinity;

    return {

        possibilite,

        score,

        scenarios:
            evaluations,

        details:
            evaluations.length === 1
                ? evaluations[0].evaluation
                : null
    };
}


// =====================================================
// ÉVALUATION DE TOUTES LES POSSIBILITÉS
// =====================================================

function evaluerToutesPossibilites(
    etat,
    possibilites
) {

    return possibilites.map(
        possibilite =>
            evaluerPossibilite(
                etat,
                possibilite
            )
    );
}

window.AtoumoulinBotPriorities = {

    obtenirPrioritePossibilite,

    classerPossibilitesParPriorite,

    grouperPossibilitesParPriorite,

    decrirePossibilite
};

window.AtoumoulinBotDecision = {

    obtenirCibleEtat,
    
    construireContexteDecision,

    simulerPossibilite,
    simulerPossibilites,

    calculerValeurMoyenneScenarios,

    evaluerEtat,
    evaluerPossibilite,
    evaluerToutesPossibilites,

    analyserFinition,
    analyserProgression,
    analyserStabilite,
    analyserPosition,

    analyserQualiteMain,
    analyserPossibilitesRestantes,
    analyserFlexibilite,
    analyserPotentielFutur,

    analyserDangerAdversaire,
    analyserPotentielFuturAdversaire,
    analyserSituationAdverse,
    analyserAdversaires,

    analyserImpactPersonnel,
    analyserImpactAdversaire,
    analyserCoutOpportunite,
    analyserRisque
};

window.AtoumoulinBotPossibilities = {

    creerPossibilite,

    creerPossibiliteDouble,

    obtenirAdversaires,

    obtenirDoublesMain,

    genererPossibilitesCarteSimple,

    genererPossibilitesCartesSimples,

    genererPossibilitesDouble,

    genererPossibilitesDoubles,

    genererToutesPossibilites
};
