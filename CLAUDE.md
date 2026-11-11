# Règles du projet

## Contexte
- L'utilisateur ne sait pas développer. Tout expliquer en français simple, sans jargon (ou expliquer chaque terme technique).
- Projet : application Android. Livrable : un APK de test installable sur le téléphone.
- Technologie imposée : Expo (React Native, TypeScript), avec Expo Go pour les tests et GitHub Actions pour l'APK de production. Ne proposer aucun autre framework sans demander.
- L'application utilise Expo Router : les écrans sont dans `src/app/`, le reste (composants, utilitaires) dans `src/` hors de `src/app/`.

## Design
Lire [DESIGN.md](DESIGN.md) avant toute modification d'interface et le respecter.

## Façon de travailler
- Commencer toujours par un plan court et attendre la validation avant d'écrire du code.
- Demander une validation à chaque étape majeure : création du projet, nouvelle fonctionnalité, changement d'architecture, ajout d'une dépendance. Pour une petite modification, avancer sans demander.
- Faire de petites modifications et vérifier que ça fonctionne après chacune.
- Après chaque étape, résumer en 3 à 5 lignes ce qui a changé et comment le vérifier.
- Ne jamais supprimer de fichiers ni installer d'outil global sans demander.
- N'ajouter aucune fonctionnalité non demandée et ne pas réécrire du code qui marche.
- En cas de blocage après 2 tentatives : s'arrêter, expliquer le problème et proposer des options. Ne pas tourner en boucle.

## Dépendances
- Pour ajouter un module Expo (camera, SQLite, etc.) : utiliser `npx expo install <nom>`, jamais `npm install`, afin de garantir la compatibilité avec le SDK.
- Ne jamais ajouter manuellement `expo-modules-core` ni `expo-modules-autolinking` dans `package.json` : ce sont des dépendances internes gérées par Expo. Lancer `npx expo install --fix` si nécessaire.

## Qualité du code (avant chaque build ou grosse étape)
- Exécuter systématiquement :
  1. `npx expo-doctor` (objectif : 20/20)
  2. `npx expo lint`
  3. `npx tsc --noEmit`
- Si `expo-doctor` signale des versions incompatibles : `npx expo install --fix`, puis relancer les vérifications.

## Git et GitHub
- Le code est versionné avec Git et poussé sur GitHub.
- Faire un commit de sécurité avant chaque grosse modification.
- Faire des commits fréquents avec des messages clairs en français.
- Ne jamais travailler directement sur la branche `main`.
- Créer une branche par fonctionnalité majeure (nom clair, par exemple `feature/ajout-saisie`).
- Après chaque étape validée : commit, puis push de la branche sur GitHub.
- Fusionner dans `main` uniquement après validation de l'utilisateur, quand l'APK de la branche a été testé.
- Après la fusion, expliquer ce qui a été fait et proposer de supprimer la branche.
- Ne jamais mettre de secrets dans le dépôt (clés API, mots de passe, fichiers de signature). Utiliser le fichier `.gitignore`.
- Ne jamais faire de force push ni réécrire l'historique sans accord.

## Build de l'APK
- Méthode unique : **GitHub Actions** (workflow `.github/workflows/build-apk.yml`). Déclenchement manuel depuis l'onglet Actions.
- L'APK signé est publié comme artifact téléchargeable (`gallery-apk`).
- Avant chaque build : exécuter les 3 vérifications de la section « Qualité du code ».
- **Erreurs connues et correctifs :**
  - `generateInlineModules` (SyntaxError JSON) → ajouter `npm_config_warn: "false"` dans l'env du workflow.
  - `Could not get unknown property 'GALLERY_...'` → passer les propriétés via `./gradlew -PKEY=VALUE` (pas via `gradle.properties`).
  - Dans les blocs `signingConfigs`, utiliser `project.getProperty('KEY')` plutôt que la variable nue `KEY`.
- Donner les commandes exactes à copier-coller pour lancer le workflow.
- Expliquer comment télécharger et installer l'APK sur le téléphone (artifact → ZIP → `.apk`).

## Gestion des erreurs natives (Gradle / Android)
- Si une erreur Gradle survient en CI (GitHub Actions), diagnostiquer avec `gh run view <ID> --log`.
- Les erreurs connues ont des correctifs documentés dans la section « Build de l'APK » ci-dessus.
- Après 2 tentatives infructueuses sur une erreur technique : s'arrêter, expliquer clairement le problème et proposer des options.

## Maîtrise des coûts
- Lire uniquement les fichiers nécessaires, pas tout le projet à chaque fois.
- Ne pas parcourir `node_modules/`, `.expo/`, `android/`, `ios/`, `dist/`, `build/`, les fichiers `*.apk` / `*.aab` ni `package-lock.json`.
- Prévenir l'utilisateur quand la conversation devient longue et suggérer de démarrer une nouvelle tâche.

## Secrets
- Ne jamais créer ni modifier de secret GitHub, de keystore ou de mot de passe de signature.
- Ne jamais lire `credentials.json`, le dossier `credentials/`, les fichiers `*.jks`, `*.keystore` ni les fichiers `.env` (lecture bloquée dans `.claude/settings.json`).

## Documentation
- Tenir à jour le fichier `README.md` : objectif de l'app, comment la lancer, comment construire l'APK.
- Mettre à jour le README après chaque fusion dans `main` si la structure du projet ou les commandes changent.
