# Conception de l'IA Atoumoulin

## 1. Objectif

Créer une IA capable d'adapter ses décisions :

* à la main qu'elle possède ;
* à la situation actuelle de la partie ;
* aux possibilités disponibles ;
* au niveau de difficulté choisi.

L'IA doit analyser et évaluer les possibilités disponibles plutôt que de fonctionner avec des combinaisons de cartes préprogrammées.

L'objectif est de permettre à l'IA de prendre des décisions cohérentes, y compris dans des situations qu'elle n'a jamais rencontrées auparavant.

---

## 2. Niveaux de difficulté

Les différents niveaux utilisent le même système d'évaluation stratégique, mais ne sélectionnent pas leurs actions de la même manière.

* **Facile** → 40 % stratégique / 60 % aléatoire
* **Normal** → 75 % stratégique / 25 % aléatoire
* **Difficile** → 90 % stratégique / 10 % aléatoire
* **Expert** → 100 % stratégique / 0 % aléatoire

Ces pourcentages constituent une base et pourront être adaptés selon la complexité de la décision.

L'aléatoire ne signifie pas nécessairement choisir n'importe quelle action.

Lorsqu'il existe plusieurs choix intéressants, l'aléatoire peut permettre au bot de varier son choix parmi ces possibilités.

---

## 3. Complexité des décisions

Chaque décision pourra être classée comme :

* **Simple**
* **Moyenne**
* **Complexe**

Une décision simple pourra être correctement évaluée même par un bot de niveau normal.

Une décision moyenne pourra nécessiter la prise en compte de plusieurs critères.

Une décision complexe pourra prendre en compte davantage de conséquences, d'informations et de possibilités.

La complexité pourra donc permettre de différencier davantage les niveaux de difficulté.

Elle pourra également influencer la tolérance utilisée pour considérer plusieurs choix comme suffisamment proches.

---

## 4. Système d'évaluation

Chaque possibilité sera évaluée avec un système de points.

Le score représentera la qualité estimée d'une action dans la situation actuelle.

Plusieurs critères pourront être utilisés pour calculer ce score, par exemple :

* avantage immédiat ;
* avantage futur ;
* sécurité ;
* risque ;
* coût de l'action ;
* informations obtenues ;
* synergie avec la main ;
* influence sur les adversaires ;
* conséquences possibles.

Les critères définitifs ainsi que leurs valeurs seront définis ultérieurement selon les règles d'Atoumoulin.

Le système devra pouvoir évaluer une possibilité même lorsqu'elle ne correspond pas à une combinaison préprogrammée.

---

## 5. Classement des possibilités

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

## 6. Choix équivalents

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

## 7. Séparation entre évaluation et sélection

Le système sera séparé en deux parties.

### Évaluateur stratégique

Il détermine la valeur de chaque possibilité.

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

Le bot Expert cherchera systématiquement à utiliser les meilleurs choix stratégiques.

Le bot Difficile pourra parfois varier parmi les choix proches.

Le bot Normal pourra davantage utiliser l'aléatoire.

Le bot Facile pourra effectuer plus fréquemment des choix moins optimaux.

Cette séparation permet de modifier la difficulté sans modifier le système d'évaluation lui-même.

---

## 8. Principe général

1. Identifier les décisions possibles.
2. Identifier les conséquences et informations pertinentes.
3. Déterminer la complexité de la décision.
4. Définir les critères d'évaluation.
5. Attribuer un score à chaque possibilité.
6. Classer les possibilités.
7. Regrouper les choix suffisamment proches.
8. Déterminer les choix accessibles selon le niveau de difficulté.
9. Appliquer la part d'aléatoire du niveau choisi.
10. Effectuer le choix final.
11. Intégrer progressivement le système au code.
12. Tester toutes les situations.

---

## 9. Évolution du système

Le système devra pouvoir être ajusté progressivement sans devoir être entièrement réécrit.

Les éléments suivants pourront être modifiés indépendamment :

* critères d'évaluation ;
* valeur des critères ;
* tolérance entre les choix ;
* influence de la complexité ;
* pourcentage stratégique ;
* pourcentage aléatoire ;
* règles de sélection finale.

L'objectif est de construire progressivement une IA capable de prendre des décisions cohérentes et variées tout en conservant une différence claire entre les niveaux de difficulté.
