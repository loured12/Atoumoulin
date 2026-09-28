/**
 * Atoumoulin AI
 * game-state.js
 *
 * Représentation normalisée de l'état de jeu accessible au bot.
 *
 * IMPORTANT :
 * Ce fichier ne doit jamais aller chercher directement les variables
 * internes du script.js.
 *
 * Il travaille uniquement avec l'état fourni par AtoumoulinEngine.
 *
 * Cela garantit que le bot respecte les informations auxquelles
 * il a réellement accès.
 */

/* ============================================================
 * UTILITAIRES
 * ========================================================== */

function deepFreeze(object) {
    if (
        object === null ||
        typeof object !== "object" ||
        Object.isFrozen(object)
    ) {
        return object;
    }

    Object.freeze(object);

    for (const value of Object.values(object)) {
        deepFreeze(value);
    }

    return object;
}


function clone(value) {
    if (
        value === null ||
        value === undefined
    ) {
        return value;
    }

    if (typeof structuredClone === "function") {
        try {
            return structuredClone(value);
        } catch {}
    }

    if (Array.isArray(value)) {
        return value.map(clone);
    }

    if (typeof value === "object") {
        const result = {};

        for (const [key, item] of Object.entries(value)) {
            result[key] = clone(item);
        }

        return result;
    }

    return value;
}


/* ============================================================
 * CARTE
 * ========================================================== */

/**
 * Normalise une carte.
 *
 * Dans Atoumoulin :
 *
 *   1 ... 21
 *   "Joker"
 *
 * Les cartes présentes sur la table sont des objets contenant
 * notamment :
 *
 *   valeur
 *   proprietaire
 *   liee
 *   historiqueCarte
 */
export function normalizeCard(card) {

    if (
        card === null ||
        card === undefined
    ) {
        return null;
    }

    if (
        typeof card === "number" ||
        typeof card === "string"
    ) {
        return {
            value: card,
            owner: null,
            linked: false,
            history: []
        };
    }

    if (typeof card !== "object") {
        return null;
    }

    return {
        value:
            card.valeur ??
            card.value ??
            null,

        owner:
            card.proprietaire ??
            card.owner ??
            null,

        linked:
            !!(
                card.liee ??
                card.linked
            ),

        history:
            Array.isArray(
                card.historiqueCarte
            )
                ? card.historiqueCarte.slice()
                : Array.isArray(card.history)
                    ? card.history.slice()
                    : []
    };
}


/* ============================================================
 * JOUEUR
 * ========================================================== */

function normalizePlayer(
    player,
    index,
    botIndex
) {
    if (!player) {
        return null;
    }

    const own =
        Number(index) ===
        Number(botIndex);

    const cardCount =
        Number(player.cardCount) || 0;

    let main;

    /*
     * La vue du moteur contient :
     *
     *   - la vraie main pour le joueur concerné ;
     *   - null/null/null pour les mains adverses.
     *
     * On conserve exactement cette information.
     */
    if (own) {
        main =
            Array.isArray(player.main)
                ? player.main.slice()
                : [];
    } else {
        main =
            Array.from(
                {
                    length: cardCount
                },
                () => null
            );
    }

    return {
        id: Number(index),

        name:
            String(
                player.name ??
                `Joueur ${Number(index) + 1}`
            ),

        score:
            Number(player.score) || 0,

        bot:
            !!player.bot,

        cardCount,

        /*
         * true uniquement pour notre propre main.
         */
        handKnown:
            own,

        main
    };
}


/* ============================================================
 * ÉTAT DE JEU
 * ========================================================== */

export class AtoumoulinGameState {

