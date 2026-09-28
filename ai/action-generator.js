/**
 * Atoumoulin AI
 * action-generator.js
 *
 * Génère les possibilités LÉGALES du bot.
 *
 * IMPORTANT :
 * - ce fichier ne choisit jamais la meilleure action ;
 * - il ne contient aucune logique de difficulté ;
 * - il ne fait aucune évaluation stratégique ;
 * - il ne révèle aucune information cachée ;
 * - une possibilité représente une ACTION COMPLÈTE.
 *
 * Architecture :
 *
 *     GameState
 *        ↓
 *     génération des actions légales
 *        ↓
 *     possibilités complètes
 *        ↓
 *     simulation
 *        ↓
 *     évaluation
 *        ↓
 *     décision
 *
 * Priorité générale :
 *
 *     Double 7
 *        ↓
 *     7 simple
 *        ↓
 *     Double X
 *        ↓
 *     Carte simple
 *
 * Si 3 cartes identiques ou plus sont présentes,
 * un seul double est généré.
 */


/* ============================================================
 * TYPES
 * ========================================================== */

export const ACTION_KIND = Object.freeze({

    PLAY_CARD:
        "play-card",

    PLAY_DOUBLE:
        "play-double",

    CHOOSE_TARGET:
        "choose-target",

    CHOOSE_EFFECT:
        "choose-effect",

    CHOOSE_TABLE_CARD:
        "choose-table-card",

    CHOOSE_MULTIPLE_TABLE_CARDS:
        "choose-multiple-table-cards",

    CHOOSE_REVEALED_CARD:
        "choose-revealed-card",

    CONTINUE:
        "continue",

    FINISH:
        "finish"
});


/* ============================================================
 * UTILITAIRES
 * ========================================================== */

function number(value) {

    const result =
        Number(value);

    return Number.isFinite(result)
        ? result
        : 0;
}


function clone(value) {

    if (
        value === null ||
        value === undefined
    ) {
        return value;
    }

    if (
        typeof structuredClone === "function"
    ) {

        try {
            return structuredClone(value);
        } catch {}
    }

    if (Array.isArray(value)) {
        return value.map(clone);
    }

    if (
        typeof value === "object"
    ) {

        const result = {};

        for (
            const [key, item]
            of Object.entries(value)
        ) {
            result[key] =
                clone(item);
        }

        return result;
    }

    return value;
}


function unique(values) {

    return [
        ...new Set(values)
    ];
}


/* ============================================================
 * ACTION
 * ========================================================== */

export class AIAction {

    constructor({

        id = null,

        kind,

        card = null,

        cardIndex = null,

        cards = [],

        target = null,

        tableCard = null,

        tableCards = [],

        effect = null,

        value = null,

        commands = [],

        hiddenInformation = false,

        uncertainty = null,

        metadata = {}

    } = {}) {

        this.id =
            id;

        this.kind =
            kind;

        this.card =
            clone(card);

        this.cardIndex =
            cardIndex;

        this.cards =
            clone(cards);

        this.target =
            target;

        this.tableCard =
            tableCard;

        this.tableCards =
            clone(tableCards);

        this.effect =
            effect;

        this.value =
            value;

        this.commands =
            clone(commands);

        this.hiddenInformation =
            !!hiddenInformation;

        this.uncertainty =
            uncertainty;

        this.metadata =
            clone(metadata);
    }


    signature() {

        return JSON.stringify({

            kind:
                this.kind,

            card:
                this.card,

            cardIndex:
                this.cardIndex,

            cards:
                this.cards,

            target:
                this.target,

            tableCard:
                this.tableCard,

            tableCards:
                this.tableCards,

            effect:
                this.effect,

            value:
                this.value,

            commands:
                this.commands
        });
    }
}


/* ============================================================
 * GÉNÉRATEUR
 * ========================================================== */

export class AtoumoulinActionGenerator {

    constructor(options = {}) {

        this.options = {

            /*
             * Les effets spéciaux utilisent les noms réels
             * des fonctions présentes dans script.js.
             */
            methods: {

                playCard:
                    "jouerCarte",

                card11:
                    "effetCarte11",

                double11:
                    "effetDouble11",

                card21:
                    "effetCarte21",

                double21:
                    "effetDouble21",

                joker:
                    "effetJoker",

                targetCard1:
                    "choisirAdversaireVol1",

                targetDouble1:
                    "choisirAdversaireDouble1",

                targetCard3:
                    "choisirAdversaireCarte3",

                targetDouble3:
                    "choisirAdversaireDouble3",

                targetCard9:
                    "choisirAdversaireCarte9",

                targetDouble9:
                    "choisirAdversaireDouble9",

                targetCard13:
                    "choisirAdversaireCarte13",

                stealCard13:
                    "volerCarte13",

                targetDouble13:
                    "choisirAdversaireDouble13",

                stealDouble13:
                    "volerCartesDouble13",

                doubleCard15:
                    "doublerCarte15",

                tripleCard15:
                    "triplerCarte15",

                targetCard17:
                    "choisirAdversaireCarte17",

                continueCard17:
                    "continuerCarte17",

                targetCard19:
                    "choisirAdversaireCarte19",

                targetDouble19:
                    "choisirAdversaireDouble19",

                exchangeDouble19:
                    "effectuerEchangeDouble19",

                targetCard21:
                    "cibleCarte21",

                targetDouble21:
                    "cibleDouble21",

                jokerExchange:
                    "echangeJoker",

                targetDouble17:
                    "choisirAdversaireDouble17",

                chooseDouble17Card:
                    "choisirCarteDouble17",

                continueDouble17:
                    "continuerDouble17",

                finish17:
                    "terminer17SansCarte",

                finishDouble13:
                    "terminerDouble13",

                finishDouble15:
                    "terminerDouble15"
            },

            ...options
        };
    }


    /* ========================================================
     * POINT D'ENTRÉE
     * ====================================================== */

    generate(state) {

        if (!state) {
            return [];
        }

        /*
         * Si une action spéciale est déjà en cours,
         * on ne regénère pas un nouveau coup.
         *
         * On continue l'action actuelle.
         */
        if (
            state.action !== null &&
            state.action !== undefined
        ) {

            return this.generatePendingAction(
                state
            );
        }


        return this.generateTurnActions(
            state
        );
    }


    /* ========================================================
     * TOUR NORMAL
     * ====================================================== */

