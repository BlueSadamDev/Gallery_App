# Design de l'application « Ma galerie »

Ce document est la référence unique pour l'apparence de l'app. Respecte-le à la lettre. Ne change aucune couleur, police ou taille sans mon accord, et n'ajoute aucun écran ni aucune fonctionnalité qui n'y figure pas.

## Principes

- Élégant et épuré, dans l'esprit d'une galerie ou d'un musée.
- Les œuvres sont mises en valeur, avec beaucoup d'espace autour.
- Aucune décoration inutile : pas d'ombres, pas de dégradés.
- Une seule couleur d'accent.
- Version claire uniquement (pas de mode sombre dans la version 1).

## Couleurs

| Rôle | Valeur | Usage |
| --- | --- | --- |
| Fond | #F6F2EA | Fond de tous les écrans |
| Texte principal | #1C1B19 | Titres et textes |
| Texte secondaire | #7A756B | Légendes, aides, icônes |
| Traits fins | #E3DDD1 | Séparateurs et contours |
| Traits des champs | #CFC8BA | Soulignement des champs de saisie |
| Accent | #7B3F3A | Bouton « + », boutons principaux, liens |
| Étiquette | #8A6A45 | Petite étiquette au-dessus des titres d'écran |
| Alerte (à valider) | #A32D2D | Suppression et réinitialisation |

Un seul bouton plein par écran, de couleur accent. Le texte sur l'accent est #F6F2EA.

## Typographie

