// Surveillance du quota gratuit de chaque modèle et choix du modèle à utiliser.
// Ce fichier ne parle ni à Google ni au téléphone : il compte et décide.
// Le compteur du jour est enregistré par src/config/settings.ts (sans clé ni contenu).

import { AiError } from './types.ts';

export type ModelLimits = { perMinute: number; perDay: number };

// Limites de l'offre gratuite, relevées dans Google AI Studio le 21/11/2026.
// Remise à zéro du quota du jour : minuit, heure du Pacifique (Californie).
// 4 Hydrogen et 2.5 Flash-Lite sont notés pour mémoire : ils ne sont pas proposés
// dans l'app et ne servent pas au changement de modèle.
export const MODEL_LIMITS: Record<string, ModelLimits> = {
  'gemini-3.5-flash-lite': { perMinute: 15, perDay: 500 },
  'gemini-3.1-flash-lite': { perMinute: 15, perDay: 500 },
  'gemini-3.6-flash': { perMinute: 5, perDay: 20 },
  'gemini-3.8-flash': { perMinute: 5, perDay: 20 },
  'gemini-4-hydrogen': { perMinute: 5, perDay: 20 },
  'gemini-2.5-flash-lite': { perMinute: 10, perDay: 20 },
};

const MINUTE_MS = 60_000;
const HOUR_MS = 3_600_000;

// Dimanche numéro `n` (1 = premier) d'un mois, en jour du mois.
function nthSunday(year: number, month: number, n: number): number {
  const firstWeekday = new Date(Date.UTC(year, month, 1)).getUTCDay(); // 0 = dimanche
  return 1 + ((7 - firstWeekday) % 7) + 7 * (n - 1);
}

// Date du jour à l'heure du Pacifique, au format AAAA-MM-JJ.
// Heure d'été américaine : du 2e dimanche de mars à 2 h au 1er dimanche de novembre à 2 h.
// Calcul fait ici, sans dépendre des fuseaux horaires du téléphone.
export function pacificDay(nowMs: number): string {
  const year = new Date(nowMs).getUTCFullYear();
  const summerStart = Date.UTC(year, 2, nthSunday(year, 2, 2), 10); // 2 h heure d'hiver = 10 h UTC
  const summerEnd = Date.UTC(year, 10, nthSunday(year, 10, 1), 9); // 2 h heure d'été = 9 h UTC
  const offsetHours = nowMs >= summerStart && nowMs < summerEnd ? 7 : 8;
  return new Date(nowMs - offsetHours * HOUR_MS).toISOString().slice(0, 10);
}

// Ce qui est enregistré sur le téléphone : le jour et le nombre de demandes par modèle.
export type DailyUsage = { day: string; counts: Record<string, number> };

export type QuotaStorage = {
  load(): Promise<DailyUsage | null>;
  save(usage: DailyUsage): Promise<void>;
};

export class QuotaTracker {
  private usage: DailyUsage | null = null;
  // Heures des demandes de la dernière minute (gardées en mémoire seulement).
  private recent: Record<string, number[]> = {};
  // Modèle bloqué par Google jusqu'à cette heure (quota de la minute).
  private blockedUntil: Record<string, number> = {};

  private readonly storage: QuotaStorage;
  private readonly now: () => number;

  constructor(storage: QuotaStorage, now: () => number = () => Date.now()) {
    this.storage = storage;
    this.now = now;
  }

  // Compteur du jour, remis à zéro si minuit (heure du Pacifique) est passé.
  private async today(): Promise<DailyUsage> {
    const day = pacificDay(this.now());
    if (!this.usage) {
      try {
        this.usage = await this.storage.load();
      } catch {
        this.usage = null; // compteur illisible : on repart de zéro
      }
    }
    if (!this.usage || this.usage.day !== day) this.usage = { day, counts: {} };
    return this.usage;
  }

  private async persist(): Promise<void> {
    if (!this.usage) return;
    try {
      await this.storage.save(this.usage);
    } catch {
      // Le compteur n'a pas pu être enregistré : l'appel à l'IA n'est pas bloqué pour autant.
    }
  }