    generateTurnActions(state) {

        const botIndex =
            this.getBotIndex(state);

        const hand =
            this.getOwnHand(
                state,
                botIndex
            );


        if (
            hand.length === 0
        ) {
            return [];
        }


        /*
         * ----------------------------------------------------
         * PRIORITÉ 1 : DOUBLE 7
         * ----------------------------------------------------
         */

        const sevens =
            this.indicesOf(
                hand,
                7
            );

        if (
            sevens.length >= 2
        ) {

            return [
                this.createDoubleAction(
                    7,
                    sevens.slice(0, 2),
                    state
                )
            ];
        }


        /*
         * ----------------------------------------------------
         * PRIORITÉ 2 : 7 SIMPLE
         * ----------------------------------------------------
         */

        if (
            sevens.length === 1
        ) {

            return [
                this.createSingleAction(
                    7,
                    sevens[0],
                    state
                )
            ];
        }


        /*
         * ----------------------------------------------------
         * PRIORITÉ 3 : DOUBLES
         * ----------------------------------------------------
         */

        const doubles =
            this.findDoubles(
                hand
            );


        if (
            doubles.length > 0
        ) {

            const actions = [];

            for (
                const value
                of doubles
            ) {

                const indices =
                    this.indicesOf(
                        hand,
                        value
                    );

                /*
                 * Même avec 3, 4, etc. cartes identiques,
                 * on ne génère qu'un seul double.
                 */
                actions.push(
                    this.createDoubleAction(
                        value,
                        indices.slice(0, 2),
                        state
                    )
                );
            }

            return actions;
        }


        /*
         * ----------------------------------------------------
         * PRIORITÉ 4 : CARTES SIMPLES
         * ----------------------------------------------------
         */

        return this.generateSingleCards(
            hand,
            state
        );
    }


    /* ========================================================
     * CARTES SIMPLES
     * ====================================================== */

    generateSingleCards(
        hand,
        state
    ) {

        const actions = [];

        for (
            let index = 0;
            index < hand.length;
            index++
        ) {

            const card =
                hand[index];

            actions.push(
                this.createSingleAction(
                    card,
                    index,
                    state
                )
            );
        }

        return actions;
    }


    /* ========================================================
     * CRÉATION D'UNE CARTE SIMPLE
     * ====================================================== */

    createSingleAction(
        card,
        cardIndex,
        state
    ) {

        const base = {

            card,

            cardIndex,

            cards: [
                card
            ],

            metadata: {

                cardValue:
                    card,

                double:
                    false
            }
        };


        /*
         * Les cartes à pouvoir ne sont pas immédiatement
         * exécutées.
         *
         * Elles produisent des possibilités complètes.
         */

        switch (card) {

            case 1:
                return this.generateCard1(
                    base,
                    state
                );

            case 3:
                return this.generateCard3(
                    base,
                    state
                );

            case 9:
                return this.generateCard9(
                    base,
                    state
                );

            case 11:
                return this.generateCard11(
                    base,
                    state
                );

            case 13:
                return this.generateCard13(
                    base,
                    state
                );

            case 15:
                return this.generateCard15(
                    base,
                    state
                );

            case 17:
                return this.generateCard17(
                    base,
                    state
                );

            case 19:
                return this.generateCard19(
                    base,
                    state
                );

            case 21:
                return this.generateCard21(
                    base,
                    state
                );

            case "Joker":
                return this.generateJoker(
                    base,
                    state
                );

            default:
                return this.createDirectCardAction(
                    base,
                    state
                );
        }
    }


    /* ========================================================
     * DOUBLE
     * ====================================================== */

    createDoubleAction(
        value,
        indices,
        state
    ) {

        const base = {

            card:
                value,

            cardIndex:
                indices[0],

            cards:
                indices.map(
                    index =>
                        this.getOwnHand(
                            state,
                            this.getBotIndex(state)
                        )[index]
                ),

            metadata: {

                cardValue:
                    value,

                double:
                    true,

                indices:
                    [...indices]
            }
        };


        /*
         * Double pair :
         * l'action est directement déterminée.
         *
         * Double impair :
         * pouvoir.
         */

        switch (value) {

            case 1:
                return this.generateDouble1(
                    base,
                    state
                );

            case 3:
                return this.generateDouble3(
                    base,
                    state
                );

            case 5:
                return this.createDirectDoubleAction(
                    base,
                    state,
                    {
                        effect:
                            "draw-four"
                    }
                );

            case 7:
                return this.createDirectDoubleAction(
                    base,
                    state,
                    {
                        effect:
                            "score-40"
                    }
                );

            case 9:
                return this.generateDouble9(
                    base,
                    state
                );

            case 11:
                return this.generateDouble11(
                    base,
                    state
                );

            case 13:
                return this.generateDouble13(
                    base,
                    state
                );

            case 15:
                return this.generateDouble15(
                    base,
                    state
                );

            case 17:
                return this.generateDouble17(
                    base,
                    state
                );

            case 19:
                return this.generateDouble19(
                    base,
                    state
                );

            case 21:
                return this.generateDouble21(
                    base,
                    state
                );

            default:
                return this.createDirectDoubleAction(
                    base,
                    state,
                    {
                        effect:
                            "score",
                        value:
                            value * 2
                    }
                );
        }
    }


    /* ========================================================
     * CARTES DIRECTES
     * ====================================================== */

    createDirectCardAction(
        base,
        state
    ) {

        return new AIAction({

            kind:
                ACTION_KIND.PLAY_CARD,

            card:
                base.card,

            cardIndex:
                base.cardIndex,

            cards:
                base.cards,

            commands:
                this.playCommands(
                    base.cardIndex,
                    false
                ),

            metadata:
                base.metadata
        });
    }


    createDirectDoubleAction(
        base,
        state,
        effect = {}
    ) {

        return new AIAction({

            kind:
                ACTION_KIND.PLAY_DOUBLE,

            card:
                base.card,

            cardIndex:
                base.cardIndex,

            cards:
                base.cards,

            effect:
                effect.effect,

            value:
                effect.value,

            commands:
                this.playCommands(
                    base.metadata.indices[0],
                    true
                ),

            metadata: {

                ...base.metadata,

                ...effect
            }
        });
    }


    /* ========================================================
     * CARTE 1
     * ====================================================== */

    generateCard1(
        base,
        state
    ) {

        const targets =
            this.getPointCardTargets(
                state
            );

        if (
            targets.length === 0
        ) {

            return this.createDirectCardAction(
                base,
                state
            );
        }


        return this.targetActions({

            base,

            state,

            kind:
                ACTION_KIND.CHOOSE_TARGET,

            effect:
                "steal-last-point-card",

            targets,

            method:
                this.options.methods
                    .targetCard1
        });
    }


    /* ========================================================
     * CARTE 3
     * ====================================================== */

    generateCard3(
        base,
        state
    ) {

        const targets =
            this.getOpponents(
                state
            );

        return this.targetActions({

            base,

            state,

            kind:
                ACTION_KIND.CHOOSE_TARGET,

            effect:
                "minus-20",

            targets,

            method:
                this.options.methods
                    .targetCard3
        });
    }


    /* ========================================================
     * CARTE 9
     * ====================================================== */

    generateCard9(
        base,
        state
    ) {

        const targets =
            this.getOpponents(
                state
            );


        /*
         * Le bot connaît uniquement le nombre de cartes
         * adverses.
         *
         * Le contenu des mains reste caché.
         */
        return this.targetActions({

            base,

            state,

            kind:
                ACTION_KIND.CHOOSE_TARGET,

            effect:
                "exchange-hands",

            targets,

            method:
                this.options.methods
                    .targetCard9,

            hiddenInformation:
                true,

            uncertainty:
                "opponent-hand-content"
        });
    }


    /* ========================================================
     * CARTE 11
     * ====================================================== */