    constructor(raw, botIndex) {

        if (!raw) {
            throw new Error(
                "Impossible de créer l'état IA : état absent."
            );
        }

        this.botIndex =
            Number(botIndex);

        if (
            !Number.isInteger(
                this.botIndex
            )
        ) {
            throw new Error(
                "Index du bot invalide."
            );
        }


        /* ----------------------------------------------------
         * Joueurs
         * -------------------------------------------------- */

        this.players =
            (raw.players ?? [])
                .map(
                    (player, index) =>
                        normalizePlayer(
                            player,
                            index,
                            this.botIndex
                        )
                )
                .filter(Boolean);


        /* ----------------------------------------------------
         * Pioche
         * -------------------------------------------------- */

        this.deckCount =
            Math.max(
                0,
                Number(raw.deckCount) || 0
            );


        /* ----------------------------------------------------
         * Table
         * -------------------------------------------------- */

        this.table =
            (raw.table ?? [])
                .map(normalizeCard)
                .filter(Boolean);


        /* ----------------------------------------------------
         * Défausse
         * -------------------------------------------------- */

        this.discard =
            clone(
                raw.discard ?? []
            );


        /* ----------------------------------------------------
         * Historique
         * -------------------------------------------------- */

        this.history =
            String(
                raw.history ?? ""
            );


        /* ----------------------------------------------------
         * Tour
         * -------------------------------------------------- */

        this.currentPlayer =
            Number(
                raw.currentPlayer
            );


        /* ----------------------------------------------------
         * Action en cours
         * -------------------------------------------------- */

        this.action =
            raw.action ??
            null;


        /* ----------------------------------------------------
         * Cible
         * -------------------------------------------------- */

        this.target =
            raw.target ??
            null;


        /* ----------------------------------------------------
         * Sélection actuelle
         * -------------------------------------------------- */

        this.selection =
            clone(
                raw.selection ??
                null
            );


        /* ----------------------------------------------------
         * Joker
         * -------------------------------------------------- */

        this.toursJoker =
            clone(
                raw.toursJoker ?? {}
            );


        /* ----------------------------------------------------
         * 17
         * -------------------------------------------------- */

        this.player17 =
            raw.player17 ??
            null;

        this.card17Pending =
            clone(
                raw.card17Pending ??
                null
            );


        /* ----------------------------------------------------
         * Double 17
         * -------------------------------------------------- */

        this.double17Cards =
            clone(
                raw.double17Cards ??
                []
            );

        this.double17Active =
            !!raw.double17Active;


        /* ----------------------------------------------------
         * 19
         * -------------------------------------------------- */

        this.player19 =
            raw.player19 ??
            null;


        /* ----------------------------------------------------
         * Fin
         * -------------------------------------------------- */

        this.winner =
            raw.winner ??
            null;

        this.roundWinner =
            raw.roundWinner ??
            null;

        this.roundEnded =
            !!raw.roundEnded;


        /* ----------------------------------------------------
         * Partie
         * -------------------------------------------------- */

        this.victories =
            Array.isArray(raw.victories)
                ? raw.victories.slice()
                : [];

        this.modeJeu =
            Number(raw.modeJeu) || 1;


        /*
         * Empêche accidentellement le moteur stratégique de
         * modifier l'état observé.
         */
        deepFreeze(this);
    }


    /* ========================================================
     * ACCÈS JOUEUR
     * ====================================================== */

    getPlayer(index = this.botIndex) {

        return (
            this.players[
                Number(index)
            ] ?? null
        );
    }


    getBot() {
        return this.getPlayer(
            this.botIndex
        );
    }


    getOpponents() {

        return this.players.filter(
            player =>
                player.id !==
                this.botIndex
        );
    }


    getOpponent(index) {

        const id =
            Number(index);

        if (
            id ===
            this.botIndex
        ) {
            return null;
        }

        return (
            this.players[id] ??
            null
        );
    }


    /* ========================================================
     * MAIN
     * ====================================================== */

    getOwnHand() {

        const player =
            this.getBot();

        if (!player) {
            return [];
        }

        return player.handKnown
            ? player.main.slice()
            : [];
    }


    getOwnCardCount() {

        const player =
            this.getBot();

        return player
            ? player.cardCount
            : 0;
    }


