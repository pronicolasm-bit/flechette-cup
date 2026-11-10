# Fléchettes Cup 2 : site vitrine

Site one-page de la deuxième édition de la Fléchettes Cup (12 juin 2027), le tournoi de fléchettes entre duos de créateurs porté par LeBouseuh et organisé par Webedia.

## Phase 1 (vitrine)

- Menu à ancres fixe, boutons Billetterie et Boutique toujours visibles
- Hero : uniquement la cible de fléchettes (générée en SVG) avec le logo et les éléments punaisés
- Intro en vue subjective à l'arrivée sur le site : on est la fléchette (visée, lancer, impact, recul de caméra calé sur la cible, pose de l'habillage). Passable d'un clic, à la molette ou avec Échap, désactivée si l'utilisateur préfère les animations réduites ou arrive par un lien vers une ancre
- Sections dans l'ordre du cahier des charges : concept, équipes (révélation progressive), tournoi amateur, programme et infos pratiques, où regarder, billetterie (teaser phase 2), boutique (teaser phase 2), best of édition 1, partenaires, FAQ
- Compte à rebours jusqu'au 12 juin 2027, formulaire d'alertes (front seul en phase 1)
- Mobile first, sans framework : HTML, CSS et JS vanilla, aucune étape de build

## DA

Reprise de la brand guideline 2026 : violet #5B1DDA, dégradé #5012D4 → #210666, dark violet #160444, vert anis, pattern soleil denté (`assets/pattern.svg`, généré par script), dégradés officiels des 8 équipes. Typo Baikal VAR remplacée par Archivo variable (largeur 62 %, extra bold, italique) via Google Fonts.

## Photo des vainqueurs

Le polaroid punaisé sur la cible affiche `assets/vainqueurs-edition-1.jpg` si le fichier existe, sinon un visuel de repli. Il suffit de déposer la photo à cet emplacement.

## Lancer en local

Ouvrir `index.html` dans un navigateur, c'est tout.

## Phase 2 (à venir, mars 2027)

Billetterie (quotas, e-billet QR code, file d'attente) et boutique (un maillot par équipe, stock limité sans réassort), en pages dédiées ou via un outil externe selon la recommandation.