    generateCard11(
        base,
        state
    ) {

        return [

            new AIAction({

                kind:
                    ACTION_KIND.CHOOSE_EFFECT,

                card:
                    base.card,

                cardIndex:
                    base.cardIndex,

                cards:
                    base.cards,

                effect:
                    "score",

                value:
                    10,

                commands:
                    [
                        ...this.playCommands(
                            base.cardIndex,
                            false
                        ),
                        {
                            method:
                                this.options.methods
                                    .card11,

                            args:
                                [10]
                        }
                    ],

                metadata:
                    {
                        ...base.metadata,

                        choice:
                            "+10"
                    }
            }),

            new AIAction({

                kind:
                    ACTION_KIND.CHOOSE_EFFECT,

                card:
                    base.card,

                cardIndex:
                    base.cardIndex,

                cards:
                    base.cards,

                effect:
                    "score",

                value:
                    -10,

                commands:
                    [
                        ...this.playCommands(
                            base.cardIndex,
                            false
                        ),
                        {
                            method:
                                this.options.methods
                                    .card11,

                            args:
                                [-10]
                        }
                    ],

                metadata:
                    {
                        ...base.metadata,

                        choice:
                            "-10"
                    }
            })
        ];
    }


    /* ========================================================
     * CARTE 13
     * ====================================================== */

    generateCard13(
        base,
        state
    ) {

        const targets =
            this.getOpponentsWithPointCards(
                state
            );


        /*
         * Si aucune cible n'a de carte à points,
         * le pouvoir n'a pas de cible utile.
         *
         * Le moteur réel termine alors le pouvoir.
         */
        if (
            targets.length === 0
        ) {

            return [
                this.createFinishAction(
                    base,
                    "no-target"
                )
            ];
        }


        const actions = [];

        for (
            const target
            of targets
        ) {

            const cards =
                this.getTargetPointCards(
                    state,
                    target
                );

            for (
                const tableIndex
                of cards
            ) {

                actions.push(
                    new AIAction({

                        kind:
                            ACTION_KIND
                                .CHOOSE_TABLE_CARD,

                        card:
                            base.card,

                        cardIndex:
                            base.cardIndex,

                        cards:
                            base.cards,

                        target,

                        tableCard:
                            tableIndex,

                        effect:
                            "steal-table-card",

                        commands:
                            [
                                ...this.playCommands(
                                    base.cardIndex,
                                    false
                                ),
                                {
                                    method:
                                        this.options.methods
                                            .targetCard13,

                                    args:
                                        [target]
                                },
                                {
                                    method:
                                        this.options.methods
                                            .stealCard13,

                                    args:
                                        [tableIndex]
                                }
                            ],

                        metadata: {

                            ...base.metadata,

                            target,

                            tableCard:
                                tableIndex
                        }
                    })
                );
            }
        }

        return actions;
    }


    /* ========================================================
     * CARTE 15
     * ====================================================== */

    generateCard15(
        base,
        state
    ) {

        const bot =
            this.getBot(
                state
            );

        const table =
            this.getTable(
                state
            );


        const ownCards =
            table
                .map(
                    (card, index) => ({
                        card,
                        index
                    })
                )
                .filter(
                    entry =>
                        this.isOwnedBy(
                            entry.card,
                            bot
                        ) &&
                        this.isPointCard(
                            entry.card
                        )
                );


        if (
            ownCards.length === 0
        ) {

            return [
                this.createFinishAction(
                    base,
                    "no-own-point-card"
                )
            ];
        }


        return ownCards.map(
            entry =>
                new AIAction({

                    kind:
                        ACTION_KIND
                            .CHOOSE_TABLE_CARD,

                    card:
                        base.card,

                    cardIndex:
                        base.cardIndex,

                    cards:
                        base.cards,

                    tableCard:
                        entry.index,

                    effect:
                        "double-table-card",

                    commands:
                        [
                            ...this.playCommands(
                                base.cardIndex,
                                false
                            ),
                            {
                                method:
                                    this.options.methods
                                        .doubleCard15,

                                args:
                                    [entry.index]
                            }
                        ],

                    metadata: {

                        ...base.metadata,

                        tableCard:
                            entry.index,

                        oldValue:
                            entry.card?.valeur
                                ??
                                entry.card?.value
                    }
                })
        );
    }


    /* ========================================================
     * CARTE 17
     * ====================================================== */

    generateCard17(
        base,
        state
    ) {

        const targets =
            this.getOpponentsWithCards(
                state
            );


        if (
            targets.length === 0
        ) {

            return [
                new AIAction({

                    kind:
                        ACTION_KIND.FINISH,

                    card:
                        base.card,

                    cardIndex:
                        base.cardIndex,

                    cards:
                        base.cards,

                    effect:
                        "17-no-card",

                    commands:
                        [
                            ...this.playCommands(
                                base.cardIndex,
                                false
                            ),
                            {
                                method:
                                    this.options.methods
                                        .finish17,

                                args:
                                    []
                            }
                        ],

                    metadata:
                        {
                            ...base.metadata,

                            impossible:
                                true
                        }
                })
            ];
        }


        /*
         * Le contenu de la carte volée est inconnu avant
         * le tirage.
         *
         * On choisit donc uniquement la cible.
         */
        return this.targetActions({

            base,

            state,

            kind:
                ACTION_KIND.CHOOSE_TARGET,

            effect:
                "random-steal-card",

            targets,

            method:
                this.options.methods
                    .targetCard17,

            hiddenInformation:
                true,

            uncertainty:
                "stolen-card"
        });
    }


    /* ========================================================
     * CARTE 19
     * ====================================================== */

    generateCard19(
        base,
        state
    ) {

        const targets =
            this.getOpponents(
                state
            );


        /*
         * Le 19 ne révèle pas la main adverse.
         * L'information utile est sur la table.
         */
        return this.targetActions({

            base,

            state,

            kind:
                ACTION_KIND.CHOOSE_TARGET,

            effect:
                "exchange-last-point-cards",

            targets,

            method:
                this.options.methods
                    .targetCard19,

            hiddenInformation:
                false
        });
    }


    /* ========================================================
     * CARTE 21
     * ====================================================== */

    generateCard21(
        base,
        state
    ) {

        const actions = [];


        /*
         * +20 pour soi.
         */
        actions.push(

            new AIAction({

                kind:
                    ACTION_KIND.CHOOSE_EFFECT,

                card:
                    base.card,

                cardIndex:
                    base.cardIndex,

                cards:
                    base.cards,

                effect:
                    "score",

                value:
                    20,

                commands:
                    [
                        ...this.playCommands(
                            base.cardIndex,
                            false
                        ),
                        {
                            method:
                                this.options.methods
                                    .card21,

                            args:
                                [20]
                        }
                    ],

                metadata: {

                    ...base.metadata,

                    choice:
                        "+20-self"
                }
            })
        );


        /*
         * -20 sur chaque adversaire possible.
         */
        for (
            const target
            of this.getOpponents(
                state
            )
        ) {

            actions.push(

                new AIAction({

                    kind:
                        ACTION_KIND.CHOOSE_TARGET,

                    card:
                        base.card,

                    cardIndex:
                        base.cardIndex,

                    cards:
                        base.cards,

                    target,

                    effect:
                        "minus-20",

                    value:
                        -20,

                    commands:
                        [
                            ...this.playCommands(
                                base.cardIndex,
                                false
                            ),
                            {
                                method:
                                    this.options.methods
                                        .card21,

                                args:
                                    [-20]
                            },
                            {
                                method:
                                    this.options.methods
                                        .targetCard21,

                                args:
                                    [target]
                            }
                        ],

                    metadata: {

                        ...base.metadata,

                        choice:
                            "-20-target",

                        target
                    }
                })
            );
        }

        return actions;
    }