    /**
     * Retourne true si le contenu de la main est réellement
     * connu par le bot.
     */
    knowsOwnHand() {
        const player =
            this.getBot();

        return !!(
            player &&
            player.handKnown
        );
    }


    /**
     * Retourne true si la carte d'un adversaire est connue.
     *
     * En règle générale, false.
     */
    knowsOpponentCard(
        playerIndex,
        cardIndex
    ) {

        const player =
            this.getOpponent(
                playerIndex
            );

        if (!player) {
            return false;
        }

        return (
            player.handKnown &&
            player.main[cardIndex] !== null
        );
    }


    /* ========================================================
     * TABLE
     * ====================================================== */

    getTableCards() {
        return this.table.slice();
    }


    getCardsOwnedBy(playerIndex) {

        const player =
            this.getPlayer(
                playerIndex
            );

        if (!player) {
            return [];
        }

        return this.table.filter(
            card =>
                card.owner ===
                player.name
        );
    }


    getPointCardsOwnedBy(playerIndex) {

        return this
            .getCardsOwnedBy(
                playerIndex
            )
            .filter(
                card =>
                    typeof card.value === "number" &&
                    card.value !== 0
            );
    }


    getTableCard(index) {

        return (
            this.table[
                Number(index)
            ] ?? null
        );
    }


    /* ========================================================
     * ACTIONS / ÉTAT
     * ====================================================== */

    isOurTurn() {

        return (
            Number(
                this.currentPlayer
            ) ===
            this.botIndex
        );
    }


    hasPendingAction() {

        return (
            this.action !== null &&
            this.action !== undefined
        );
    }


    isNormalTurn() {

        return (
            this.action === null
        );
    }


    /* ========================================================
     * SCORE
     * ====================================================== */

    getScore(
        playerIndex = this.botIndex
    ) {

        const player =
            this.getPlayer(
                playerIndex
            );

        return player
            ? player.score
            : null;
    }


    getScores() {

        return this.players.map(
            player => ({
                player:
                    player.id,

                score:
                    player.score
            })
        );
    }


    /* ========================================================
     * CIBLES
     * ====================================================== */

    getTargetPlayer() {

        if (
            this.target === null ||
            this.target === undefined
        ) {
            return null;
        }

        return this.getOpponent(
            this.target
        );
    }


    getLegalOpponentIds() {

        return this.players
            .filter(
                player =>
                    player.id !==
                    this.botIndex
            )
            .map(
                player =>
                    player.id
            );
    }


    /* ========================================================
     * CARTES DES ADVERSAIRES
     * ====================================================== */

    /**
     * Important :
     *
     * Cette méthode ne prétend jamais connaître le contenu
     * d'une main cachée.
     *
     * Elle donne uniquement le nombre de cartes connu.
     */
    getOpponentCardCount(
        playerIndex
    ) {

        const player =
            this.getOpponent(
                playerIndex
            );

        return player
            ? player.cardCount
            : 0;
    }


    getUnknownCardCount() {

        return this.getOpponents()
            .reduce(
                (
                    total,
                    player
                ) =>
                    total +
                    player.cardCount,
                0
            );
    }


    /* ========================================================
     * INFORMATIONS SPÉCIALES
     * ====================================================== */

    isDouble9() {

        return (
            this.action ===
            "double9"
        );
    }


    isDouble17() {

        return (
            this.double17Active ||
            this.action ===
                "double17"
        );
    }


    isCard17() {

        return (
            this.action ===
            "carte17"
        );
    }


    isCard19() {

        return (
            this.action ===
            "carte19"
        );
    }


    isDouble19() {

        return (
            this.action ===
            "double19"
        );
    }


    /* ========================================================
     * PHASE DE PARTIE
     * ====================================================== */

