/* =========================================================
   ATOUMOULIN — NOUVEAU MOTEUR IA
   =========================================================
   
   Architecture :
   état → informations accessibles → actions légales
   → actions complètes → simulation → évaluation
   → difficulté → décision

   Ce fichier ne doit pas exécuter directement les règles
   du jeu. Il prépare les décisions du bot.
   ========================================================= */

(function () {

    "use strict";

    /* =====================================================
       CONFIGURATION DES DIFFICULTÉS
       ===================================================== */

    const BOT_DIFFICULTES = {

        facile: {
            strategique: 0.40,
            hasard: 0.60,
            profondeur: 1
        },

        normal: {
            strategique: 0.75,
            hasard: 0.25,
            profondeur: 2
        },

        difficile: {
            strategique: 0.90,
            hasard: 0.10,
            profondeur: 3
        },

        expert: {
            strategique: 1.00,
            hasard: 0.00,
            profondeur: 4
        }

    };


    /* =====================================================
       COEFFICIENTS DU MOTEUR
       ===================================================== */

    const BOT_COEFFICIENTS = {

        impactPersonnel: 0.40,
        impactAdversaire: 0.30,
        potentielFutur: 0.15,
        coutOpportunite: 0.10,
        risque: 0.05

    };


    /* =====================================================
       VALEURS DE FINITION
       ===================================================== */

    const VALEUR_TOURS_FINITION = {

        1: 100,
        2: 70,
        3: 45,
        4: 25,
        5: 10

    };


    const CERTITUDE_FINITION = {

        certaine: 100,
        tresProbable: 80,
        possible: 55,
        faible: 30,
        impossible: 0

    };


    /* =====================================================
       OUTILS GÉNÉRAUX
       ===================================================== */

    function limiter(valeur, minimum = 0, maximum = 100) {

        return Math.max(
            minimum,
            Math.min(maximum, Number(valeur) || 0)
        );

    }


    function moyenne(valeurs) {

        if (!Array.isArray(valeurs) || valeurs.length === 0) {
            return 0;
        }

        return valeurs.reduce(
            (total, valeur) => total + Number(valeur || 0),
            0
        ) / valeurs.length;

    }


    function valeurFinition(tours) {

        if (!Number.isFinite(tours)) {
            return 0;
        }

        if (tours >= 5) {
            return 10;
        }

        return VALEUR_TOURS_FINITION[tours] || 0;

    }


    /* =====================================================
       DIFFICULTÉ
       ===================================================== */

    function obtenirDifficulteBot(joueur) {

        if (
            joueur &&
            typeof joueur.niveauBot === "string" &&
            BOT_DIFFICULTES[joueur.niveauBot]
        ) {
            return joueur.niveauBot;
        }

        if (
            typeof niveauBots !== "undefined" &&
            BOT_DIFFICULTES[niveauBots]
        ) {
            return niveauBots;
        }

        return "normal";

    }


    function obtenirConfigurationDifficulte(joueur) {

        const difficulte =
            obtenirDifficulteBot(joueur);

        return BOT_DIFFICULTES[difficulte];

    }


    /* =====================================================
       ÉTAT DU BOT
       ===================================================== */

    function obtenirEtatBot(joueur) {

        if (
            typeof globalThis.__atoumoulinGetBotState === "function"
        ) {
            return globalThis.__atoumoulinGetBotState(joueur);
        }

        return {

            joueur,
            joueurs:
                typeof joueurs !== "undefined"
                    ? joueurs
                    : [],

            joueurActuel:
                typeof joueurActuel !== "undefined"
                    ? joueurActuel
                    : null,

            cartesTable:
                typeof cartesTable !== "undefined"
                    ? cartesTable
                    : [],

            paquet:
                typeof paquet !== "undefined"
                    ? paquet
                    : [],

            defaussePouvoirs:
                typeof defaussePouvoirs !== "undefined"
                    ? defaussePouvoirs
                    : [],

            actionEnCours:
                typeof actionEnCours !== "undefined"
                    ? actionEnCours
                    : null,

            modeJeu:
                typeof modeJeu !== "undefined"
                    ? modeJeu
                    : 1

        };

    }


    /* =====================================================
       INFORMATIONS ACCESSIBLES
       ===================================================== */

    function construireConnaissanceBot(etat, joueur) {

        const connaissance = {

            joueur: joueur,

            scorePersonnel:
                joueur ? joueur.score : 0,

            mainPersonnelle:
                joueur && Array.isArray(joueur.main)
                    ? [...joueur.main]
                    : [],

            adversaires: [],

            cartesTable:
                Array.isArray(etat.cartesTable)
                    ? etat.cartesTable
                    : [],

            nombreCartesPioche:
                Array.isArray(etat.paquet)
                    ? etat.paquet.length
                    : 0

        };


        if (Array.isArray(etat.joueurs)) {

            connaissance.adversaires =
                etat.joueurs
                    .filter(adversaire =>
                        adversaire !== joueur
                    )
                    .map(adversaire => ({

                        joueur: adversaire,

                        /*
                         * Le bot connaît le nombre de cartes.
                         * Il ne reçoit PAS leur contenu ici.
                         */
                        nombreCartes:
                            Array.isArray(adversaire.main)
                                ? adversaire.main.length
                                : Number(adversaire.cardCount) || 0,

                        score:
                            Number(adversaire.score) || 0

                    }));

        }


        return connaissance;

    }

      /* =====================================================
       ACTIONS LÉGALES
       ===================================================== */

    function obtenirValeurCarte(carte) {

        if (typeof carte === "number") {
            return carte;
        }

        if (carte && typeof carte.valeur !== "undefined") {
            return Number(carte.valeur);
        }

        return Number(carte);
    }


    function compterValeurs(main) {

        const compte = {};

        main.forEach(carte => {

            const valeur = obtenirValeurCarte(carte);

            if (!Number.isFinite(valeur)) {
                return;
            }

            compte[valeur] =
                (compte[valeur] || 0) + 1;

        });

        return compte;

    }


    function trouverDouble(main, valeur) {

        const cartes = main.filter(carte =>
            obtenirValeurCarte(carte) === valeur
        );

        /*
         * Un seul double est formé.
         * Les éventuelles cartes supplémentaires
         * restent dans la main.
         */

        if (cartes.length < 2) {
            return null;
        }

        return [
            cartes[0],
            cartes[1]
        ];

    }


    function creerActionCarte(carte, index) {

        return {

            type: "carte",

            valeur:
                obtenirValeurCarte(carte),

            carte,

            indexCarte: index,

            cartes: [carte],

            /*
             * Une action complète sera construite
             * plus tard.
             *
             * Pour l'instant :
             * carte → action de base
             */

            cible: null,

            choix: null,

            priorite: 3

        };

    }


    function creerActionDouble(
        valeur,
        cartes,
        indices
    ) {

        return {

            type: "double",

            valeur,

            cartes: [...cartes],

            indicesCartes: [...indices],

            cible: null,

            choix: null,

            priorite:
                valeur === 7
                    ? 1
                    : 2

        };

    }


    function obtenirActionsLegales(
        joueur
    ) {

        if (
            !joueur ||
            !Array.isArray(joueur.main) ||
            joueur.main.length === 0
        ) {
            return [];
        }


        const main = joueur.main;

        const compte = compterValeurs(main);


        /* =================================================
           PRIORITÉ ABSOLUE : DOUBLE 7
           ================================================= */

        if ((compte[7] || 0) >= 2) {

            const cartes =
                trouverDouble(main, 7);

            const indices =
                cartes.map(carte =>
                    main.indexOf(carte)
                );

            return [
                creerActionDouble(
                    7,
                    cartes,
                    indices
                )
            ];

        }


        /* =================================================
           PRIORITÉ : 7 SIMPLE
           ================================================= */

        if ((compte[7] || 0) === 1) {

            const index =
                main.findIndex(carte =>
                    obtenirValeurCarte(carte) === 7
                );

            return [
                creerActionCarte(
                    main[index],
                    index
                )
            ];

        }


        /* =================================================
           RECHERCHE DES DOUBLES
           ================================================= */

        const doubles = [];

        Object.keys(compte)
            .map(Number)
            .forEach(valeur => {

                if (valeur === 7) {
                    return;
                }

                if (compte[valeur] >= 2) {

                    const cartes =
                        trouverDouble(
                            main,
                            valeur
                        );

                    if (!cartes) {
                        return;
                    }

                    const indices =
                        cartes.map(carte =>
                            main.indexOf(carte)
                        );

                    doubles.push(
                        creerActionDouble(
                            valeur,
                            cartes,
                            indices
                        )
                    );

                }

            });


        if (doubles.length > 0) {

            return doubles;

        }


        /* =================================================
           AUCUN DOUBLE :
           CARTES SIMPLES DISPONIBLES
           ================================================= */

        return main.map(
            (carte, index) =>
                creerActionCarte(
                    carte,
                    index
                )
        );

    }


    /* =====================================================
       VALIDATION D'UNE ACTION
       ===================================================== */

    function actionEstLegale(
        action,
        joueur
    ) {

        if (!action || !joueur) {
            return false;
        }

        const actions =
            obtenirActionsLegales(joueur);

        return actions.some(candidate => {

            if (
                candidate.type !== action.type
            ) {
                return false;
            }

            if (
                candidate.valeur !== action.valeur
            ) {
                return false;
            }

            if (
                candidate.type === "double"
            ) {
                return true;
            }

            return (
                candidate.indexCarte ===
                action.indexCarte
            );

        });

    }

  
         /* =====================================================
       GÉNÉRATION DES ACTIONS COMPLÈTES
       ===================================================== */

    function obtenirAdversaires(etat, joueur) {

        if (!etat || !Array.isArray(etat.joueurs)) {
            return [];
        }

        return etat.joueurs.filter(
            autre => autre !== joueur
        );

    }


    function creerPossibilite(
        action,
        details = {}
    ) {

        return {

            action,

            type: action.type,

            valeur: action.valeur,

            cartes:
                Array.isArray(action.cartes)
                    ? [...action.cartes]
                    : [],

            cible:
                details.cible ?? null,

            carteCible:
                details.carteCible ?? null,

            choix:
                details.choix ?? null,

            effet:
                details.effet ?? null,

            metadata:
                details.metadata || {},

            evaluation: null

        };

    }


    function genererPossibilitesCarte(
        action,
        joueur,
        etat,
        connaissance
    ) {

        const possibilites = [];

        const valeur = action.valeur;

        const adversaires =
            obtenirAdversaires(
                etat,
                joueur
            );


        /* ================================================
           CARTES SANS CHOIX
           ================================================ */

        const cartesSansChoix = [
            2, 4, 5, 7, 8, 10,
            12, 14, 16, 18, 20
        ];

        if (
            cartesSansChoix.includes(valeur)
        ) {

            possibilites.push(
                creerPossibilite(action)
            );

            return possibilites;

        }


        /* ================================================
           1
           Vole la dernière carte à points
           ================================================ */

        if (valeur === 1) {

            adversaires.forEach(cible => {

                possibilites.push(
                    creerPossibilite(
                        action,
                        {
                            cible
                        }
                    )
                );

            });

            return possibilites;

        }


        /* ================================================
           3
           -20 à un adversaire
           ================================================ */

        if (valeur === 3) {

            adversaires.forEach(cible => {

                possibilites.push(
                    creerPossibilite(
                        action,
                        {
                            cible
                        }
                    )
                );

            });

            return possibilites;

        }


        /* ================================================
           5
           Pioche 2
           ================================================ */

        if (valeur === 5) {

            possibilites.push(
                creerPossibilite(
                    action,
                    {
                        choix: "piocher2"
                    }
                )
            );

            return possibilites;

        }


        /* ================================================
           9
           Échange de main
           ================================================ */

        if (valeur === 9) {

            adversaires.forEach(cible => {

                possibilites.push(
                    creerPossibilite(
                        action,
                        {
                            cible
                        }
                    )
                );

            });

            return possibilites;

        }


        /* ================================================
           11
           +10 ou -10 pour soi
           ================================================ */

        if (valeur === 11) {

            possibilites.push(
                creerPossibilite(
                    action,
                    {
                        choix: "+10"
                    }
                )
            );

            possibilites.push(
                creerPossibilite(
                    action,
                    {
                        choix: "-10"
                    }
                )
            );

            return possibilites;

        }


        /* ================================================
           13
           Vole une carte à points
           ================================================ */

        if (valeur === 13) {

            adversaires.forEach(cible => {

                const cartesDisponibles =
                    Array.isArray(
                        cible.main
                    )
                        ? cible.main
                        : [];


                /*
                 * Ici on ne doit pas révéler artificiellement
                 * les cartes cachées.
                 *
                 * Si la main de l'adversaire n'est pas
                 * réellement accessible au bot, on crée
                 * une possibilité abstraite.
                 */

                if (
                    connaissance &&
                    connaissance.mainsAdversesVisibles
                ) {

                    cartesDisponibles.forEach(
                        carteCible => {

                            possibilites.push(
                                creerPossibilite(
                                    action,
                                    {
                                        cible,
                                        carteCible
                                    }
                                )
                            );

                        }
                    );

                }
                else {

                    possibilites.push(
                        creerPossibilite(
                            action,
                            {
                                cible,
                                metadata: {
                                    carteCibleInconnue: true
                                }
                            }
                        )
                    );

                }

            });

            return possibilites;

        }


        /* ================================================
           15
           Choisit une carte personnelle
           ================================================ */

        if (valeur === 15) {

            const cartesPersonnellementEligibles =
                Array.isArray(
                    connaissance.mainPersonnelle
                )
                    ? connaissance.mainPersonnelle
                    : [];


            cartesPersonnellementEligibles
                .forEach(
                    (carteCible, index) => {

                        const valeurCible =
                            obtenirValeurCarte(
                                carteCible
                            );

                        /*
                         * Les cartes de pouvoir ne sont
                         * pas des cartes à points.
                         *
                         * On limite ici aux valeurs
                         * strictement positives.
                         */

                        if (
                            valeurCible > 0 &&
                            valeurCible !== 15
                        ) {

                            possibilites.push(
                                creerPossibilite(
                                    action,
                                    {
                                        carteCible,
                                        metadata: {
                                            indexCarteCible:
                                                index
                                        }
                                    }
                                )
                            );

                        }

                    }
                );

            return possibilites;

        }


        /* ================================================
           17
           Vole une carte au hasard
           ================================================ */

        if (valeur === 17) {

            adversaires.forEach(cible => {

                possibilites.push(
                    creerPossibilite(
                        action,
                        {
                            cible,

                            metadata: {
                                carteCibleAleatoire:
                                    true
                            }

                        }
                    )
                );

            });

            return possibilites;

        }


        /* ================================================
           19
           Échange avec un adversaire
           ================================================ */

        if (valeur === 19) {

            adversaires.forEach(cible => {

                possibilites.push(
                    creerPossibilite(
                        action,
                        {
                            cible
                        }
                    )
                );

            });

            return possibilites;

        }


        /* ================================================
           21
           +20 soi OU -20 adversaire
           ================================================ */

        if (valeur === 21) {

            possibilites.push(
                creerPossibilite(
                    action,
                    {
                        choix: "+20"
                    }
                )
            );


            adversaires.forEach(cible => {

                possibilites.push(
                    creerPossibilite(
                        action,
                        {
                            cible,
                            choix: "-20"
                        }
                    )
                );

            });

            return possibilites;

        }


        /* ================================================
           JOKER
           ================================================ */

        if (
            typeof valeur === "string" &&
            valeur.toLowerCase() === "joker"
        ) {

            possibilites.push(
                creerPossibilite(
                    action,
                    {
                        choix: "10"
                    }
                )
            );

            possibilites.push(
                creerPossibilite(
                    action,
                    {
                        choix: "22"
                    }
                )
            );


            adversaires.forEach(cible => {

                possibilites.push(
                    creerPossibilite(
                        action,
                        {
                            cible,
                            choix: "echangeScores"
                        }
                    )
                );

            });

            return possibilites;

        }


        /* ================================================
           PAR DÉFAUT
           ================================================ */

        possibilites.push(
            creerPossibilite(action)
        );

        return possibilites;

    }


    function genererPossibilitesDouble(
        action,
        joueur,
        etat,
        connaissance
    ) {

        const possibilites = [];

        const valeur = action.valeur;

        const adversaires =
            obtenirAdversaires(
                etat,
                joueur
            );


        /* ================================================
           DOUBLES SANS CHOIX
           ================================================ */

        const doublesSansChoix = [
            2, 4, 5, 7, 15, 17, 19
        ];

        if (
            doublesSansChoix.includes(valeur)
        ) {

            possibilites.push(
                creerPossibilite(action)
            );

            return possibilites;

        }


        /* ================================================
           DOUBLE 1
           ================================================ */

        if (valeur === 1) {

            adversaires.forEach(cible => {

                possibilites.push(
                    creerPossibilite(
                        action,
                        {
                            cible
                        }
                    )
                );

            });

            return possibilites;

        }


        /* ================================================
           DOUBLE 3
           ================================================ */

        if (valeur === 3) {

            adversaires.forEach(cible => {

                possibilites.push(
                    creerPossibilite(
                        action,
                        {
                            cible
                        }
                    )
                );

            });

            return possibilites;

        }


        /* ================================================
           DOUBLE 9
           ================================================ */

        if (valeur === 9) {

            /*
             * Double 9 révèle les mains.
             *
             * Cette information sera traitée comme une
             * information nouvellement révélée pendant
             * la simulation.
             */

            adversaires.forEach(cible => {

                possibilites.push(
                    creerPossibilite(
                        action,
                        {
                            cible,

                            metadata: {
                                reveleMains: true
                            }

                        }
                    )
                );

            });

            return possibilites;

        }


        /* ================================================
           DOUBLE 11
           ================================================ */

        if (valeur === 11) {

            possibilites.push(
                creerPossibilite(
                    action,
                    {
                        choix: "+20"
                    }
                )
            );

            possibilites.push(
                creerPossibilite(
                    action,
                    {
                        choix: "-20"
                    }
                )
            );

            return possibilites;

        }


        /* ================================================
           DOUBLE 13
           ================================================ */

        if (valeur === 13) {

            adversaires.forEach(cible => {

                possibilites.push(
                    creerPossibilite(
                        action,
                        {
                            cible,

                            metadata: {
                                nombreCartesVolees: 2
                            }

                        }
                    )
                );

            });

            return possibilites;

        }


        /* ================================================
           DOUBLE 21
           ================================================ */

        if (valeur === 21) {

            possibilites.push(
                creerPossibilite(
                    action,
                    {
                        choix: "+40"
                    }
                )
            );


            adversaires.forEach(cible => {

                possibilites.push(
                    creerPossibilite(
                        action,
                        {
                            cible,
                            choix: "-40"
                        }
                    )
                );

            });

            return possibilites;

        }


        /* ================================================
           DOUBLE JOKER
           ================================================ */

        if (
            typeof valeur === "string" &&
            valeur.toLowerCase() === "joker"
        ) {

            possibilites.push(
                creerPossibilite(
                    action,
                    {
                        choix: "passeDeuxTours"
                    }
                )
            );

            return possibilites;

        }


        possibilites.push(
            creerPossibilite(action)
        );

        return possibilites;

    }


    function genererPossibilites(
        joueur,
        etat,
        connaissance
    ) {

        const actionsLegales =
            obtenirActionsLegales(
                joueur
            );

        const possibilites = [];


        actionsLegales.forEach(action => {

            let nouvellesPossibilites;


            if (action.type === "double") {

                nouvellesPossibilites =
                    genererPossibilitesDouble(
                        action,
                        joueur,
                        etat,
                        connaissance
                    );

            }
            else {

                nouvellesPossibilites =
                    genererPossibilitesCarte(
                        action,
                        joueur,
                        etat,
                        connaissance
                    );

            }


            nouvellesPossibilites.forEach(
                possibilite => {

                    possibilites.push(
                        possibilite
                    );

                }
            );

        });


        return possibilites;

    }

        /* =====================================================
       SIMULATION D'UNE POSSIBILITÉ
       ===================================================== */

    function clonerEtatBot(etat) {

        if (!etat) {
            return null;
        }

        return JSON.parse(
            JSON.stringify(etat)
        );

    }


    function trouverJoueurSimulation(
        etat,
        joueur
    ) {

        if (
            !etat ||
            !Array.isArray(etat.joueurs) ||
            !joueur
        ) {
            return null;
        }

        return etat.joueurs.find(
            j => j.nom === joueur.nom
        ) || null;

    }


    function retirerCarteMain(
        joueur,
        carte
    ) {

        if (
            !joueur ||
            !Array.isArray(joueur.main)
        ) {
            return false;
        }

        const index =
            joueur.main.indexOf(carte);

        if (index === -1) {
            return false;
        }

        joueur.main.splice(index, 1);

        return true;

    }


    function ajouterCarteTable(
        etat,
        valeur,
        proprietaire,
        historiqueCarte = null
    ) {

        if (!Array.isArray(etat.cartesTable)) {
            etat.cartesTable = [];
        }

        etat.cartesTable.push({

            valeur,

            proprietaire,

            liee: false,

            historiqueCarte:
                historiqueCarte || [valeur]

        });

    }


    function ajusterScore(
        joueur,
        variation
    ) {

        if (!joueur) {
            return;
        }

        joueur.score =
            Number(joueur.score || 0)
            + Number(variation || 0);

    }


    function obtenirCartesPoints(
        etat,
        nomJoueur
    ) {

        if (
            !etat ||
            !Array.isArray(etat.cartesTable)
        ) {
            return [];
        }

        return etat.cartesTable.filter(
            carte =>
                carte.proprietaire === nomJoueur &&
                Number(carte.valeur) > 0
        );

    }


    function simulerEchangeScores(
        joueur,
        cible
    ) {

        if (!joueur || !cible) {
            return;
        }

        const scoreJoueur =
            joueur.score;

        joueur.score =
            cible.score;

        cible.score =
            scoreJoueur;

    }


    function simulerCarteSimple(
        possibilite,
        etat,
        joueur
    ) {

        const valeur =
            possibilite.valeur;


        /* ================================================
           CARTE À POINTS
           ================================================ */

        if (
            typeof valeur === "number" &&
            valeur % 2 === 0 &&
            valeur >= 2 &&
            valeur <= 20
        ) {

            ajusterScore(
                joueur,
                valeur
            );

            ajouterCarteTable(
                etat,
                valeur,
                joueur.nom
            );

            return;

        }


        /* ================================================
           1
           ================================================ */

        if (valeur === 1) {

            const cible =
                trouverJoueurSimulation(
                    etat,
                    possibilite.cible
                );

            if (!cible) {
                return;
            }

            const cartes =
                obtenirCartesPoints(
                    etat,
                    cible.nom
                );

            if (cartes.length === 0) {
                return;
            }

            const carte =
                cartes[cartes.length - 1];

            const index =
                etat.cartesTable.indexOf(
                    carte
                );

            if (index !== -1) {

                etat.cartesTable.splice(
                    index,
                    1
                );

                ajusterScore(
                    cible,
                    -carte.valeur
                );

                ajusterScore(
                    joueur,
                    carte.valeur
                );

                carte.proprietaire =
                    joueur.nom;

                etat.cartesTable.push(
                    carte
                );

            }

            return;

        }


        /* ================================================
           3
           ================================================ */

        if (valeur === 3) {

            const cible =
                trouverJoueurSimulation(
                    etat,
                    possibilite.cible
                );

            if (cible) {

                ajusterScore(
                    cible,
                    -20
                );

                ajouterCarteTable(
                    etat,
                    -20,
                    cible.nom,
                    [3]
                );

            }

            return;

        }


        /* ================================================
           5
           ================================================ */

        if (valeur === 5) {

            const nombre =
                2;

            for (
                let i = 0;
                i < nombre;
                i++
            ) {

                if (
                    Array.isArray(etat.paquet) &&
                    etat.paquet.length > 0
                ) {

                    /*
                     * Pour l'instant on ne révèle pas
                     * le contenu de la pioche.
                     *
                     * La recherche probabiliste sera
                     * ajoutée ensuite.
                     */

                    etat.paquet.pop();

                    joueur.main.push(
                        null
                    );

                }

            }

            return;

        }


        /* ================================================
           9
           ================================================ */

        if (valeur === 9) {

            const cible =
                trouverJoueurSimulation(
                    etat,
                    possibilite.cible
                );

            if (!cible) {
                return;
            }

            const mainJoueur =
                joueur.main;

            joueur.main =
                cible.main;

            cible.main =
                mainJoueur;

            return;

        }


        /* ================================================
           11
           ================================================ */

        if (valeur === 11) {

            if (
                possibilite.choix === "+10"
            ) {

                ajusterScore(
                    joueur,
                    10
                );

                ajouterCarteTable(
                    etat,
                    10,
                    joueur.nom,
                    [11]
                );

            }

            else if (
                possibilite.choix === "-10"
            ) {

                ajusterScore(
                    joueur,
                    -10
                );

                ajouterCarteTable(
                    etat,
                    -10,
                    joueur.nom,
                    [11]
                );

            }

            return;

        }


        /* ================================================
           13
           ================================================ */

        if (valeur === 13) {

            const cible =
                trouverJoueurSimulation(
                    etat,
                    possibilite.cible
                );

            if (!cible) {
                return;
            }

            /*
             * Si la carte est inconnue,
             * on ne l'invente pas.
             *
             * La simulation conserve simplement
             * l'incertitude pour l'étape probabiliste.
             */

            if (
                possibilite.metadata &&
                possibilite.metadata.carteCibleInconnue
            ) {
                return;
            }

            const carte =
                possibilite.carteCible;

            if (!carte) {
                return;
            }

            const index =
                etat.cartesTable.indexOf(
                    carte
                );

            if (index !== -1) {

                etat.cartesTable.splice(
                    index,
                    1
                );

                ajusterScore(
                    cible,
                    -carte.valeur
                );

                ajusterScore(
                    joueur,
                    carte.valeur
                );

                carte.proprietaire =
                    joueur.nom;

                etat.cartesTable.push(
                    carte
                );

            }

            return;

        }


        /* ================================================
           15
           ================================================ */

        if (valeur === 15) {

            const carte =
                possibilite.carteCible;

            if (!carte) {
                return;
            }

            const valeurCible =
                obtenirValeurCarte(
                    carte
                );

            if (
                valeurCible <= 0 ||
                valeurCible === 15
            ) {
                return;
            }

            const bonus =
                valeurCible;

            ajusterScore(
                joueur,
                bonus
            );

            ajouterCarteTable(
                etat,
                bonus,
                joueur.nom,
                [15, valeurCible]
            );

            return;

        }


        /* ================================================
           17
           ================================================ */

        if (valeur === 17) {

            /*
             * La carte volée est inconnue.
             *
             * Elle sera traitée par les scénarios
             * probabilistes dans la prochaine couche.
             */

            return;

        }


        /* ================================================
           19
           ================================================ */

        if (valeur === 19) {

            const cible =
                trouverJoueurSimulation(
                    etat,
                    possibilite.cible
                );

            if (!cible) {
                return;
            }

            const cartesJoueur =
                obtenirCartesPoints(
                    etat,
                    joueur.nom
                );

            const cartesCible =
                obtenirCartesPoints(
                    etat,
                    cible.nom
                );

            if (
                cartesJoueur.length === 0 ||
                cartesCible.length === 0
            ) {
                return;
            }

            const carteJoueur =
                cartesJoueur[
                    cartesJoueur.length - 1
                ];

            const carteCible =
                cartesCible[
                    cartesCible.length - 1
                ];

            const valeurJoueur =
                carteJoueur.valeur;

            const valeurCible =
                carteCible.valeur;

            carteJoueur.proprietaire =
                cible.nom;

            carteCible.proprietaire =
                joueur.nom;

            ajusterScore(
                joueur,
                valeurCible - valeurJoueur
            );

            ajusterScore(
                cible,
                valeurJoueur - valeurCible
            );

            return;

        }


        /* ================================================
           21
           ================================================ */

        if (valeur === 21) {

            if (
                possibilite.choix === "+20"
            ) {

                ajusterScore(
                    joueur,
                    20
                );

                ajouterCarteTable(
                    etat,
                    20,
                    joueur.nom,
                    [21]
                );

            }

            else if (
                possibilite.choix === "-20"
            ) {

                const cible =
                    trouverJoueurSimulation(
                        etat,
                        possibilite.cible
                    );

                if (cible) {

                    ajusterScore(
                        cible,
                        -20
                    );

                    ajouterCarteTable(
                        etat,
                        -20,
                        cible.nom,
                        [21]
                    );

                }

            }

            return;

        }


        /* ================================================
           JOKER
           ================================================ */

        if (
            typeof valeur === "string" &&
            valeur.toLowerCase() === "joker"
        ) {

            if (
                possibilite.choix === "10"
            ) {

                ajusterScore(
                    joueur,
                    10
                );

                ajouterCarteTable(
                    etat,
                    10,
                    joueur.nom,
                    ["joker"]
                );

            }

            else if (
                possibilite.choix === "22"
            ) {

                ajusterScore(
                    joueur,
                    22
                );

                ajouterCarteTable(
                    etat,
                    22,
                    joueur.nom,
                    ["joker"]
                );

            }

            else if (
                possibilite.choix === "echangeScores"
            ) {

                const cible =
                    trouverJoueurSimulation(
                        etat,
                        possibilite.cible
                    );

                simulerEchangeScores(
                    joueur,
                    cible
                );

            }

        }

    }


    function simulerDouble(
        possibilite,
        etat,
        joueur
    ) {

        const valeur =
            possibilite.valeur;


        /* ================================================
           DOUBLES À POINTS
           ================================================ */

        if (
            typeof valeur === "number" &&
            valeur % 2 === 0 &&
            valeur >= 2 &&
            valeur <= 20
        ) {

            const points =
                valeur * 2;

            ajusterScore(
                joueur,
                points
            );

            ajouterCarteTable(
                etat,
                points,
                joueur.nom,
                [valeur, valeur]
            );

            return;

        }


        /* ================================================
           DOUBLE 1
           ================================================ */

        if (valeur === 1) {

            const cible =
                trouverJoueurSimulation(
                    etat,
                    possibilite.cible
                );

            if (!cible) {
                return;
            }

            const cartes =
                obtenirCartesPoints(
                    etat,
                    cible.nom
                );

            const aVoler =
                cartes.slice(
                    Math.max(0, cartes.length - 2)
                );

            aVoler.forEach(carte => {

                carte.proprietaire =
                    joueur.nom;

                ajusterScore(
                    cible,
                    -carte.valeur
                );

                ajusterScore(
                    joueur,
                    carte.valeur
                );

            });

            return;

        }


        /* ================================================
           DOUBLE 3
           ================================================ */

        if (valeur === 3) {

            const cible =
                trouverJoueurSimulation(
                    etat,
                    possibilite.cible
                );

            if (cible) {

                ajusterScore(
                    cible,
                    -40
                );

                ajouterCarteTable(
                    etat,
                    -40,
                    cible.nom,
                    [3, 3]
                );

            }

            return;

        }


        /* ================================================
           DOUBLE 5
           ================================================ */

        if (valeur === 5) {

            for (
                let i = 0;
                i < 4;
                i++
            ) {

                if (
                    Array.isArray(etat.paquet) &&
                    etat.paquet.length > 0
                ) {

                    etat.paquet.pop();

                    joueur.main.push(
                        null
                    );

                }

            }

            return;

        }


        /* ================================================
           DOUBLE 9
           ================================================ */

        if (valeur === 9) {

            const cible =
                trouverJoueurSimulation(
                    etat,
                    possibilite.cible
                );

            if (!cible) {
                return;
            }

            const mainJoueur =
                joueur.main;

            joueur.main =
                cible.main;

            cible.main =
                mainJoueur;

            return;

        }


        /* ================================================
           DOUBLE 11
           ================================================ */

        if (valeur === 11) {

            if (
                possibilite.choix === "+20"
            ) {

                ajusterScore(
                    joueur,
                    20
                );

                ajouterCarteTable(
                    etat,
                    20,
                    joueur.nom,
                    [11, 11]
                );

            }

            else if (
                possibilite.choix === "-20"
            ) {

                ajusterScore(
                    joueur,
                    -20
                );

                ajouterCarteTable(
                    etat,
                    -20,
                    joueur.nom,
                    [11, 11]
                );

            }

            return;

        }


        /* ================================================
           DOUBLE 13
           ================================================ */

        if (valeur === 13) {

            /*
             * Les deux cartes volées restent dépendantes
             * de l'information disponible.
             *
             * Pour l'instant, si la main est cachée,
             * on conserve l'incertitude.
             */

            if (
                possibilite.metadata &&
                possibilite.metadata.carteCibleInconnue
            ) {
                return;
            }

            return;

        }


        /* ================================================
           DOUBLE 15
           ================================================ */

        if (valeur === 15) {

            const carte =
                possibilite.carteCible;

            if (!carte) {
                return;
            }

            const valeurCible =
                obtenirValeurCarte(
                    carte
                );

            if (
                valeurCible <= 0 ||
                valeurCible === 15
            ) {
                return;
            }

            const bonus =
                valeurCible * 2;

            ajusterScore(
                joueur,
                bonus
            );

            ajouterCarteTable(
                etat,
                bonus,
                joueur.nom,
                [15, 15, valeurCible]
            );

            return;

        }


        /* ================================================
           DOUBLE 17
           ================================================ */

        if (valeur === 17) {

            /*
             * Les deux cartes sont inconnues avant le vol.
             * Le moteur probabiliste les traitera plus tard.
             */

            return;

        }


        /* ================================================
           DOUBLE 19
           ================================================ */

        if (valeur === 19) {

            const cible =
                trouverJoueurSimulation(
                    etat,
                    possibilite.cible
                );

            if (!cible) {
                return;
            }

            const cartesJoueur =
                obtenirCartesPoints(
                    etat,
                    joueur.nom
                );

            const cartesCible =
                obtenirCartesPoints(
                    etat,
                    cible.nom
                );

            const nombre =
                Math.min(
                    cartesJoueur.length,
                    cartesCible.length,
                    2
                );

            for (
                let i = 0;
                i < nombre;
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
                    carteJoueur.valeur;

                const valeurCible =
                    carteCible.valeur;

                carteJoueur.proprietaire =
                    cible.nom;

                carteCible.proprietaire =
                    joueur.nom;

                ajusterScore(
                    joueur,
                    valeurCible -
                    valeurJoueur
                );

                ajusterScore(
                    cible,
                    valeurJoueur -
                    valeurCible
                );

            }

            return;

        }


        /* ================================================
           DOUBLE 21
           ================================================ */

        if (valeur === 21) {

            if (
                possibilite.choix === "+40"
            ) {

                ajusterScore(
                    joueur,
                    40
                );

                ajouterCarteTable(
                    etat,
                    40,
                    joueur.nom,
                    [21, 21]
                );

            }

            else if (
                possibilite.choix === "-40"
            ) {

                const cible =
                    trouverJoueurSimulation(
                        etat,
                        possibilite.cible
                    );

                if (cible) {

                    ajusterScore(
                        cible,
                        -40
                    );

                    ajouterCarteTable(
                        etat,
                        -40,
                        cible.nom,
                        [21, 21]
                    );

                }

            }

            return;

        }


        /* ================================================
           DOUBLE JOKER
           ================================================ */

        if (
            typeof valeur === "string" &&
            valeur.toLowerCase() === "joker"
        ) {

            /*
             * Effet temporaire.
             * Il sera représenté dans l'état simulé
             * lors de la prochaine étape de recherche.
             */

            etat.doubleJokerTours =
                (etat.doubleJokerTours || 0)
                + 2;

        }

    }


    function simulerPossibilite(
        possibilite,
        etat
    ) {

        const simulation =
            clonerEtatBot(etat);

        if (!simulation) {
            return null;
        }


        const joueur =
            trouverJoueurSimulation(
                simulation,
                possibilite.joueur ||
                etat.joueurActuel
            );


        /*
         * Si la possibilité ne possède pas encore
         * de référence joueur, on utilise le joueur
         * actuellement actif.
         */

        const joueurSimulation =
            joueur ||
            (
                Array.isArray(
                    simulation.joueurs
                )
                    ? simulation.joueurs[
                        simulation.joueurActuel
                    ]
                    : null
            );


        if (!joueurSimulation) {
            return simulation;
        }


        if (
            possibilite.type === "double"
        ) {

            simulerDouble(
                possibilite,
                simulation,
                joueurSimulation
            );

        }
        else {

            simulerCarteSimple(
                possibilite,
                simulation,
                joueurSimulation
            );

        }


        /*
         * Une action consomme les cartes jouées.
         * On le fait dans la copie, jamais dans la vraie partie.
         */

        if (
            Array.isArray(
                joueurSimulation.main
            )
        ) {

            const nombreCartes =
                possibilite.cartes
                    ? possibilite.cartes.length
                    : 1;

            /*
             * Pour les cartes représentées par null
             * dans une simulation probabiliste,
             * on retire simplement le nombre nécessaire.
             */

            for (
                let i = 0;
                i < nombreCartes;
                i++
            ) {

                if (
                    joueurSimulation.main.length > 0
                ) {

                    joueurSimulation.main.shift();

                }

            }

        }


        return simulation;

    }

    /* =====================================================
       API INTERNE DU MOTEUR
       ===================================================== */

    const BOT = {

        config: BOT_DIFFICULTES,

        coefficients: BOT_COEFFICIENTS,

        obtenirDifficulte:
            obtenirDifficulteBot,

        obtenirConfiguration:
            obtenirConfigurationDifficulte,

        obtenirEtat:
            obtenirEtatBot,

        construireConnaissance:
            construireConnaissanceBot,

        obtenirActionsLegales:
            obtenirActionsLegales,

        actionEstLegale:
            actionEstLegale,

        obtenirValeurCarte:
            obtenirValeurCarte,

        genererPossibilites:
            genererPossibilites,

        genererPossibilitesCarte:
            genererPossibilitesCarte,

        genererPossibilitesDouble:
            genererPossibilitesDouble,

        clonerEtat:
            clonerEtatBot,

        simulerPossibilite:
            simulerPossibilite,

        limiter,

        moyenne,

        valeurFinition

    };


    /* =====================================================
       EXPOSITION
       ===================================================== */

    globalThis.AtoumoulinBot = BOT;


    console.log(
        "Atoumoulin : nouveau moteur IA chargé."
    );

})();