    /* ========================================================
     * JOKER
     * ====================================================== */

    generateJoker(
        base,
        state
    ) {

        const actions = [];


        /*
         * +10
         */
        actions.push(

            new AIAction({

                kind:
                    ACTION_KIND.CHOOSE_EFFECT,

                card:
                    base.card,

                cardIndex:
                    base.cardIndex,

                cards:
                    base.cards,

                effect:
                    "score",

                value:
                    10,

                commands:
                    [
                        ...this.playCommands(
                            base.cardIndex,
                            false
                        ),
                        {
                            method:
                                this.options.methods
                                    .joker,

                            args:
                                [10]
                        }
                    ],

                metadata:
                    {
                        ...base.metadata,

                        choice:
                            "+10"
                    }
            })
        );


        /*
         * +22
         */
        actions.push(

            new AIAction({

                kind:
                    ACTION_KIND.CHOOSE_EFFECT,

                card:
                    base.card,

                cardIndex:
                    base.cardIndex,

                cards:
                    base.cards,

                effect:
                    "score",

                value:
                    22,

                commands:
                    [
                        ...this.playCommands(
                            base.cardIndex,
                            false
                        ),
                        {
                            method:
                                this.options.methods
                                    .joker,

                            args:
                                [22]
                        }
                    ],

                metadata:
                    {
                        ...base.metadata,

                        choice:
                            "+22"
                    }
            })
        );


        /*
         * Échange de scores/carte avec une cible.
         */
        for (
            const target
            of this.getOpponents(
                state
            )
        ) {

            actions.push(

                new AIAction({

                    kind:
                        ACTION_KIND.CHOOSE_TARGET,

                    card:
                        base.card,

                    cardIndex:
                        base.cardIndex,

                    cards:
                        base.cards,

                    target,

                    effect:
                        "joker-exchange",

                    commands:
                        [
                            ...this.playCommands(
                                base.cardIndex,
                                false
                            ),
                            {
                                method:
                                    this.options.methods
                                        .joker,

                                args:
                                    ["echange"]
                            },
                            {
                                method:
                                    this.options.methods
                                        .jokerExchange,

                                args:
                                    [target]
                            }
                        ],

                    metadata: {

                        ...base.metadata,

                        choice:
                            "exchange",

                        target
                    }
                })
            );
        }


        return actions;
    }


    /* ========================================================
     * DOUBLE 1
     * ====================================================== */

    generateDouble1(
        base,
        state
    ) {

        const targets =
            this.getPointCardTargets(
                state
            );


        if (
            targets.length === 0
        ) {

            return [
                this.createFinishAction(
                    base,
                    "double1-no-target"
                )
            ];
        }


        return this.targetActions({

            base,

            state,

            kind:
                ACTION_KIND.CHOOSE_TARGET,

            effect:
                "steal-two-last-point-cards",

            targets,

            method:
                this.options.methods
                    .targetDouble1
        });
    }


    /* ========================================================
     * DOUBLE 3
     * ====================================================== */

    generateDouble3(
        base,
        state
    ) {

        return this.targetActions({

            base,

            state,

            kind:
                ACTION_KIND.CHOOSE_TARGET,

            effect:
                "minus-40",

            targets:
                this.getOpponents(
                    state
                ),

            method:
                this.options.methods
                    .targetDouble3
        });
    }


    /* ========================================================
     * DOUBLE 9
     * ====================================================== */

    generateDouble9(
        base,
        state
    ) {

        /*
         * Le Double 9 donne connaissance des mains adverses
         * au moment du choix.
         *
         * L'action reste néanmoins simplement une cible.
         */
        return this.targetActions({

            base,

            state,

            kind:
                ACTION_KIND.CHOOSE_TARGET,

            effect:
                "exchange-hands",

            targets:
                this.getOpponents(
                    state
                ),

            method:
                this.options.methods
                    .targetDouble9,

            hiddenInformation:
                false
        });
    }


    /* ========================================================
     * DOUBLE 11
     * ====================================================== */

    generateDouble11(
        base,
        state
    ) {

        return [

            new AIAction({

                kind:
                    ACTION_KIND.CHOOSE_EFFECT,

                card:
                    base.card,

                cardIndex:
                    base.cardIndex,

                cards:
                    base.cards,

                effect:
                    "score",

                value:
                    20,

                commands:
                    [
                        ...this.playCommands(
                            base.cardIndex,
                            true
                        ),
                        {
                            method:
                                this.options.methods
                                    .double11,

                            args:
                                [20]
                        }
                    ],

                metadata: {

                    ...base.metadata,

                    choice:
                        "+20"
                }
            }),

            new AIAction({

                kind:
                    ACTION_KIND.CHOOSE_EFFECT,

                card:
                    base.card,

                cardIndex:
                    base.cardIndex,

                cards:
                    base.cards,

                effect:
                    "score",

                value:
                    -20,

                commands:
                    [
                        ...this.playCommands(
                            base.cardIndex,
                            true
                        ),
                        {
                            method:
                                this.options.methods
                                    .double11,

                            args:
                                [-20]
                        }
                    ],

                metadata: {

                    ...base.metadata,

                    choice:
                        "-20"
                }
            })
        ];
    }


    /* ========================================================
     * DOUBLE 13
     * ====================================================== */

