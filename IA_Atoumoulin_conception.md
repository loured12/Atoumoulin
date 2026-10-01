# Conception de l’IA Atoumoulin

## 1. Objectif

Créer une IA capable d'adapter ses décisions :

* à la main qu'elle possède ;
* à la situation actuelle de la partie ;
* aux possibilités légalement disponibles ;
* aux informations auxquelles elle a réellement accès ;
* au niveau de difficulté choisi.

L'IA ne repose pas sur des combinaisons de cartes préprogrammées. Elle analyse les actions disponibles, leurs conséquences et l'état résultant.

Principe fondamental :

> **Carte → action complète → état résultant → évaluation → décision.**

L'IA ne doit jamais utiliser une information cachée qu'elle n'est pas censée connaître.

---

## 2. Détermination des actions légalement disponibles

La légalité est déterminée avant toute évaluation stratégique.

Ordre des priorités :

1. **Double 7**
2. **7 simple**
3. **Double X**
4. **Carte simple**

Si trois cartes identiques ou plus sont présentes, une seule double est formée et jouée ; les cartes restantes restent en main.

Exemple :

* 7 / 7 / 7 / 15 / 21 → Double 7.
* 7 / 15 / 15 / 21 → 7 simple.
* Double 9 / Double 15 / 12 → choix entre les deux doubles.

Le moteur stratégique ne peut jamais sélectionner une action interdite par ces règles.

---

## 3. Informations accessibles

L'IA distingue toujours :

### État réel

Toutes les cartes et informations internes du moteur de jeu.

### Connaissance de l'IA

Uniquement les informations auxquelles elle a réellement accès.

Exemples :

* 9 simple → l'IA connaît le nombre de cartes dans les mains adverses, pas leur contenu.
* Double 9 → l'IA voit les mains et peut choisir son adversaire.
* 19 et Double 19 → aucune vision des mains adverses.
* 17 et Double 17 → carte(s) volée(s) inconnue avant le vol.
* 1 / Double 1 → l'IA connaît les derniers scores éligibles.
* Les informations cachées sont estimées sans jamais être révélées artificiellement.

---

## 4. Difficulté

Même moteur stratégique pour tous les niveaux.

| Difficulté | Stratégique | Random |
| ---------- | ----------: | -----: |
| Facile     |        0 % |   100 % |
| Normale    |        60 % |   40 % |
| Difficile  |        90 % |   10 % |
| Expert     |       100 % |    0 % |

Le hasard ne choisit jamais une action illégale.

Il peut sélectionner une possibilité moins optimale, mais raisonnablement proche ou pertinente.

Une victoire immédiate n'est pas traitée par un sélecteur spécial : elle passe par le même moteur d'évaluation.

---

## 5. Complexité

Trois niveaux :

* **Simple**
* **Moyenne**
* **Complexe**

La complexité dépend notamment :

* du nombre de possibilités ;
* du nombre de critères à comparer ;
* des conséquences ;
* des informations cachées ;
* de l'incertitude ;
* de la profondeur de recherche nécessaire.

La puissance de l'effet ne détermine pas automatiquement sa complexité.

Exemple : Double Joker est puissant mais simple, car il n'offre aucun choix d'effet ou de cible.

---

## 6. Une possibilité = une action complète

Une carte seule n'est pas nécessairement une possibilité.

Exemples :

* `13 → Joueur A → carte 40`
* `21 → +20 → soi`
* `21 → -20 → Joueur B`
* `15 → carte personnelle 40`
* `Joker → échange de scores → Joueur C`

Chaque action complète reçoit son propre score.

---

## 7. Simulation

Pour chaque possibilité :

> **État actuel + action → état résultant virtuel**

Le moteur crée une simulation sans modifier immédiatement la partie réelle.

L'état simulé peut contenir :

* scores ;
* mains ;
* cartes jouées ;
* cartes liées ;
* pioche ;
* effets temporaires ;
* informations nouvellement révélées.

Le même moteur de simulation sert à :

* l'évaluation immédiate ;
* la recherche de finition ;
* l'évaluation du danger adverse ;
* la recherche de plans futurs.

---

# 8. Recherche future

La recherche est effectuée par nombre de tours.

* Profondeur 1 → action actuelle.
* Profondeur 2 → action actuelle + prochain tour.
* Profondeur 3 → + deux tours futurs.
* etc.

À chaque futur tour :

> nouvel état → nouvelles informations → nouvelles actions légales → nouvelles priorités.

La recherche respecte donc toujours les règles de priorité.

### Recherche générale

* Facile → principalement 1 tour.
* Normale → environ 2 tours.
* Difficile → environ 3 tours.
* Expert → recherche adaptative.

### Recherche de finition

Une recherche de finition exacte peut dépasser la profondeur générale si nécessaire.

---

# 9. Potentiel de finition

L'IA cherche le nombre minimal de tours nécessaires pour :

* atteindre exactement la cible ;
* ou, si elle est au-dessus, revenir exactement à la cible.

Ordre :

1. finition en 1 tour ;
2. sinon 2 tours ;
3. sinon 3 tours ;
4. etc.

