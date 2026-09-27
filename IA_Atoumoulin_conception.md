# Conception de l'IA Atoumoulin

## 1. Objectif

Créer une IA capable d'adapter ses décisions à la main qu'elle possède,
à la situation de la partie et au niveau de difficulté choisi.

L'IA doit évaluer les possibilités disponibles plutôt que de fonctionner
avec des combinaisons de cartes préprogrammées.

---

## 2. Niveaux de difficulté

- Facile → 40 % stratégique / 60 % aléatoire
- Normal → 75 % stratégique / 25 % aléatoire
- Difficile → 90 % stratégique / 10 % aléatoire
- Expert → 100 % stratégique / 0 % aléatoire

Ces pourcentages pourront être adaptés selon la complexité de la décision.

---

## 3. Complexité des décisions

Chaque décision pourra être classée comme :

- Simple
- Moyenne
- Complexe

Une décision simple pourra être très bien maîtrisée même par un bot
de niveau normal.

Une décision complexe pourra davantage différencier les niveaux
de difficulté.

---

## 4. Système d'évaluation

Chaque possibilité sera évaluée avec un système de points.

Les critères et leurs valeurs seront définis ultérieurement.

---

## 5. Choix équivalents

Plusieurs possibilités ayant des scores suffisamment proches pourront
être considérées comme appartenant au même groupe de bons choix.

Exemple :

Choix 1 → 94 points
Choix 2 → 92 points
Choix 3 → 89 points

Ces trois choix peuvent être considérés comme des choix équivalents
ou presque équivalents.

---

## 6. Principe général

1. Identifier les décisions possibles.
2. Identifier les conséquences et informations pertinentes.
3. Déterminer la complexité de chaque décision.
4. Définir les critères d'évaluation.
5. Attribuer des points.
6. Classer les possibilités.
7. Regrouper les choix suffisamment proches.
8. Appliquer le niveau de difficulté.
9. Intégrer progressivement au code.
10. Tester toutes les situations.
