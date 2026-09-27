# Conception de l'IA Atoumoulin

## 1. Objectif

Créer une IA capable d'adapter ses décisions :

* à la main qu'elle possède ;
* à la situation actuelle de la partie ;
* aux possibilités disponibles ;
* aux informations auxquelles elle a réellement accès ;
* au niveau de difficulté choisi.

L'IA doit analyser et évaluer les possibilités disponibles plutôt que de fonctionner avec des combinaisons de cartes préprogrammées.

L'objectif est de permettre à l'IA de prendre des décisions cohérentes, y compris dans des situations qu'elle n'a jamais rencontrées auparavant.

L'IA ne doit jamais utiliser une information qu'elle n'est pas censée connaître. Le système doit donc distinguer les informations **visibles et accessibles par le bot** des informations **cachées aux joueurs**.

---

## 2. Détermination des actions légalement disponibles

Avant toute analyse stratégique, l'IA doit déterminer quelles actions sont réellement autorisées par les règles du jeu.

Le système stratégique ne doit jamais pouvoir sélectionner une action interdite.

L'ordre de priorité est :

1. **7 présent dans la main** → le 7 doit être joué.
2. **Aucun 7 mais un ou plusieurs doubles présents** → le bot doit choisir parmi les doubles disponibles.
3. **Aucun 7 et aucun double** → le bot peut choisir librement parmi les cartes simples disponibles.

Si un seul double est disponible, celui-ci doit être joué.

Si plusieurs doubles différents sont disponibles, l'IA peut analyser chacun d'eux et choisir le meilleur stratégiquement.

Cette règle s'applique à tous les doubles.

La stratégie intervient donc **après le filtrage des actions légales**.

Exemple :

```text
Main :
7 / 15 / Double 9

→ Le 7 est obligatoire.
→ L'IA ne compare pas le 7 avec le Double 9 ou le 15.
```

Autre exemple :

```text
Main :
Double 9 / Double 15 / 12

→ Aucun 7.
→ Les doubles sont prioritaires.
→ L'IA compare uniquement Double 9 et Double 15.
```

---

## 3. Informations disponibles

L'IA doit prendre ses décisions uniquement à partir des informations auxquelles elle a légalement accès.

Le système doit donc séparer :

* les informations connues par l'IA ;
* les informations visibles dans la situation actuelle ;
* les informations cachées appartenant aux adversaires ;
* les informations révélées temporairement par certaines cartes.

Exemples :

* **9 simple** → l'IA connaît le nombre de cartes dans les mains adverses, mais pas leur contenu.
* **Double 9** → l'IA peut voir le contenu des mains et choisir le joueur avec lequel elle souhaite échanger.
* **19 simple** → l'IA utilise les dernières cartes de score jouées par les joueurs concernés.
* **Double 19** → l'IA peut également voir le contenu des mains adverses conformément aux règles de cette carte.
* **17** → la carte volée est inconnue avant le vol. L'IA ne doit donc pas connaître à l'avance la carte qui sera tirée.

L'IA ne doit jamais utiliser une information cachée uniquement parce que cette information existe dans l'état interne du jeu.

---

## 4. Niveaux de difficulté

Les différents niveaux utilisent le même système d'évaluation stratégique, mais ne sélectionnent pas leurs actions de la même manière.

* **Facile** → 40 % stratégique / 60 % aléatoire
* **Normal** → 75 % stratégique / 25 % aléatoire
* **Difficile** → 90 % stratégique / 10 % aléatoire
* **Expert** → 100 % stratégique / 0 % aléatoire

Ces pourcentages constituent une base et pourront être adaptés selon la complexité de la décision.

L'aléatoire ne signifie pas nécessairement choisir n'importe quelle action.

Lorsqu'il existe plusieurs choix intéressants, l'aléatoire peut permettre au bot de varier son choix parmi ces possibilités.

L'aléatoire ne doit cependant jamais permettre au bot de choisir une action qui n'est pas légalement disponible.

---

## 5. Complexité des décisions

Chaque décision pourra être classée comme :

* **Simple**
* **Moyenne**
* **Complexe**

Une décision simple pourra être correctement évaluée même par un bot de niveau normal.

Une décision moyenne pourra nécessiter la prise en compte de plusieurs critères.

Une décision complexe pourra prendre en compte davantage de conséquences, d'informations, de possibilités ou d'incertitudes.

La complexité pourra donc permettre de différencier davantage les niveaux de difficulté.

Elle pourra également influencer :

* la précision de l'évaluation ;
* la tolérance utilisée pour considérer plusieurs choix comme proches ;
* la quantité de possibilités considérées comme intéressantes ;
* l'influence de l'aléatoire dans la sélection finale.

La complexité ne modifie pas les règles du jeu : elle sert uniquement à déterminer la difficulté d'analyse d'une décision.

---

## 6. Définition d'une possibilité

Une possibilité évaluée par l'IA doit correspondre à une **action complète**, et pas simplement au nom de la carte jouée.

Une action complète peut comprendre :

* la carte jouée ;
* l'effet choisi ;
* la cible choisie ;
* éventuellement la carte ou l'élément ciblé.

Exemples :

```text
11 → +10 à soi
11 → -10 à soi

21 → +20 à soi
21 → -20 au joueur A
21 → -20 au joueur B

Joker → +10
Joker → +22
Joker → échange de score avec le joueur A
Joker → échange de score avec le joueur B
```

De la même manière :

```text
9 → échange avec le joueur A
9 → échange avec le joueur B

15 → doublement de la carte de score A
15 → doublement de la carte de score B
```