Toute action légale permettant d'atteindre exactement la cible dans le même nombre de tours compte comme un plan de même niveau.

Direct, 13 et 15 sont donc comparés selon le nombre de tours nécessaires, pas selon le nombre de possibilités techniques.

### Valeur du nombre de tours

| Tours      | Valeur |
| ---------- | -----: |
| 1          |    100 |
| 2          |     70 |
| 3          |     45 |
| 4          |     25 |
| 5+         |     10 |
| Impossible |      0 |

### Certitude

| Certitude     | Valeur |
| ------------- | -----: |
| Certaine      |  100 % |
| Très probable |   80 % |
| Possible      |   55 % |
| Faible        |   30 % |
| Impossible    |    0 % |

La certitude représente la probabilité que **l'ensemble du plan** aboutisse réellement.

Elle tient compte notamment :

* de la réalisation du plan ;
* des informations connues ;
* du hasard ;
* de la dépendance aux actions adverses.

### Potentiel de finition

> **Potentiel de finition = Valeur du nombre de tours × Certitude / 100**

Exemple :

* 1 tour certain → 100
* 1 tour à 50 % → 50
* 2 tours certains → 70
* 3 tours à 80 % → 36

---

# 10. Progression

La progression mesure la capacité d'une situation à améliorer durablement la position vers la cible.

Elle ne signifie pas simplement « gagner plus de points ».

> **Progression = (Amélioration du score ×25 + Chemins vers la cible ×30 + Diversité ×20 + Qualité des cartes ×15 + Adaptation ×10) ÷100**

Les critères sont évalués de 0 à 100.

Échelle générale :

* 90–100 : excellente
* 70–89 : très bonne
* 50–69 : correcte
* 30–49 : faible
* 10–29 : très faible
* 0–9 : pratiquement aucune

La proximité brute de la cible ne suffit jamais à déterminer la progression.

---

# 11. Stabilité

La stabilité mesure la résistance de la situation à la disparition ou à l'échec d'un plan.