- Police unique : **Satoshi**. Ne jamais en utiliser une autre sans mon accord.
- Satoshi n'est pas une police Google : ses fichiers sont dans le projet (dossier `assets/fonts`) et chargés avec `expo-font`. Aucun chargement depuis Internet.
- N'utilise que les graisses dont les fichiers sont présents dans le projet. Indique-moi lesquelles avant d'en ajouter.
- Échelle indicative (garde les tailles actuelles de l'app si elles diffèrent légèrement) :
  - Titre d'écran : grand, graisse Medium
  - Titre d'œuvre : 20 px, Medium
  - Texte courant : 15 px, Regular
  - Légende (artiste, année) : 12 à 13 px, Regular, texte secondaire
  - Étiquette : 11 à 12 px, Regular, couleur Étiquette, lettres légèrement espacées

## Forme et espacement

- Coins : 2 px pour les images, champs et boutons rectangulaires. Le bouton « + » est un cercle.
- Traits très fins (épaisseur hairline), jamais épais.
- Unité d'espacement : 8 px. Marges latérales d'écran : 20 à 24 px.
- Zone tactile d'au moins 48 px pour chaque bouton.
- Icônes : une seule famille, trait fin (par exemple Feather via `@expo/vector-icons`), de couleur texte secondaire. Aucune icône système colorée.

## Ton des textes

- Vouvoiement dans toute l'app (comme dans l'écran d'accueil actuel).
- Phrases courtes, majuscule seulement au début de la phrase, pas de point d'exclamation, pas de jargon.

## Écrans

### 1. Première ouverture

Affiché une seule fois, tant qu'aucun accès n'a été créé.

- Bandeau visuel en haut, titre « Bienvenue ».
- Phrase : « Choisissez vos identifiants. Ils restent sur ce téléphone. »
- Champs : Identifiant, Mot de passe (avec œil pour afficher), Confirmer le mot de passe.
- Bouton « Créer mon accès ».
- Avertissement : il n'y a aucune récupération possible, à noter avec soin.

### 2. Connexion

- Bandeau visuel en haut, titre « Ma galerie ».
- Champs : Identifiant, Mot de passe (avec œil).
- Bouton « Se connecter ».
- « Utiliser l'empreinte » une fois l'accès créé, si le téléphone le permet.
- Lien discret en bas « Réinitialiser l'accès » : demande une confirmation claire, car cela **efface toute la collection**.

### 3. Accueil

En-tête : étiquette « Galerie personnelle » à gauche, boutons « + » et roue à droite (même ligne, alignés au centre vertical). En dessous, titre « Ma collection » (graisse Medium, 32 px) sur toute la largeur, sur une seule ligne (numberOfLines 1, adjustsFontSizeToFit). Pas de titre technique (« index »).

- Roue des paramètres : toujours en haut à droite.
- Bouton « + » rond, fond plein #7B3F3A, icône Feather « plus » blanche (#F6F2EA), contour très fin 1 px #CFC8BA. Zone tactile 56 × 56 px (petit) / 120 × 120 px (grand). Centré si la collection est vide, en haut à droite (à gauche de la roue) sinon.
- **Collection vide** : message « Votre collection est encore vide. Commencez à conserver la trace des œuvres qui vous touchent. », et le bouton « + » rond, centré sous le message.
- **Avec au moins une œuvre** : le bouton « + » passe en haut à droite, à gauche de la roue. Le message d'invitation disparaît. Contenu :
  - **Marges** : tout le contenu a une marge latérale de 24 px. Le carrousel est centré : paddingHorizontal = (largeur écran - largeur carte) / 2.
  - **Carrousel horizontal** de 10 œuvres tirées au hasard (ou toutes si moins de 10). Chaque carte :
    - Largeur = 80 % de la largeur de l'écran, espacement de 12 px entre les cartes (ItemSeparatorComponent).
    - Image (coins 2 px) occupant 100 % de la largeur de la carte, hauteur 220 px.
    - Pas de hauteur fixe sur la carte ni sur le conteneur : la hauteur est automatique en fonction du texte.
    - Les cartes s'alignent en haut de la liste (alignItems 'flex-start').
    - Titre et artiste alignés à gauche, sous l'image, à 100 % de la largeur de la carte.
    - Titre : numberOfLines 3, lineHeight 20 (1,25 × 16), marginTop 8, ellipsizeMode tail. Artiste : numberOfLines 1, lineHeight 16, marginTop 4, ellipsizeMode tail.
    - Les tirets et espaces spéciaux sont nettoyés à l'affichage (tirets insécables → tirets normaux, espace insécable → espace, ajout de zero-width space après les tirets pour le retour à la ligne).
    - Fond d'image en chargement ou absente : #E3DDD1.
    - Hauteur totale de la carte (image + texte) : 268 px environ.
    - Défilement carte par carte avec snap (decelerationRate fast), sans boucle.
    - Petits points de position (#CFC8BA inactif, #7B3F3A actif) sous le carrousel, centrés.
    - Pas de défilement automatique.
    - L'appui ouvre le détail de l'œuvre.
  - **Regroupement par artiste** sous le carrousel :
    - En-tête : nom (style étiquette #8A6A45) et nombre d'œuvres. Le conteneur a flexWrap 'wrap', columnGap 12, rowGap 2. Le nom a numberOfLines 2, maxWidth '100%'. Le compteur passe à la ligne si nécessaire.
    - Grille de **2 colonnes** : chaque œuvre occupe exactement la moitié de la largeur (moins l'espacement de 8 px entre colonnes), même s'il n'y a qu'une œuvre sur la ligne.
    - Image carrée (coins 2 px), sans fond blanc ni cadre autour. Fond de chargement #E3DDD1.
    - Titre (numberOfLines 3, ellipsizeMode tail) et année alignés à gauche sous l'image.
    - Artistes triés par ordre alphabétique, « Artiste inconnu » en dernier.
    - Œuvres d'un groupe triées par année croissante.
  - **Espace de sécurité en bas** : hauteur de la barre de navigation Android (zone sûre) + 24 px, pour que la dernière œuvre ne passe pas dessous.
- Pas de barre de navigation en bas.

### 4. Ajout d'une œuvre

- Zone de visuel en pointillés : photo prise avec l'appareil ou choisie dans la galerie du téléphone.
- Bouton « Chercher avec Gemini » : après avoir saisi un titre, envoie la recherche à Gemini (clé API dans le stockage sécurisé). Les champs sont remplis automatiquement.
- **Recherche d'image** : après le résultat de Gemini, une image est cherchée gratuitement sur Internet (Wikipedia → Metropolitan Museum → Art Institute of Chicago). Si une image est trouvée, elle s'affiche avec deux boutons :
  - « Utiliser cette image » : télécharge et copie l'image dans le stockage de l'app.
  - « Choisir ma propre photo » : ouvre la galerie du téléphone.
  - Si aucune image n'est trouvée, un message l'indique et propose la galerie.
- Champs : Titre, Artiste, Année, Description.
- Bouton « Enregistrer » plein, en bas de l'écran.

### 5. Détail d'une œuvre

- Visuel en haut, pleine largeur.
- Titre, puis artiste et année en légende, puis description.
- Actions : modifier et supprimer (icônes fines). La suppression demande une confirmation.

### 6. Paramètres

Contenu à définir ensemble. Ne crée rien dans cet écran sans ma validation.

## Données d'une œuvre

Nom, artiste, année, description, visuel. Tout reste sur le téléphone. Le visuel est copié dans le stockage de l'app, pour rester disponible même si la photo d'origine est supprimée.

## Sécurité de l'accès

- Le mot de passe n'est jamais stocké en clair : seulement une version hachée avec un sel, dans le stockage sécurisé du téléphone (`expo-secure-store`).
- Aucun mot de passe dans le code, dans Git ni dans les journaux.
- L'empreinte est facultative (`expo-local-authentication`).

## Hors version 1

Recherche, tri, page Artistes, catégories, sauvegarde ou export de la collection, compte en ligne, mode sombre.

## Corrections à appliquer en priorité

1. Supprimer le titre technique « index » en haut de l'accueil.
2. ✅ Passer le bouton « + » de bleu à l'accent #7B3F3A, en bouton rond (sans contour).
3. Remplacer la roue système par une icône fine grise.
