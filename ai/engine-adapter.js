/**
 * Atoumoulin AI
 * engine-adapter.js
 *
 * Pont entre :
 *
 *   nouvelle IA
 *       ↓
 *   action complète
 *       ↓
 *   moteur réel Atoumoulin
 *
 * Le fichier ne contient aucune logique stratégique.
 *
 * Son seul rôle est de transformer une action choisie par l'IA
 * en appels aux fonctions déjà exposées par server/engine.js.
 *
 * IMPORTANT :
 * - l'ancien bot n'est pas modifié ;
 * - script.js n'est pas modifié ;
 * - aucune règle du jeu n'est redéfinie ici ;
 * - une action illégale est refusée ;
 * - les commandes présentes dans action.commands sont prioritaires.
 */


/* =========================================================
 * UTILITAIRES
 * ========================================================= */

function number(value) {
    const n = Number(value);

    return Number.isFinite(n)
        ? n
        : null;
}


function cardValue(card) {
    if (card == null) {
        return null;
    }

    if (
        typeof card === "number" ||
        typeof card === "string"
    ) {
        return card;
    }

    return (
        card.value ??
        card.valeur ??
        card.cardValue ??
        null
    );
}


function normalizeTarget(target) {
    const n = Number(target);

    return Number.isInteger(n)
        ? n
        : null;
}


function getPlayerIndex(engine, fallback = 0) {
    if (
        engine &&
        typeof engine.currentIndex === "function"
    ) {
        return Number(
            engine.currentIndex()
        );
    }

    return Number(fallback);
}


/* =========================================================
 * ADAPTATEUR
 * ========================================================= */

export class AtoumoulinEngineAdapter {
    constructor(
        engine,
        {
            strict = true,
            debug = false
        } = {}
    ) {
        if (!engine) {
            throw new Error(
                "AtoumoulinEngineAdapter : moteur absent."
            );
        }

        this.engine = engine;
        this.strict = !!strict;
        this.debug = !!debug;
    }


    /* =====================================================
     * LOG
     * ===================================================== */

    log(...args) {
        if (this.debug) {
            console.log(
                "[Atoumoulin AI adapter]",
                ...args
            );
        }
    }


    /* =====================================================
     * ÉTAT
     * ===================================================== */

    getState(
        playerIndex,
        selection = null
    ) {
        if (
            typeof this.engine.stateFor !==
            "function"
        ) {
            throw new Error(
                "Le moteur ne fournit pas stateFor()."
            );
        }

        return this.engine.stateFor(
            playerIndex,
            selection
        );
    }


    /* =====================================================
     * EXÉCUTION BAS NIVEAU
     * ===================================================== */

    apply(
        functionName,
        args = []
    ) {
        this.log(
            "apply",
            functionName,
            args
        );

        return this.engine.apply(
            functionName,
            args
        );
    }


    setPlayer(
        playerIndex
    ) {
        if (
            typeof this.engine.setPlayerIndex ===
            "function"
        ) {
            this.engine.setPlayerIndex(
                Number(playerIndex)
            );
        }
    }


    setSelection(
        value
    ) {
        if (
            typeof this.engine.setSelection ===
            "function"
        ) {
            this.engine.setSelection(
                value
            );
        }
    }


    /* =====================================================
     * COMMANDES EXPLICITES DE L'ACTION
     *
     * C'est la voie privilégiée.
     *
     * action-generator peut fournir :
     *
     * commands: [
     *   {
     *      fn: "jouerCarte",
     *      args: [...]
     *   }
     * ]
     *
     * ou :
     *
     * commands: [
     *   ["jouerCarte", [...]],
     *   ["choisirAdversaireCarte13", [1]]
     * ]
     * ===================================================== */

    executeCommand(
        command,
        playerIndex
    ) {
        if (!command) {
            return false;
        }

        let functionName = null;
        let args = [];

        if (
            Array.isArray(command)
        ) {
            functionName =
                command[0];

            args =
                Array.isArray(command[1])
                    ? command[1]
                    : [];
        } else if (
            typeof command === "object"
        ) {
            functionName =
                command.fn ??
                command.function ??
                command.functionName ??
                command.name ??
                null;

            args =
                Array.isArray(command.args)
                    ? command.args
                    : [];
        } else if (
            typeof command === "string"
        ) {
            functionName =
                command;

            args = [];
        }

        if (
            typeof functionName !==
            "string"
        ) {
            throw new Error(
                "Commande IA invalide."
            );
        }

        this.setPlayer(
            playerIndex
        );

        this.apply(
            functionName,
            args
        );

        return true;
    }


