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
 * - N'utilise jamais runBotTurn().
 * - L'ancien bot reste intact.
 * - Une action de l'IA est traduite en appels
 *   aux fonctions officielles du moteur.
 *
 * Principe :
 *
 *   IA choisit une action complète
 *          ↓
 *   adapter déroule les étapes déterministes
 *          ↓
 *   arrêt dès qu'une nouvelle décision IA
 *   est nécessaire
 */

function getCardValue(action) {
    return (
        action?.card?.value ??
        action?.cardValue ??
        action?.card ??
        null
    );
}

function getCardIndex(action) {
    return (
        action?.cardIndex ??
        action?.index ??
        null
    );
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
    return (
        action?.target ??
        action?.targetPlayer ??
        action?.playerTarget ??
        null
    );
}

function getTableCardIndex(action) {
    return (
        action?.tableCardIndex ??
        action?.cardIndexTable ??
        action?.tableIndex ??
        null
    );
}

function getTableCardIndices(action) {
    if (Array.isArray(action?.tableCardIndices)) {
        return action.tableCardIndices.slice();
    }

    return [];
}

function getOwnTableCardIndex(action) {
    return (
        action?.ownTableCardIndex ??
        action?.metadata?.ownTableCardIndex ??
        null
    );
}

function getTargetTableCardIndex(action) {
    return (
        action?.targetTableCardIndex ??
        action?.metadata?.targetTableCardIndex ??
        null
    );
}

function getOwnTableCardIndices(action) {
    if (Array.isArray(action?.ownTableCardIndices)) {
        return action.ownTableCardIndices.slice();
    }

    if (Array.isArray(action?.metadata?.ownTableCardIndices)) {
        return action.metadata.ownTableCardIndices.slice();
    }

    return [];
}

function getTargetTableCardIndices(action) {
    if (Array.isArray(action?.targetTableCardIndices)) {
        return action.targetTableCardIndices.slice();
    }

    if (Array.isArray(action?.metadata?.targetTableCardIndices)) {
        return action.metadata.targetTableCardIndices.slice();
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
        action?.metadata?.double === true
    );
}

function samePlayer(a, b) {
    return (
        a !== null &&
        a !== undefined &&
        Number(a) === Number(b)
    );
}

function isActionWaiting(state) {
    return Boolean(
        state &&
        state.action !== null &&
        state.action !== undefined
    );
}


/* =========================================================
 * ADAPTATEUR
 * ========================================================= */

export class AtoumoulinEngineAdapter {

    constructor(
        engine,
        {
            strict = true,
            autoResolve = true
        } = {}
    ) {
        if (!engine) {
            throw new Error(
                "AtoumoulinEngineAdapter : moteur manquant."
            );
        }

        this.engine = engine;
        this.strict = strict;
        this.autoResolve = autoResolve;
    }


    /* =====================================================
     * ÉTAT
     * ===================================================== */

    state(viewIndex = null) {
        const index =
            viewIndex === null
                ? this.engine.currentIndex()
                : Number(viewIndex);

        return this.engine.stateFor(index);
    }


    currentState(playerIndex) {
        return this.state(playerIndex);
    }


    /* =====================================================
     * JOUEUR
     * ===================================================== */

    setPlayer(playerIndex) {
        this.engine.setPlayerIndex(
            Number(playerIndex)
        );
    }


    /* =====================================================
     * APPEL MOTEUR
     * ===================================================== */

    apply(
        fn,
        args = [],
        playerIndex = null
    ) {
        if (
            playerIndex !== null &&
            playerIndex !== undefined
        ) {
            this.setPlayer(playerIndex);
        }

        return this.engine.apply(
            fn,
            args
        );
    }


    /* =====================================================
     * SÉLECTIONS
     * ===================================================== */

    selectCard(
        index,
        playerIndex
    ) {
        if (
            index === null ||
            index === undefined
        ) {
            throw new Error(
                "Index de carte manquant."
            );
        }

        return this.engine.selectCard(
            Number(index),
            Number(playerIndex)
        );
    }


