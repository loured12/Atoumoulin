# Atoumoulin — prototype visuel + multijoueur

Cette version intègre :
- une direction artistique cartoon/jeu de société ;
- une table en bois avec tapis vert ;
- 22 faces de cartes SVG originales, une par carte d'Atoumoulin ;
- cartes de points dorées ;
- cartes de pouvoir avec couleurs et pictogrammes distinctifs ;
- cartes 7/15/17/19/Joker visuellement différenciées ;
- main du joueur sous forme de vraies cartes ;
- piles de points et défausse stylisées.

## Lancer
1. Node.js 20+
2. `npm install`
3. `npm start`
4. `http://localhost:3000`

`design-reference.png` sert de référence de direction artistique pour la future finition.

## À noter
Le moteur de règles est encore un prototype : avant une mise en production, il faut auditer toutes les interactions des doubles, des 15 attachés, des vols, des échanges et des cartes jouées par 17, puis remplacer les `prompt()` par des panneaux de choix graphiques.

## V3 — interactions visuelles
- Les choix des cartes 11, 21 et Joker utilisent maintenant un panneau graphique.
- Les cibles des cartes 1, 3, 9, 13, 17 et 19 utilisent un panneau graphique.
- Le 13 permet de sélectionner visuellement une carte de points adverse.
- Le 15 permet de sélectionner visuellement une carte de points de sa propre pile.
- Les `prompt()` de choix ont été retirés du client.
