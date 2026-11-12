/// <reference types="node" />
// Aiguillage des imports pour lancer le vrai code de recherche avec Node, sans l'app.
// - « @/config/settings » (stockage sécurisé du téléphone) → tests/recherche/substituts.ts
// - « @/… » → src/… (même raccourci que dans l'app)
// Aucun fichier de l'app n'est modifié.

import { registerHooks } from 'node:module';
import { existsSync } from 'node:fs';
import { fileURLToPath, pathToFileURL } from 'node:url';
import path from 'node:path';

const root = fileURLToPath(new URL('../../', import.meta.url));

registerHooks({
  resolve(specifier, context, nextResolve) {
    if (specifier === '@/config/settings') {
      return nextResolve(pathToFileURL(path.join(root, 'tests/recherche/substituts.ts')).href, context);
    }
    if (specifier.startsWith('@/')) {
      let file = path.join(root, 'src', specifier.slice(2));
      if (!path.extname(file) && existsSync(`${file}.ts`)) file = `${file}.ts`;
      return nextResolve(pathToFileURL(file).href, context);
    }
    return nextResolve(specifier, context);
  },
});