    executeCommands(
        commands,
        playerIndex
    ) {
        if (
            !Array.isArray(commands) ||
            !commands.length
        ) {
            return false;
        }

        let executed = false;

        for (
            const command of commands
        ) {
            this.executeCommand(
                command,
                playerIndex
            );

            executed = true;
        }

        return executed;
    }


    /* =====================================================
     * SÉLECTION D'UNE CARTE
     * ===================================================== */

    selectCard(
        playerIndex,
        cardIndex
    ) {
        if (
            !Number.isInteger(
                Number(cardIndex)
            )
        ) {
            throw new Error(
                "Index de carte invalide."
            );
        }

        this.setPlayer(
            playerIndex
        );

        if (
            typeof this.engine.selectCard ===
            "function"
        ) {
            this.engine.selectCard(
                Number(cardIndex),
                Number(playerIndex)
            );

            return;
        }

        this.setSelection(
            Number(cardIndex)
        );
    }


    selectDouble(
        playerIndex,
        cardIndex
    ) {
        if (
            !Number.isInteger(
                Number(cardIndex)
            )
        ) {
            throw new Error(
                "Index de double invalide."
            );
        }

        this.setPlayer(
            playerIndex
        );

        if (
            typeof this.engine.selectDouble13 ===
            "function"
        ) {
            /*
             * Le moteur actuel expose cette fonction
             * pour la sélection spécifique de Double13.
             *
             * Les autres doubles passent normalement
             * par les commandes explicites de l'action.
             */
            this.engine.selectDouble13(
                Number(cardIndex),
                Number(playerIndex)
            );

            return;
        }

        this.setSelection(
            Number(cardIndex)
        );
    }


    /* =====================================================
     * ACTION SIMPLE
     * ===================================================== */

    playCard(
        action,
        playerIndex
    ) {
        const index =
            number(
                action.cardIndex
            );

        if (
            index === null
        ) {
            throw new Error(
                "Impossible de jouer une carte sans cardIndex."
            );
        }

        this.setPlayer(
            playerIndex
        );

        /*
         * Si action-generator fournit les commandes,
         * elles sont la source de vérité.
         */
        if (
            Array.isArray(
                action.commands
            ) &&
            action.commands.length
        ) {
            return this.executeCommands(
                action.commands,
                playerIndex
            );
        }

        /*
         * Sinon on prépare la sélection puis on appelle
         * la fonction centrale du moteur.
         */
        this.selectCard(
            playerIndex,
            index
        );

        this.apply(
            "jouerCarte",
            []
        );

        return true;
    }


    /* =====================================================
     * DOUBLE
     * ===================================================== */

    playDouble(
        action,
        playerIndex
    ) {
        this.setPlayer(
            playerIndex
        );

        if (
            Array.isArray(
                action.commands
            ) &&
            action.commands.length
        ) {
            return this.executeCommands(
                action.commands,
                playerIndex
            );
        }

        const indices =
            Array.isArray(
                action.cardIndices
            )
                ? action.cardIndices
                : [];

        /*
         * Pour un double générique, les indices peuvent
         * être fournis directement par l'action.
         *
         * Si le générateur fournit seulement cardIndex,
         * on utilise celui-ci comme première sélection.
         */
        if (
            indices.length >= 2
        ) {
            this.setSelection(
                indices.slice(
                    0,
                    2
                )
            );
        } else if (
            action.cardIndex != null
        ) {
            this.setSelection(
                Number(
                    action.cardIndex
                )
            );
        }

        /*
         * La logique exacte du double est normalement
         * décrite par action.commands.
         *
         * On ne devine donc pas ici une fonction script.js
         * qui n'aurait pas été explicitement déclarée.
         */
        if (
            this.strict
        ) {
            throw new Error(
                "Double sans commands explicites : " +
                "l'adaptateur refuse de deviner la séquence moteur."
            );
        }

        return false;
    }


    /* =====================================================
     * ACTION AVEC CIBLE
     * ===================================================== */

