// =========================================================
// ATOUMOULIN — BOT SIMULATOR
// Moteur de simulation indépendant du jeu réel
//
// Rôle :
// - recevoir un snapshot GameState
// - cloner l'état
// - retrouver les joueurs
// - modifier uniquement la copie
// - fournir les primitives nécessaires aux effets
//
// Ce fichier ne choisit aucune action.
// Ce fichier ne contient aucune stratégie.
// =========================================================

(function () {

    "use strict";

    const GameState = window.AtoumoulinGameState;

    if (!GameState) {
        console.error(
            "Atoumoulin Simulator : AtoumoulinGameState introuvable."
        );
        return;
    }


    // =====================================================
    // OUTILS GÉNÉRAUX
    // =====================================================

    function limiter(valeur, minimum = 0, maximum = 100) {

        return Math.max(
            minimum,
            Math.min(
                maximum,
                Number(valeur) || 0
            )
        );
    }


    function nombre(valeur, valeurParDefaut = 0) {

        const resultat = Number(valeur);

        return Number.isFinite(resultat)
            ? resultat
            : valeurParDefaut;
    }


    function estNombre(valeur) {

        return Number.isFinite(Number(valeur));
    }


    // =====================================================
    // CLONAGE
    // =====================================================

    function clonerEtat(etat) {

        return GameState.clonerEtat(etat);
    }


    // =====================================================
    // JOUEURS
    // =====================================================

    function trouverJoueur(etat, reference) {

        return GameState.trouverJoueur(
            etat,
            reference
        );
    }


    function trouverJoueurParNom(etat, nom) {

        return GameState.trouverJoueurParNom(
            etat,
            nom
        );
    }


    function trouverJoueurParIndex(etat, index) {

        return GameState.trouverJoueurParIndex(
            etat,
            index
        );
    }


    function obtenirJoueurActuel(etat) {

        return GameState.obtenirJoueurActuel(etat);
    }


    // =====================================================
    // IDENTIFICATION
    // =====================================================

    function obtenirReferenceJoueur(joueur) {

        if (!joueur) {
            return null;
        }

        return {
            index:
                Number.isInteger(joueur.index)
                    ? joueur.index
                    : null,

            nom:
                typeof joueur.nom === "string"
                    ? joueur.nom
                    : null
        };
    }


    // =====================================================
    // SCORES
    // =====================================================

    function obtenirScore(joueur) {

        if (!joueur) {
            return 0;
        }

        return nombre(joueur.score);
    }


    function modifierScore(joueur, variation) {

        if (!joueur) {
            return;
        }

        joueur.score =
            obtenirScore(joueur) +
            nombre(variation);
    }


    function definirScore(joueur, score) {

        if (!joueur) {
            return;
        }

        joueur.score = nombre(score);
    }


    // =====================================================
    // MAINS
    // =====================================================

    function obtenirMain(joueur) {

        if (!joueur) {
            return [];
        }

        if (!Array.isArray(joueur.main)) {
            joueur.main = [];
        }

        return joueur.main;
    }


    function ajouterCarteMain(joueur, carte) {

        if (!joueur) {
            return false;
        }

        const main = obtenirMain(joueur);

        main.push(carte);

        joueur.nombreCartes = main.length;

        return true;
    }


    function retirerCarteMainParIndex(joueur, index) {

        if (!joueur) {
            return null;
        }

        const main = obtenirMain(joueur);

        if (
            !Number.isInteger(index) ||
            index < 0 ||
            index >= main.length
        ) {
            return null;
        }

        const [carte] = main.splice(index, 1);

        joueur.nombreCartes = main.length;

        return carte;
    }


    function retirerCarteMain(joueur, carte) {

        if (!joueur) {
            return null;
        }

        const main = obtenirMain(joueur);

        const index = main.indexOf(carte);

        if (index === -1) {
            return null;
        }

        return retirerCarteMainParIndex(
            joueur,
            index
        );
    }


    function retirerCartesMain(joueur, nombreCartes) {

        if (!joueur) {
            return [];
        }

        const resultat = [];

        const quantite = Math.max(
            0,
            Math.floor(nombre(nombreCartes))
        );

        for (
            let i = 0;
            i < quantite;
            i++
        ) {

            const carte =
                retirerCarteMainParIndex(
                    joueur,
                    0
                );

            if (carte === null) {
                break;
            }

            resultat.push(carte);
        }

        return resultat;
    }


    // =====================================================
    // CARTES
    // =====================================================

    function obtenirValeurCarte(carte) {

        if (typeof carte === "number") {
            return carte;
        }

        if (
            carte &&
            typeof carte.valeur !== "undefined"
        ) {
            return Number(carte.valeur);
        }

        return Number(carte);
    }


    function obtenirCartesTable(etat) {

        if (!etat) {
            return [];
        }

        if (!Array.isArray(etat.cartesTable)) {
            etat.cartesTable = [];
        }

        return etat.cartesTable;
    }


    function obtenirCartesPointsJoueur(
        etat,
        referenceJoueur
    ) {

        const joueur =
            trouverJoueur(
                etat,
                referenceJoueur
            );

        if (!joueur) {
            return [];
        }

        const nom = joueur.nom;

        return obtenirCartesTable(etat)
            .filter(carte => {

                if (!carte) {
                    return false;
                }

                const valeur =
                    obtenirValeurCarte(carte);

                return (
                    carte.proprietaire === nom &&
                    estNombre(valeur) &&
                    valeur > 0
                );
            });
    }


    function trouverDerniereCartePoints(
        etat,
        referenceJoueur
    ) {

        const cartes =
            obtenirCartesPointsJoueur(
                etat,
                referenceJoueur
            );

        if (cartes.length === 0) {
            return null;
        }

        return cartes[cartes.length - 1];
    }


    // =====================================================
    // TABLE
    // =====================================================

    function ajouterCarteTable(
        etat,
        valeur,
        proprietaire,
        options = {}
    ) {

        const table =
            obtenirCartesTable(etat);

        const carte = {

            valeur,

            proprietaire:
                proprietaire || null,

            liee:
                options.liee === true,

            historiqueCarte:
                options.historiqueCarte !== undefined
                    ? options.historiqueCarte
                    : null
        };

        table.push(carte);

        return carte;
    }


    function trouverIndexCarteTable(
        etat,
        carte
    ) {

        const table =
            obtenirCartesTable(etat);

        return table.indexOf(carte);
    }


    // =====================================================
    // TRANSFERT DE CARTE
    // =====================================================

    function transfererCarteTable(
        etat,
        carte,
        nouveauProprietaire
    ) {

        if (!carte) {
            return false;
        }

        const ancienneValeur =
            obtenirValeurCarte(carte);

        const ancienProprietaire =
            carte.proprietaire;

        if (
            ancienProprietaire ===
            nouveauProprietaire
        ) {
            return false;
        }

        const ancienJoueur =
            trouverJoueurParNom(
                etat,
                ancienProprietaire
            );

        const nouveauJoueur =
            trouverJoueurParNom(
                etat,
                nouveauProprietaire
            );

        if (
            estNombre(ancienneValeur) &&
            ancienneValeur > 0
        ) {

            if (ancienJoueur) {
                modifierScore(
                    ancienJoueur,
                    -ancienneValeur
                );
            }

            if (nouveauJoueur) {
                modifierScore(
                    nouveauJoueur,
                    ancienneValeur
                );
            }
        }

        carte.proprietaire =
            nouveauProprietaire;

        return true;
    }


    // =====================================================
    // ÉCHANGE DE SCORES
    // =====================================================

    function echangerScores(
        joueurA,
        joueurB
    ) {

        if (!joueurA || !joueurB) {
            return false;
        }

        const scoreA =
            obtenirScore(joueurA);

        const scoreB =
            obtenirScore(joueurB);

        joueurA.score = scoreB;
        joueurB.score = scoreA;

        return true;
    }


    // =====================================================
    // ÉCHANGE DE MAINS
    // =====================================================

    function echangerMains(
        joueurA,
        joueurB
    ) {

        if (!joueurA || !joueurB) {
            return false;
        }

        const mainA =
            obtenirMain(joueurA);

        const mainB =
            obtenirMain(joueurB);

        joueurA.main = mainB;
        joueurB.main = mainA;

        joueurA.nombreCartes =
            joueurA.main.length;

        joueurB.nombreCartes =
            joueurB.main.length;

        return true;
    }


    // =====================================================
    // PIOCHE
    // =====================================================

    function piocherCarte(
        etat,
        joueur
    ) {

        if (
            !etat ||
            !joueur ||
            !Array.isArray(etat.paquet) ||
            etat.paquet.length === 0
        ) {
            return null;
        }

        const carte =
            etat.paquet.shift();

        ajouterCarteMain(
            joueur,
            carte
        );

        return carte;
    }


    function piocherCartes(
        etat,
        joueur,
        nombreCartes
    ) {

        const resultat = [];

        const quantite =
            Math.max(
                0,
                Math.floor(
                    nombre(nombreCartes)
                )
            );

        for (
            let i = 0;
            i < quantite;
            i++
        ) {

            const carte =
                piocherCarte(
                    etat,
                    joueur
                );

            if (carte === null) {
                break;
            }

            resultat.push(carte);
        }

        return resultat;
    }


    // =====================================================
    // NORMALISATION D'UNE POSSIBILITÉ
    // =====================================================

    function normaliserPossibilite(
        possibilite
    ) {

        if (!possibilite) {
            return null;
        }

        return {
            ...possibilite,

            cartes:
                Array.isArray(possibilite.cartes)
                    ? [...possibilite.cartes]
                    : [],

            metadata:
                possibilite.metadata &&
                typeof possibilite.metadata === "object"
                    ? {
                        ...possibilite.metadata
                    }
                    : {}
        };
    }


    // =====================================================
    // APPLICATION GÉNÉRALE
    //
    // Pour l'instant, cette fonction ne connaît encore
    // aucun effet de carte.
    //
    // Elle constitue le point d'entrée unique que nous
    // compléterons avec les vraies règles.
    // =====================================================

    function simuler(
        etat,
        possibilite
    ) {

        if (!etat) {
            return null;
        }

        const simulation =
            clonerEtat(etat);

        const action =
            normaliserPossibilite(
                possibilite
            );

        if (!action) {
            return simulation;
        }

        const joueur =
            trouverJoueur(
                simulation,
                action.joueur ||
                simulation.joueurActuel
            );

        if (!joueur) {
            return simulation;
        }

        let resultat;

        if (action.type === "double") {

            resultat =
                simulerDouble(
                    simulation,
                    joueur,
                    action
                );

        } else {

            resultat =
                simulerCarteSimple(
                    simulation,
                    joueur,
                    action
                );
        }

        // ---------------------------------------------
        // Retirer les cartes réellement jouées de la main
        // ---------------------------------------------

        if (
            resultat &&
            resultat.appliquee &&
            Array.isArray(action.cartes)
        ) {

            for (
                const carteJouee of action.cartes
            ) {

                const index =
                    obtenirMain(joueur)
                        .indexOf(carteJouee);

                if (index !== -1) {

                    retirerCarteMainParIndex(
                        joueur,
                        index
                    );
                }
            }

        }

        simulation.__simulation = true;

        simulation.__actionSimulee =
            action;

        simulation.__resultatSimulation =
            resultat;

        return simulation;
    }
    
    // =====================================================
    // EFFETS — CARTES SIMPLES
    // =====================================================

    function estCartePoint(carte) {

        if (!carte) {
            return false;
        }

        const valeur =
            obtenirValeurCarte(carte);

        return (
            estNombre(valeur) &&
            valeur > 0
        );
    }


    function obtenirDernieresCartesPoints(
        etat,
        referenceJoueur,
        quantite = 1
    ) {

        const cartes =
            obtenirCartesPointsJoueur(
                etat,
                referenceJoueur
            );

        if (cartes.length === 0) {
            return [];
        }

        return cartes.slice(
            Math.max(0, cartes.length - quantite)
        );
    }


    // -----------------------------------------------------
    // CARTE 1
    //
    // Vole la dernière carte à points de la cible.
    // -----------------------------------------------------

    function simulerCarte1(
        etat,
        joueur,
        possibilite
    ) {

        const cible =
            trouverJoueur(
                etat,
                possibilite.cible
            );

        if (!cible || cible === joueur) {
            return {
                appliquee: false,
                raison: "cible-invalide"
            };
        }

        const carte =
            trouverDerniereCartePoints(
                etat,
                cible
            );

        if (!carte) {
            return {
                appliquee: false,
                raison: "aucune-carte-a-points"
            };
        }

        transfererCarteTable(
            etat,
            carte,
            joueur.nom
        );

        return {
            appliquee: true,
            carteVolee: carte
        };
    }


    // -----------------------------------------------------
    // CARTES DE POINTS
    //
    // 2, 4, 6, 7, 8, 10, 12, 14, 16, 18, 20
    // -----------------------------------------------------

    function simulerCartePoints(
        etat,
        joueur,
        valeur
    ) {

        if (!joueur) {
            return {
                appliquee: false,
                raison: "joueur-invalide"
            };
        }

        modifierScore(
            joueur,
            valeur
        );

        const carte =
            ajouterCarteTable(
                etat,
                valeur,
                joueur.nom
            );

        return {
            appliquee: true,
            carte
        };
    }


    // -----------------------------------------------------
    // CARTE 3
    //
    // Retire 20 points à la cible.
    // -----------------------------------------------------

    function simulerCarte3(
        etat,
        joueur,
        possibilite
    ) {

        const cible =
            trouverJoueur(
                etat,
                possibilite.cible
            );

        if (!cible || cible === joueur) {
            return {
                appliquee: false,
                raison: "cible-invalide"
            };
        }

        modifierScore(
            cible,
            -20
        );

        const carte =
            ajouterCarteTable(
                etat,
                -20,
                cible.nom
            );

        return {
            appliquee: true,
            carte
        };
    }


    // -----------------------------------------------------
    // CARTE 5
    //
    // Pioche 2 cartes.
    // -----------------------------------------------------

    function simulerCarte5(
        etat,
        joueur
    ) {

        const cartes =
            piocherCartes(
                etat,
                joueur,
                2
            );

        return {
            appliquee: true,
            cartesPiochees: cartes
        };
    }


    // -----------------------------------------------------
    // CARTE 9
    //
    // Pioche 1 puis échange les mains.
    // -----------------------------------------------------

    function simulerCarte9(
        etat,
        joueur,
        possibilite
    ) {

        const cible =
            trouverJoueur(
                etat,
                possibilite.cible
            );

        if (!cible || cible === joueur) {
            return {
                appliquee: false,
                raison: "cible-invalide"
            };
        }

        const cartePiochee =
            piocherCarte(
                etat,
                joueur
            );

        echangerMains(
            joueur,
            cible
        );

        return {
            appliquee: true,
            cartePiochee
        };
    }


    // -----------------------------------------------------
    // CARTE 11
    //
    // +10 pour soi ou -10 à une cible.
    // -----------------------------------------------------

    function simulerCarte11(
        etat,
        joueur,
        possibilite
    ) {

        const choix =
            possibilite.choix;

        if (choix === "+10") {

            modifierScore(
                joueur,
                10
            );

            const carte =
                ajouterCarteTable(
                    etat,
                    10,
                    joueur.nom
                );

            return {
                appliquee: true,
                choix: "+10",
                carte
            };
        }

        if (choix === "-10") {

            const cible =
                trouverJoueur(
                    etat,
                    possibilite.cible
                );

            if (!cible || cible === joueur) {
                return {
                    appliquee: false,
                    raison: "cible-invalide"
                };
            }

            modifierScore(
                cible,
                -10
            );

            const carte =
                ajouterCarteTable(
                    etat,
                    -10,
                    cible.nom
                );

            return {
                appliquee: true,
                choix: "-10",
                cible,
                carte
            };
        }

        return {
            appliquee: false,
            raison: "choix-invalide"
        };
    }


    // -----------------------------------------------------
    // CARTE 13
    //
    // Vole une carte à points précise à une cible.
    // -----------------------------------------------------

    function simulerCarte13(
        etat,
        joueur,
        possibilite
    ) {

        const cible =
            trouverJoueur(
                etat,
                possibilite.cible
            );

        if (!cible || cible === joueur) {
            return {
                appliquee: false,
                raison: "cible-invalide"
            };
        }

        let carte =
            possibilite.carteCible;

        // Si le choix contient un index de table,
        // on utilise directement celui-ci.
        if (
            Number.isInteger(
                possibilite.indexCarteTable
            )
        ) {

            const table =
                obtenirCartesTable(etat);

            carte =
                table[
                    possibilite.indexCarteTable
                ];
        }

        // Si une référence par valeur est fournie,
        // on tente de retrouver la carte correspondante.
        if (
            !carte &&
            estNombre(
                possibilite.valeurCarteCible
            )
        ) {

            const cartes =
                obtenirCartesPointsJoueur(
                    etat,
                    cible
                );

            carte =
                cartes.find(
                    element =>
                        obtenirValeurCarte(element) ===
                        Number(
                            possibilite.valeurCarteCible
                        )
                ) || null;
        }

        if (!carte) {
            return {
                appliquee: false,
                raison: "carte-cible-introuvable"
            };
        }

        if (
            carte.proprietaire !== cible.nom
        ) {
            return {
                appliquee: false,
                raison: "carte-non-accessible"
            };
        }

        transfererCarteTable(
            etat,
            carte,
            joueur.nom
        );

        return {
            appliquee: true,
            carteVolee: carte
        };
    }


    // -----------------------------------------------------
    // CARTE 15
    //
    // Double une carte à points appartenant au joueur.
    //
    // Exemple :
    // 20 → 40
    //
    // Le joueur gagne +20.
    // -----------------------------------------------------

    function simulerCarte15(
        etat,
        joueur,
        possibilite
    ) {

        let carte =
            possibilite.carteCible;

        if (
            Number.isInteger(
                possibilite.indexCarteTable
            )
        ) {

            const table =
                obtenirCartesTable(etat);

            carte =
                table[
                    possibilite.indexCarteTable
                ];
        }

        if (!carte) {
            return {
                appliquee: false,
                raison: "carte-cible-introuvable"
            };
        }

        if (
            carte.proprietaire !== joueur.nom
        ) {
            return {
                appliquee: false,
                raison: "carte-non-personnelle"
            };
        }

        const ancienneValeur =
            obtenirValeurCarte(carte);

        if (
            !estNombre(ancienneValeur) ||
            ancienneValeur <= 0
        ) {
            return {
                appliquee: false,
                raison: "carte-non-valide"
            };
        }

        const nouvelleValeur =
            ancienneValeur * 2;

        const gain =
            nouvelleValeur -
            ancienneValeur;

        modifierScore(
            joueur,
            gain
        );

        carte.valeur =
            nouvelleValeur;

        carte.liee = true;

        return {
            appliquee: true,
            ancienneValeur,
            nouvelleValeur,
            gain,
            carte
        };
    }


    // -----------------------------------------------------
    // CARTE 17
    //
    // Le résultat est volontairement représenté comme
    // un événement aléatoire.
    //
    // Le simulateur déterministe ne choisit PAS encore
    // la carte volée.
    //
    // Le moteur de scénarios pourra ensuite créer :
    //
    // 17 → cible A → carte possible 1
    // 17 → cible A → carte possible 2
    // ...
    // -----------------------------------------------------

    function simulerCarte17(
        etat,
        joueur,
        possibilite
    ) {

        const cible =
            trouverJoueur(
                etat,
                possibilite.cible
            );

        if (!cible || cible === joueur) {
            return {
                appliquee: false,
                raison: "cible-invalide"
            };
        }

        return {
            appliquee: true,

            aleatoire: true,

            type:
                "vol-carte-aleatoire",

            cible: {
                index: cible.index,
                nom: cible.nom
            },

            nombreCartesPossibles:
                obtenirMain(cible).length
        };
    }


    // -----------------------------------------------------
    // CARTE 19
    //
    // Échange les dernières cartes à points.
    // -----------------------------------------------------

    function simulerCarte19(
        etat,
        joueur,
        possibilite
    ) {

        const cible =
            trouverJoueur(
                etat,
                possibilite.cible
            );

        if (!cible || cible === joueur) {
            return {
                appliquee: false,
                raison: "cible-invalide"
            };
        }

        const carteJoueur =
            trouverDerniereCartePoints(
                etat,
                joueur
            );

        const carteCible =
            trouverDerniereCartePoints(
                etat,
                cible
            );

        if (!carteJoueur || !carteCible) {
            return {
                appliquee: false,
                raison: "echange-impossible"
            };
        }

        const proprietaireJoueur =
            joueur.nom;

        const proprietaireCible =
            cible.nom;

        const valeurJoueur =
            obtenirValeurCarte(
                carteJoueur
            );

        const valeurCible =
            obtenirValeurCarte(
                carteCible
            );

        carteJoueur.proprietaire =
            proprietaireCible;

        carteCible.proprietaire =
            proprietaireJoueur;

        modifierScore(
            joueur,
            valeurCible - valeurJoueur
        );

        modifierScore(
            cible,
            valeurJoueur - valeurCible
        );

        return {
            appliquee: true,

            carteJoueur,
            carteCible,

            valeurJoueur,
            valeurCible
        };
    }


    // -----------------------------------------------------
    // CARTE 21
    //
    // +20 pour soi ou -20 à une cible.
    // -----------------------------------------------------

    function simulerCarte21(
        etat,
        joueur,
        possibilite
    ) {

        const choix =
            possibilite.choix;

        if (choix === "+20") {

            modifierScore(
                joueur,
                20
            );

            const carte =
                ajouterCarteTable(
                    etat,
                    20,
                    joueur.nom
                );

            return {
                appliquee: true,
                choix: "+20",
                carte
            };
        }

        if (choix === "-20") {

            const cible =
                trouverJoueur(
                    etat,
                    possibilite.cible
                );

            if (!cible || cible === joueur) {
                return {
                    appliquee: false,
                    raison: "cible-invalide"
                };
            }

            modifierScore(
                cible,
                -20
            );

            const carte =
                ajouterCarteTable(
                    etat,
                    -20,
                    cible.nom
                );

            return {
                appliquee: true,
                choix: "-20",
                cible,
                carte
            };
        }

        return {
            appliquee: false,
            raison: "choix-invalide"
        };
    }


    // -----------------------------------------------------
    // JOKER
    //
    // +10
    // +22
    // échange de scores
    // -----------------------------------------------------

    function simulerJoker(
        etat,
        joueur,
        possibilite
    ) {

        const choix =
            possibilite.choix;

        if (choix === "10") {

            modifierScore(
                joueur,
                10
            );

            const carte =
                ajouterCarteTable(
                    etat,
                    10,
                    joueur.nom
                );

            return {
                appliquee: true,
                choix: "10",
                carte
            };
        }

        if (choix === "22") {

            modifierScore(
                joueur,
                22
            );

            const carte =
                ajouterCarteTable(
                    etat,
                    22,
                    joueur.nom
                );

            return {
                appliquee: true,
                choix: "22",
                carte
            };
        }

        if (
            choix === "echangeScores" ||
            choix === "échangeScores"
        ) {

            const cible =
                trouverJoueur(
                    etat,
                    possibilite.cible
                );

            if (!cible || cible === joueur) {
                return {
                    appliquee: false,
                    raison: "cible-invalide"
                };
            }

            echangerScores(
                joueur,
                cible
            );

            return {
                appliquee: true,
                choix: "echangeScores",
                cible
            };
        }

        return {
            appliquee: false,
            raison: "choix-invalide"
        };
    }


    // =====================================================
    // DISPATCHER — CARTES SIMPLES
    // =====================================================

    function simulerCarteSimple(
        etat,
        joueur,
        possibilite
    ) {

        if (!joueur || !possibilite) {
            return {
                appliquee: false,
                raison: "parametres-invalides"
            };
        }

        const valeur =
            obtenirValeurCarte(
                possibilite.valeur
            );

        switch (valeur) {

            case 1:
                return simulerCarte1(
                    etat,
                    joueur,
                    possibilite
                );

            case 2:
            case 4:
            case 6:
            case 7:
            case 8:
            case 10:
            case 12:
            case 14:
            case 16:
            case 18:
            case 20:
                return simulerCartePoints(
                    etat,
                    joueur,
                    valeur
                );

            case 3:
                return simulerCarte3(
                    etat,
                    joueur,
                    possibilite
                );

            case 5:
                return simulerCarte5(
                    etat,
                    joueur
                );

            case 9:
                return simulerCarte9(
                    etat,
                    joueur,
                    possibilite
                );

            case 11:
                return simulerCarte11(
                    etat,
                    joueur,
                    possibilite
                );

            case 13:
                return simulerCarte13(
                    etat,
                    joueur,
                    possibilite
                );

            case 15:
                return simulerCarte15(
                    etat,
                    joueur,
                    possibilite
                );

            case 17:
                return simulerCarte17(
                    etat,
                    joueur,
                    possibilite
                );

            case 19:
                return simulerCarte19(
                    etat,
                    joueur,
                    possibilite
                );

            case 21:
                return simulerCarte21(
                    etat,
                    joueur,
                    possibilite
                );          

            default:

                if (
                    possibilite.valeur === "Joker" ||
                    possibilite.valeur === "joker"
                ) {
                    return simulerJoker(
                        etat,
                        joueur,
                        possibilite
                    );
                }

                return {
                    appliquee: false,
                    raison: "carte-inconnue"
                };
        }
    }

        // =====================================================
    // EFFETS — DOUBLES
    // =====================================================

    // -----------------------------------------------------
    // DOUBLE DE CARTES À POINTS
    //
    // 2 → +4
    // 4 → +8
    // 6 → +12
    // 7 → +14
    // etc.
    //
    // Le principe général est :
    // valeur du double = valeur × 2
    // -----------------------------------------------------

    function simulerDoublePoints(
        etat,
        joueur,
        valeur
    ) {

        if (!joueur) {
            return {
                appliquee: false,
                raison: "joueur-invalide"
            };
        }

        const gain =
            valeur * 2;

        modifierScore(
            joueur,
            gain
        );

        const carte =
            ajouterCarteTable(
                etat,
                gain,
                joueur.nom
            );

        return {
            appliquee: true,
            gain,
            carte
        };
    }


    // -----------------------------------------------------
    // DOUBLE 1
    //
    // Vole jusqu'à deux dernières cartes à points
    // de la cible.
    // -----------------------------------------------------

    function simulerDouble1(
        etat,
        joueur,
        possibilite
    ) {

        const cible =
            trouverJoueur(
                etat,
                possibilite.cible
            );

        if (!cible || cible === joueur) {
            return {
                appliquee: false,
                raison: "cible-invalide"
            };
        }

        const cartes =
            obtenirDernieresCartesPoints(
                etat,
                cible,
                2
            );

        if (cartes.length === 0) {
            return {
                appliquee: false,
                raison: "aucune-carte-a-points"
            };
        }

        const cartesVolees = [];

        for (const carte of cartes) {

            transfererCarteTable(
                etat,
                carte,
                joueur.nom
            );

            cartesVolees.push(carte);
        }

        return {
            appliquee: true,
            cartesVolees
        };
    }


    // -----------------------------------------------------
    // DOUBLE 3
    //
    // -40 à une cible.
    // -----------------------------------------------------

    function simulerDouble3(
        etat,
        joueur,
        possibilite
    ) {

        const cible =
            trouverJoueur(
                etat,
                possibilite.cible
            );

        if (!cible || cible === joueur) {
            return {
                appliquee: false,
                raison: "cible-invalide"
            };
        }

        modifierScore(
            cible,
            -40
        );

        const carte =
            ajouterCarteTable(
                etat,
                -40,
                cible.nom
            );

        return {
            appliquee: true,
            carte
        };
    }


    // -----------------------------------------------------
    // DOUBLE 5
    //
    // Pioche jusqu'à 4 cartes.
    // -----------------------------------------------------

    function simulerDouble5(
        etat,
        joueur
    ) {

        const cartes =
            piocherCartes(
                etat,
                joueur,
                4
            );

        return {
            appliquee: true,
            cartesPiochees: cartes
        };
    }


    // -----------------------------------------------------
    // DOUBLE 9
    //
    // Pioche 1 puis échange les mains.
    //
    // La révélation des mains sera gérée comme information
    // accessible dans le moteur de connaissance.
    // -----------------------------------------------------

    function simulerDouble9(
        etat,
        joueur,
        possibilite
    ) {

        const cible =
            trouverJoueur(
                etat,
                possibilite.cible
            );

        if (!cible || cible === joueur) {
            return {
                appliquee: false,
                raison: "cible-invalide"
            };
        }

        const cartePiochee =
            piocherCarte(
                etat,
                joueur
            );

        echangerMains(
            joueur,
            cible
        );

        return {
            appliquee: true,

            cartePiochee,

            reveleMains: true,

            mainsEchangees: true
        };
    }


    // -----------------------------------------------------
    // DOUBLE 11
    //
    // +20 pour soi
    // ou
    // -20 à une cible.
    // -----------------------------------------------------

    function simulerDouble11(
        etat,
        joueur,
        possibilite
    ) {

        const choix =
            possibilite.choix;

        if (choix === "+20") {

            modifierScore(
                joueur,
                20
            );

            const carte =
                ajouterCarteTable(
                    etat,
                    20,
                    joueur.nom
                );

            return {
                appliquee: true,
                choix: "+20",
                carte
            };
        }

        if (choix === "-20") {

            const cible =
                trouverJoueur(
                    etat,
                    possibilite.cible
                );

            if (!cible || cible === joueur) {
                return {
                    appliquee: false,
                    raison: "cible-invalide"
                };
            }

            modifierScore(
                cible,
                -20
            );

            const carte =
                ajouterCarteTable(
                    etat,
                    -20,
                    cible.nom
                );

            return {
                appliquee: true,
                choix: "-20",
                cible,
                carte
            };
        }

        return {
            appliquee: false,
            raison: "choix-invalide"
        };
    }


    // -----------------------------------------------------
    // DOUBLE 13
    //
    // Vole jusqu'à deux cartes à points précises
    // appartenant à la cible.
    //
    // Les cartes doivent être accessibles au moment
    // de la simulation.
    // -----------------------------------------------------

    function simulerDouble13(
        etat,
        joueur,
        possibilite
    ) {

        const cible =
            trouverJoueur(
                etat,
                possibilite.cible
            );

        if (!cible || cible === joueur) {
            return {
                appliquee: false,
                raison: "cible-invalide"
            };
        }

        let cartes =
            Array.isArray(
                possibilite.cartesCibles
            )
                ? possibilite.cartesCibles
                : [];

        // Support d'un seul choix.
        if (
            cartes.length === 0 &&
            possibilite.carteCible
        ) {
            cartes = [
                possibilite.carteCible
            ];
        }

        if (cartes.length === 0) {
            return {
                appliquee: false,
                raison: "aucune-carte-cible"
            };
        }

        const cartesVolees = [];

        for (const carteReference of cartes.slice(0, 2)) {

            let carte = carteReference;

            if (
                Number.isInteger(
                    carteReference
                )
            ) {

                const table =
                    obtenirCartesTable(etat);

                carte =
                    table[
                        carteReference
                    ];
            }

            if (!carte) {
                continue;
            }

            if (
                carte.proprietaire !==
                cible.nom
            ) {
                continue;
            }

            if (!estCartePoint(carte)) {
                continue;
            }

            transfererCarteTable(
                etat,
                carte,
                joueur.nom
            );

            cartesVolees.push(carte);
        }

        if (cartesVolees.length === 0) {
            return {
                appliquee: false,
                raison: "cartes-invalides"
            };
        }

        return {
            appliquee: true,
            cartesVolees
        };
    }


    // -----------------------------------------------------
    // DOUBLE 15
    //
    // Triple une carte à points personnelle.
    //
    // Exemple :
    // 20 → 60
    //
    // Gain réel = +40.
    // -----------------------------------------------------

    function simulerDouble15(
        etat,
        joueur,
        possibilite
    ) {

        let carte =
            possibilite.carteCible;

        if (
            Number.isInteger(
                possibilite.indexCarteTable
            )
        ) {

            const table =
                obtenirCartesTable(etat);

            carte =
                table[
                    possibilite.indexCarteTable
                ];
        }

        if (!carte) {
            return {
                appliquee: false,
                raison: "carte-cible-introuvable"
            };
        }

        if (
            carte.proprietaire !==
            joueur.nom
        ) {
            return {
                appliquee: false,
                raison: "carte-non-personnelle"
            };
        }

        const ancienneValeur =
            obtenirValeurCarte(carte);

        if (
            !estNombre(ancienneValeur) ||
            ancienneValeur <= 0
        ) {
            return {
                appliquee: false,
                raison: "carte-non-valide"
            };
        }

        const nouvelleValeur =
            ancienneValeur * 3;

        const gain =
            nouvelleValeur -
            ancienneValeur;

        modifierScore(
            joueur,
            gain
        );

        carte.valeur =
            nouvelleValeur;

        carte.liee = true;

        return {
            appliquee: true,

            ancienneValeur,

            nouvelleValeur,

            gain,

            carte
        };
    }


    // -----------------------------------------------------
    // DOUBLE 17
    //
    // Vole jusqu'à deux cartes aléatoires de la cible.
    //
    // Comme pour le 17 simple, on ne choisit pas encore
    // arbitrairement les cartes.
    // -----------------------------------------------------

    function simulerDouble17(
        etat,
        joueur,
        possibilite
    ) {

        const cible =
            trouverJoueur(
                etat,
                possibilite.cible
            );

        if (!cible || cible === joueur) {
            return {
                appliquee: false,
                raison: "cible-invalide"
            };
        }

        const mainCible =
            obtenirMain(cible);

        return {
            appliquee: true,

            aleatoire: true,

            type:
                "vol-deux-cartes-aleatoires",

            cible: {
                index: cible.index,
                nom: cible.nom
            },

            nombreCartesPossibles:
                mainCible.length,

            nombreCartesVolees:
                Math.min(
                    2,
                    mainCible.length
                )
        };
    }


    // -----------------------------------------------------
    // DOUBLE 19
    //
    // Échange jusqu'à deux dernières cartes à points
    // avec la cible.
    // -----------------------------------------------------

    function simulerDouble19(
        etat,
        joueur,
        possibilite
    ) {

        const cible =
            trouverJoueur(
                etat,
                possibilite.cible
            );

        if (!cible || cible === joueur) {
            return {
                appliquee: false,
                raison: "cible-invalide"
            };
        }

        const cartesJoueur =
            obtenirDernieresCartesPoints(
                etat,
                joueur,
                2
            );

        const cartesCible =
            obtenirDernieresCartesPoints(
                etat,
                cible,
                2
            );

        const nombreEchanges =
            Math.min(
                cartesJoueur.length,
                cartesCible.length
            );

        if (nombreEchanges === 0) {
            return {
                appliquee: false,
                raison: "echange-impossible"
            };
        }

        const echanges = [];

        for (
            let i = 0;
            i < nombreEchanges;
            i++
        ) {

            const carteJoueur =
                cartesJoueur[
                    cartesJoueur.length -
                    1 -
                    i
                ];

            const carteCible =
                cartesCible[
                    cartesCible.length -
                    1 -
                    i
                ];

            const valeurJoueur =
                obtenirValeurCarte(
                    carteJoueur
                );

            const valeurCible =
                obtenirValeurCarte(
                    carteCible
                );

            carteJoueur.proprietaire =
                cible.nom;

            carteCible.proprietaire =
                joueur.nom;

            modifierScore(
                joueur,
                valeurCible -
                valeurJoueur
            );

            modifierScore(
                cible,
                valeurJoueur -
                valeurCible
            );

            echanges.push({
                carteJoueur,
                carteCible,
                valeurJoueur,
                valeurCible
            });
        }

        return {
            appliquee: true,
            echanges
        };
    }


    // -----------------------------------------------------
    // DOUBLE 21
    //
    // +40 pour soi
    // ou
    // -40 à une cible.
    // -----------------------------------------------------

    function simulerDouble21(
        etat,
        joueur,
        possibilite
    ) {

        const choix =
            possibilite.choix;

        if (choix === "+40") {

            modifierScore(
                joueur,
                40
            );

            const carte =
                ajouterCarteTable(
                    etat,
                    40,
                    joueur.nom
                );

            return {
                appliquee: true,
                choix: "+40",
                carte
            };
        }

        if (choix === "-40") {

            const cible =
                trouverJoueur(
                    etat,
                    possibilite.cible
                );

            if (!cible || cible === joueur) {
                return {
                    appliquee: false,
                    raison: "cible-invalide"
                };
            }

            modifierScore(
                cible,
                -40
            );

            const carte =
                ajouterCarteTable(
                    etat,
                    -40,
                    cible.nom
                );

            return {
                appliquee: true,
                choix: "-40",
                cible,
                carte
            };
        }

        return {
            appliquee: false,
            raison: "choix-invalide"
        };
    }


    // -----------------------------------------------------
    // DOUBLE JOKER
    //
    // Passe deux tours.
    //
    // On modifie uniquement l'état du Joker ici.
    // La logique complète des tours sera gérée ensuite
    // par la couche de tour.
    // -----------------------------------------------------

    function simulerDoubleJoker(
        etat,
        joueur,
        possibilite
    ) {

        if (!etat.toursJoker) {
            etat.toursJoker = {};
        }

        const cle =
            joueur.nom;

        etat.toursJoker[cle] =
            (
                Number(
                    etat.toursJoker[cle]
                ) || 0
            ) + 2;

        return {
            appliquee: true,

            choix:
                "passeDeuxTours",

            toursAjoutes: 2
        };
    }


    // =====================================================
    // DISPATCHER — DOUBLES
    // =====================================================

    function simulerDouble(
        etat,
        joueur,
        possibilite
    ) {

        if (!joueur || !possibilite) {
            return {
                appliquee: false,
                raison: "parametres-invalides"
            };
        }

        const valeur =
            obtenirValeurCarte(
                possibilite.valeur
            );

        switch (valeur) {

            case 1:
                return simulerDouble1(
                    etat,
                    joueur,
                    possibilite
                );

            case 2:
            case 4:
            case 6:
            case 7:
            case 8:
            case 10:
            case 12:
            case 14:
            case 16:
            case 18:
            case 20:
                return simulerDoublePoints(
                    etat,
                    joueur,
                    valeur
                );

            case 3:
                return simulerDouble3(
                    etat,
                    joueur,
                    possibilite
                );

            case 5:
                return simulerDouble5(
                    etat,
                    joueur
                );

            case 9:
                return simulerDouble9(
                    etat,
                    joueur,
                    possibilite
                );

            case 11:
                return simulerDouble11(
                    etat,
                    joueur,
                    possibilite
                );

            case 13:
                return simulerDouble13(
                    etat,
                    joueur,
                    possibilite
                );

            case 15:
                return simulerDouble15(
                    etat,
                    joueur,
                    possibilite
                );

            case 17:
                return simulerDouble17(
                    etat,
                    joueur,
                    possibilite
                );

            case 19:
                return simulerDouble19(
                    etat,
                    joueur,
                    possibilite
                );

            case 21:
                return simulerDouble21(
                    etat,
                    joueur,
                    possibilite
                );

            default:

                if (
                    possibilite.valeur === "Joker" ||
                    possibilite.valeur === "joker"
                ) {
                    return simulerDoubleJoker(
                        etat,
                        joueur,
                        possibilite
                    );
                }

                return {
                    appliquee: false,
                    raison: "double-inconnu"
                };
        }
    }

/* ============================================================
   SCÉNARIOS — INFORMATIONS CACHÉES / EFFETS ALÉATOIRES
   ============================================================ */

function creerScenario(etat, probabilite, description, metadata = {}) {
    return {
        etat,
        probabilite,
        description,
        metadata
    };
}

function normaliserProbabilites(scenarios) {
    if (!Array.isArray(scenarios) || scenarios.length === 0) {
        return [];
    }

    const total = scenarios.reduce((somme, scenario) => {
        return somme + Math.max(0, Number(scenario.probabilite) || 0);
    }, 0);

    if (total <= 0) {
        const probabilite = 1 / scenarios.length;

        return scenarios.map(scenario => ({
            ...scenario,
            probabilite
        }));
    }

    return scenarios.map(scenario => ({
        ...scenario,
        probabilite:
            Math.max(0, Number(scenario.probabilite) || 0) / total
    }));
}


/* ------------------------------------------------------------
   Cartes inconnues d'une main adverse
   ------------------------------------------------------------ */

function construireScenariosCarteAdverse(etat, joueurCible, nombre = 1) {
    const cible = trouverJoueur(etat, joueurCible);

    if (!cible) {
        return [];
    }

    const main = obtenirMain(cible);

    if (main.length === 0) {
        return [];
    }

    /*
     * IMPORTANT :
     * Le bot ne doit jamais apprendre le contenu réel
     * de la main adverse.
     *
     * Ici, on construit des scénarios à partir des cartes
     * possibles. La vraie main reste uniquement dans l'état
     * de simulation.
     */

    const scenarios = [];

    main.forEach((carte, index) => {
        const simulation = GameState.clonerEtat(etat);

        const cibleSimulation = trouverJoueur(
            simulation,
            cible.index
        );

        if (!cibleSimulation) {
            return;
        }

        retirerCarteMainParIndex(
            cibleSimulation,
            index
        );

        scenarios.push(
            creerScenario(
                simulation,
                1,
                `Carte adverse inconnue #${index + 1}`,
                {
                    type: "carte-adverse-inconnue",
                    carte: carte,
                    indexCarte: index,
                    nombreCartes: nombre
                }
            )
        );
    });

    return normaliserProbabilites(scenarios);
}


/* ------------------------------------------------------------
   17 simple
   ------------------------------------------------------------ */

function construireScenariosCarte17(etat, joueurActuel, cible) {
    const simulationBase = GameState.clonerEtat(etat);

    const joueur = trouverJoueur(
        simulationBase,
        joueurActuel
    );

    const adversaire = trouverJoueur(
        simulationBase,
        cible
    );

    if (!joueur || !adversaire) {
        return [];
    }

    const mainAdverse = obtenirMain(adversaire);

    if (mainAdverse.length === 0) {
        return [
            creerScenario(
                simulationBase,
                1,
                "17 sans carte adverse disponible",
                {
                    type: "17",
                    carteVolee: null
                }
            )
        ];
    }

    const scenarios = [];

    mainAdverse.forEach((carte, index) => {
        const simulation = GameState.clonerEtat(etat);

        const joueurSimule = trouverJoueur(
            simulation,
            joueurActuel
        );

        const adversaireSimule = trouverJoueur(
            simulation,
            cible
        );

        if (!joueurSimule || !adversaireSimule) {
            return;
        }

        const carteVolee =
            retirerCarteMainParIndex(
                adversaireSimule,
                index
            );

        if (carteVolee === undefined) {
            return;
        }

        /*
         * Le 17 vole la carte puis la joue immédiatement.
         *
         * On conserve ici la carte dans les métadonnées.
         * Son effet sera appliqué dans une étape séparée.
         */

        scenarios.push(
            creerScenario(
                simulation,
                1,
                `17 vole puis joue une carte`,
                {
                    type: "17",
                    carteVolee,
                    cible: cible
                }
            )
        );
    });

    return normaliserProbabilites(scenarios);
}


/* ------------------------------------------------------------
   Double 17
   ------------------------------------------------------------ */

function construireScenariosDouble17(etat, joueurActuel, cible) {
    const simulationBase = GameState.clonerEtat(etat);

    const joueur = trouverJoueur(
        simulationBase,
        joueurActuel
    );

    const adversaire = trouverJoueur(
        simulationBase,
        cible
    );

    if (!joueur || !adversaire) {
        return [];
    }

    const mainAdverse = obtenirMain(adversaire);

    if (mainAdverse.length === 0) {
        return [
            creerScenario(
                simulationBase,
                1,
                "Double 17 sans carte adverse disponible",
                {
                    type: "double-17",
                    cartesVolees: []
                }
            )
        ];
    }

    /*
     * Pour Double 17 :
     * on considère toutes les combinaisons possibles de
     * deux cartes différentes.
     */

    const scenarios = [];

    for (let i = 0; i < mainAdverse.length; i++) {
        for (let j = i + 1; j < mainAdverse.length; j++) {

            const simulation =
                GameState.clonerEtat(etat);

            const adversaireSimule =
                trouverJoueur(
                    simulation,
                    cible
                );

            if (!adversaireSimule) {
                continue;
            }

            /*
             * On retire d'abord la carte ayant l'index
             * le plus grand pour ne pas décaler le second index.
             */

            const carte2 =
                retirerCarteMainParIndex(
                    adversaireSimule,
                    j
                );

            const carte1 =
                retirerCarteMainParIndex(
                    adversaireSimule,
                    i
                );

            if (
                carte1 === undefined ||
                carte2 === undefined
            ) {
                continue;
            }

            scenarios.push(
                creerScenario(
                    simulation,
                    1,
                    "Double 17 vole puis joue deux cartes",
                    {
                        type: "double-17",
                        cartesVolees: [
                            carte1,
                            carte2
                        ],
                        cible
                    }
                )
            );
        }
    }

    return normaliserProbabilites(scenarios);
}


/* ------------------------------------------------------------
   Appliquer l'effet d'une carte volée
   ------------------------------------------------------------ */

function appliquerCarteVolee(
    etat,
    joueurActuel,
    carteVolee,
    cible
) {
    if (carteVolee === undefined || carteVolee === null) {
        return etat;
    }

    /*
     * On réutilise le simulateur normal.
     *
     * La carte volée devient donc une nouvelle action
     * effectuée par le joueur actif.
     */

    return simuler(
        etat,
        {
            type: "carte",
            valeur: carteVolee,
            cartes: [carteVolee],
            joueur: joueurActuel,
            cible
        }
    );
}


/* ------------------------------------------------------------
   Développer les scénarios 17
   ------------------------------------------------------------ */

function developperScenarios17(scenarios) {
    const resultat = [];

    scenarios.forEach(scenario => {

        const carteVolee =
            scenario.metadata &&
            scenario.metadata.carteVolee;

        if (
            carteVolee === undefined ||
            carteVolee === null
        ) {
            resultat.push(scenario);
            return;
        }

        const etatApres =
            appliquerCarteVolee(
                scenario.etat,
                scenario.metadata.cible
                    ? scenario.etat.joueurActuel
                    : scenario.etat.joueurActuel,
                carteVolee,
                scenario.metadata.cible
            );

        resultat.push({
            ...scenario,
            etat: etatApres,
            metadata: {
                ...scenario.metadata,
                effetCarteVoleeApplique: true
            }
        });
    });

    return resultat;
}


/* ------------------------------------------------------------
   Développer les scénarios Double 17
   ------------------------------------------------------------ */

function developperScenariosDouble17(scenarios) {
    const resultat = [];

    scenarios.forEach(scenario => {

        const cartes =
            scenario.metadata &&
            scenario.metadata.cartesVolees;

        if (!Array.isArray(cartes) || cartes.length === 0) {
            resultat.push(scenario);
            return;
        }

        let etat = scenario.etat;

        for (const carte of cartes) {
            etat = appliquerCarteVolee(
                etat,
                etat.joueurActuel,
                carte,
                scenario.metadata.cible
            );
        }

        resultat.push({
            ...scenario,
            etat,
            metadata: {
                ...scenario.metadata,
                effetCartesVoleesApplique: true
            }
        });
    });

    return resultat;
}

// =====================================================
// API PUBLIQUE
// =====================================================

function simulerAvecScenarios(etat, possibilite) {

    const type = possibilite.type;
    const valeur = possibilite.valeur;

    // -------------------------------------------------
    // DOUBLE 17
    // -------------------------------------------------

    if (
        type === "double" &&
        valeur === 17
    ) {

        const scenarios =
            construireScenariosDouble17(
                etat,
                possibilite.joueur,
                possibilite.cible
            );

        return developperScenariosDouble17(
            scenarios
        );
    }

    // -------------------------------------------------
    // 17 SIMPLE
    // -------------------------------------------------

    if (
        type !== "double" &&
        valeur === 17
    ) {

        const scenarios =
            construireScenariosCarte17(
                etat,
                possibilite.joueur,
                possibilite.cible
            );

        return developperScenarios17(
            scenarios
        );
    }

    // -------------------------------------------------
    // ACTION DÉTERMINISTE
    // -------------------------------------------------

    return [
        creerScenario(
            simuler(etat, possibilite),
            1,
            "Simulation déterministe",
            {
                type: "deterministe"
            }
        )
    ];
}


window.AtoumoulinBotSimulator = {

    simuler,

    simulerAvecScenarios,

    construireScenariosCarte17,

    construireScenariosDouble17,

    normaliserProbabilites,

    creerScenario
};


window.AtoumoulinSimulator = {

    version: 1,

    simuler,

    simulerAvecScenarios,

    clonerEtat,

    trouverJoueur,
    trouverJoueurParNom,
    trouverJoueurParIndex,
    obtenirJoueurActuel,
    obtenirReferenceJoueur,

    obtenirScore,
    modifierScore,
    definirScore,

    obtenirMain,
    ajouterCarteMain,
    retirerCarteMain,
    retirerCarteMainParIndex,
    retirerCartesMain,

    obtenirValeurCarte,

    obtenirCartesTable,
    obtenirCartesPointsJoueur,
    trouverDerniereCartePoints,

    ajouterCarteTable,
    trouverIndexCarteTable,
    transfererCarteTable,

    echangerScores,
    echangerMains,

    piocherCarte,
    piocherCartes,

    limiter
};


console.log(
    "Atoumoulin : Bot Simulator v1 chargé."
);

})();
