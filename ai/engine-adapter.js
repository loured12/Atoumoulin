/**
 * Atoumoulin AI
 * engine-adapter.js
 *
 * Pont entre :
 *
 *   nouvelle IA
 *      ↓
 *   action complète
 *      ↓
 *   moteur script.js
 *
 * IMPORTANT :
 * - Ne modifie pas script.js.
 * - N'utilise pas runBotTurn().
 * - L'ancien bot reste donc intact.
 * - Chaque étape est exécutée par les fonctions officielles
 *   déjà présentes dans le moteur.
 */

function asNumber(value, fallback = null) {
    const n = Number(value);
    return Number.isFinite(n) ? n : fallback;
}

function getCardValue(action) {
    return action?.card?.value ??
        action?.cardValue ??
        action?.card ??
        null;
}

function getCardIndex(action) {
    return action?.cardIndex ??
        action?.index ??
        null;
}

function getDoubleIndices(action) {
    if (Array.isArray(action?.indices)) {
        return action.indices.slice();
    }

    if (Array.isArray(action?.cardIndices)) {
        return action.cardIndices.slice();
    }

    if (Array.isArray(action?.selectedIndices)) {
        return action.selectedIndices.slice();
    }

    return [];
}

function getTarget(action) {
    return action?.target ??
        action?.targetPlayer ??
        action?.playerTarget ??
        null;
}

function getTableCardIndex(action) {
    return action?.tableCardIndex ??
        action?.cardIndexTable ??
        action?.tableIndex ??
        null;
}

function getTableCardIndices(action) {
    if (Array.isArray(action?.tableCardIndices)) {
        return action.tableCardIndices.slice();
    }

    return [];
}

function getEffect(action) {
    return action?.effect ?? null;
}

function getValue(action) {
    return action?.value ?? null;
}

function isDoubleAction(action) {
    return (
        action?.type === "play_double" ||
        action?.metadata?.double === true ||
        String(action?.id ?? "").startsWith("double")
    );
}

function isSamePlayerTarget(target, playerIndex) {
    return (
        target !== null &&
        target !== undefined &&
        Number(target) === Number(playerIndex)
    );
}

export class AtoumoulinEngineAdapter {

    constructor(engine, {
        strict = true,
        autoResolve = true
    } = {}) {
        if (!engine) {
            throw new Error(
                "AtoumoulinEngineAdapter : moteur manquant."
            );
        }

        this.engine = engine;
        this.strict = strict;
        this.autoResolve = autoResolve;
    }

    state(viewIndex = null) {
        const index =
            viewIndex === null
                ? this.engine.currentIndex()
                : Number(viewIndex);

        return this.engine.stateFor(index);
    }

    setPlayer(playerIndex) {
        this.engine.setPlayerIndex(Number(playerIndex));
    }

    apply(fn, args = [], playerIndex = null) {
        if (playerIndex !== null && playerIndex !== undefined) {
            this.setPlayer(playerIndex);
        }

        return this.engine.apply(fn, args);
    }

    selectCard(index, playerIndex) {
        return this.engine.selectCard(
            Number(index),
            Number(playerIndex)
        );
    }

    selectDouble(indexes, playerIndex) {
        const indices = Array.isArray(indexes)
            ? indexes.slice()
            : [];

        if (indices.length !== 2) {
            throw new Error(
                "Une action Double doit contenir exactement 2 indices."
            );
        }

        this.setPlayer(playerIndex);

        /*
         * Le moteur possède déjà la logique de sélection
         * automatique d'un double dans selectionnerCarte().
         *
         * On sélectionne donc la première occurrence.
         */
        return this.engine.selectCard(
            Number(indices[0]),
            Number(playerIndex)
        );
    }

    playSelectedCard(playerIndex) {
        return this.apply(
            "jouerCarte",
            [],
            playerIndex
        );
    }

    /**
     * Exécute l'action complète choisie par la nouvelle IA.
     */
    execute(action, playerIndex) {
        if (!action) {
            throw new Error(
                "AtoumoulinEngineAdapter : action absente."
            );
        }

        const player = Number(playerIndex);

        if (!Number.isInteger(player)) {
            throw new Error(
                "AtoumoulinEngineAdapter : playerIndex invalide."
            );
        }

        if (
            isSamePlayerTarget(getTarget(action), player)
        ) {
            throw new Error(
                "Une action ne peut pas cibler le joueur lui-même."
            );
        }

        switch (action.type) {

            case "play_card":
            case "play_double":
                return this.executePlay(action, player);

            case "target":
                return this.executeTargetAction(action, player);

            case "table_card":
                return this.executeTableCardAction(action, player);

            case "table_cards":
                return this.executeTableCardsAction(action, player);

            case "effect":
                return this.executeEffectAction(action, player);

            case "continue":
                return this.executeContinueAction(action, player);

            case "terminate":
                return this.executeTerminateAction(action, player);

            default:
                throw new Error(
                    `Type d'action non supporté : ${action.type}`
                );
        }
    }

