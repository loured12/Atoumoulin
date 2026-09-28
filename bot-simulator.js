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

        simulation.__simulation = true;

        simulation.__actionSimulee =
            action;

        return simulation;
    }


    // =====================================================
    // API PUBLIQUE
    // =====================================================

    window.AtoumoulinSimulator = {

        version: 1,

        simuler,

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