    generateDouble13(
        base,
        state
    ) {

        const targets =
            this.getOpponentsWithPointCards(
                state
            );


        if (
            targets.length === 0
        ) {

            return [
                this.createFinishAction(
                    base,
                    "double13-no-target"
                )
            ];
        }


        const actions = [];


        for (
            const target
            of targets
        ) {

            const cards =
                this.getTargetPointCards(
                    state,
                    target
                );


            /*
             * Le moteur autorise jusqu'à 2 cartes.
             *
             * Toutes les combinaisons légales de 1 ou 2 cartes
             * sont générées.
             */
            for (
                const tableIndex
                of cards
            ) {

                actions.push(

                    new AIAction({

                        kind:
                            ACTION_KIND
                                .CHOOSE_MULTIPLE_TABLE_CARDS,

                        card:
                            base.card,

                        cardIndex:
                            base.cardIndex,

                        cards:
                            base.cards,

                        target,

                        tableCards:
                            [tableIndex],

                        effect:
                            "steal-table-cards",

                        commands:
                            [
                                ...this.playCommands(
                                    base.cardIndex,
                                    true
                                ),
                                {
                                    method:
                                        this.options.methods
                                            .targetDouble13,

                                    args:
                                        [target]
                                },
                                {
                                    method:
                                        this.options.methods
                                            .stealDouble13,

                                    args:
                                        [
                                            [tableIndex]
                                        ]
                                }
                            ],

                        metadata: {

                            ...base.metadata,

                            target,

                            count:
                                1
                        }
                    })
                );
            }


            /*
             * Combinaisons de deux cartes.
             */
            for (
                let i = 0;
                i < cards.length;
                i++
            ) {

                for (
                    let j = i + 1;
                    j < cards.length;
                    j++
                ) {

                    actions.push(

                        new AIAction({

                            kind:
                                ACTION_KIND
                                    .CHOOSE_MULTIPLE_TABLE_CARDS,

                            card:
                                base.card,

                            cardIndex:
                                base.cardIndex,

                            cards:
                                base.cards,

                            target,

                            tableCards:
                                [
                                    cards[i],
                                    cards[j]
                                ],

                            effect:
                                "steal-table-cards",

                            commands:
                                [
                                    ...this.playCommands(
                                        base.cardIndex,
                                        true
                                    ),
                                    {
                                        method:
                                            this.options.methods
                                                .targetDouble13,

                                        args:
                                            [target]
                                    },
                                    {
                                        method:
                                            this.options.methods
                                                .stealDouble13,

                                        args:
                                            [
                                                [
                                                    cards[i],
                                                    cards[j]
                                                ]
                                            ]
                                    }
                                ],

                            metadata: {

                                ...base.metadata,

                                target,

                                count:
                                    2
                            }
                        })
                    );
                }
            }
        }


        return actions;
    }


    /* ========================================================
     * DOUBLE 15
     * ====================================================== */

    generateDouble15(
        base,
        state
    ) {

        const bot =
            this.getBot(
                state
            );

        const table =
            this.getTable(
                state
            );


        const cards =
            table
                .map(
                    (card, index) => ({
                        card,
                        index
                    })
                )
                .filter(
                    entry =>
                        this.isOwnedBy(
                            entry.card,
                            bot
                        ) &&
                        this.isPointCard(
                            entry.card
                        )
                );


        if (
            cards.length === 0
        ) {

            return [
                this.createFinishAction(
                    base,
                    "double15-no-card"
                )
            ];
        }


        return cards.map(
            entry =>
                new AIAction({

                    kind:
                        ACTION_KIND
                            .CHOOSE_TABLE_CARD,

                    card:
                        base.card,

                    cardIndex:
                        base.cardIndex,

                    cards:
                        base.cards,

                    tableCard:
                        entry.index,

                    effect:
                        "triple-table-card",

                    commands:
                        [
                            ...this.playCommands(
                                base.cardIndex,
                                true
                            ),
                            {
                                method:
                                    this.options.methods
                                        .tripleCard15,

                                args:
                                    [entry.index]
                            }
                        ],

                    metadata: {

                        ...base.metadata,

                        tableCard:
                            entry.index,

                        oldValue:
                            entry.card?.valeur
                                ??
                                entry.card?.value
                    }
                })
        );
    }


    /* ========================================================
     * DOUBLE 17
     * ====================================================== */

    generateDouble17(
        base,
        state
    ) {

        const targets =
            this.getOpponentsWithCards(
                state
            );


        if (
            targets.length === 0
        ) {

            return [
                this.createFinishAction(
                    base,
                    "double17-no-target"
                )
            ];
        }


        /*
         * Les deux cartes volées sont aléatoires.
         *
         * Le bot ne doit donc surtout pas prétendre connaître
         * leur contenu avant le tirage.
         */
        return this.targetActions({

            base,

            state,

            kind:
                ACTION_KIND.CHOOSE_TARGET,

            effect:
                "random-steal-two-cards",

            targets,

            method:
                this.options.methods
                    .targetDouble17,

            hiddenInformation:
                true,

            uncertainty:
                "two-stolen-cards"
        });
    }


    /* ========================================================
     * DOUBLE 19
     * ====================================================== */

    generateDouble19(
        base,
        state
    ) {

        return this.targetActions({

            base,

            state,

            kind:
                ACTION_KIND.CHOOSE_TARGET,

            effect:
                "exchange-two-last-point-cards",

            targets:
                this.getOpponents(
                    state
                ),

            method:
                this.options.methods
                    .targetDouble19,

            hiddenInformation:
                false
        });
    }


    /* ========================================================
     * DOUBLE 21
     * ====================================================== */

    generateDouble21(
        base,
        state
    ) {

        const actions = [];


        /*
         * +40 pour soi.
         */
        actions.push(

            new AIAction({

                kind:
                    ACTION_KIND.CHOOSE_EFFECT,

                card:
                    base.card,

                cardIndex:
                    base.cardIndex,

                cards:
                    base.cards,

                effect:
                    "score",

                value:
                    40,

                commands:
                    [
                        ...this.playCommands(
                            base.cardIndex,
                            true
                        ),
                        {
                            method:
                                this.options.methods
                                    .double21,

                            args:
                                [40]
                        }
                    ],

                metadata: {

                    ...base.metadata,

                    choice:
                        "+40"
                }
            })
        );


        /*
         * -40 sur chaque adversaire.
         */
        for (
            const target
            of this.getOpponents(
                state
            )
        ) {

            actions.push(

                new AIAction({

                    kind:
                        ACTION_KIND.CHOOSE_TARGET,

                    card:
                        base.card,

                    cardIndex:
                        base.cardIndex,

                    cards:
                        base.cards,

                    target,

                    effect:
                        "minus-40",

                    value:
                        -40,

                    commands:
                        [
                            ...this.playCommands(
                                base.cardIndex,
                                true
                            ),
                            {
                                method:
                                    this.options.methods
                                        .double21,

                                args:
                                    [-40]
                            },
                            {
                                method:
                                    this.options.methods
                                        .targetDouble21,

                                args:
                                    [target]
                            }
                        ],

                    metadata: {

                        ...base.metadata,

                        choice:
                            "-40-target",

                        target
                    }
                })
            );
        }


        return actions;
    }


    /* ========================================================
     * ACTIONS EN COURS
     * ====================================================== */

