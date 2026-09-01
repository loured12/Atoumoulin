# Serveur Atoumoulin — déploiement

Le dossier `server/` est un serveur Node/WebSocket.

## Déploiement
1. Déployer le dossier `server` sur un hébergeur Node (par exemple Render).
2. Le service doit exposer le port fourni par la variable `PORT`.
3. Récupérer l'URL HTTPS du service et utiliser son équivalent WebSocket `wss://...`.
4. Ouvrir le jeu avec `?server=wss://...` ou configurer `ATOUMOULIN_SERVER_URL`.

## Important
GitHub Pages héberge le site statique, mais ne fait pas tourner le serveur WebSocket. Le site et le serveur sont donc deux déploiements distincts.

## Test réel
Après déploiement :
- ouvrir le site sur téléphone A ;
- créer un salon ;
- ouvrir le site sur téléphone B ;
- rejoindre avec le code ;
- lancer la partie ;
- jouer plusieurs tours ;
- couper la connexion d'un joueur et vérifier le passage au bot.

Ne pas considérer une partie comme validée tant que ce test n'a pas été effectué avec le serveur public.
