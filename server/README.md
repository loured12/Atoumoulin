# Atoumoulin — serveur V1

## Démarrage
`npm install`
`npm start`

Le serveur écoute `PORT` (3000 par défaut).

## WebSocket
En production, l'URL du navigateur doit être de la forme :
`wss://...`

## État
Cette étape synchronise le moteur existant de façon déterministe entre les clients :
le serveur attribue une graine commune et relaie les actions autorisées.
Le moteur autoritaire serveur complet est une étape de durcissement ultérieure.