    generatePendingAction(
        state
    ) {

        const action =
            String(
                state.action
            );


        switch (action) {

            case "vol1":
                return this.pendingTargetAction(
                    state,
                    "steal-last-point-card",
                    this.getPointCardTargets(state),
                    this.options.methods.targetCard1
                );

            case "double1":
                return this.pendingTargetAction(
                    state,
                    "steal-two-last-point-cards",
                    this.getPointCardTargets(state),
                    this.options.methods.targetDouble1
                );

            case "carte3":
                return this.pendingTargetAction(
                    state,
                    "minus-20",
                    this.getOpponents(state),
                    this.options.methods.targetCard3
                );

            case "double3":
                return this.pendingTargetAction(
                    state,
                    "minus-40",
                    this.getOpponents(state),
                    this.options.methods.targetDouble3
                );

            case "carte9":
                return this.pendingTargetAction(
                    state,
                    "exchange-hands",
                    this.getOpponents(state),
                    this.options.methods.targetCard9,
                    true
                );

            case "double9":
                return this.pendingTargetAction(
                    state,
                    "exchange-hands",
                    this.getOpponents(state),
                    this.options.methods.targetDouble9
                );

            case "carte11":
                return this.pendingEffectAction(
                    state,
                    [10, -10],
                    this.options.methods.card11
                );

            case "double11":
                return this.pendingEffectAction(
                    state,
                    [20, -20],
                    this.options.methods.double11
                );

            case "carte13":
                return this.pendingTargetAction(
                    state,
                    "steal-table-card",
                    this.getOpponentsWithPointCards(state),
                    this.options.methods.targetCard13
                );

            case "carte13choix":
                return this.pendingTableCardActions(
                    state,
                    false
                );

            case "double13":
                return this.pendingTargetAction(
                    state,
                    "steal-table-cards",
                    this.getOpponentsWithPointCards(state),
                    this.options.methods.targetDouble13
                );

            case "double13choix":
                return this.pendingDouble13Cards(
                    state
                );

            case "carte15":
                return this.pendingOwnTableCardActions(
                    state,
                    false
                );

            case "double15":
                return this.pendingOwnTableCardActions(
                    state,
                    true
                );

            case "carte17":
                return this.pendingTargetAction(
                    state,
                    "random-steal-card",
                    this.getOpponentsWithCards(state),
                    this.options.methods.targetCard17,
                    true,
                    "stolen-card"
                );

            case "carte17revelee":
                return [
                    new AIAction({

                        kind:
                            ACTION_KIND.CONTINUE,

                        effect:
                            "play-revealed-card",

                        hiddenInformation:
                            false,

                        commands:
                            [
                                {
                                    method:
                                        this.options.methods
                                            .continueCard17,

                                    args:
                                        []
                                }
                            ],

                        metadata:
                            {
                                continuation:
                                    true
                            }
                    })
                ];

            case "double17":
                return this.pendingTargetAction(
                    state,
                    "random-steal-two-cards",
                    this.getOpponentsWithCards(state),
                    this.options.methods.targetDouble17,
                    true,
                    "two-stolen-cards"
                );

            case "double17revelee":
                return this.pendingRevealedDouble17(
                    state
                );

            case "double17jouer":
                return [
                    new AIAction({

                        kind:
                            ACTION_KIND.CONTINUE,

                        effect:
                            "play-stolen-card",

                        commands:
                            [
                                {
                                    method:
                                        this.options.methods
                                            .continueDouble17,

                                    args:
                                        []
                                }
                            ]
                    })
                ];

            case "carte19":
                return this.pendingTargetAction(
                    state,
                    "exchange-last-point-cards",
                    this.getOpponents(state),
                    this.options.methods.targetCard19
                );

            case "double19":
                return this.pendingTargetAction(
                    state,
                    "exchange-two-last-point-cards",
                    this.getOpponents(state),
                    this.options.methods.targetDouble19
                );

            case "carte21":
                return this.pendingEffectAction(
                    state,
                    [20, -20],
                    this.options.methods.card21
                );

            case "carte21cible":
                return this.pendingTargetAction(
                    state,
                    "minus-20",
                    this.getOpponents(state),
                    this.options.methods.targetCard21
                );

            case "double21":
                return this.pendingEffectAction(
                    state,
                    [40, -40],
                    this.options.methods.double21
                );

            case "double21cible":
                return this.pendingTargetAction(
                    state,
                    "minus-40",
                    this.getOpponents(state),
                    this.options.methods.targetDouble21
                );

            case "joker":
                return this.pendingJoker(
                    state
                );

            case "jokerCible":
                return this.pendingTargetAction(
                    state,
                    "joker-exchange",
                    this.getOpponents(state),
                    this.options.methods.jokerExchange
                );

            default:
                return [];
        }
    }


    /* ========================================================
     * PENDING : CIBLE
     * ====================================================== */

    pendingTargetAction(
        state,
        effect,
        targets,
        method,
        hiddenInformation = false,
        uncertainty = null
    ) {

        return targets.map(
            target =>
                new AIAction({

                    kind:
                        ACTION_KIND
                            .CHOOSE_TARGET,

                    target,

                    effect,

                    hiddenInformation,

                    uncertainty,

                    commands:
                        [
                            {
                                method,

                                args:
                                    [target]
                            }
                        ],

                    metadata:
                        {
                            pending:
                                state.action,

                            target
                        }
                })
        );
    }


    /* ========================================================
     * PENDING : EFFET
     * ====================================================== */

    pendingEffectAction(
        state,
        values,
        method
    ) {

        return values.map(
            value =>
                new AIAction({

                    kind:
                        ACTION_KIND
                            .CHOOSE_EFFECT,

                    effect:
                        "score",

                    value,

                    commands:
                        [
                            {
                                method,

                                args:
                                    [value]
                            }
                        ],

                    metadata:
                        {
                            pending:
                                state.action
                        }
                })
        );
    }


    /* ========================================================
     * PENDING : JOKER
     * ====================================================== */

    pendingJoker(
        state
    ) {

        const actions = [

            new AIAction({

                kind:
                    ACTION_KIND
                        .CHOOSE_EFFECT,

                effect:
                    "score",

                value:
                    10,

                commands:
                    [
                        {
                            method:
                                this.options.methods
                                    .joker,

                            args:
                                [10]
                        }
                    ]
            }),

            new AIAction({

                kind:
                    ACTION_KIND
                        .CHOOSE_EFFECT,

                effect:
                    "score",

                value:
                    22,

                commands:
                    [
                        {
                            method:
                                this.options.methods
                                    .joker,

                            args:
                                [22]
                        }
                    ]
            })
        ];


        for (
            const target
            of this.getOpponents(
                state
            )
        ) {

            actions.push(

                new AIAction({

                    kind:
                        ACTION_KIND.CHOOSE_TARGET,

                    target,

                    effect:
                        "joker-exchange",

                    commands:
                        [
                            {
                                method:
                                    this.options.methods
                                        .joker,

                                args:
                                    ["echange"]
                            },
                            {
                                method:
                                    this.options.methods
                                        .jokerExchange,

                                args:
                                    [target]
                            }
                        ]
                })
            );
        }


        return actions;
    }


    /* ========================================================
     * PENDING : CARTE TABLE
     * ====================================================== */

    pendingTableCardActions(
        state,
        double
    ) {

        const target =
            this.getCurrentTarget(
                state
            );

        if (
            target === null ||
            target === undefined
        ) {
            return [];
        }


        const cards =
            this.getTargetPointCards(
                state,
                target
            );


        return cards.map(
            tableIndex =>
                new AIAction({

                    kind:
                        ACTION_KIND
                            .CHOOSE_TABLE_CARD,

                    target,

                    tableCard:
                        tableIndex,

                    effect:
                        "steal-table-card",

                    commands:
                        [
                            {
                                method:
                                    this.options.methods
                                        .stealCard13,

                                args:
                                    [tableIndex]
                            }
                        ],

                    metadata:
                        {
                            pending:
                                state.action
                        }
                })
        );
    }


