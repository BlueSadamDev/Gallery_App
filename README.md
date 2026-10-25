# Gallery App

Application Android créée avec **Expo** (React Native + TypeScript).
Elle permettra de gérer une galerie de photos.

## Prérequis

- Node.js (LTS) installé sur le PC
- L'application **Expo Go** sur ton téléphone (Play Store)
- Les deux appareils sur le même réseau Wi-Fi

## Lancer l'application en développement

```bash
npm install
npm start
```

Puis scanne le QR code affiché avec l'app **Expo Go** sur ton téléphone.

## Construire l'APK de test

L'APK est construit avec **EAS Build** (compte Expo requis) :

```bash
npm install -g eas-cli        # une seule fois
eas login                     # connexion à ton compte Expo
eas build --platform android --profile preview
```

À la fin, EAS affichera un lien pour télécharger l'APK. Installe-le directement
sur ton téléphone Android.

## Structure du projet

- `App.tsx` : écran principal de l'application
- `app.json` : configuration Expo (nom, icônes, slug)
- `assets/` : icônes et images par défaut