    /**
     * Première étape :
     *
     * sélection de la carte
     * →
     * jouerCarte()
     * →
     * résolution du pouvoir.
     */
    executePlay(action, playerIndex) {

        const card = getCardValue(action);

        if (
            card === null ||
            card === undefined
        ) {
            throw new Error(
                "Impossible de jouer une action sans carte."
            );
        }

        const double = isDoubleAction(action);
        const indices = getDoubleIndices(action);

        if (double) {

            if (indices.length === 2) {
                this.selectDouble(
                    indices,
                    playerIndex
                );
            } else if (getCardIndex(action) !== null) {
                /*
                 * selectionnerCarte() détecte elle-même
                 * qu'il s'agit d'un double et sélectionne
                 * les deux cartes.
                 */
                this.selectCard(
                    getCardIndex(action),
                    playerIndex
                );
            } else {
                throw new Error(
                    `Double ${card} sans indices de main.`
                );
            }

        } else {

            const index = getCardIndex(action);

            if (index === null || index === undefined) {
                throw new Error(
                    `Carte ${card} sans cardIndex.`
                );
            }

            this.selectCard(
                index,
                playerIndex
            );
        }

        /*
         * jouerCarte() est la seule porte d'entrée du moteur
         * pour jouer réellement la carte.
         */
        let state = this.playSelectedCard(
            playerIndex
        );

        if (!this.autoResolve) {
            return state;
        }

        /*
         * Les cartes paires simples et certains cas de fin
         * terminent déjà le tour dans jouerCarte().
         *
         * Les pouvoirs impairs laissent actionEnCours
         * avec le choix correspondant.
         */
        return this.resolvePendingAction(
            action,
            playerIndex,
            state
        );
    }

