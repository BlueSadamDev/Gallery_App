# Design de l'application « X-Gallery »

Ce document est la référence unique pour l'apparence de l'app. Respecte-le à la lettre. Ne change aucune couleur, police ou taille sans mon accord, et n'ajoute aucun écran ni aucune fonctionnalité qui n'y figure pas.

## Principes

- Élégant et épuré, dans l'esprit d'une galerie ou d'un musée.
- Les œuvres sont mises en valeur, avec beaucoup d'espace autour.
- Aucune décoration inutile : pas d'ombres, pas de dégradés. **Seule exception** : l'écran « Galerie vivante » (dégradé du mur et ombres portées simulées, voir section 7).
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

## Logo

- Nom de l'app : **X-Gallery**.
- Logo : un carré à trait fin et un X (une branche épaisse, une branche fine), en bordeaux #7B3F3A sur fond crème #F6F2EA.
- Fichiers : `assets/icon.png` (icône complète), `assets/adaptive-icon.png` (logo seul, fond transparent, posé sur la couleur #F6F2EA), `assets/monochrome-icon.png` (version une couleur pour les icônes à thème d'Android).

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

- Bandeau visuel en haut, titre « X-Gallery ».
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
  - **Carrousel horizontal** de 5 œuvres tirées au hasard (ou toutes si moins de 5). Composant indépendant (`src/components/Carousel.tsx`). Chaque carte :
    - Largeur = 80 % de la largeur de l'écran, espacement de 12 px entre les cartes (ItemSeparatorComponent).
    - Image (coins 2 px) occupant 100 % de la largeur de la carte, hauteur 260 px, fond de chargement #E3DDD1.
    - Pas de hauteur fixe sur la carte ni sur le conteneur du FlatList. Pas de pagingEnabled. SnapToInterval = cardWidth + 12, snapToAlignment start, decelerationRate fast, disableIntervalMomentum.
    - Titre : numberOfLines 2, minHeight 48, lineHeight 24, marginTop 10, fontFamily title, fontSize 18, couleur texte principal.
    - Artiste : numberOfLines 1, lineHeight 20, marginTop 4, fontSize 14, couleur texte secondaire.
    - Les tirets et espaces spéciaux sont nettoyés à l'affichage (idem carrousel).
    - L'appui ouvre le détail de l'œuvre.
    - Points de pagination sous la liste, dans le flux normal, marginTop 16 : point inactif 6 × 6 en #CFC8BA, point actif 16 × 6 (pastille) en #7B3F3A, 6 px d'espace entre les points.
  - **Regroupement par artiste** sous le carrousel :
    - En-tête : nom (style étiquette #8A6A45) et nombre d'œuvres dans un **unique Text** (le compteur est un `<Text>` imbriqué). Pas de flexDirection row, pas de largeur fixe. Le retour à la ligne se fait naturellement. Marges latérales de 24 px.
    - Grille de **2 colonnes** pour 2 œuvres ou plus : chaque œuvre occupe exactement la moitié de la largeur (moins l'espacement de 8 px entre colonnes).
    - **Groupe d'une seule œuvre** : l'image est centrée horizontalement (alignSelf center), à la même largeur qu'une colonne. Le titre et l'année sont centrés sous l'image (textAlign center).
    - Image carrée (coins 2 px), sans fond blanc ni cadre autour. Fond de chargement #E3DDD1.
    - Titre (numberOfLines 3, ellipsizeMode tail) et année alignés à gauche sous l'image (sauf cas 1 œuvre → centré).
    - Artistes triés par ordre alphabétique, « Artiste inconnu » en dernier.
    - Œuvres d'un groupe triées par année croissante.
  - **Espace de sécurité en bas** : hauteur de la barre de navigation Android (zone sûre) + 24 px, pour que la dernière œuvre ne passe pas dessous.
- L'accueil est l'onglet « Collection » de la barre d'onglets (voir ci-dessous).

### Barre d'onglets

Barre en bas des écrans principaux, avec deux onglets : « Collection » (l'accueil) et « Galerie vivante ».

- Fond #F6F2EA, trait fin (hairline) #E3DDD1 en haut, aucune ombre.
- Icônes Feather fines : `grid` (Collection), `sun` (Galerie vivante), taille 20.
- Onglet actif : icône et libellé en accent #7B3F3A. Inactif : texte secondaire #7A756B.
- Libellés Satoshi Regular 12 px. Zone tactile d'au moins 48 px ; la barre s'ajoute à la zone sûre du bas.
- Les autres écrans (ajout, détail, modification, paramètres, connexion) s'ouvrent par-dessus, sans barre d'onglets.

### 7. Galerie vivante

Les œuvres sont présentées comme dans une exposition, sur un mur continu.

- En-tête : étiquette « EXPOSITION » (accent, 11 px, lettres espacées), titre « Galerie vivante » (Medium, 32 px).
- Défilement vertical, une œuvre par travée, centrée, avec 48 px d'espace au-dessus et au-dessous.
- Œuvre : 72 % de la largeur de l'écran au maximum, proportions d'origine respectées (jamais recadrée ; si l'image est très haute, elle est rétrécie). Cadre fin hairline #CFC8BA, coins 2 px. Fond de chargement #E3DDD1.
- Cartel centré sous l'œuvre (20 px plus bas) : titre (Medium 20 px), puis « artiste, année » (Regular 13 px, texte secondaire).
- L'appui ouvre le détail de l'œuvre.
- Collection vide : même message d'invitation et même bouton « + » que l'accueil.
- **Mur éclairé** : couche à part, placée sous les œuvres. Dégradé vertical (expo-linear-gradient) + voile de lumière de faible opacité. Les changements d'ambiance se font en fondu enchaîné de deux couches (environ 0,9 s).
  - Matin : crème clair, voile doré léger, ombre longue vers la droite.
  - Midi : presque blanc, ombre courte vers le bas.
  - Heure dorée : beige chaud, voile orangé, ombre longue vers la gauche.
  - Nuit : beige grisé tamisé, ombre courte vers le bas ; la météo n'y change rien.
  - Nuages et pluie (le jour) : mur plus gris et plus froid, ombres plus courtes et plus pâles.
- **Ombre portée** : une vue sombre (#1C1B19, opacité 0,05 à 0,13) décalée derrière le cadre selon l'heure, plus une pénombre plus pâle. Pas de `shadowColor` ni d'`elevation`.
- **Règle absolue** : les images des œuvres ne sont jamais modifiées (aucune teinte, aucune opacité inférieure à 1, rien par-dessus, aucun filtre). Les effets ne touchent que le mur et l'espace autour du cadre.
- **Barre de modes** (fixe en haut, sous la zone sûre, masquée si la collection est vide) : trois mots centrés « Auto », « Time-Travel », « Puriste », espacés de 24 px. Satoshi 13 px ; mode inactif en texte secondaire, mode actif en texte principal Medium, souligné d'un trait de 1 px #7B3F3A. Zone tactile 48 px.
  - Auto : éclairage réel (heure et météo du lieu).
  - Time-Travel : un curseur de 0 h à 24 h (pas de 15 min, piste active et poignée #7B3F3A, piste inactive #CFC8BA) simule l'heure ; la météo réelle est conservée. Libellé à droite : « 14 h », « 14 h 15 ».
  - Puriste : aucun effet, mur neutre #F6F2EA, aucune ombre.
  - Le mode revient à Auto à chaque ouverture de l'onglet ; rien n'est mémorisé.

### 4. Ajout d'une œuvre

Un seul écran, en plusieurs étapes. En-tête : étiquette « NOUVELLE ŒUVRE », titre d'étape (Medium, 32 px), roue des paramètres (icône Feather fine, texte secondaire). Couleurs de ce document (pas le fichier de thème). Le bouton retour d'Android revient à l'étape précédente sans rien perdre.

1. **Choix** (« Ajouter une œuvre ») : « Rechercher par titre » (bouton plein accent) et « Ajouter ma photo » (bouton à contour fin accent). La photo vient de l'appareil photo ou de la galerie et ouvre l'étape « Ma photo ».
   - **Ma photo** : la photo (320 px de haut, jamais recadrée), « Photographier le cartel » (contour, facultatif ; miniature 64 px + « Retirer » une fois pris), bouton plein « Identifier l'œuvre », aide en 12 px : « La photo est réduite et ses informations de lieu sont retirées avant l'envoi. En offre gratuite, Google peut utiliser les photos envoyées pour améliorer ses produits. », lien « Saisir l'œuvre à la main ».
   - Rien ne part sans appui sur « Identifier l'œuvre » ; un seul appui suffit, sans relance automatique ; seuls un quota atteint ou une panne du modèle (surcharge, modèle introuvable) font passer au modèle suivant (voir « Quota de l'IA »). Bouton grisé hors ligne.
   - Avant l'envoi, la photo et le cartel sont réduits à 1024 px sur le grand côté et réencodés en JPEG (`expo-image-manipulator`), ce qui supprime les métadonnées dont la position GPS. Le cartel n'est pas conservé dans l'app.
   - L'IA renvoie séparément le texte qu'elle lit (cartel, plaque, inscription) et des pistes structurées (titres, artiste, année, confiance). Elle ne doit jamais composer de titre : une inscription gravée sur l'œuvre n'est pas un titre.
   - **Score de confiance** (`src/services/artworkSearch/confidence.ts`), calculé par l'app pour chaque œuvre trouvée dans Wikidata : titre 55 %, artiste 35 %, avis de l'IA 10 %. Une œuvre n'est proposée que si son titre est confirmé (mêmes mots qu'un nom de l'œuvre dans Wikidata, ou présent sur le cartel photographié) et si son score atteint **0,70**. Les propositions sont classées par score : vous confirmez toujours.
   - Aucune œuvre au-dessus du seuil : message « Aucune œuvre identifiée avec certitude. », on reste sur « Ma photo » et rien n'est prérempli. Si l'IA a lu un texte, il s'affiche sous l'étiquette « Inscription lue » (12 px, couleur Étiquette), entre guillemets (15 px), avec le lien « Chercher avec ce texte » qui le reprend dans la recherche, modifiable.
   - **Œuvre inconnue** : si l'identification n'a rien donné (confiance faible, aucune proposition, « Aucune ne convient » sur les propositions issues de la photo, ou échec de l'IA), l'app propose « Conserver comme œuvre inconnue » (bouton à contour sous le message de l'étape « Ma photo », lien « Conserver ma photo comme œuvre inconnue » à l'étape « Rechercher »). La fiche s'ouvre avec le titre « Œuvre inconnue » (modifiable), ma photo et les autres champs vides ; rien n'est enregistré sans « Enregistrer ». « Compléter avec l'IA » demande d'abord un vrai titre pour une œuvre inconnue.
   - Ma photo reste l'image par défaut de la fiche ; « Image suivante » montre les images Wikimedia.
   - Échec de l'IA : le message dit la cause et quoi faire (clé non reconnue, accès refusé, quota de la minute ou du jour, modèle indisponible, service surchargé, délai dépassé, hors ligne, réponse bloquée ou illisible). Textes dans `src/services/ai/errors.ts`.
2. **Recherche** (« Rechercher ») : champs soulignés Titre * / Artiste (facultatif) / Année (facultatif), bouton plein « Rechercher ».
   - Trop d'homonymes et ni artiste ni année : « Ce titre correspond à de nombreuses œuvres. Précisez l'artiste ou l'année. » + « Afficher quand même ».
   - Aucun résultat : message pour ajouter l'artiste, l'année ou corriger le titre.
   - Hors ligne (bouton grisé), service occupé ou en panne : message simple + lien « Saisir l'œuvre à la main ».
3. **Propositions** : lignes séparées d'un trait fin : miniature 64 px (coins 2 px, fond #E3DDD1), titre (Medium 16 px), « artiste, année » et lieu (13 px, texte secondaire). « Voir 5 autres » (contour) et lien « Aucune ne convient » : les œuvres montrées sont exclues et l'app demande de préciser. Après la recherche initiale + 2 relances sans succès, le lien « Saisir l'œuvre à la main » apparaît.
4. **Fiche** (« Vérifier la fiche ») : image (320 px de haut, jamais recadrée), « Image suivante » et « Utiliser ma photo » ; champs Titre *, Artiste, Année, Style, Description, préremplis et modifiables ; bouton plein « Enregistrer » ; lien « Pas la bonne œuvre » (retour à la liste, œuvre exclue).
   - **Description par l'IA** : rédigée à l'ouverture d'une proposition (si une clé Gemini est enregistrée), en 2 à 3 phrases, uniquement à partir des faits trouvés : titre, artiste, année, lieu et extrait du résumé Wikipédia de l'œuvre avec son lien. Sources du résumé, dans l'ordre : article relié à l'œuvre dans Wikidata (français, anglais, puis espagnol, italien, allemand, catalan, néerlandais, portugais) ; à défaut, recherche dans Wikipédia (français puis anglais) par titre et artiste, retenue seulement si le résumé cite le nom de l'artiste et la moitié au moins des mots du titre (jamais pour un artiste inconnu). Sans extrait, l'app écrit sans IA une phrase avec les seuls faits de Wikidata : « Œuvre de Jackson Pollock (1943). Lieu de conservation : Museum of Modern Art. » (« Œuvre d'un artiste inconnu » si l'artiste n'est pas connu). Sans artiste connu ni lieu, la description reste vide. Mention discrète « À vérifier » (12 px, Regular, texte secondaire) à droite du libellé ; elle disparaît dès que vous modifiez le texte ou enregistrez, et n'est jamais stockée. Liens « Régénérer » et « Effacer » sous le champ.
   - Rien n'est enregistré sans « Enregistrer ». L'image Wikimedia est alors téléchargée et copiée dans le stockage de l'app ; aucune adresse Internet n'est conservée. Si la copie échoue, l'app propose d'enregistrer sans image.

**Source et vérification des données**

- Source des données : Wikidata (créateur, date, image, lieu de conservation) et images de Wikimedia Commons. Aucune clé.
- L'IA prépare seulement la recherche (titres possibles, artiste probable, confiance). Elle ne fournit jamais d'image ni d'adresse, et ne remplit pas la fiche.
- Vérification : l'artiste saisi est comparé sans majuscules ni accents ; un candidat d'un autre artiste n'est jamais proposé. L'année saisie est vérifiée à plus ou moins 10 ans (plus large si la source ne connaît que la décennie ou le siècle). Les attributions contestées comptent (ex. Vénus de Milo : « Alexandros d'Antioche (attribution) »).
- Les œuvres refusées pendant la session ne sont plus proposées.
- Plus de 5 artistes différents pour un titre, sans artiste saisi : l'app demande d'abord l'artiste ou l'année.
- Requêtes une par une, délai de 5 s, mémoire de session ; l'app s'identifie auprès de Wikimedia avec l'adresse du dépôt GitHub.
- La clé Gemini part dans un en-tête, jamais dans l'adresse.
- Tous les appels à l'IA passent par `src/services/ai` (aucun écran n'appelle Google directement). Le réglage « temperature » n'est plus envoyé (ignoré par les modèles récents) ; « Régénérer » demande une autre formulation dans la consigne.
- **Quota de l'IA** (limites gratuites relevées le 21/11/2026, dans `src/services/ai/quotas.ts`) : 3.5 et 3.1 Flash-Lite 15 par minute et 500 par jour ; 3.6 et 3.8 Flash 5 par minute et 20 par jour. Le compteur du jour revient à zéro à minuit, heure du Pacifique. L'app compte les demandes de chaque modèle ; si le modèle choisi a atteint sa limite, ou si Google répond « quota de la minute » ou « quota du jour », elle passe aussitôt au modèle suivant (le plus gros quota du jour d'abord). Elle passe aussi au suivant si Google répond « surchargé » (500, 503 : modèle mis de côté 5 minutes) ou « modèle introuvable » (404, ou quota gratuit à zéro : mis de côté jusqu'à minuit) ; ces mises de côté sont oubliées au redémarrage de l'app. Toute autre erreur (clé, accès, hors ligne, délai dépassé, réponse bloquée) est affichée sans changer de modèle. Aucun modèle disponible : message de quota de la minute, sinon de surcharge, sinon de quota du jour. Le compteur ne contient que des nombres.

### 5. Détail d'une œuvre

- Visuel en haut, pleine largeur.
- Titre, puis artiste et année en légende, puis description.
- Actions : modifier et supprimer (icônes fines). La suppression demande une confirmation.

### 5 bis. Modification d'une œuvre

- En-tête sans titre technique, roue Feather fine (texte secondaire) ; étiquette « MODIFICATION » et titre « Modifier l'œuvre » (Medium 32 px). Couleurs et composants de l'écran d'ajout (fond #F6F2EA, champs soulignés, boutons coins 2 px).
- Image (320 px de haut, jamais recadrée, fond #E3DDD1), boutons à contour « Galerie » et « Caméra », puis bouton à contour fin accent **« Compléter avec l'IA »** (zone tactile 48 px), puis les champs Titre *, Artiste, Année, Style, Description et le bouton plein « Enregistrer ».
- « Compléter avec l'IA » : même recherche vérifiée qu'à l'ajout (IA + Wikidata) à partir du titre, de l'artiste et de l'année enregistrés ; sans résultat, nouvelle recherche sur le titre seul. Une seule œuvre : « Œuvre trouvée : titre, artiste, année. Utiliser ces informations ? ». Plusieurs : liste de propositions (comme à l'ajout, « Voir 5 autres », « Aucune ne convient »). Nombreux homonymes sans artiste ni année : l'app demande de les ajouter.
- Seuls les champs **vides** sont remplis : artiste, année, description (rédigée par l'IA à partir du résumé Wikipédia, mention « À vérifier » qui disparaît dès que vous modifiez le texte ou enregistrez) et image Wikimedia si l'œuvre n'a pas d'image. Le style n'est pas rempli (Wikidata ne le fournit pas).
- Artiste ou année déjà saisis mais différents de Wikidata : fenêtre « Différences avec Wikidata » (« Année : « 1890 » ici, « 1889 » selon Wikidata ») avec « Garder les miennes » (par défaut) ou « Remplacer ».
- Ligne d'information sous le bouton (12 px, texte secondaire) : ce qui a été complété, ou la cause d'un échec (clé manquante, quota, hors ligne, aucune œuvre trouvée). Bouton grisé hors ligne ou sans titre.
- Rien n'est enregistré sans « Enregistrer ». L'image Wikimedia n'est copiée dans le stockage de l'app qu'à ce moment ; si la copie échoue, l'app propose d'enregistrer sans image.

### 6. Paramètres

Contenu à définir ensemble. Ne crée rien dans cet écran sans ma validation.

Contenu actuel :

- **Intelligence artificielle** : clé Gemini (champ masqué, stockage sécurisé), choix du modèle, « Enregistrer la clé », « Tester la clé ». Modèles proposés : uniquement des modèles gratuits qui lisent les images — Gemini 3.5 Flash-Lite (recommandé, par défaut), 3.1 Flash-Lite, 3.6 Flash, 3.8 Flash. Le test essaie seulement le modèle choisi (même s'il a été mis de côté après une panne) et affiche la cause d'un échec et l'action à faire. « Tester tous les modèles » (même style) fait une demande très courte par modèle et affiche une ligne par modèle. Le texte d'introduction rappelle qu'en offre gratuite, Google peut utiliser les photos envoyées.
  - **Utilisation de l'IA aujourd'hui** : une ligne par modèle (nom, « 12 / 500 aujourd'hui », état en 12 px : « Disponible » en texte secondaire, sinon en accent avec l'heure de retour : pause courte, quota du jour atteint, surchargé, indisponible avec votre clé), séparée par un trait fin. En dessous : dernier modèle utilisé et heure de remise à zéro (minuit en Californie, à l'heure du téléphone). Ces chiffres viennent du compteur de l'app, sans appel à Google ; ils sont relus à chaque retour sur l'écran.
- **Sauvegarde et restauration** : exporter, importer.
- **Se déconnecter**.

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