    /* ========================================================
     * PENDING : DOUBLE 13
     * ====================================================== */

    pendingDouble13Cards(
        state
    ) {

        const target =
            this.getCurrentTarget(
                state
            );


        if (
            target === null ||
            target === undefined
        ) {
            return [];
        }


        const cards =
            this.getTargetPointCards(
                state,
                target
            );


        const actions = [];


        /*
         * Une seule carte.
         */
        for (
            const index
            of cards
        ) {

            actions.push(

                new AIAction({

                    kind:
                        ACTION_KIND
                            .CHOOSE_MULTIPLE_TABLE_CARDS,

                    target,

                    tableCards:
                        [index],

                    effect:
                        "steal-table-cards",

                    commands:
                        [
                            {
                                method:
                                    this.options.methods
                                        .stealDouble13,

                                args:
                                    [[index]]
                            }
                        ],

                    metadata:
                        {
                            pending:
                                state.action,

                            count:
                                1
                        }
                })
            );
        }


        /*
         * Deux cartes.
         */
        for (
            let i = 0;
            i < cards.length;
            i++
        ) {

            for (
                let j = i + 1;
                j < cards.length;
                j++
            ) {

                actions.push(

                    new AIAction({

                        kind:
                            ACTION_KIND
                                .CHOOSE_MULTIPLE_TABLE_CARDS,

                        target,

                        tableCards:
                            [
                                cards[i],
                                cards[j]
                            ],

                        effect:
                            "steal-table-cards",

                        commands:
                            [
                                {
                                    method:
                                        this.options.methods
                                            .stealDouble13,

                                    args:
                                        [
                                            [
                                                cards[i],
                                                cards[j]
                                            ]
                                        ]
                            }
                            ],

                        metadata:
                            {
                                pending:
                                    state.action,

                                count:
                                    2
                            }
                    })
                );
            }
        }


        /*
         * S'il n'y a aucune carte :
         * le moteur possède une fonction de terminaison.
         */
        if (
            actions.length === 0
        ) {

            actions.push(

                new AIAction({

                    kind:
                        ACTION_KIND.FINISH,

                    effect:
                        "no-card",

                    commands:
                        [
                            {
                                method:
                                    this.options.methods
                                        .finishDouble13,

                                args:
                                    []
                            }
                        ]
                })
            );
        }


        return actions;
    }


    /* ========================================================
     * PENDING : CARTES PERSONNELLES
     * ====================================================== */

    pendingOwnTableCardActions(
        state,
        triple
    ) {

        const bot =
            this.getBot(
                state
            );

        const table =
            this.getTable(
                state
            );


        const cards =
            table
                .map(
                    (card, index) => ({
                        card,
                        index
                    })
                )
                .filter(
                    entry =>
                        this.isOwnedBy(
                            entry.card,
                            bot
                        ) &&
                        this.isPointCard(
                            entry.card
                        )
                );


        if (
            cards.length === 0
        ) {

            return [
                new AIAction({

                    kind:
                        ACTION_KIND.FINISH,

                    effect:
                        triple
                            ? "double15-no-card"
                            : "card15-no-card",

                    commands:
                        [
                            {
                                method:
                                    triple
                                        ? this.options.methods
                                            .finishDouble15
                                        : null,

                                args:
                                    []
                            }
                        ].filter(
                            command =>
                                command.method
                        )
                })
            ];
        }


        return cards.map(
            entry =>
                new AIAction({

                    kind:
                        ACTION_KIND
                            .CHOOSE_TABLE_CARD,

                    tableCard:
                        entry.index,

                    effect:
                        triple
                            ? "triple-table-card"
                            : "double-table-card",

                    commands:
                        [
                            {
                                method:
                                    triple
                                        ? this.options.methods
                                            .tripleCard15
                                        : this.options.methods
                                            .doubleCard15,

                                args:
                                    [entry.index]
                            }
                        ]
                })
        );
    }


    /* ========================================================
     * PENDING : DOUBLE 17 REVEALED
     * ====================================================== */

    pendingRevealedDouble17(
        state
    ) {

        const cards =
            this.getDouble17Cards(
                state
            );


        if (
            cards.length === 0
        ) {
            return [];
        }


        /*
         * À ce stade la carte est réellement révélée.
         *
         * On peut donc enfin l'évaluer.
         */
        return cards.map(
            (card, index) =>
                new AIAction({

                    kind:
                        ACTION_KIND
                            .CHOOSE_REVEALED_CARD,

                    card,

                    value:
                        card,

                    tableCard:
                        index,

                    effect:
                        "play-stolen-card",

                    commands:
                        [
                            {
                                method:
                                    this.options.methods
                                        .chooseDouble17Card,

                                args:
                                    [index]
                            }
                        ],

                    metadata:
                        {
                            revealed:
                                true,

                            source:
                                "double17"
                        }
                })
        );
    }


    /* ========================================================
     * CIBLE
     * ====================================================== */

    targetActions({

        base,

        state,

        kind,

        effect,

        targets,

        method,

        hiddenInformation = false,

        uncertainty = null

    }) {

        return targets.map(
            target =>
                new AIAction({

                    kind,

                    card:
                        base.card,

                    cardIndex:
                        base.cardIndex,

                    cards:
                        base.cards,

                    target,

                    effect,

                    hiddenInformation,

                    uncertainty,

                    commands:
                        [
                            ...this.playCommands(
                                base.cardIndex,
                                !!base.metadata.double
                            ),
                            {
                                method,

                                args:
                                    [target]
                            }
                        ],

                    metadata: {

                        ...base.metadata,

                        target
                    }
                })
        );
    }


    /* ========================================================
     * FIN D'ACTION
     * ====================================================== */

    createFinishAction(
        base,
        reason
    ) {

        return new AIAction({

            kind:
                ACTION_KIND.FINISH,

            card:
                base.card,

            cardIndex:
                base.cardIndex,

            cards:
                base.cards,

            effect:
                "finish",

            commands:
                this.playCommands(
                    base.cardIndex,
                    !!base.metadata.double
                ),

            metadata: {

                ...base.metadata,

                reason
            }
        });
    }


    /* ========================================================
     * COMMANDES DE JEU
     * ====================================================== */

    playCommands(
        cardIndex,
        double
    ) {

        /*
         * L'AtoumoulinEngine possède déjà les méthodes
         * selectCard / selectDouble13 pour préparer
         * carteChoisie.
         *
         * Ici on conserve une représentation générique.
         */
        return [

            {
                method:
                    double
                        ? "__selectDouble"
                        : "__selectCard",

                args:
                    [cardIndex]
            },

            {
                method:
                    this.options.methods
                        .playCard,

                args:
                    []
            }
        ];
    }


    /* ========================================================
     * JOUEURS
     * ====================================================== */

    getBotIndex(
        state
    ) {

        if (
            Number.isInteger(
                state.botIndex
            )
        ) {
            return state.botIndex;
        }

        if (
            Number.isInteger(
                state.viewIndex
            )
        ) {
            return state.viewIndex;
        }

        if (
            Number.isInteger(
                state.currentPlayer
            )
        ) {
            return state.currentPlayer;
        }

        return 0;
    }


