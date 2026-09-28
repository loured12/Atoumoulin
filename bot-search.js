// =====================================================
// ATOUMOULIN - BOT SEARCH
// Recherche en profondeur des conséquences
// =====================================================

(function () {

    const Simulator = window.AtoumoulinBotSimulator;
    const Decision = window.AtoumoulinBotDecision;
    const Possibilities = window.AtoumoulinBotPossibilities;

    if (!Simulator) {
        console.error("Atoumoulin : Bot Search nécessite Bot Simulator.");
        return;
    }

    if (!Decision) {
        console.error("Atoumoulin : Bot Search nécessite Bot Decision.");
        return;
    }

    // =====================================================
    // UTILITAIRES
    // =====================================================

    function clamp(valeur, min = 0, max = 100) {
        return Math.max(min, Math.min(max, Number(valeur) || 0));
    }

    function nombre(valeur, defaut = 0) {
        const n = Number(valeur);
        return Number.isFinite(n) ? n : defaut;
    }

    function moyenne(valeurs) {

        if (!Array.isArray(valeurs) || valeurs.length === 0) {
            return 0;
        }

        return valeurs.reduce(
            (total, valeur) => total + nombre(valeur),
            0
        ) / valeurs.length;
    }

    // =====================================================
    // NIVEAUX
    // =====================================================

    function normaliserNiveau(niveau) {

        const valeur = String(
            niveau || ""
        ).toLowerCase();

        if (
            valeur === "facile" ||
            valeur === "easy"
        ) {
            return "facile";
        }

        if (
            valeur === "normal" ||
            valeur === "medium" ||
            valeur === "moyen"
        ) {
            return "normal";
        }

        if (
            valeur === "difficile" ||
            valeur === "hard"
        ) {
            return "difficile";
        }

        if (
            valeur === "expert"
        ) {
            return "expert";
        }

        return "normal";
    }

    function obtenirProfondeurBase(niveau) {

        switch (normaliserNiveau(niveau)) {

            case "facile":
                return 1;

            case "normal":
                return 2;

            case "difficile":
                return 3;

            case "expert":
                return 3;

            default:
                return 2;
        }
    }

    // =====================================================
    // PROFONDEUR EXPERT
    // =====================================================

    function calculerProfondeurExpert(
        etat,
        possibilites
    ) {

        const nombrePossibilites =
            Array.isArray(possibilites)
                ? possibilites.length
                : 0;

        const joueur =
            Simulator.obtenirJoueurActuel(etat);

        const nombreCartes =
            joueur
                ? Simulator.obtenirMain(joueur).length
                : 0;

        /*
         * Plus il y a de choix, plus on évite
         * une explosion combinatoire.
         */

        if (nombrePossibilites <= 3) {
            return 5;
        }

        if (nombrePossibilites <= 6) {
            return 4;
        }

        if (nombrePossibilites <= 10) {
            return 3;
        }

        if (nombrePossibilites <= 16) {
            return 2;
        }

        if (nombreCartes <= 3) {
            return 3;
        }

        return 2;
    }

    function obtenirProfondeur(
        niveau,
        etat,
        possibilites
    ) {

        const normalise =
            normaliserNiveau(niveau);

        if (normalise !== "expert") {
            return obtenirProfondeurBase(normalise);
        }

        return calculerProfondeurExpert(
            etat,
            possibilites
        );
    }

    // =====================================================
    // JOUEUR ACTUEL
    // =====================================================

    function obtenirJoueurActif(etat) {

        if (!etat) {
            return null;
        }

        return Simulator.obtenirJoueurActuel(etat);
    }

    // =====================================================
    // POSSIBILITÉS
    // =====================================================

    function genererPossibilites(etat) {

        if (!Possibilities) {
            return [];
        }

        if (
            typeof Possibilities.genererToutesPossibilites ===
            "function"
        ) {
            return Possibilities.genererToutesPossibilites(
                etat
            ) || [];
        }

        /*
         * Compatibilité avec différentes versions
         * du moteur de possibilités.
         */

        if (
            typeof Possibilities.genererPossibilites ===
            "function"
        ) {
            return Possibilities.genererPossibilites(
                etat
            ) || [];
        }

        return [];
    }

    // =====================================================
    // ÉTAT TERMINAL
    // =====================================================

    function estEtatVictoire(etat) {

        if (!etat) {
            return false;
        }

        if (
            etat.partieTerminee === true ||
            etat.mancheTerminee === true ||
            etat.victoire === true
        ) {
            return true;
        }

        const cible =
            Decision.obtenirCibleEtat
                ? Decision.obtenirCibleEtat(etat)
                : 0;

        if (cible <= 0) {
            return false;
        }

        const joueur =
            obtenirJoueurActif(etat);

        if (!joueur) {
            return false;
        }

        return nombre(joueur.score) === cible;
    }

    // =====================================================
    // VALEUR TERMINALE
    // =====================================================

    function evaluerEtatTerminal(
        etat,
        joueurReference
    ) {

        if (!etat) {
            return -Infinity;
        }

        const joueur =
            joueurReference
                ? Simulator.trouverJoueur(
                    etat,
                    joueurReference
                )
                : obtenirJoueurActif(etat);

        if (!joueur) {
            return Decision.evaluerEtat(etat);
        }

        const cible =
            Decision.obtenirCibleEtat
                ? Decision.obtenirCibleEtat(etat)
                : 0;

        if (
            cible > 0 &&
            nombre(joueur.score) === cible
        ) {
            return 1000000;
        }

        return Decision.evaluerEtat(
            etat,
            joueur
        );
    }

    // =====================================================
    // IDENTIFIANT JOUEUR
    // =====================================================

    function obtenirIdentifiantJoueur(
        etat,
        joueur
    ) {

        if (!joueur) {
            return null;
        }

        if (
            typeof Simulator.obtenirReferenceJoueur ===
            "function"
        ) {
            return Simulator.obtenirReferenceJoueur(
                joueur
            );
        }

        if (
            joueur.index !== undefined &&
            joueur.index !== null
        ) {
            return {
                index: joueur.index,
                nom: joueur.nom
            };
        }

        return {
            nom: joueur.nom
        };
    }

    // =====================================================
    // LE JOUEUR EST-IL LE BOT ?
    // =====================================================

    function estNotreJoueur(
        joueur,
        joueurReference
    ) {

        if (!joueur || !joueurReference) {
            return false;
        }

        if (
            joueur.index !== undefined &&
            joueurReference.index !== undefined
        ) {
            return joueur.index === joueurReference.index;
        }

        return joueur.nom === joueurReference.nom;
    }

    // =====================================================
    // SIMULATION D'UNE POSSIBILITÉ
    // =====================================================

    function simulerPossibilite(
        etat,
        possibilite
    ) {

        if (
            typeof Simulator.simulerAvecScenarios ===
            "function"
        ) {

            return Simulator.simulerAvecScenarios(
                etat,
                possibilite
            ) || [];
        }

        if (
            typeof Simulator.simuler ===
            "function"
        ) {

            return [
                {
                    etat: Simulator.simuler(
                        etat,
                        possibilite
                    ),
                    probabilite: 1
                }
            ];
        }

        return [];
    }

    // =====================================================
    // PROBABILITÉS
    // =====================================================

    function obtenirProbabilite(
        scenario
    ) {

        if (!scenario) {
            return 0;
        }

        if (
            scenario.probabilite !== undefined
        ) {
            return nombre(
                scenario.probabilite
            );
        }

        if (
            scenario.probability !== undefined
        ) {
            return nombre(
                scenario.probability
            );
        }

        return 1;
    }

    // =====================================================
    // ÉVALUATION D'UNE BRANCHE
    // =====================================================

    function evaluerScenario(
        scenario,
        joueurReference,
        profondeurRestante,
        contexte
    ) {

        if (!scenario) {
            return -Infinity;
        }

        const etat =
            scenario.etat ||
            scenario.state;

        if (!etat) {
            return -Infinity;
        }

        /*
         * Victoire immédiate :
         * on ne cherche pas inutilement plus loin.
         */

        if (estEtatVictoire(etat)) {

            return evaluerEtatTerminal(
                etat,
                joueurReference
            );
        }

        if (profondeurRestante <= 0) {

            return Decision.evaluerEtat(
                etat,
                joueurReference
            );
        }

        return rechercherEtat(
            etat,
            joueurReference,
            profondeurRestante,
            contexte
        );
    }

    // =====================================================
    // RECHERCHE D'UN ÉTAT
    // =====================================================

    function rechercherEtat(
        etat,
        joueurReference,
        profondeur,
        contexte = {}
    ) {

        if (!etat) {
            return -Infinity;
        }

        if (estEtatVictoire(etat)) {

            return evaluerEtatTerminal(
                etat,
                joueurReference
            );
        }

        const joueurActuel =
            obtenirJoueurActif(etat);

        if (!joueurActuel) {
            return Decision.evaluerEtat(
                etat,
                joueurReference
            );
        }

        const possibilites =
            genererPossibilites(etat);

        if (
            !Array.isArray(possibilites) ||
            possibilites.length === 0
        ) {
            return Decision.evaluerEtat(
                etat,
                joueurReference
            );
        }

        const nous =
            estNotreJoueur(
                joueurActuel,
                joueurReference
            );

        const valeurs = [];

        for (const possibilite of possibilites) {

            const scenarios =
                simulerPossibilite(
                    etat,
                    possibilite
                );

            if (
                !Array.isArray(scenarios) ||
                scenarios.length === 0
            ) {
                continue;
            }

            let valeurScenario = 0;
            let sommeProbabilites = 0;

            for (const scenario of scenarios) {

                const probabilite =
                    obtenirProbabilite(
                        scenario
                    );

                const valeur =
                    evaluerScenario(
                        scenario,
                        joueurReference,
                        profondeur - 1,
                        contexte
                    );

                valeurScenario +=
                    valeur * probabilite;

                sommeProbabilites +=
                    probabilite;
            }

            if (sommeProbabilites > 0) {

                valeurScenario /=
                    sommeProbabilites;
            }

            valeurs.push({
                possibilite,
                valeur: valeurScenario
            });
        }

        if (valeurs.length === 0) {
            return Decision.evaluerEtat(
                etat,
                joueurReference
            );
        }

        /*
         * Notre tour :
         * on maximise.
         *
         * Tour adverse :
         * on considère que l'adversaire cherche
         * à maximiser sa propre position,
         * donc à minimiser la nôtre.
         *
         * IMPORTANT :
         * cette partie suppose que le générateur
         * de possibilités respecte les informations
         * accessibles au joueur concerné.
         */

        valeurs.sort(
            (a, b) =>
                b.valeur - a.valeur
        );

        if (nous) {
            return valeurs[0].valeur;
        }

        return valeurs[valeurs.length - 1].valeur;
    }

    // =====================================================
    // ÉVALUATION D'UNE ACTION AVEC PROFONDEUR
    // =====================================================

    function evaluerPossibiliteProfondeur(
        etat,
        possibilite,
        joueurReference,
        profondeur,
        contexte = {}
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
            return -Infinity;
        }

        let total = 0;
        let totalProbabilite = 0;

        for (const scenario of scenarios) {

            const probabilite =
                obtenirProbabilite(
                    scenario
                );

            const valeur =
                evaluerScenario(
                    scenario,
                    joueurReference,
                    profondeur - 1,
                    contexte
                );

            total +=
                valeur * probabilite;

            totalProbabilite +=
                probabilite;
        }

        if (totalProbabilite <= 0) {
            return -Infinity;
        }

        return total / totalProbabilite;
    }

    // =====================================================
    // ANALYSE COMPLÈTE
    // =====================================================

    function analyserRecherche(
        etat,
        possibilites,
        niveau,
        joueurReference
    ) {

        if (
            !Array.isArray(possibilites) ||
            possibilites.length === 0
        ) {
            return [];
        }

        const profondeur =
            obtenirProfondeur(
                niveau,
                etat,
                possibilites
            );

        const resultats = [];

        for (const possibilite of possibilites) {

            const valeur =
                evaluerPossibiliteProfondeur(
                    etat,
                    possibilite,
                    joueurReference,
                    profondeur
                );

            resultats.push({
                possibilite,
                valeur,
                profondeur
            });
        }

        resultats.sort(
            (a, b) =>
                b.valeur - a.valeur
        );

        return resultats;
    }

    // =====================================================
    // MEILLEURE ACTION
    // =====================================================

    function rechercherMeilleureAction(
        etat,
        niveau,
        possibilites = null
    ) {

        const joueur =
            obtenirJoueurActif(etat);

        if (!joueur) {
            return null;
        }

        const joueurReference =
            obtenirIdentifiantJoueur(
                etat,
                joueur
            );

        const choix =
            Array.isArray(possibilites)
                ? possibilites
                : genererPossibilites(etat);

        const analyses =
            analyserRecherche(
                etat,
                choix,
                niveau,
                joueurReference
            );

        if (analyses.length === 0) {
            return null;
        }

        return analyses[0];
    }

    // =====================================================
    // API PUBLIQUE
    // =====================================================

    window.AtoumoulinBotSearch = {

        version: 1,

        normaliserNiveau,

        obtenirProfondeurBase,
        obtenirProfondeur,

        genererPossibilites,

        estEtatVictoire,

        rechercherEtat,

        evaluerPossibiliteProfondeur,

        analyserRecherche,

        rechercherMeilleureAction
    };

    console.log(
        "Atoumoulin : Bot Search v1 chargé."
    );

})();
