// Fournisseur Google Gemini (API generateContent, appel HTTP direct, sans bibliothèque).
// La clé part dans un en-tête, jamais dans l'adresse (qui peut finir dans des journaux).

import { classifyHttpError, extractText } from './errors.ts';
import { AiError, type AiPart, type AiProvider, type AiRequest } from './types.ts';

export const GEMINI_BASE_URL = 'https://generativelanguage.googleapis.com/v1beta';
const DEFAULT_TIMEOUT_MS = 45_000;

type FetchLike = (input: string, init?: RequestInit) => Promise<Response>;

function toGeminiPart(part: AiPart) {
  return part.kind === 'text'
    ? { text: part.text }
    : { inline_data: { mime_type: part.mimeType, data: part.base64 } };
}

// Les modèles Gemini 3.6+ et 4 ignorent « temperature » et Google annonce une
// erreur 400 à venir : on ne l'envoie plus (documentation « Troubleshooting »).
export function buildGeminiBody(request: AiRequest) {
  return {
    contents: [{ parts: request.parts.map(toGeminiPart) }],
    generationConfig: {
      ...(request.json ? { responseMimeType: 'application/json' } : {}),
      ...(request.maxOutputTokens ? { maxOutputTokens: request.maxOutputTokens } : {}),
    },
  };
}

// Erreur réseau sans réponse : coupure ou délai écoulé.
function networkError(error: unknown, model: string, aborted: boolean): AiError {
  if (aborted || (error instanceof Error && error.name === 'AbortError')) {
    return new AiError('DÉLAI_DÉPASSÉ', model);
  }
  return new AiError('HORS_LIGNE', model);
}

export function createGeminiProvider(fetchImpl: FetchLike = (input, init) => fetch(input, init)): AiProvider {
  return {
    id: 'gemini',
    async generate(apiKey: string, request: AiRequest): Promise<string> {
      const { model } = request;
      const controller = new AbortController();
      let aborted = false;
      const timeout = setTimeout(() => {
        aborted = true;
        controller.abort();
      }, request.timeoutMs ?? DEFAULT_TIMEOUT_MS);

      let response: Response;
      let body: unknown = null;
      try {
        try {
          response = await fetchImpl(`${GEMINI_BASE_URL}/models/${encodeURIComponent(model)}:generateContent`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', 'x-goog-api-key': apiKey },
            body: JSON.stringify(buildGeminiBody(request)),
            signal: controller.signal,
          });
        } catch (error) {
          throw networkError(error, model, aborted);
        }
        try {
          body = await response.json();
        } catch (error) {
          if (aborted) throw networkError(error, model, true);
          body = null; // corps illisible : traité plus bas
        }
      } finally {
        clearTimeout(timeout);
      }

      if (!response.ok) throw classifyHttpError(response.status, body, model);
      return extractText(body, model);
    },
  };
}
