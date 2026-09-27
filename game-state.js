// =========================================================
// ATOUMOULIN — GAME STATE
// Couche d'accès à l'état actuel du jeu
// =========================================================

(function () {

    "use strict";

    window.AtoumoulinGameState = {

        version: 1,

        snapshot() {

            return {
                joueurs: joueurs.map(joueur => ({
                    nom: joueur.nom,
                    score: joueur.score,
                    main: [...joueur.main],
                    bot: !!joueur.bot
                })),

                joueurActuel: joueurActuel,

                paquet: [...paquet],

                cartesTable:
                    JSON.parse(JSON.stringify(cartesTable)),

                defaussePouvoirs:
                    JSON.parse(JSON.stringify(defaussePouvoirs)),

                historique: historique,

                actionEnCours: actionEnCours,
                cibleChoisie: cibleChoisie,
                carteChoisie: carteChoisie,

                modeJeu: modeJeu,
                victoires: [...victoires],

                joueur17: joueur17,
                carte17EnAttente: carte17EnAttente,
                cartesDouble17: [...cartesDouble17],
                double17EnCours: double17EnCours,

                joueur19: joueur19,
                toursJoker: { ...toursJoker },

                gagnantPartie:
                    gagnantPartie
                        ? joueurs.indexOf(gagnantPartie)
                        : null,

                gagnantManche:
                    gagnantManche
                        ? joueurs.indexOf(gagnantManche)
                        : null,

                mancheTerminee: mancheTerminee
            };

        }

    };

})();
