# Fléchettes Cup 2 : site vitrine

Site one-page de la deuxième édition de la Fléchettes Cup (12 juin 2027), le tournoi de fléchettes entre duos de créateurs porté par LeBouseuh et organisé par Webedia.

## Phase 1 (vitrine)

- Menu à ancres fixe, boutons Billetterie et Boutique toujours visibles
- Hero : uniquement la cible, rendue en 3D temps réel (three.js) : texture de sisal, fils d'acier en relief, chiffres en fil, ombres portées. Les éléments (ticket du 12 juin 2027, carton du logo, polaroid des vainqueurs, sticker 3 000 places, carte du live) sont de vrais papiers dans la scène, chacun cloué par sa fléchette
- Intro en vue subjective à l'arrivée sur le site : on est la première fléchette (visée, armé, vol, impact sur le ticket), puis la caméra recule et se cale sur la cible pendant que les autres fléchettes viennent clouer chacune leur papier. Passable d'un clic, à la molette ou avec Échap, désactivée si l'utilisateur préfère les animations réduites ou arrive par un lien vers une ancre
- Repli sans WebGL : la même cible peinte à plat avec les éléments en HTML, sans intro
- Sections dans l'ordre du cahier des charges : concept, équipes (révélation progressive), tournoi amateur, programme et infos pratiques, où regarder, billetterie (teaser phase 2), boutique (teaser phase 2), best of édition 1, partenaires, FAQ
- Compte à rebours jusqu'au 12 juin 2027, formulaire d'alertes (front seul en phase 1)
- Mobile first, sans framework : HTML, CSS et JS vanilla, aucune étape de build. three.js r128 est embarqué dans `js/vendor/` (licence MIT), la scène est dans `js/scene.js`

## DA

Reprise de la brand guideline 2026 : violet #5B1DDA, dégradé #5012D4 → #210666, dark violet #160444, vert anis, pattern soleil denté (`assets/pattern.svg`, généré par script), dégradés officiels des 8 équipes. Typo Baikal VAR remplacée par Archivo variable (largeur 62 %, extra bold, italique) via Google Fonts.

## Photo des vainqueurs

Le polaroid cloué sur la cible affiche `assets/vainqueurs-edition-1.jpg` si le fichier existe, sinon un visuel provisoire. Il suffit de déposer la photo à cet emplacement.

## Lancer en local

Ouvrir `index.html` dans un navigateur, c'est tout.

## Phase 2 (à venir, mars 2027)

Billetterie (quotas, e-billet QR code, file d'attente) et boutique (un maillot par équipe, stock limité sans réassort), en pages dédiées ou via un outil externe selon la recommandation.