    /**
     * Nombre total de cartes théoriquement utilisées.
     *
     * Les règles actuelles du jeu utilisent :
     *
     * 2-3 joueurs : 44
     * 4 joueurs   : 66
     * 5 joueurs   : 88
     * 6 joueurs   : 110
     * 7 joueurs   : 132
     * 8 joueurs   : 154
     */
    getTotalCardCount() {

        const count =
            this.players.length;

        if (count <= 3) {
            return 44;
        }

        return (
            (count - 1) *
            22
        );
    }


    /**
     * Nombre de cartes déjà sorties.
     *
     * Cette estimation utilise :
     *
     * cartes en main connues
     * + cartes sur table
     * + défausse
     * + pioche restante
     *
     * La pioche est connue seulement en quantité,
     * pas en contenu.
     */
    getCardsProgress() {

        const total =
            this.getTotalCardCount();

        if (total <= 0) {
            return 0;
        }

        const remaining =
            this.deckCount;

        return Math.max(
            0,
            Math.min(
                1,
                1 -
                (
                    remaining /
                    total
                )
            )
        );
    }


    /* ========================================================
     * COPIE POUR SIMULATION
     * ====================================================== */

    /**
     * Produit une représentation mutable.
     *
     * Le moteur de simulation pourra travailler dessus sans
     * modifier l'état réel observé.
     */
    toMutableObject() {

        return clone({
            botIndex:
                this.botIndex,

            players:
                this.players,

            deckCount:
                this.deckCount,

            table:
                this.table,

            discard:
                this.discard,

            history:
                this.history,

            currentPlayer:
                this.currentPlayer,

            action:
                this.action,

            target:
                this.target,

            selection:
                this.selection,

            toursJoker:
                this.toursJoker,

            player17:
                this.player17,

            card17Pending:
                this.card17Pending,

            double17Cards:
                this.double17Cards,

            double17Active:
                this.double17Active,

            player19:
                this.player19,

            winner:
                this.winner,

            roundWinner:
                this.roundWinner,

            roundEnded:
                this.roundEnded,

            victories:
                this.victories,

            modeJeu:
                this.modeJeu
        });
    }


    /* ========================================================
     * SIGNATURE
     * ====================================================== */

    /**
     * Signature légère utilisée pour détecter si deux états
     * sont identiques.
     */
    signature() {

        return JSON.stringify({
            players:
                this.players.map(
                    player => ({
                        id:
                            player.id,

                        score:
                            player.score,

                        cardCount:
                            player.cardCount,

                        main:
                            player.handKnown
                                ? player.main
                                : undefined
                    })
                ),

            deckCount:
                this.deckCount,

            table:
                this.table,

            discard:
                this.discard,

            currentPlayer:
                this.currentPlayer,

            action:
                this.action,

            target:
                this.target,

            player17:
                this.player17,

            card17Pending:
                this.card17Pending,

            double17Cards:
                this.double17Cards,

            double17Active:
                this.double17Active,

            player19:
                this.player19,

            roundEnded:
                this.roundEnded
        });
    }
}


/* ============================================================
 * CONSTRUCTEUR DEPUIS LE MOTEUR
 * ========================================================== */

/**
 * Utilisation :
 *
 * const state =
 *     GameState.fromEngine(
 *         engine,
 *         botIndex
 *     );
 */
export function createGameState(
    engine,
    botIndex
) {

    if (
        !engine ||
        typeof engine.stateFor !==
            "function"
    ) {
        throw new Error(
            "Moteur Atoumoulin invalide."
        );
    }

    const raw =
        engine.stateFor(
            Number(botIndex)
        );

    return new AtoumoulinGameState(
        raw,
        Number(botIndex)
    );
}


/* ============================================================
 * COPIE
 * ========================================================== */

export function cloneGameState(
    state
) {

    if (
        !(state instanceof
          AtoumoulinGameState)
    ) {
        throw new Error(
            "cloneGameState attend un AtoumoulinGameState."
        );
    }

    return new AtoumoulinGameState(
        state.toMutableObject(),
        state.botIndex
    );
}