    /**
     * Résolution d'une action déjà engagée dans le moteur.
     */
    resolvePendingAction(
        originalAction,
        playerIndex,
        state = null
    ) {
        let current =
            state ??
            this.state(playerIndex);

        const action = current?.action;

        if (!action) {
            return current;
        }

        const card = getCardValue(originalAction);
        const target = getTarget(originalAction);
        const effect = getEffect(originalAction);
        const value = getValue(originalAction);
        const tableCardIndex =
            getTableCardIndex(originalAction);

        /*
         * --------------------------------------------------
         * 1
         * --------------------------------------------------
         */
        if (action === "vol1") {
            this.requireTarget(target, originalAction);
            return this.apply(
                "choisirAdversaireVol1",
                [Number(target)],
                playerIndex
            );
        }

        if (action === "double1") {
            this.requireTarget(target, originalAction);
            return this.apply(
                "choisirAdversaireDouble1",
                [Number(target)],
                playerIndex
            );
        }

        /*
         * --------------------------------------------------
         * 3
         * --------------------------------------------------
         */
        if (action === "carte3") {
            this.requireTarget(target, originalAction);
            return this.apply(
                "choisirAdversaireCarte3",
                [Number(target)],
                playerIndex
            );
        }

        if (action === "double3") {
            this.requireTarget(target, originalAction);
            return this.apply(
                "choisirAdversaireDouble3",
                [Number(target)],
                playerIndex
            );
        }

        /*
         * --------------------------------------------------
         * 9
         * --------------------------------------------------
         */
        if (action === "carte9") {
            this.requireTarget(target, originalAction);
            return this.apply(
                "choisirAdversaireCarte9",
                [Number(target)],
                playerIndex
            );
        }

        if (action === "double9") {
            this.requireTarget(target, originalAction);
            return this.apply(
                "choisirAdversaireDouble9",
                [Number(target)],
                playerIndex
            );
        }

        /*
         * --------------------------------------------------
         * 11
         * --------------------------------------------------
         */
        if (action === "carte11") {
            const chosenValue =
                value === 10 || value === -10
                    ? value
                    : effect === "score_self_negative"
                        ? -10
                        : 10;

            return this.apply(
                "effetCarte11",
                [chosenValue],
                playerIndex
            );
        }

        if (action === "double11") {
            const chosenValue =
                value === 20 || value === -20
                    ? value
                    : effect === "score_self_negative"
                        ? -20
                        : 20;

            return this.apply(
                "effetDouble11",
                [chosenValue],
                playerIndex
            );
        }

        /*
         * --------------------------------------------------
         * 13
         * --------------------------------------------------
         */
        if (action === "carte13") {
            this.requireTarget(target, originalAction);

            return this.apply(
                "choisirAdversaireCarte13",
                [Number(target)],
                playerIndex
            );
        }

        if (action === "carte13choix") {
            if (tableCardIndex === null) {
                throw new Error(
                    "13 : tableCardIndex manquant."
                );
            }

            return this.apply(
                "volerCarte13",
                [Number(tableCardIndex)],
                playerIndex
            );
        }

        if (action === "double13") {
            this.requireTarget(target, originalAction);

            return this.apply(
                "choisirAdversaireDouble13",
                [Number(target)],
                playerIndex
            );
        }

        if (action === "double13choix") {

            const indices =
                getTableCardIndices(originalAction);

            if (indices.length === 0) {
                return this.apply(
                    "terminerDouble13",
                    [],
                    playerIndex
                );
            }

            /*
             * Le moteur attend une sélection via carteChoisie.
             * L'engine expose selectDouble13().
             */
            this.setPlayer(playerIndex);

            for (const index of indices.slice(0, 2)) {
                this.engine.sandbox.__atoumoulinSetSelection(
                    index
                );
            }

            /*
             * Sécurité : le moteur possède une fonction
             * de sélection dédiée, mais la résolution finale
             * se fait par volerCartesDouble13().
             */
            this.engine.sandbox.__atoumoulinSetSelection(
                indices.slice(0, 2)
            );

            return this.apply(
                "volerCartesDouble13",
                [],
                playerIndex
            );
        }

        /*
         * --------------------------------------------------
         * 15
         * --------------------------------------------------
         */
        if (action === "carte15") {

            if (tableCardIndex === null) {
                throw new Error(
                    "15 : tableCardIndex manquant."
                );
            }

            return this.apply(
                "doublerCarte15",
                [Number(tableCardIndex)],
                playerIndex
            );
        }

        if (action === "double15") {

            if (tableCardIndex === null) {
                throw new Error(
                    "Double 15 : tableCardIndex manquant."
                );
            }

            return this.apply(
                "triplerCarte15",
                [Number(tableCardIndex)],
                playerIndex
            );
        }

        /*
         * --------------------------------------------------
         * 17
         * --------------------------------------------------
         */
        if (action === "carte17") {
            this.requireTarget(target, originalAction);

            return this.apply(
                "choisirAdversaireCarte17",
                [Number(target)],
                playerIndex
            );
        }

        /*
         * Le 17 a tiré une carte cachée.
         * Le moteur la révèle.
         *
         * La décision sur la carte révélée peut alors être
         * fournie à nouveau par l'IA.
         */
        if (action === "carte17revelee") {

            if (
                originalAction?.metadata?.cancel === true
            ) {
                return this.apply(
                    "terminer17SansCarte",
                    [],
                    playerIndex
                );
            }

            return this.apply(
                "continuerCarte17",
                [],
                playerIndex
            );
        }

        /*
         * --------------------------------------------------
         * Double 17
         * --------------------------------------------------
         */
        if (action === "double17") {
            this.requireTarget(target, originalAction);

            return this.apply(
                "choisirAdversaireDouble17",
                [Number(target)],
                playerIndex
            );
        }

        if (action === "double17revelee") {

            const revealedIndex =
                originalAction?.cardIndex ??
                originalAction?.metadata?.revealedIndex;

            if (
                revealedIndex === null ||
                revealedIndex === undefined
            ) {
                throw new Error(
                    "Double 17 : index de carte révélée manquant."
                );
            }

            return this.apply(
                "choisirCarteDouble17",
                [Number(revealedIndex)],
                playerIndex
            );
        }

        if (action === "double17jouer") {
            return this.apply(
                "continuerDouble17",
                [],
                playerIndex
            );
        }

        /*
         * --------------------------------------------------
         * 19
         * --------------------------------------------------
         */
        if (action === "carte19") {
            this.requireTarget(target, originalAction);

            return this.apply(
                "choisirAdversaireCarte19",
                [Number(target)],
                playerIndex
            );
        }

        if (action === "double19") {
            this.requireTarget(target, originalAction);

            return this.apply(
                "choisirAdversaireDouble19",
                [Number(target)],
                playerIndex
            );
        }

        /*
         * --------------------------------------------------
         * 21
         * --------------------------------------------------
         */
        if (action === "carte21") {

            const chosenValue =
                value === 20 || value === -20
                    ? value
                    : effect === "score_target"
                        ? -20
                        : 20;

            return this.apply(
                "effetCarte21",
                [chosenValue],
                playerIndex
            );
        }

        if (action === "carte21cible") {
            this.requireTarget(target, originalAction);

            return this.apply(
                "cibleCarte21",
                [Number(target)],
                playerIndex
            );
        }

        if (action === "double21") {

            const chosenValue =
                value === 40 || value === -40
                    ? value
                    : effect === "score_target"
                        ? -40
                        : 40;

            return this.apply(
                "effetDouble21",
                [chosenValue],
                playerIndex
            );
        }

        if (action === "double21cible") {
            this.requireTarget(target, originalAction);

            return this.apply(
                "cibleDouble21",
                [Number(target)],
                playerIndex
            );
        }

        /*
         * --------------------------------------------------
         * Joker
         * --------------------------------------------------
         */
        if (action === "joker") {

            if (
                effect === "exchange_scores"
            ) {
                return this.apply(
                    "effetJoker",
                    ["echange"],
                    playerIndex
                );
            }

            const jokerValue =
                value === 22
                    ? 22
                    : 10;

            return this.apply(
                "effetJoker",
                [jokerValue],
                playerIndex
            );
        }

        if (action === "jokerCible") {
            this.requireTarget(target, originalAction);

            return this.apply(
                "echangeJoker",
                [Number(target)],
                playerIndex
            );
        }

        /*
         * --------------------------------------------------
         * Fins explicites
         * --------------------------------------------------
         */
        if (action === "terminerDouble13") {
            return this.apply(
                "terminerDouble13",
                [],
                playerIndex
            );
        }

        if (action === "terminerDouble15") {
            return this.apply(
                "terminerDouble15",
                [],
                playerIndex
            );
        }

        if (action === "terminer17SansCarte") {
            return this.apply(
                "terminer17SansCarte",
                [],
                playerIndex
            );
        }

        /*
         * Le moteur a déjà terminé l'action.
         */
        return current;
    }