Chaque possibilité concrète doit pouvoir recevoir sa propre évaluation.

---

## 7. Système d'évaluation

Chaque possibilité sera évaluée avec un système de points.

Le score représentera la qualité estimée d'une action dans la situation actuelle.

Plusieurs critères pourront être utilisés pour calculer ce score, par exemple :

* avantage immédiat ;
* avantage futur ;
* proximité de la cible ;
* sécurité ;
* risque ;
* coût de l'action ;
* informations obtenues ;
* synergie avec la main ;
* influence sur les adversaires ;
* conséquences possibles ;
* potentiel de la situation créée.

Les critères définitifs ainsi que leurs valeurs seront définis ultérieurement selon les règles d'Atoumoulin.

La valeur d'une action ne doit pas être considérée comme fixe.

Par exemple, un gain de **+20** peut avoir une valeur stratégique différente selon le score actuel du joueur, la cible de la partie et la situation des adversaires.

Le système doit donc évaluer l'action **dans son contexte actuel**, et non simplement attribuer une valeur fixe à chaque carte.

Le système devra pouvoir évaluer une possibilité même lorsqu'elle ne correspond pas à une combinaison préprogrammée.

---

## 8. Prise en compte des conséquences et de l'incertitude

Certaines actions produisent un résultat directement prévisible.

D'autres peuvent produire plusieurs résultats possibles.

L'IA doit tenir compte de cette différence.

Par exemple, avec une carte **17**, la carte volée est inconnue avant l'action.

L'IA ne doit donc pas considérer qu'elle va nécessairement obtenir une carte précise.

Elle doit évaluer l'action à partir des conséquences possibles et des informations connues.

De manière générale, lorsqu'une action dépend d'un élément aléatoire ou inconnu, l'évaluation devra tenir compte de cette incertitude.

---

## 9. Classement des possibilités

Une fois les scores calculés, les possibilités seront classées de la meilleure à la moins intéressante.

Exemple :

```text
Choix 1 → 94 points
Choix 2 → 92 points
Choix 3 → 89 points
Choix 4 → 63 points
Choix 5 → 41 points
```

Le classement servira ensuite à déterminer les groupes de choix disponibles pour le bot.

---

## 10. Choix équivalents

Plusieurs possibilités ayant des scores suffisamment proches pourront être considérées comme appartenant au même groupe de bons choix.

Exemple :

```text
Choix 1 → 94 points
Choix 2 → 92 points
Choix 3 → 89 points
Choix 4 → 63 points
Choix 5 → 41 points
```

Avec une tolérance de 5 points :

```text
Groupe 1 → Choix 1, Choix 2, Choix 3
Groupe 2 → Choix 4
Groupe 3 → Choix 5
```

Ainsi, une différence de quelques points ne signifie pas nécessairement qu'un choix est nettement meilleur qu'un autre.

La tolérance pourra être adaptée en fonction de la complexité de la décision.

---

## 11. Séparation entre évaluation et sélection

Le système sera séparé en deux parties.

### Évaluateur stratégique

Il détermine la valeur de chaque possibilité légalement disponible.

Exemple :

```text
Choix 1 → 94
Choix 2 → 92
Choix 3 → 89
Choix 4 → 63
Choix 5 → 41
```

### Sélection finale

Le niveau de difficulté détermine ensuite la manière dont le bot utilise ces résultats.

Le bot **Expert** cherchera systématiquement à utiliser les meilleurs choix stratégiques.

Le bot **Difficile** pourra parfois varier parmi les choix proches.

Le bot **Normal** pourra davantage utiliser l'aléatoire.

Le bot **Facile** pourra effectuer plus fréquemment des choix moins optimaux.

Cette séparation permet de modifier la difficulté sans modifier le système d'évaluation lui-même.

---

## 12. Principe général

Le fonctionnement global de l'IA sera donc :

1. Lire l'état actuel de la partie.
2. Déterminer les informations réellement accessibles à l'IA.
3. Identifier les actions légalement disponibles.
4. Appliquer les priorités imposées par les règles du jeu.
5. Générer les actions complètes pouvant réellement être choisies.
6. Identifier les conséquences et informations pertinentes de chaque action.
7. Déterminer la complexité de la décision.
8. Définir les critères d'évaluation.
9. Attribuer un score à chaque possibilité.
10. Classer les possibilités.
11. Regrouper les choix suffisamment proches.
12. Déterminer les choix accessibles selon le niveau de difficulté.
13. Appliquer la part d'aléatoire du niveau choisi.
14. Effectuer le choix final.
15. Exécuter l'action.
16. Mettre à jour l'état de la partie.
17. Répéter le processus au prochain tour.

---

## 13. Évolution du système

Le système devra pouvoir être ajusté progressivement sans devoir être entièrement réécrit.

Les éléments suivants pourront être modifiés indépendamment :

* critères d'évaluation ;
* valeur des critères ;
* tolérance entre les choix ;
* influence de la complexité ;
* pourcentage stratégique ;
* pourcentage aléatoire ;
* règles de sélection finale ;
* gestion des conséquences incertaines ;
* classification de la complexité des décisions.

L'objectif est de construire progressivement une IA capable de prendre des décisions cohérentes et variées tout en conservant une différence claire entre les niveaux de difficulté.

L'architecture doit permettre d'ajouter de nouvelles cartes, de nouvelles situations ou de nouveaux critères d'évaluation sans avoir à créer manuellement une combinaison stratégique pour chaque situation.
