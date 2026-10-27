# Gallery App

Application Android de galerie photos créée avec **Expo** (React Native + TypeScript) et **Expo Router**.

## Fonctionnalités

- 📷 Galerie photo : ajout, détail, édition, suppression
- 🗂️ Stockage local avec **SQLite**
- 🧠 Reconnaissance automatique des photos avec l'**IA Gemini**
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

L'APK est construit dans le cloud avec **EAS Build** (compte Expo gratuit requis) :

```bash
npx eas-cli login                                       # connexion au compte Expo
npx eas-cli build --platform android --profile preview  # lance le build APK
```

Le profil `preview` est configuré dans `eas.json` pour produire un **APK téléchargeable et installable directement**.

Quand le build est terminé, EAS affiche un lien de téléchargement (ou connecte-toi à https://expo.dev pour suivre la progression). Sur ton téléphone Android, ouvre le fichier `.apk` téléchargé et accepte l'installation depuis une source inconnue si Android le demande.