> **Stabilité = (Plans de secours ×35 + Diversité ×30 + Indépendance à l'incertitude ×20 + Récupération ×15) ÷100**

Différence :

* **Stabilité** = résistance si un plan échoue.
* **Flexibilité** = diversité des stratégies disponibles.

---

# 12. Position personnelle

> **Position = (Finition/retour ×90 + Progression ×65 + Stabilité ×55) ÷210**

La finition/retour reste le critère principal.

---

# 13. Évaluation des adversaires

L'IA applique les mêmes principes aux adversaires, mais uniquement avec les informations accessibles.

### Information connue

Évaluation directe.

### Information inconnue

L'IA utilise quelques scénarios stratégiquement pertinents.

Exemple :

* scénario avec bonne finition ;
* scénario avec progression ;
* scénario avec forte manipulation ;
* scénario faible ;
* scénario de récupération.

Valeur estimée :

> **Évaluation = Σ (probabilité du scénario × valeur du scénario)**

L'IA ne reconstruit jamais artificiellement la main cachée de l'adversaire.

---

# 14. Danger individuel adverse

Le danger d'un adversaire n'est jamais simplement sa distance à la cible.

Il dépend notamment de sa capacité réelle à :

* finir ;
* revenir à la cible ;
* progresser ;
* manipuler les scores ;
* conserver plusieurs plans ;
* récupérer après un échec.

### Danger

> **Danger = (Finition/retour ×50 + Position ×20 + Possibilités ×20 + Stabilité ×10) ÷100**

Les possibilités mesurent notamment :

* nombre d'actions intéressantes ;
* diversité ;
* possibilités de score ;
* réduction de score ;
* manipulation ;
* préparation d'une finition ;
* perturbation.

---

# 15. Potentiel futur adverse

> **Potentiel futur = (Progression ×40 + Manipulation ×30 + Qualité des cartes ×20 + Création ×10) ÷100**

La création mesure notamment :

* nouvelles cartes ;
* nouvelles combinaisons ;
* modification de la situation ;
* informations utiles.

---

# 16. Situation adverse

> **Situation adverse = (Danger ×100 + Potentiel futur ×65 + Stabilité ×50) ÷215**

On conserve deux indicateurs globaux :

* **danger maximal** d'un adversaire ;
* **danger moyen** de l'ensemble des adversaires.

Le danger global n'est pas simplement la somme des dangers.

---

# 17. Impact adversaire

Après simulation :

> **Évolution = Situation adverse après − Situation adverse avant**

Une réduction de la situation adverse correspond à un impact positif pour l'IA.

La réduction est transformée en valeur d'impact selon une échelle progressive.

---

# 18. Impact personnel

> **Impact personnel = (Position ×95 + Qualité main ×60 + Possibilités restantes ×45) ÷200**

### Position

> **Position = (Finition/retour ×90 + Progression ×65 + Stabilité ×55) ÷210**

### Qualité de la main

> **Qualité main = (Actions ×25 + Finition ×25 + Manipulation ×20 + Doubles ×15 + Synergies ×15) ÷100**

La qualité d'une carte dépend de son utilité réelle dans la situation, pas de sa valeur numérique.

### Possibilités restantes

> **Possibilités = (Actions ×25 + Diversité ×20 + Finition ×20 + Manipulation ×15 + Réponses ×10 + Plans ×10) ÷100**

---

# 19. Potentiel futur après action

> **Potentiel futur = (Possibilités futures ×35 + Main après action ×30 + Flexibilité ×30 + Création ×10) ÷105**

### Flexibilité

> **Flexibilité = (Diversité des plans ×35 + Indépendance ×25 + Adaptation adversaires ×25 + Adaptation événements ×15) ÷100**

La flexibilité représente la diversité de stratégies réellement disponibles.

---

# 20. Coût d'opportunité

> **Coût = (Sacrifice ×50 + Alternatives abandonnées ×30 + Rareté ×20) ÷100**

Il mesure ce que l'action consomme ou abandonne.

### Sacrifice

De négligeable à quasi-irremplaçable.

### Alternatives

Uniquement les alternatives légalement disponibles.

### Rareté

Difficulté à récupérer ou remplacer la ressource consommée.

Le coût évite de compter deux fois une perte déjà intégrée dans la qualité de la main.

---

# 21. Risque

> **Risque = (Probabilité défavorable ×40 + Gravité ×40 + Difficulté de récupération ×20) ÷100**

### Probabilité défavorable

De pratiquement nulle à quasi certaine.

### Gravité

De négligeable à critique.

La gravité dépend du contexte : perdre 10 points peut être insignifiant dans une situation et décisif dans une autre.

### Difficulté de récupération

De correction immédiate à pratiquement impossible.

L'incertitude seule n'est pas automatiquement considérée comme un risque.

---

# 22. Score final

Le score final d'une possibilité est :

> **Score final = Impact personnel ×0,40 + Impact adversaire ×0,30 + Potentiel futur ×0,15 − Coût d'opportunité ×0,10 − Risque ×0,05**

Les coefficients restent paramétrables pour les tests futurs.

---

# 23. Cible et position

La cible doit être traitée dynamiquement.

Le moteur ne considère jamais simplement :

> « Plus proche de la cible = meilleur. »

Il doit tenir compte :

* du score actuel ;
* de la possibilité de finir exactement ;
* de la possibilité de revenir exactement ;
* des cartes réellement disponibles ;
* des mécanismes indirects ;
* de la phase de la partie.

### Progression de la partie

> **Progression = cartes déjà sorties / nombre total de cartes**

Les cartes sorties comprennent les cartes :

* jouées ;
* défaussées ;
* présentes dans les mains.

Nombre total selon le nombre de joueurs :

* 2–3 joueurs : 44
* 4 joueurs : 66
* 5 joueurs : 88
* 6 joueurs : 110
* 7 joueurs : 132
* 8 joueurs : 154

Le poids de la distance finale augmente progressivement au cours de la partie.

---

# 24. Fin de partie

Si personne n'atteint exactement la cible lorsque toutes les cartes sont épuisées :

> **le joueur le plus proche de la cible gagne la manche.**

Cette règle donne davantage d'importance à la distance absolue en fin de partie.

Mais l'exactitude reste prioritaire : atteindre exactement la cible termine immédiatement la manche.

---

# 25. Classement et choix équivalents

Après évaluation :

1. classer les possibilités ;
2. identifier les choix proches ;
3. former des groupes selon une tolérance ;
4. appliquer le niveau de difficulté.

Exemple :

> 94 / 92 / 89 / 63 / 41

Avec une tolérance de 5 :

* groupe 1 : 94 / 92 / 89
* groupe 2 : 63
* groupe 3 : 41

La tolérance peut être adaptée selon la complexité de la décision.

---

# 26. Cycle complet de décision

1. Lire l'état réel.
2. Déterminer les informations accessibles.
3. Déterminer les actions légales.
4. Appliquer les priorités.
5. Générer les possibilités complètes.
6. Simuler chaque possibilité.
7. Rechercher les conséquences futures.
8. Calculer finition/retour.
9. Calculer progression et stabilité.
10. Calculer impact personnel.
11. Calculer danger et impact adversaire.
12. Calculer potentiel futur.
13. Calculer coût d'opportunité.
14. Calculer risque.
15. Calculer le score final.
16. Classer les possibilités.
17. Regrouper les choix proches.
18. Appliquer la difficulté.
19. Choisir l'action.
20. Exécuter réellement l'action.
21. Mettre à jour l'état.
22. Recommencer.

---

# 27. Principe général définitif

Le cœur de l'IA est :

> **État actuel → actions légales → possibilités complètes → simulation → état résultant → conséquences futures → évaluation → classement → difficulté → action.**

L'IA ne mémorise donc pas simplement :

> « Le 13 est une bonne carte. »

Elle cherche plutôt :

> « Dans cet état précis, quelle utilisation légale du 13 produit le meilleur résultat parmi toutes les possibilités disponibles ? »

C'est cette architecture qui permet à l'IA de s'adapter à des situations nouvelles sans devoir programmer manuellement chaque combinaison de cartes.
