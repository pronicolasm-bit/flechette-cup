# Fléchettes Cup 2 : site vitrine

Site one-page de la deuxième édition de la Fléchettes Cup (12 juin 2027), le tournoi de fléchettes entre duos de créateurs porté par LeBouseuh et organisé par Webedia.

## Les pages

- `index.html` : la vitrine, avec la cible 3D en ouverture.
- `jouer.html` : le compteur de score (301, 501, Cricket, en solo ou en duo) et les règles des fléchettes.
- `bars.html` : la carte des bars à fléchettes.

## Phase 1 (vitrine)

- Menu à ancres fixe, boutons Billetterie et Boutique toujours visibles
- Hero : la cible dans son bar, en 3D temps réel (three.js) : mur de briques, meuble à fléchettes en bois avec ses portes à ardoise, applique en laiton, néon violet, étagère à bouteilles, affiches aux couleurs des équipes. Cible en sisal avec fils d'acier en relief et ombres portées
- Les fléchettes clouent les sections du site, et chacune arrive à un endroit qui a un sens : la date (billetterie) dans le secteur 12 pour le 12 juin, les équipes en plein centre, la photo des vainqueurs dans le triple 20, et deux fléchettes ratées plantées dans le bois à côté de la cible pour le tournoi amateur et le compteur de score. La boutique et le programme complètent la cible. Sur un écran en hauteur, les deux ratées passent sous la cible
- Un clic sur un papier ouvre directement sa section (ou la page du compteur) : la caméra plonge dans le papier et on arrive sur le contenu. Un bouton « La cible » ramène en haut depuis n'importe où dans la page
- Rendu façon photo : deux sources de lumière voisines pour des ombres douces, halo sur les hautes lumières, flou de profondeur sur l'arrière des fléchettes qui dépasse vers la caméra, bois verni, sisal usé, papiers gondolés. La caméra se décale légèrement avec le pointeur et le papier survolé se décolle de la cible
- Intro en vue subjective : la caméra est embarquée derrière les ailettes de la première fléchette, et c'est le visiteur qui la lance (clic, toucher, Espace ou Entrée ; sans geste elle part seule après quelques secondes). Impact sur le ticket de la billetterie, puis la caméra recule pendant que les autres fléchettes viennent clouer chacune leur section. Passable d'un clic, à la molette ou avec Échap, désactivée si l'utilisateur préfère les animations réduites ou arrive par un lien vers une ancre
- La cible est jouable après l'intro : un clic lance une fléchette là où l'on vise (avec un peu de dispersion), le score du lancer s'affiche, et le total de la volée après trois fléchettes
- Son synthétisé dans le navigateur, sans fichier audio : souffle du lancer, choc dans le sisal, choc plus sec dans le bois. Il ne joue qu'après un geste du visiteur (règle des navigateurs) et se coupe avec le bouton en bas à gauche de la cible ; le choix est mémorisé
- Écran de chargement dans la pénombre du bar le temps que la scène se construise
- Dans la page : une fléchette vient se planter dans chaque titre de section à son arrivée à l'écran, les chiffres de l'édition 1 montent jusqu'à leur valeur, les cartes des équipes s'inclinent sous le pointeur
- Aperçu de partage (`assets/partage.jpg` et balises Open Graph) : les adresses sont relatives, à rendre absolues une fois le domaine connu
- Repli sans WebGL : la même cible peinte à plat avec les éléments en HTML, sans intro
- Sections dans l'ordre du cahier des charges : concept, équipes (révélation progressive), tournoi amateur, programme et infos pratiques, où regarder, billetterie (teaser phase 2), boutique (teaser phase 2), best of édition 1, partenaires, FAQ
- Compte à rebours jusqu'au 12 juin 2027, formulaire d'alertes (front seul en phase 1)
- Mobile first, sans framework : HTML, CSS et JS vanilla, aucune étape de build. three.js r128 est embarqué dans `js/vendor/` (licence MIT), la scène est dans `js/scene.js`. Les styles des pages outils sont dans `css/app.css`

## DA

Reprise de la brand guideline 2026 : violet #5B1DDA, dégradé #5012D4 → #210666, dark violet #160444, vert anis, pattern soleil denté (`assets/pattern.svg`, généré par script), dégradés officiels des 8 équipes. Typo Baikal VAR remplacée par Archivo variable (largeur 62 %, extra bold, italique) via Google Fonts.

## Photo des vainqueurs

Le polaroid cloué sur la cible affiche `assets/vainqueurs-edition-1.jpg`. Pour la changer, remplacer ce fichier.

## Lancer en local

Servir le dossier avec n'importe quel serveur statique, par exemple `python3 -m http.server`, puis ouvrir l'adresse indiquée. En ouvrant `index.html` directement (`file://`), tout fonctionne sauf la photo des vainqueurs, que le navigateur refuse alors de charger dans la scène 3D.

## Phase 2 (à venir, mars 2027)

Billetterie (quotas, e-billet QR code, file d'attente) et boutique (un maillot par équipe, stock limité sans réassort), en pages dédiées ou via un outil externe selon la recommandation.

## Compteur de score et règles (`jouer.html`)

- Le calcul est dans `js/scorer-engine.js`, sans interface : 301 et 501 en double out ou simple out, bust, manches gagnantes, duos qui lancent à tour de rôle, Cricket, moyenne par volée, et proposition de finish.
- L'écran est dans `js/scorer.js` : pensé pour le téléphone posé près de la cible, annulation fléchette par fléchette, partie conservée si la page est rechargée (stockage local du navigateur), écran maintenu allumé quand le navigateur le permet.
- Tests du calcul : `node --test tests/scorer.test.js`.

## Carte des bars (`bars.html`)

Trois sources d'adresses, fusionnées sur la carte :

- `data/bars.json` : la liste tenue par l'équipe (bars partenaires des qualifications). Vide pour l'instant.
- OpenStreetMap : les lieux que la communauté a marqués comme proposant des fléchettes. Tant que `data/bars-osm.json` est vide, la page les demande à la volée pour la zone affichée (bouton « Chercher dans cette zone »). `node scripts/import-osm-bars.mjs` remplit ce fichier pour toute la France en une fois ; la page s'en sert alors à la place des requêtes à la volée.
- Les propositions des visiteurs : enregistrées dans le navigateur de la personne seulement. Il n'y a pas de serveur : l'envoi à l'équipe et la validation restent à construire.

À prévoir avant un vrai trafic : le fond de carte et le service de requêtes d'OpenStreetMap utilisés ici sont des services publics partagés, à remplacer par un fournisseur dédié (les adresses sont en tête de `js/bars.js`). Leaflet 1.9.4 est embarqué dans `js/vendor/` et `css/vendor/`.

## Pour aller plus loin en réalisme et en contenu

Ce qui ne peut pas venir du code seul :

- Des textures photographiées (brique, bois, sisal) et une ambiance lumineuse de bar à la place des matières calculées.
- Les photos et vidéos de l'édition 1, les portraits des équipes, pour remplacer les aplats de couleur.
- Le logo officiel en vectoriel et la police Baikal, aujourd'hui approchés avec Archivo.
- Un petit serveur pour les alertes par mail et les propositions de bars.
