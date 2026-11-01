# Gallery App

Application Android de galerie photos créée avec **Expo** (React Native + TypeScript) et **Expo Router**.

## Fonctionnalités

- 📷 Galerie photo : ajout, détail, édition, suppression (bouton « + » rond marron avec contour bleu : centré quand la collection est vide, sinon en haut à droite à gauche de la roue)
- 🗂️ Stockage local avec **SQLite** (titre, auteur, année, style, description)
- 🧠 Remplissage automatique avec l'**IA Gemini** : dès qu'une photo est ajoutée, le nom, l'auteur, l'année, le style et la description sont complétés automatiquement. La recherche fonctionne aussi à partir d'un **titre** (« Chercher avec Gemini »). Le **modèle Gemini est choisi dans les réglages** (bouton « Tester la clé » pour vérifier qu'il fonctionne)
- 🔐 Connexion / inscription protégée par mot de passe
- 💾 Sauvegarde et restauration des données

## Structure du projet

- `src/app/` : les écrans de l'application (Expo Router)
  - `index.tsx` : galerie principale
  - `add.tsx` : ajout d'une photo
  - `detail/[id].tsx`, `edit/[id].tsx` : détail et édition d'une photo
  - `login.tsx`, `register.tsx`, `settings.tsx` : authentification et réglages
- `src/db/` : base de données SQLite
- `src/auth/` : gestion de l'authentification
- `src/utils/` : logique métier (images, sauvegarde, IA Gemini)
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

## Ajouter une dépendance Expo

Toujours utiliser `expo install` (et non `npm install`) pour obtenir des versions compatibles avec le SDK :

```bash
npx expo install <nom-du-module>
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
4. Laisse la branche `main` et clique **Run workflow**
5. Une fois le build terminé (case ✅), clique sur le run pour voir les détails
6. Dans la section **Artifacts**, télécharge **gallery-apk** (fichier ZIP)
7. Décompresse le ZIP sur ton téléphone et installe le `.apk` (accepte l'installation depuis une source inconnue si Android le demande)

> **Astuce :** Tu peux aussi accéder à l'URL du run depuis le navigateur de ton téléphone pour télécharger l'APK directement sans passer par un PC.