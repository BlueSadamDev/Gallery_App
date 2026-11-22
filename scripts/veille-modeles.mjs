// Veille des modèles Gemini, lancée chaque dimanche par .github/workflows/veille-modeles.yml.
// 1. Demande à Google la liste des modèles (clé lue dans GEMINI_API_KEY, envoyée en en-tête).
// 2. Garde les modèles Gemini qui répondent à du texte (generateContent), hors embeddings,
//    voix, génération d'images, etc.
// 3. Compare avec les modèles connus de l'app (src/config/settings.ts et src/services/ai/quotas.ts).
// 4. Signale les modèles inconnus dans une fiche GitHub « Veille des modèles Gemini » :
//    création de la fiche la première fois, puis un commentaire par nouveauté.
// Aucun fichier de l'app n'est modifié. La clé n'est jamais affichée.

import { readFileSync } from 'node:fs';
import { pathToFileURL } from 'node:url';

export const ISSUE_TITLE = 'Veille des modèles Gemini';
const GOOGLE_URL = 'https://generativelanguage.googleapis.com/v1beta/models?pageSize=1000';

// Modèles qui ne servent pas à l'app : vecteurs, voix, génération d'images ou de vidéo, etc.
const NOT_FOR_APP = /embedding|aqa|tts|audio|live|image|imagen|veo|robotics|computer-use|learnlm/i;

// Noms des modèles connus, lus dans le code de l'app.
export function knownModels(settingsSource, quotasSource) {
  const known = new Set();
  for (const m of settingsSource.matchAll(/value:\s*'([^']+)'/g)) known.add(m[1]);
  for (const m of quotasSource.matchAll(/'(gemini-[^']+)':\s*\{/g)) known.add(m[1]);
  return known;
}

// Modèles de Google utiles à l'app et inconnus d'elle (sans le préfixe « models/»).
export function unknownModels(googleModels, known) {
  return googleModels
    .filter((m) => (m.supportedGenerationMethods ?? []).includes('generateContent'))
    .map((m) => ({ id: String(m.name ?? '').replace(/^models\//, ''), label: m.displayName ?? '' }))
    .filter((m) => m.id.startsWith('gemini-') && !NOT_FOR_APP.test(m.id) && !known.has(m.id))
    .sort((a, b) => a.id.localeCompare(b.id));
}

// Garde seulement les modèles pas encore cités dans la fiche (texte et commentaires).
export function notYetReported(models, issueTexts) {
  const all = issueTexts.join('\n');
  return models.filter((m) => !all.includes(`\`${m.id}\``));
}

export function formatList(models) {
  return models.map((m) => `- \`${m.id}\`${m.label ? ` (${m.label})` : ''}`).join('\n');
}

const CHECKLIST = [
  'À vérifier dans Google AI Studio avant de l’ajouter à l’app :',
  '- gratuit (offre gratuite) et limites par minute et par jour ;',
  '- lit les images (indispensable pour « Ajouter ma photo ») ;',
  '- pas de date de fermeture annoncée.',
].join('\n');

async function github(path, options = {}) {
  const response = await fetch(`https://api.github.com/repos/${process.env.GITHUB_REPOSITORY}${path}`, {
    ...options,
    headers: {
      Authorization: `Bearer ${process.env.GITHUB_TOKEN}`,
      Accept: 'application/vnd.github+json',
      'Content-Type': 'application/json',
    },
  });
  if (!response.ok) throw new Error(`GitHub ${path} : erreur ${response.status}`);
  return response.json();
}

async function main() {
  const key = process.env.GEMINI_API_KEY?.trim();
  if (!key) {
    console.error('Secret GEMINI_API_KEY absent : ajoutez-le dans Settings > Secrets and variables > Actions.');
    process.exit(1);
  }

  const response = await fetch(GOOGLE_URL, { headers: { 'x-goog-api-key': key } });
  if (!response.ok) {
    console.error(`Google a refusé la liste des modèles (erreur ${response.status}). Vérifiez la clé.`);
    process.exit(1);
  }
  const { models = [] } = await response.json();

  const known = knownModels(
    readFileSync('src/config/settings.ts', 'utf8'),
    readFileSync('src/services/ai/quotas.ts', 'utf8')
  );
  const unknown = unknownModels(models, known);
  console.log(`${models.length} modèles chez Google, ${unknown.length} modèle(s) Gemini inconnu(s) de l'app.`);

  // Fiche existante (ouverte ou fermée), créée par ce programme.
  const issues = await github(`/issues?state=all&per_page=100&creator=github-actions%5Bbot%5D`);
  const issue = issues.find((i) => i.title === ISSUE_TITLE && !i.pull_request);

  if (!issue) {
    if (unknown.length === 0) return;
    await github('/issues', {
      method: 'POST',
      body: JSON.stringify({
        title: ISSUE_TITLE,
        body: `Modèles Gemini proposés par Google et absents de l'app, relevés le ${new Date().toISOString().slice(0, 10)} :\n\n${formatList(unknown)}\n\n${CHECKLIST}\n\nLes prochains dimanches, seuls les nouveaux modèles seront ajoutés ici en commentaire.`,
      }),
    });
    console.log('Fiche créée.');
    return;
  }

  const comments = await github(`/issues/${issue.number}/comments?per_page=100`);
  const fresh = notYetReported(unknown, [issue.body ?? '', ...comments.map((c) => c.body ?? '')]);
  if (fresh.length === 0) {
    console.log('Aucun nouveau modèle depuis le dernier relevé.');
    return;
  }
  await github(`/issues/${issue.number}/comments`, {
    method: 'POST',
    body: JSON.stringify({
      body: `Nouveaux modèles relevés le ${new Date().toISOString().slice(0, 10)} :\n\n${formatList(fresh)}\n\n${CHECKLIST}`,
    }),
  });
  // Une fiche fermée est rouverte pour que la nouveauté se voie.
  if (issue.state === 'closed') {
    await github(`/issues/${issue.number}`, { method: 'PATCH', body: JSON.stringify({ state: 'open' }) });
  }
  console.log(`${fresh.length} nouveau(x) modèle(s) signalé(s).`);
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  main().catch((error) => {
    console.error(error.message);
    process.exit(1);
  });
}
