# Fléchettes Cup 2 : site vitrine

Site one-page de la deuxième édition de la Fléchettes Cup (12 juin 2027), le tournoi de fléchettes entre duos de créateurs porté par LeBouseuh et organisé par Webedia.

## Phase 1 (vitrine)

- Menu à ancres fixe, boutons Billetterie et Boutique toujours visibles
- Hero : la cible dans son bar, en 3D temps réel (three.js) : mur de briques, meuble à fléchettes en bois avec ses portes à ardoise, applique en laiton, néon violet, étagère à bouteilles, affiches aux couleurs des équipes. Cible en sisal avec fils d'acier en relief et ombres portées
- Les fléchettes clouent les sections du site sur la cible : billetterie, boutique, équipes, tournoi amateur, programme, et la photo des vainqueurs de l'édition 1. Chaque papier est un lien vers sa section
- Intro en vue subjective à l'arrivée sur le site : caméra embarquée derrière les ailettes de la première fléchette, mise au point sur la cible (flou de profondeur au premier plan), visée, armé, vol, impact sur le ticket de la billetterie. La caméra recule ensuite et se cale sur la cible pendant que les autres fléchettes viennent clouer chacune leur section. Passable d'un clic, à la molette ou avec Échap, désactivée si l'utilisateur préfère les animations réduites ou arrive par un lien vers une ancre
- Repli sans WebGL : la même cible peinte à plat avec les éléments en HTML, sans intro
- Sections dans l'ordre du cahier des charges : concept, équipes (révélation progressive), tournoi amateur, programme et infos pratiques, où regarder, billetterie (teaser phase 2), boutique (teaser phase 2), best of édition 1, partenaires, FAQ
- Compte à rebours jusqu'au 12 juin 2027, formulaire d'alertes (front seul en phase 1)
- Mobile first, sans framework : HTML, CSS et JS vanilla, aucune étape de build. three.js r128 est embarqué dans `js/vendor/` (licence MIT), la scène est dans `js/scene.js`

## DA

Reprise de la brand guideline 2026 : violet #5B1DDA, dégradé #5012D4 → #210666, dark violet #160444, vert anis, pattern soleil denté (`assets/pattern.svg`, généré par script), dégradés officiels des 8 équipes. Typo Baikal VAR remplacée par Archivo variable (largeur 62 %, extra bold, italique) via Google Fonts.

## Photo des vainqueurs

Le polaroid cloué sur la cible affiche `assets/vainqueurs-edition-1.jpg`. Pour la changer, remplacer ce fichier.

## Lancer en local

Servir le dossier avec n'importe quel serveur statique, par exemple `python3 -m http.server`, puis ouvrir l'adresse indiquée. En ouvrant `index.html` directement (`file://`), tout fonctionne sauf la photo des vainqueurs, que le navigateur refuse alors de charger dans la scène 3D.

## Phase 2 (à venir, mars 2027)

Billetterie (quotas, e-billet QR code, file d'attente) et boutique (un maillot par équipe, stock limité sans réassort), en pages dédiées ou via un outil externe selon la recommandation.
