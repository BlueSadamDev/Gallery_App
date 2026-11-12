# X-Gallery

Application Android de galerie photos créée avec **Expo** (React Native + TypeScript) et **Expo Router**.

## Fonctionnalités

- 📷 Galerie photo : ajout, détail, édition, suppression (bouton « + » rond marron avec contour fin beige clair : centré quand la collection est vide, sinon en haut à droite à gauche de la roue)
- 🗂️ Stockage local avec **SQLite** (titre, auteur, année, style, description)
- 🔎 **Recherche d'œuvre fiable** (écran d'ajout) :
  - « Rechercher par titre » (artiste et année facultatifs) : des propositions vérifiées viennent de **Wikidata** (images Wikimedia Commons, sans clé). Vous choisissez l'œuvre, vérifiez la fiche, et pouvez refuser (« Aucune ne convient », « Pas la bonne œuvre ») ou saisir à la main.
  - « Ajouter ma photo » : identification sur appui de « Identifier l'œuvre » seulement, cartel facultatif ; la photo est réduite et ses métadonnées (GPS) sont supprimées avant l'envoi. Votre photo reste l'image par défaut.
  - L'**IA Gemini** ne fait que préparer la recherche (pistes) et rédiger une description à partir des seuls faits trouvés (mention « À vérifier »). La clé est saisie dans les réglages, rangée dans le stockage sécurisé du téléphone et envoyée dans un en-tête. Pensez à mettre une limite de dépense basse sur la clé.
- 🔐 Connexion / inscription protégée par mot de passe
- 💾 Sauvegarde et restauration des données
- 🗺️ Barre d'onglets en bas : **Collection** (l'accueil) et **Galerie vivante**
- 🌤️ **Galerie vivante** : les œuvres sont présentées comme dans une exposition, sur un mur dont l'éclairage suit l'heure et la météo réelles (position approximative + météo gratuite Open-Meteo, sans clé). Trois modes : **Auto**, **Time-Travel** (curseur de 0 h à 24 h) et **Puriste** (mur neutre). Les images des œuvres ne sont jamais modifiées.

## Structure du projet

- `src/app/` : les écrans de l'application (Expo Router)
  - `(tabs)/_layout.tsx` : barre d'onglets en bas
  - `(tabs)/index.tsx` : onglet « Collection » (galerie principale)
  - `(tabs)/galerie.tsx` : onglet « Galerie vivante »
  - `add.tsx` : ajout d'une œuvre (choix, ma photo, recherche, propositions, fiche)
  - `detail/[id].tsx`, `edit/[id].tsx` : détail et édition d'une photo
  - `login.tsx`, `register.tsx`, `settings.tsx` : authentification et réglages
- `src/components/` : composants réutilisables (`Carousel.tsx`, `gallery/` pour la Galerie vivante, `add/` pour l'écran d'ajout)
- `src/services/` : position approximative et météo (Galerie vivante) ; `artworkSearch/` : recherche d'œuvres (Wikidata, vérification artiste/année)
- `scripts/` : test rapide de la recherche d'œuvres, sans IA (`cas-recherche.json` + `test-recherche.ts`)
- `tests/recherche/` : jeu de 42 cas sur le vrai service (IA + Wikidata), rapport et résultats
- `src/hooks/` : `useGalleryEnvironment` (moment de la journée et météo)
- `src/db/` : base de données SQLite
- `src/auth/` : gestion de l'authentification
- `src/utils/` : logique métier (images, sauvegarde, IA Gemini, ambiances lumineuses)
- `src/theme/` : thème et couleurs
- `src/config/` : réglages

## Prérequis

- Node.js (LTS) installé sur le PC
- L'application **Expo Go** sur ton téléphone (Play Store)
- Les deux appareils sur le même réseau Wi-Fi

## Lancer l'application en développement

```bash
npm install        # installe les dépendances
npx expo start     # démarre le serveur de développement
```

Puis scanne le QR code affiché avec l'app **Expo Go** sur ton téléphone.

> **Projet dans OneDrive :** OneDrive marque les fichiers de `node_modules` d'une façon que le serveur Expo ne sait pas lire (erreur 500 en scannant le QR code). Sur ce PC, `node_modules` est donc un raccourci (jonction Windows) vers `C:\dev\gallery-app\node_modules`, hors de OneDrive. Le dossier cible doit s'appeler exactement `node_modules`. Pour le recréer sur un autre PC (PowerShell, dans le dossier du projet, `node_modules` absent) :
>
> ```powershell
> New-Item -ItemType Directory -Force C:\dev\gallery-app\node_modules
> New-Item -ItemType Junction -Path node_modules -Target C:\dev\gallery-app\node_modules
> npm ci
> ```

## Ajouter une dépendance Expo

Toujours utiliser `expo install` (et non `npm install`) pour obtenir des versions compatibles avec le SDK :

```bash
npx expo install <nom-du-module>
```

## Tester la recherche d'œuvres

Interroge le vrai Wikidata (sans IA) avec les cas du fichier `scripts/cas-recherche.json` et affiche OK ou ÉCHEC pour chacun (Node 22.18 ou plus récent, qui lit le TypeScript directement) :

```bash
node scripts/test-recherche.ts
```

**Jeu complet de 42 cas (avec l'IA)** : exécute le vrai service de recherche (IA Gemini + Wikidata) sans l'interface, en deux passes (à froid puis avec cache), et écrit le détail dans `tests/recherche/resultats.json`. La clé Gemini est lue dans la variable d'environnement Windows `GEMINI_API_KEY` (à créer soi-même, jamais dans le dépôt) ; `GEMINI_MODEL` permet de changer de modèle. Durée : environ 15 minutes, environ 82 appels à l'IA. Le dernier rapport est dans `tests/recherche/rapport.md`.

```bash
npm run test:recherche
```

## Vérifications avant un build

```bash
npx expo-doctor          # tout doit être vert (20/20)
npx expo lint            # vérification du style de code
npx tsc --noEmit         # vérification des types TypeScript
npx expo install --fix   # corrige les versions incompatibles si besoin
```

## Construire l'APK de test

L'APK est construit avec **GitHub Actions** (pas de build local nécessaire, pas de compte Expo requis) :

1. Va sur **GitHub** → ton dépôt → onglet **Actions**
2. Clique sur **Build APK Android** dans la colonne de gauche
3. Clique sur le bouton **Run workflow** (dropdown à droite)
4. Choisis la branche à construire (`main`, ou la branche à tester) et clique **Run workflow**
5. Une fois le build terminé (case ✅), clique sur le run pour voir les détails
6. Dans la section **Artifacts**, télécharge **gallery-apk** (fichier ZIP)
7. Décompresse le ZIP sur ton téléphone et installe le `.apk` (accepte l'installation depuis une source inconnue si Android le demande)

> **Limite de minutes :** sur un dépôt privé, un compte gratuit dispose d'un nombre limité de minutes de build par mois. Une fois la limite atteinte, le build échoue au démarrage (« startup failure ») sans rien exécuter. Le dépôt est public depuis novembre 2026 : les builds y sont gratuits et illimités.

> **Astuce :** Tu peux aussi accéder à l'URL du run depuis le navigateur de ton téléphone pour télécharger l'APK directement sans passer par un PC.