    executeTargetAction(
        action,
        playerIndex
    ) {
        const target =
            normalizeTarget(
                action.target
            );

        if (
            target === null
        ) {
            throw new Error(
                "Action ciblée sans cible valide."
            );
        }

        this.setPlayer(
            playerIndex
        );

        /*
         * Priorité aux commandes générées.
         */
        if (
            Array.isArray(
                action.commands
            ) &&
            action.commands.length
        ) {
            return this.executeCommands(
                action.commands,
                playerIndex
            );
        }

        /*
         * Sans commande explicite, on ne lance
         * aucune fonction arbitraire.
         */
        if (
            this.strict
        ) {
            throw new Error(
                "Action ciblée sans commands explicites."
            );
        }

        return false;
    }


    /* =====================================================
     * ACTION INTERMÉDIAIRE
     * ===================================================== */

    executePendingAction(
        action,
        playerIndex
    ) {
        this.setPlayer(
            playerIndex
        );

        if (
            Array.isArray(
                action.commands
            ) &&
            action.commands.length
        ) {
            return this.executeCommands(
                action.commands,
                playerIndex
            );
        }

        if (
            this.strict
        ) {
            throw new Error(
                "Action intermédiaire sans commands explicites."
            );
        }

        return false;
    }


    /* =====================================================
     * DISPATCH
     * ===================================================== */

    execute(
        action,
        playerIndex = null
    ) {
        if (!action) {
            throw new Error(
                "Aucune action IA à exécuter."
            );
        }

        const actualPlayer =
            playerIndex === null
                ? getPlayerIndex(
                    this.engine
                )
                : Number(
                    playerIndex
                );

        if (
            !Number.isInteger(
                actualPlayer
            )
        ) {
            throw new Error(
                "Joueur IA invalide."
            );
        }

        this.log(
            "action complète",
            action
        );

        const kind =
            String(
                action.kind ??
                action.type ??
                ""
            ).toUpperCase();

        /*
         * 1. Commandes explicites.
         *
         * C'est la priorité absolue :
         * l'action-generator connaît alors exactement
         * comment transformer l'action en commandes moteur.
         */
        if (
            Array.isArray(
                action.commands
            ) &&
            action.commands.length
        ) {
            this.executeCommands(
                action.commands,
                actualPlayer
            );

            return this.getState(
                actualPlayer
            );
        }

        /*
         * 2. Action simple.
         */
        if (
            kind === "PLAY_CARD" ||
            String(
                action.type
            ).toLowerCase() === "card"
        ) {
            this.playCard(
                action,
                actualPlayer
            );

            return this.getState(
                actualPlayer
            );
        }

        /*
         * 3. Double.
         */
        if (
            kind === "PLAY_DOUBLE" ||
            String(
                action.type
            ).toLowerCase() === "double"
        ) {
            this.playDouble(
                action,
                actualPlayer
            );

            return this.getState(
                actualPlayer
            );
        }

        /*
         * 4. Action intermédiaire.
         */
        if (
            kind === "CONTINUE" ||
            kind === "FINISH" ||
            kind === "CHOOSE_EFFECT" ||
            kind === "CHOOSE_TABLE_CARD" ||
            kind === "CHOOSE_MULTIPLE_TABLE_CARDS" ||
            kind === "CHOOSE_REVEALED_CARD"
        ) {
            this.executePendingAction(
                action,
                actualPlayer
            );

            return this.getState(
                actualPlayer
            );
        }

        /*
         * 5. Action ciblée.
         */
        if (
            kind === "CHOOSE_TARGET"
        ) {
            this.executeTargetAction(
                action,
                actualPlayer
            );

            return this.getState(
                actualPlayer
            );
        }

        /*
         * 6. Type inconnu.
         */
        throw new Error(
            `Type d'action IA inconnu : ${kind || "inconnu"}`
        );
    }


    /* =====================================================
     * EXÉCUTION SÉCURISÉE
     * ===================================================== */

    tryExecute(
        action,
        playerIndex = null
    ) {
        try {
            const state =
                this.execute(
                    action,
                    playerIndex
                );

            return {
                ok: true,
                state,
                action,
                error: null
            };
        } catch (error) {
            return {
                ok: false,
                state: null,
                action,
                error:
                    error?.message ||
                    String(error)
            };
        }
    }
}


/* =========================================================
 * FONCTIONS UTILITAIRES
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


export function executeBotAction(
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


export function tryExecuteBotAction(
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

    return adapter.tryExecute(
        action,
        playerIndex
    );
}


export default {
    AtoumoulinEngineAdapter,
    createEngineAdapter,
    executeBotAction,
    tryExecuteBotAction
};