    getBot(
        state
    ) {

        const index =
            this.getBotIndex(
                state
            );

        return (
            state.players?.[index] ??
            null
        );
    }


    getOwnHand(
        state,
        index
    ) {

        const player =
            state.players?.[index];

        if (
            !player ||
            !Array.isArray(
                player.main
            )
        ) {
            return [];
        }

        return player.main;
    }


    getOpponents(
        state
    ) {

        const botIndex =
            this.getBotIndex(
                state
            );


        return (
            state.players ??
            []
        )
            .filter(
                player =>
                    Number(player.id) !==
                    Number(botIndex)
            )
            .map(
                player =>
                    Number(player.id)
            );
    }


    getOpponentsWithCards(
        state
    ) {

        return this.getOpponents(
            state
        )
            .filter(
                index =>
                    number(
                        state.players?.[index]
                            ?.cardCount
                    ) > 0
            );
    }


    /* ========================================================
     * TABLE
     * ====================================================== */

    getTable(
        state
    ) {

        return Array.isArray(
            state.table
        )
            ? state.table
            : [];
    }


    getPointCardTargets(
        state
    ) {

        const botIndex =
            this.getBotIndex(
                state
            );

        const table =
            this.getTable(
                state
            );

        const names = new Set();


        for (
            const card
            of table
        ) {

            if (
                !this.isPointCard(
                    card
                )
            ) {
                continue;
            }

            const owner =
                this.findPlayerByName(
                    state,
                    card?.proprietaire ??
                    card?.owner
                );

            if (
                owner &&
                Number(owner.id) !==
                    Number(botIndex)
            ) {

                names.add(
                    Number(owner.id)
                );
            }
        }


        return [
            ...names
        ];
    }


    getOpponentsWithPointCards(
        state
    ) {

        return this.getPointCardTargets(
            state
        );
    }


    getTargetPointCards(
        state,
        target
    ) {

        const player =
            state.players?.[target];

        if (!player) {
            return [];
        }


        const ownerName =
            player.name ??
            player.nom;


        return this.getTable(
            state
        )
            .map(
                (card, index) => ({
                    card,
                    index
                })
            )
            .filter(
                entry =>
                    (
                        entry.card?.proprietaire ??
                        entry.card?.owner
                    ) === ownerName &&
                    this.isPointCard(
                        entry.card
                    )
            )
            .map(
                entry =>
                    entry.index
            );
    }


    /* ========================================================
     * CARTES
     * ====================================================== */

    isPointCard(
        card
    ) {

        if (!card) {
            return false;
        }

        const value =
            Number(
                card.valeur ??
                card.value
            );

        return (
            Number.isFinite(value) &&
            value !== 0
        );
    }


    isOwnedBy(
        card,
        player
    ) {

        if (!card || !player) {
            return false;
        }

        const owner =
            card.proprietaire ??
            card.owner;

        return (
            owner ===
            (
                player.name ??
                player.nom
            )
        );
    }


    findPlayerByName(
        state,
        name
    ) {

        if (
            name === null ||
            name === undefined
        ) {
            return null;
        }

        return (
            state.players ??
            []
        ).find(
            player =>
                (
                    player.name ??
                    player.nom
                ) === name
        ) ?? null;
    }


    indicesOf(
        hand,
        value
    ) {

        const indices = [];

        for (
            let i = 0;
            i < hand.length;
            i++
        ) {

            if (
                hand[i] === value
            ) {
                indices.push(i);
            }
        }

        return indices;
    }


    findDoubles(
        hand
    ) {

        const counts =
            new Map();


        for (
            const card
            of hand
        ) {

            /*
             * Joker peut être doublé techniquement comme
             * n'importe quelle carte identique présente dans
             * la main.
             */
            const key =
                typeof card === "object"
                    ? JSON.stringify(card)
                    : String(card);

            counts.set(
                key,
                {
                    value:
                        card,

                    count:
                        (
                            counts.get(key)
                                ?.count ??
                            0
                        ) + 1
                }
            );
        }


        return [
            ...counts.values()
        ]
            .filter(
                item =>
                    item.count >= 2
            )
            .map(
                item =>
                    item.value
            );
    }


    /* ========================================================
     * ÉTAT INTERMÉDIAIRE
     * ====================================================== */

    getCurrentTarget(
        state
    ) {

        if (
            state.target !== null &&
            state.target !== undefined
        ) {
            return Number(
                state.target
            );
        }

        if (
            state.cibleChoisie !== null &&
            state.cibleChoisie !== undefined
        ) {
            return Number(
                state.cibleChoisie
            );
        }

        return null;
    }


    getDouble17Cards(
        state
    ) {

        if (
            Array.isArray(
                state.double17Cards
            )
        ) {
            return state.double17Cards;
        }

        if (
            Array.isArray(
                state.cartesDouble17
            )
        ) {
            return state.cartesDouble17;
        }

        return [];
    }


    /* ========================================================
     * DÉDUPLICATION
     * ====================================================== */

    deduplicate(
        actions
    ) {

        const seen =
            new Set();

        const result = [];


        for (
            const action
            of actions
        ) {

            const signature =
                action instanceof AIAction
                    ? action.signature()
                    : JSON.stringify(
                        action
                    );

            if (
                seen.has(signature)
            ) {
                continue;
            }

            seen.add(signature);
            result.push(action);
        }


        return result;
    }


    /* ========================================================
     * API FINALE
     * ====================================================== */

    generateLegalActions(
        state
    ) {

        return this.deduplicate(
            this.generate(
                state
            )
        );
    }
}


/* ============================================================
 * FONCTION SIMPLE
 * ========================================================== */

export function generateLegalActions(
    state,
    options = {}
) {

    const generator =
        new AtoumoulinActionGenerator(
            options
        );

    return generator.generateLegalActions(
        state
    );
}


/* ============================================================
 * PRIORITÉ
 * ========================================================== */

export function actionPriority(
    action
) {

    if (!action) {
        return 999;
    }


    const value =
        action.card;


    /*
     * Double 7
     */
    if (
        action.kind ===
            ACTION_KIND.PLAY_DOUBLE &&
        value === 7
    ) {
        return 1;
    }


    /*
     * 7 simple
     */
    if (
        action.kind ===
            ACTION_KIND.PLAY_CARD &&
        value === 7
    ) {
        return 2;
    }


    /*
     * Tous les doubles.
     */
    if (
        action.kind ===
            ACTION_KIND.PLAY_DOUBLE
    ) {
        return 3;
    }


    /*
     * Cartes simples.
     */
    if (
        action.kind ===
            ACTION_KIND.PLAY_CARD
    ) {
        return 4;
    }


    /*
     * Actions intermédiaires.
     */
    return 5;
}


/* ============================================================
 * TRI PAR PRIORITÉ
 * ========================================================== */

export function sortByActionPriority(
    actions
) {

    return [
        ...actions
    ].sort(
        (a, b) =>
            actionPriority(a) -
            actionPriority(b)
    );
}