    selectDouble(
        indices,
        playerIndex
    ) {
        if (
            !Array.isArray(indices) ||
            indices.length !== 2
        ) {
            throw new Error(
                "Un double doit contenir exactement 2 indices."
            );
        }

        /*
         * selectionnerCarte() du moteur reconnaît
         * automatiquement qu'une carte sélectionnée
         * possède une seconde occurrence.
         *
         * On utilise donc le premier index canonique
         * fourni par la nouvelle IA.
         */
        return this.selectCard(
            indices[0],
            playerIndex
        );
    }


    /* =====================================================
     * JOUER LA CARTE
     * ===================================================== */

    playSelectedCard(playerIndex) {
        return this.apply(
            "jouerCarte",
            [],
            playerIndex
        );
    }


    executePlay(
        action,
        playerIndex
    ) {
        const card =
            getCardValue(action);

        if (
            card === null ||
            card === undefined
        ) {
            throw new Error(
                "Impossible de jouer une action sans carte."
            );
        }

        const double =
            isDoubleAction(action);

        const indices =
            getDoubleIndices(action);

        if (double) {

            if (indices.length === 2) {

                this.selectDouble(
                    indices,
                    playerIndex
                );

            } else {

                const index =
                    getCardIndex(action);

                if (
                    index === null ||
                    index === undefined
                ) {
                    throw new Error(
                        `Double ${card} sans indices de main.`
                    );
                }

                this.selectCard(
                    index,
                    playerIndex
                );
            }

        } else {

            const index =
                getCardIndex(action);

            if (
                index === null ||
                index === undefined
            ) {
                throw new Error(
                    `Carte ${card} sans cardIndex.`
                );
            }

            this.selectCard(
                index,
                playerIndex
            );
        }

        const state =
            this.playSelectedCard(
                playerIndex
            );

        if (!this.autoResolve) {
            return state;
        }

        return this.resolvePendingAction(
            action,
            playerIndex,
            state
        );
    }


    /* =====================================================
     * ACTION COMPLÈTE
     * ===================================================== */

    execute(
        action,
        playerIndex
    ) {
        if (!action) {
            throw new Error(
                "AtoumoulinEngineAdapter : action absente."
            );
        }

        const player =
            Number(playerIndex);

        if (!Number.isInteger(player)) {
            throw new Error(
                "playerIndex invalide."
            );
        }

        const target =
            getTarget(action);

        if (
            samePlayer(
                target,
                player
            )
        ) {
            throw new Error(
                "Une action ne peut pas cibler le joueur lui-même."
            );
        }

        switch (action.type) {

            case "play_card":
            case "play_double":
                return this.executePlay(
                    action,
                    player
                );

            case "target":
                return this.executeTargetAction(
                    action,
                    player
                );

            case "table_card":
                return this.executeTableCardAction(
                    action,
                    player
                );

            case "table_cards":
                return this.executeTableCardsAction(
                    action,
                    player
                );

            case "effect":
                return this.executeEffectAction(
                    action,
                    player
                );

            case "continue":
                return this.executeContinueAction(
                    action,
                    player
                );

            case "terminate":
                return this.executeTerminateAction(
                    action,
                    player
                );

            default:
                throw new Error(
                    `Type d'action non supporté : ${action.type}`
                );
        }
    }


    /* =====================================================
     * RÉSOLUTION DES ACTIONS EN ATTENTE
     * ===================================================== */