    executeTargetAction(action, playerIndex) {
        const target = getTarget(action);
        const current = this.state(playerIndex);

        /*
         * Une action TARGET peut être :
         *
         * - une action en attente après jouerCarte()
         * - une action complète construite par le générateur.
         */
        return this.resolvePendingAction(
            action,
            playerIndex,
            current
        );
    }

    executeTableCardAction(action, playerIndex) {
        return this.resolvePendingAction(
            action,
            playerIndex,
            this.state(playerIndex)
        );
    }

    executeTableCardsAction(action, playerIndex) {
        return this.resolvePendingAction(
            action,
            playerIndex,
            this.state(playerIndex)
        );
    }

    executeEffectAction(action, playerIndex) {
        return this.resolvePendingAction(
            action,
            playerIndex,
            this.state(playerIndex)
        );
    }

    executeContinueAction(action, playerIndex) {
        return this.resolvePendingAction(
            action,
            playerIndex,
            this.state(playerIndex)
        );
    }

    executeTerminateAction(action, playerIndex) {
        return this.resolvePendingAction(
            action,
            playerIndex,
            this.state(playerIndex)
        );
    }

    requireTarget(target, action) {
        if (
            target === null ||
            target === undefined
        ) {
            throw new Error(
                `Action ${action?.id ?? "inconnue"} : cible manquante.`
            );
        }
    }

    /**
     * Exécute une ligne complète d'actions.
     *
     * Utile lorsque le search retourne plusieurs étapes.
     */
    executeLine(actions, playerIndex) {

        if (!Array.isArray(actions)) {
            throw new Error(
                "executeLine attend un tableau d'actions."
            );
        }

        let state = null;

        for (const action of actions) {
            state = this.execute(
                action,
                playerIndex
            );
        }

        return state;
    }

    /**
     * Mode sécurisé :
     * tente l'action et retourne un résultat exploitable
     * sans casser la partie.
     */
    tryExecute(action, playerIndex) {

        try {

            const state = this.execute(
                action,
                playerIndex
            );

            return {
                ok: true,
                action,
                state,
                error: null
            };

        } catch (error) {

            if (this.strict) {
                throw error;
            }

            return {
                ok: false,
                action,
                state: this.state(playerIndex),
                error
            };
        }
    }
}

export function createEngineAdapter(
    engine,
    options = {}
) {
    return new AtoumoulinEngineAdapter(
        engine,
        options
    );
}

export function executeEngineAction(
    engine,
    action,
    playerIndex,
    options = {}
) {
    const adapter =
        new AtoumoulinEngineAdapter(
            engine,
            options
        );

    return adapter.execute(
        action,
        playerIndex
    );
}

export default AtoumoulinEngineAdapter;
