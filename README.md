# Fléchettes Cup 2 : site vitrine

Site one-page de la deuxième édition de la Fléchettes Cup (12 juin 2027), le tournoi de fléchettes entre duos de créateurs porté par LeBouseuh et organisé par Webedia.

## Les pages

- `index.html` : la vitrine, avec la cible 3D en ouverture.
- `jouer.html` : le compteur de score (301, 501, Cricket, en solo ou en duo) et les règles des fléchettes.
- `bars.html` : la carte des bars à fléchettes.

## Phase 1 (vitrine)

- Menu à ancres fixe, boutons Billetterie et Boutique toujours visibles
- Hero : la cible en 3D temps réel (three.js), dans le décor et la lumière du teaser de l'édition 1 : un mur en enduit terracotta usé et balafré, une source chaude et rasante en haut à droite qui allonge les ombres et laisse le côté gauche dans le noir, une tablette en bois couverte de débris de plâtre, des ombres qui tirent vers le froid
- Autour de la cible, une vingtaine de fléchettes plantées dans le mur dans tous les sens, chacune avec son éclat de plâtre : aucune n'a touché la cible
- Les sections du site (billetterie, photo des vainqueurs, boutique, équipes, compteur de score, tournoi amateur, programme) sont clouées dans le bois autour de la cible, qui reste vide. Sur un écran en hauteur, elles passent au-dessus et en dessous
- Un clic sur un papier ouvre directement sa section (ou la page du compteur) : la caméra plonge dans le papier et on arrive sur le contenu. Un bouton « La cible » ramène en haut depuis n'importe où dans la page
- Rendu façon photo : deux sources de lumière voisines pour des ombres douces, halo sur les hautes lumières, léger flou sur l'arrière des fléchettes, vignettage et grain. La caméra se décale légèrement avec le pointeur et le papier survolé se décolle du mur
- Intro : un montage en champ-contrechamp. Côté LeBouseuh, quatre vrais plans du teaser de l'édition 1 (il vise, il lance, il relance avec rage, il lance en contre-plongée), sans le son. Côté mur, notre scène 3D : après chaque lancer, ses fléchettes arrivent à côté de la cible, sept d'entre elles clouant chacune une section du site avec un « Raté ! ». Un carton tient le compte jusqu'à « 0 point », puis la caméra vient se caler sur la cible. Passable d'un clic, à la molette ou avec Échap, absente si l'utilisateur préfère les animations réduites ou arrive par un lien vers une ancre
- Les plans du teaser sont dans `assets/intro-lebouseuh.mp4` (et `.webm`), 3,8 secondes pour environ 700 Ko. Si la vidéo ne peut pas être lue (lecture automatique refusée, économiseur de données, réseau trop lent), l'intro enchaîne simplement les plans du mur
- Le jeu (`js/game.js`) : 9 fléchettes, 540 points au maximum. Le viseur tremble autour du point visé comme une main, il faut lancer au bon moment. Souris, doigt (le viseur reste au-dessus du doigt) ou clavier (flèches et Espace). Barre de score en bas de la scène, résultat et classement en fin de partie
- Le classement : pseudo et score gardés dans le navigateur du visiteur. Pour un classement commun à tous, indiquer l'adresse d'un service dans la page avec `<meta name="fc-classement-api" content="…">` (GET renvoie la liste, POST reçoit un score). Ce service reste à construire, et il devra valider les scores : un score envoyé par un navigateur se falsifie
- Son synthétisé dans le navigateur, sans fichier audio : souffle du lancer, choc dans le sisal, choc plus sec dans le bois. Il ne joue qu'après un geste du visiteur (règle des navigateurs) et se coupe avec le bouton en bas à gauche de la cible ; le choix est mémorisé
- Écran de chargement dans la pénombre du bar le temps que la scène se construise
- Dans la page : les chiffres de l'édition 1 montent jusqu'à leur valeur, les cartes des équipes s'inclinent sous le pointeur
- Aperçu de partage (`assets/partage.jpg` et balises Open Graph) : les adresses sont relatives, à rendre absolues une fois le domaine connu
- Repli sans WebGL : la même cible peinte à plat avec les éléments en HTML, sans intro
- Sections dans l'ordre du cahier des charges : concept, équipes (révélation progressive), tournoi amateur, programme et infos pratiques, où regarder, billetterie (teaser phase 2), boutique (teaser phase 2), best of édition 1, partenaires, FAQ
- Compte à rebours jusqu'au 12 juin 2027, formulaire d'alertes (front seul en phase 1)
- Mobile first, sans framework : HTML, CSS et JS vanilla, aucune étape de build. three.js r128 est embarqué dans `js/vendor/` (licence MIT), la scène est dans `js/scene.js`

## DA

L'habillage des pages applique le système de la brand guideline 2026, tel qu'il apparaît dans ses visuels :

- le rail à gauche (bloc logo vert anis, colonne grise, « Flechettes Cup 2027 » à la verticale) et la barre du haut en blocs de couleur pleins ;
- les titres en bloc incliné sur deux lignes, posés sur un mot géant qui déborde du cadre ;
- les chiffres empilés en deux couleurs dans un panneau gris souligné d'une bande (compte à rebours, horaires du programme, score du compteur) ;
- les cartes d'équipes : bloc aux couleurs de l'équipe (emplacement du futur portrait), numéro en dégradé, nom incliné ;
- les ponctuations : libellés en petites capitales larges, trois carrés, trois triangles, éclats en dents de scie ;
- aucun arrondi, aucune ombre portée, aucune grille de cartes identiques.

Couleurs : violet #5B1DDA, dégradé #5012D4 vers #210666, dark violet #160444, gris #E3E3E3, vert anis, dégradés officiels des 8 équipes. Typo Baikal VAR remplacée par Archivo variable (condensée pour les titres et les chiffres, large pour les libellés).

Fichiers : `css/styles.css` (socle et hero), `css/da.css` (habillage commun aux trois pages), `css/app.css` (compteur, règles, carte).

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