    resolvePendingAction(
        originalAction,
        playerIndex,
        state = null
    ) {
        let current =
            state ??
            this.state(playerIndex);

        let pending =
            current?.action;

        /*
         * Rien à résoudre :
         * le moteur a déjà terminé le pouvoir.
         */
        if (!pending) {
            return current;
        }


        const target =
            getTarget(originalAction);

        const value =
            getValue(originalAction);

        const effect =
            getEffect(originalAction);

        const tableCardIndex =
            getTableCardIndex(
                originalAction
            );


        /* =================================================
         * 1
         * ================================================= */

        if (pending === "vol1") {

            this.requireTarget(
                target,
                originalAction
            );

            return this.apply(
                "choisirAdversaireVol1",
                [Number(target)],
                playerIndex
            );
        }


        if (pending === "double1") {

            this.requireTarget(
                target,
                originalAction
            );

            return this.apply(
                "choisirAdversaireDouble1",
                [Number(target)],
                playerIndex
            );
        }


        /* =================================================
         * 3
         * ================================================= */

        if (pending === "carte3") {

            this.requireTarget(
                target,
                originalAction
            );

            return this.apply(
                "choisirAdversaireCarte3",
                [Number(target)],
                playerIndex
            );
        }


        if (pending === "double3") {

            this.requireTarget(
                target,
                originalAction
            );

            return this.apply(
                "choisirAdversaireDouble3",
                [Number(target)],
                playerIndex
            );
        }


        /* =================================================
         * 9
         * ================================================= */

        if (pending === "carte9") {

            this.requireTarget(
                target,
                originalAction
            );

            return this.apply(
                "choisirAdversaireCarte9",
                [Number(target)],
                playerIndex
            );
        }


        if (pending === "double9") {

            this.requireTarget(
                target,
                originalAction
            );

            return this.apply(
                "choisirAdversaireDouble9",
                [Number(target)],
                playerIndex
            );
        }


        /* =================================================
         * 11
         * ================================================= */

        if (pending === "carte11") {

            const chosenValue =
                value === 10 ||
                value === -10
                    ? value
                    : effect ===
                        "score_self_negative"
                        ? -10
                        : 10;

            return this.apply(
                "effetCarte11",
                [chosenValue],
                playerIndex
            );
        }


        if (pending === "double11") {

            const chosenValue =
                value === 20 ||
                value === -20
                    ? value
                    : effect ===
                        "score_self_negative"
                        ? -20
                        : 20;

            return this.apply(
                "effetDouble11",
                [chosenValue],
                playerIndex
            );
        }


        /* =================================================
         * 13
         * ================================================= */

        if (pending === "carte13") {

            this.requireTarget(
                target,
                originalAction
            );

            const next =
                this.apply(
                    "choisirAdversaireCarte13",
                    [Number(target)],
                    playerIndex
                );

            /*
             * Le choix de la carte de table est déjà
             * contenu dans l'action complète de l'IA.
             *
             * On vérifie que le moteur attend bien cette
             * étape avant de la résoudre.
             */
            if (
                getTableCardIndex(
                    originalAction
                ) !== null &&
                next?.action === "carte13choix"
            ) {
                return this.apply(
                    "volerCarte13",
                    [
                        Number(
                            getTableCardIndex(
                                originalAction
                            )
                        )
                    ],
                    playerIndex
                );
            }

            return next;
        }


        if (pending === "carte13choix") {

            if (
                tableCardIndex === null ||
                tableCardIndex === undefined
            ) {
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


        if (pending === "double13") {

            this.requireTarget(
                target,
                originalAction
            );

            const next =
                this.apply(
                    "choisirAdversaireDouble13",
                    [Number(target)],
                    playerIndex
                );

            const indices =
                getTableCardIndices(
                    originalAction
                );

            /*
             * Le moteur attend alors la sélection
             * des cartes à voler.
             */
            if (
                indices.length > 0 &&
                next?.action === "double13choix"
            ) {
                return this.resolveDouble13Cards(
                    indices,
                    playerIndex
                );
            }

            return next;
        }


        if (pending === "double13choix") {

            const indices =
                getTableCardIndices(
                    originalAction
                );

            if (indices.length === 0) {
                return this.apply(
                    "terminerDouble13",
                    [],
                    playerIndex
                );
            }

            return this.resolveDouble13Cards(
                indices,
                playerIndex
            );
        }


        /* =================================================
         * 15
         * ================================================= */

        if (pending === "carte15") {

            if (
                tableCardIndex === null ||
                tableCardIndex === undefined
            ) {
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


        if (pending === "double15") {

            if (
                tableCardIndex === null ||
                tableCardIndex === undefined
            ) {
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


        /* =================================================
         * 17
         * ================================================= */

        if (pending === "carte17") {

            this.requireTarget(
                target,
                originalAction
            );

            /*
             * IMPORTANT :
             *
             * On s'arrête après le tirage/révélation.
             * La nouvelle IA devra ensuite recevoir
             * le nouvel état et choisir quoi faire.
             */
            return this.apply(
                "choisirAdversaireCarte17",
                [Number(target)],
                playerIndex
            );
        }


        if (pending === "carte17revelee") {

            /*
             * Le 17 est volontairement une frontière
             * de décision.
             *
             * Si l'action fournie explicitement demande
             * de continuer, on le fait.
             */
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


        /* =================================================
         * DOUBLE 17
         * ================================================= */

        if (pending === "double17") {

            this.requireTarget(
                target,
                originalAction
            );

            return this.apply(
                "choisirAdversaireDouble17",
                [Number(target)],
                playerIndex
            );
        }


        if (pending === "double17revelee") {

            const revealedIndex =
                originalAction?.cardIndex ??
                originalAction?.metadata?.revealedIndex;

            if (
                revealedIndex === null ||
                revealedIndex === undefined
            ) {
                throw new Error(
                    "Double 17 : carte révélée manquante."
                );
            }

            return this.apply(
                "choisirCarteDouble17",
                [Number(revealedIndex)],
                playerIndex
            );
        }


        if (pending === "double17jouer") {

            /*
             * Ici, le moteur sait déjà quelle carte révélée
             * doit être jouée.
             */
            return this.apply(
                "continuerDouble17",
                [],
                playerIndex
            );
        }


        /* =================================================
         * 19
         * ================================================= */

        if (pending === "carte19") {

            this.requireTarget(
                target,
                originalAction
            );

            const next =
                this.apply(
                    "choisirAdversaireCarte19",
                    [Number(target)],
                    playerIndex
                );

            /*
             * Le moteur effectue l'échange à partir
             * de ses cartes actuellement déterminées.
             */
            return next;
        }


        if (pending === "double19") {

            this.requireTarget(
                target,
                originalAction
            );

            const next =
                this.apply(
                    "choisirAdversaireDouble19",
                    [Number(target)],
                    playerIndex
                );

            return next;
        }


        /* =================================================
         * 21
         * ================================================= */

        if (pending === "carte21") {

            const chosenValue =
                value === 20 ||
                value === -20
                    ? value
                    : effect === "score_target"
                        ? -20
                        : 20;

            const next =
                this.apply(
                    "effetCarte21",
                    [chosenValue],
                    playerIndex
                );

            /*
             * Si -20 a été choisi, le moteur demande
             * ensuite la cible.
             */
            if (
                chosenValue === -20 &&
                target !== null &&
                target !== undefined &&
                next?.action === "carte21cible"
            ) {
                return this.apply(
                    "cibleCarte21",
                    [Number(target)],
                    playerIndex
                );
            }

            return next;
        }


        if (pending === "carte21cible") {

            this.requireTarget(
                target,
                originalAction
            );

            return this.apply(
                "cibleCarte21",
                [Number(target)],
                playerIndex
            );
        }


        if (pending === "double21") {

            const chosenValue =
                value === 40 ||
                value === -40
                    ? value
                    : effect === "score_target"
                        ? -40
                        : 40;

            const next =
                this.apply(
                    "effetDouble21",
                    [chosenValue],
                    playerIndex
                );

            if (
                chosenValue === -40 &&
                target !== null &&
                target !== undefined &&
                next?.action === "double21cible"
            ) {
                return this.apply(
                    "cibleDouble21",
                    [Number(target)],
                    playerIndex
                );
            }

            return next;
        }


        if (pending === "double21cible") {

            this.requireTarget(
                target,
                originalAction
            );

            return this.apply(
                "cibleDouble21",
                [Number(target)],
                playerIndex
            );
        }


        /* =================================================
         * JOKER
         * ================================================= */

        if (pending === "joker") {

            if (
                effect === "exchange_scores"
            ) {
                const next =
                    this.apply(
                        "effetJoker",
                        ["echange"],
                        playerIndex
                    );

                if (
                    target !== null &&
                    target !== undefined &&
                    next?.action === "jokerCible"
                ) {
                    return this.apply(
                        "echangeJoker",
                        [Number(target)],
                        playerIndex
                    );
                }

                return next;
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


        if (pending === "jokerCible") {

            this.requireTarget(
                target,
                originalAction
            );

            return this.apply(
                "echangeJoker",
                [Number(target)],
                playerIndex
            );
        }


        /* =================================================
         * TERMINAISONS
         * ================================================= */

        if (pending === "terminerDouble13") {

            return this.apply(
                "terminerDouble13",
                [],
                playerIndex
            );
        }


        if (pending === "terminerDouble15") {

            return this.apply(
                "terminerDouble15",
                [],
                playerIndex
            );
        }


        if (pending === "terminer17SansCarte") {

            return this.apply(
                "terminer17SansCarte",
                [],
                playerIndex
            );
        }


        /*
         * Le moteur possède un état en attente que
         * cet adaptateur ne connaît pas.
         *
         * En mode strict on préfère arrêter avec une
         * erreur plutôt que d'exécuter une mauvaise action.
         */
        if (this.strict) {
            throw new Error(
                `Action moteur non gérée par l'adaptateur : ${pending}`
            );
        }

        return current;
    }


    /* =====================================================
     * DOUBLE 13
     * ===================================================== */

    resolveDouble13Cards(
        indices,
        playerIndex
    ) {
        if (
            !Array.isArray(indices) ||
            indices.length === 0
        ) {
            return this.apply(
                "terminerDouble13",
                [],
                playerIndex
            );
        }

        /*
         * On passe exactement les indices choisis
         * par la nouvelle IA à l'état de sélection
         * du moteur.
         *
         * Cette opération est volontairement centralisée
         * ici afin qu'aucun autre chemin ne manipule
         * directement sandbox.
         */
        this.engine.setSelection(
            indices.slice(0, 2)
        );

        return this.apply(
            "volerCartesDouble13",
            [],
            playerIndex
        );
    }


    /* =====================================================
     * ACTIONS NON-PLAY
     * ===================================================== */

    executeTargetAction(
        action,
        playerIndex
    ) {
        return this.resolvePendingAction(
            action,
            playerIndex,
            this.state(playerIndex)
        );
    }


    executeTableCardAction(
        action,
        playerIndex
    ) {
        return this.resolvePendingAction(
            action,
            playerIndex,
            this.state(playerIndex)
        );
    }


    executeTableCardsAction(
        action,
        playerIndex
    ) {
        return this.resolvePendingAction(
            action,
            playerIndex,
            this.state(playerIndex)
        );
    }


    executeEffectAction(
        action,
        playerIndex
    ) {
        return this.resolvePendingAction(
            action,
            playerIndex,
            this.state(playerIndex)
        );
    }


    executeContinueAction(
        action,
        playerIndex
    ) {
        return this.resolvePendingAction(
            action,
            playerIndex,
            this.state(playerIndex)
        );
    }


    executeTerminateAction(
        action,
        playerIndex
    ) {
        return this.resolvePendingAction(
            action,
            playerIndex,
            this.state(playerIndex)
        );
    }


    /* =====================================================
     * VALIDATION
     * ===================================================== */

    requireTarget(
        target,
        action
    ) {
        if (
            target === null ||
            target === undefined
        ) {
            throw new Error(
                `Action ${action?.id ?? "inconnue"} : cible manquante.`
            );
        }
    }


    /* =====================================================
     * LIGNE D'ACTIONS
     * ===================================================== */

    executeLine(
        actions,
        playerIndex
    ) {
        if (!Array.isArray(actions)) {
            throw new Error(
                "executeLine attend un tableau d'actions."
            );
        }

        let state = null;

        for (const action of actions) {

            state =
                this.execute(
                    action,
                    playerIndex
                );

            /*
             * Dès que le moteur demande une nouvelle
             * décision, on ne poursuit pas aveuglément
             * la ligne de recherche.
             */
            if (
                isActionWaiting(state)
            ) {
                break;
            }

            /*
             * Si le tour a changé, la ligne appartient
             * à une simulation future et ne doit pas être
             * injectée directement dans le moteur réel.
             */
            const current =
                this.engine.currentIndex();

            if (
                Number(current) !==
                Number(playerIndex)
            ) {
                break;
            }
        }

        return state;
    }


    /* =====================================================
     * MODE SÉCURISÉ
     * ===================================================== */

    tryExecute(
        action,
        playerIndex
    ) {
        try {

            const state =
                this.execute(
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
                state: this.state(
                    playerIndex
                ),
                error
            };
        }
    }
}


/* =========================================================
 * FACTORIES
 * ========================================================= */

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
