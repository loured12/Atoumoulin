// =========================================================
// ATOUMOULIN — GAME STATE
// Couche d'accès à l'état actuel du jeu
//
// Rôle :
// - lire l'état réel du jeu
// - produire un snapshot indépendant
// - éviter que l'IA manipule directement les objets du moteur
// - fournir des identifiants stables pour les joueurs
//
// Ce fichier NE contient aucune intelligence.
// Ce fichier NE décide aucune action.
// Ce fichier NE simule aucune règle.
// =========================================================

(function () {

    "use strict";

    const VERSION = 2;

    // -----------------------------------------------------
    // CLONAGE
    // -----------------------------------------------------

    function cloner(valeur) {

        if (valeur === null || typeof valeur !== "object") {
            return valeur;
        }

        if (typeof structuredClone === "function") {
            try {
                return structuredClone(valeur);
            } catch (erreur) {
                // Fallback ci-dessous.
            }
        }

        return JSON.parse(JSON.stringify(valeur));
    }


    // -----------------------------------------------------
    // JOUEURS
    // -----------------------------------------------------

    function obtenirIndexJoueur(joueur) {

        if (!joueur || !Array.isArray(joueurs)) {
            return null;
        }

        const index = joueurs.indexOf(joueur);

        return index >= 0 ? index : null;
    }


    function obtenirIdentifiantJoueur(joueur) {

        if (!joueur) {
            return null;
        }

        const index = obtenirIndexJoueur(joueur);

        return {
            index,
            nom: typeof joueur.nom === "string"
                ? joueur.nom
                : null
        };
    }


    function creerSnapshotJoueur(joueur) {

        if (!joueur) {
            return null;
        }

        return {
            index: obtenirIndexJoueur(joueur),

            nom:
                typeof joueur.nom === "string"
                    ? joueur.nom
                    : null,

            score:
                Number.isFinite(Number(joueur.score))
                    ? Number(joueur.score)
                    : 0,

            main:
                Array.isArray(joueur.main)
                    ? cloner(joueur.main)
                    : [],

            nombreCartes:
                Array.isArray(joueur.main)
                    ? joueur.main.length
                    : 0,

            bot: !!joueur.bot,

            // Conservé si présent dans le moteur.
            niveauBot:
                typeof joueur.niveauBot === "string"
                    ? joueur.niveauBot
                    : null
        };
    }


    // -----------------------------------------------------
    // ÉTAT DES JOUEURS
    // -----------------------------------------------------

    function creerSnapshotJoueurs() {

        if (!Array.isArray(joueurs)) {
            return [];
        }

        return joueurs
            .map(creerSnapshotJoueur)
            .filter(Boolean);
    }


    // -----------------------------------------------------
    // RÉFÉRENCE DU JOUEUR ACTUEL
    // -----------------------------------------------------

    function creerReferenceJoueur(joueur) {

        if (!joueur) {
            return null;
        }

        return obtenirIdentifiantJoueur(joueur);
    }


    // -----------------------------------------------------
    // ÉTAT DE LA PARTIE
    // -----------------------------------------------------

    function snapshot() {

        const joueursSnapshot = creerSnapshotJoueurs();

        return {

            // -------------------------------------------------
            // MÉTADONNÉES
            // -------------------------------------------------

            version: VERSION,

            // -------------------------------------------------
            // JOUEURS
            // -------------------------------------------------

            joueurs: joueursSnapshot,

            joueurActuel:
                creerReferenceJoueur(joueurActuel),

            // -------------------------------------------------
            // CARTES
            // -------------------------------------------------

            paquet:
                Array.isArray(paquet)
                    ? cloner(paquet)
                    : [],

            nombreCartesPioche:
                Array.isArray(paquet)
                    ? paquet.length
                    : 0,

            cartesTable:
                Array.isArray(cartesTable)
                    ? cloner(cartesTable)
                    : [],

            defaussePouvoirs:
                Array.isArray(defaussePouvoirs)
                    ? cloner(defaussePouvoirs)
                    : [],

            // -------------------------------------------------
            // HISTORIQUE
            // -------------------------------------------------

            historique:
                typeof historique !== "undefined"
                    ? cloner(historique)
                    : [],

            // -------------------------------------------------
            // ACTION EN COURS
            // -------------------------------------------------

            actionEnCours:
                typeof actionEnCours !== "undefined"
                    ? cloner(actionEnCours)
                    : null,

            cibleChoisie:
                typeof cibleChoisie !== "undefined"
                    ? cloner(cibleChoisie)
                    : null,

            carteChoisie:
                typeof carteChoisie !== "undefined"
                    ? cloner(carteChoisie)
                    : null,

            // -------------------------------------------------
            // CONFIGURATION DE PARTIE
            // -------------------------------------------------

            modeJeu:
                typeof modeJeu !== "undefined"
                    ? modeJeu
                    : null,

            victoires:
                typeof victoires !== "undefined"
                    ? cloner(victoires)
                    : [],

            // -------------------------------------------------
            // ÉTAT DU 17
            // -------------------------------------------------

            joueur17:
                typeof joueur17 !== "undefined"
                    ? creerReferenceJoueur(joueur17)
                    : null,

            carte17EnAttente:
                typeof carte17EnAttente !== "undefined"
                    ? cloner(carte17EnAttente)
                    : null,

            cartesDouble17:
                typeof cartesDouble17 !== "undefined"
                    ? cloner(cartesDouble17)
                    : [],

            double17EnCours:
                typeof double17EnCours !== "undefined"
                    ? !!double17EnCours
                    : false,

            // -------------------------------------------------
            // ÉTAT DU 19
            // -------------------------------------------------

            joueur19:
                typeof joueur19 !== "undefined"
                    ? creerReferenceJoueur(joueur19)
                    : null,

            // -------------------------------------------------
            // JOKER
            // -------------------------------------------------

            toursJoker:
                typeof toursJoker !== "undefined"
                    ? cloner(toursJoker)
                    : {},

            // -------------------------------------------------
            // FIN DE MANCHE / PARTIE
            // -------------------------------------------------

            gagnantPartie:
                typeof gagnantPartie !== "undefined"
                    ? obtenirIndexJoueur(gagnantPartie)
                    : null,

            gagnantManche:
                typeof gagnantManche !== "undefined"
                    ? obtenirIndexJoueur(gagnantManche)
                    : null,

            mancheTerminee:
                typeof mancheTerminee !== "undefined"
                    ? !!mancheTerminee
                    : false
        };
    }


    // -----------------------------------------------------
    // RECHERCHE D'UN JOUEUR DANS UN SNAPSHOT
    // -----------------------------------------------------

    function trouverJoueur(etat, reference) {

        if (!etat || !Array.isArray(etat.joueurs)) {
            return null;
        }

        if (reference === null || typeof reference === "undefined") {
            return null;
        }

        // Référence sous forme d'index.
        if (typeof reference === "number") {

            return etat.joueurs[reference] || null;
        }

        // Référence sous forme d'objet.
        if (typeof reference === "object") {

            if (
                Number.isInteger(reference.index) &&
                etat.joueurs[reference.index]
            ) {
                return etat.joueurs[reference.index];
            }

            if (typeof reference.nom === "string") {

                return (
                    etat.joueurs.find(
                        joueur => joueur.nom === reference.nom
                    ) || null
                );
            }
        }

        // Référence directe par nom.
        if (typeof reference === "string") {

            return (
                etat.joueurs.find(
                    joueur => joueur.nom === reference
                ) || null
            );
        }

        return null;
    }


    // -----------------------------------------------------
    // OBTENIR LE JOUEUR ACTUEL D'UN SNAPSHOT
    // -----------------------------------------------------

    function obtenirJoueurActuel(etat) {

        if (!etat) {
            return null;
        }

        return trouverJoueur(etat, etat.joueurActuel);
    }


    // -----------------------------------------------------
    // OBTENIR UN JOUEUR PAR NOM
    // -----------------------------------------------------

    function trouverJoueurParNom(etat, nom) {

        if (!etat || !Array.isArray(etat.joueurs)) {
            return null;
        }

        return (
            etat.joueurs.find(
                joueur => joueur.nom === nom
            ) || null
        );
    }


    // -----------------------------------------------------
    // OBTENIR UN JOUEUR PAR INDEX
    // -----------------------------------------------------

    function trouverJoueurParIndex(etat, index) {

        if (
            !etat ||
            !Array.isArray(etat.joueurs) ||
            !Number.isInteger(index)
        ) {
            return null;
        }

        return etat.joueurs[index] || null;
    }


    // -----------------------------------------------------
    // COPIE INDÉPENDANTE D'UN SNAPSHOT
    // -----------------------------------------------------

    function clonerEtat(etat) {

        return cloner(etat);
    }


    // -----------------------------------------------------
    // INFORMATIONS UTILES
    // -----------------------------------------------------

    function obtenirNombreJoueurs(etat) {

        if (!etat || !Array.isArray(etat.joueurs)) {
            return 0;
        }

        return etat.joueurs.length;
    }


    function obtenirNombreCartesJoueur(etat, reference) {

        const joueur = trouverJoueur(etat, reference);

        if (!joueur) {
            return 0;
        }

        if (Number.isFinite(Number(joueur.nombreCartes))) {
            return Number(joueur.nombreCartes);
        }

        return Array.isArray(joueur.main)
            ? joueur.main.length
            : 0;
    }


    // -----------------------------------------------------
    // API PUBLIQUE
    // -----------------------------------------------------

    window.AtoumoulinGameState = {

        version: VERSION,

        snapshot,

        clonerEtat,

        trouverJoueur,
        trouverJoueurParNom,
        trouverJoueurParIndex,

        obtenirJoueurActuel,

        obtenirIndexJoueur,
        obtenirIdentifiantJoueur,

        obtenirNombreJoueurs,
        obtenirNombreCartesJoueur
    };


    console.log(
        "Atoumoulin : Game State v" + VERSION + " chargé."
    );

})();