  // Temps d'attente avant de pouvoir réutiliser ce modèle :
  // 0 = disponible, Infinity = quota du jour atteint.
  async waitMs(model: string): Promise<number> {
    const limits = MODEL_LIMITS[model];
    const now = this.now();
    const usage = await this.today();
    if (limits && (usage.counts[model] ?? 0) >= limits.perDay) return Infinity;
    let wait = Math.max(0, (this.blockedUntil[model] ?? 0) - now);
    if (limits) {
      const recent = (this.recent[model] ?? []).filter((t) => now - t < MINUTE_MS);
      this.recent[model] = recent;
      if (recent.length >= limits.perMinute) wait = Math.max(wait, recent[0] + MINUTE_MS - now);
    }
    return wait;
  }

  // Une demande a été traitée par Google (réussie ou non) : elle compte dans le quota.
  async record(model: string): Promise<void> {
    const usage = await this.today();
    usage.counts[model] = (usage.counts[model] ?? 0) + 1;
    (this.recent[model] ??= []).push(this.now());
    await this.persist();
  }

  // Google a répondu « quota de la minute atteint » pour ce modèle.
  markMinuteExhausted(model: string, retryAfterMs: number | null): void {
    this.blockedUntil[model] = this.now() + (retryAfterMs ?? MINUTE_MS);
  }

  // Google a répondu « quota du jour atteint » : le modèle est mis de côté jusqu'à minuit.
  async markDayExhausted(model: string): Promise<void> {
    const usage = await this.today();
    const limit = MODEL_LIMITS[model]?.perDay;
    if (limit === undefined) return;
    usage.counts[model] = Math.max(usage.counts[model] ?? 0, limit);
    await this.persist();
  }
}

// Ordre d'essai : le modèle choisi d'abord, puis les autres modèles proposés,
// ceux qui ont le plus gros quota du jour en premier (à égalité, l'ordre de la liste).
export function rotationOrder(chosen: string, available: readonly string[]): string[] {
  const others = available
    .filter((m) => m !== chosen)
    .map((m, index) => ({ m, index, perDay: MODEL_LIMITS[m]?.perDay ?? 0 }))
    .sort((a, b) => b.perDay - a.perDay || a.index - b.index)
    .map((x) => x.m);
  return [chosen, ...others];
}

const isQuota = (error: unknown): error is AiError =>
  error instanceof AiError && (error.category === 'QUOTA_MINUTE' || error.category === 'QUOTA_JOUR');

// Essaie les modèles dans l'ordre. Passe au suivant (sans attendre) si le modèle a atteint
// sa limite d'après le compteur, ou si Google répond « quota de la minute » ou « du jour ».
// Toute autre erreur est renvoyée tout de suite. Si tout est épuisé : erreur de quota.
export async function runWithRotation<T>(
  tracker: QuotaTracker,
  models: string[],
  send: (model: string) => Promise<T>
): Promise<{ result: T; model: string }> {
  let lastQuotaError: AiError | null = null;
  let shortestWait = Infinity;

  for (const model of models) {
    const wait = await tracker.waitMs(model);
    if (wait > 0) {
      shortestWait = Math.min(shortestWait, wait);
      continue;
    }
    try {
      const result = await send(model);
      await tracker.record(model);
      return { result, model };
    } catch (error) {
      if (isQuota(error)) {
        if (error.category === 'QUOTA_JOUR') {
          await tracker.markDayExhausted(model);
        } else {
          tracker.markMinuteExhausted(model, error.retryAfterMs);
          shortestWait = Math.min(shortestWait, error.retryAfterMs ?? MINUTE_MS);
        }
        lastQuotaError = error;
        continue;
      }
      // Pas de réseau ou délai dépassé : la demande n'a peut-être pas été comptée par Google.
      if (!(error instanceof AiError && (error.category === 'HORS_LIGNE' || error.category === 'DÉLAI_DÉPASSÉ'))) {
        await tracker.record(model);
      }
      throw error;
    }
  }

  // Tous les modèles sont épuisés. Si l'un d'eux se libère dans la minute : quota minute.
  const first = models[0];
  if (Number.isFinite(shortestWait)) {
    throw new AiError('QUOTA_MINUTE', lastQuotaError?.model ?? first, {
      retryAfterMs: shortestWait,
      httpStatus: lastQuotaError?.httpStatus ?? null,
    });
  }
  throw new AiError('QUOTA_JOUR', lastQuotaError?.model ?? first, { httpStatus: lastQuotaError?.httpStatus ?? null });
}
