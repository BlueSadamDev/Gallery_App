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
function pacificOffsetHours(nowMs: number): number {
  const year = new Date(nowMs).getUTCFullYear();
  const summerStart = Date.UTC(year, 2, nthSunday(year, 2, 2), 10); // 2 h heure d'hiver = 10 h UTC
  const summerEnd = Date.UTC(year, 10, nthSunday(year, 10, 1), 9); // 2 h heure d'été = 9 h UTC
  return nowMs >= summerStart && nowMs < summerEnd ? 7 : 8;
}

export function pacificDay(nowMs: number): string {
  return new Date(nowMs - pacificOffsetHours(nowMs) * HOUR_MS).toISOString().slice(0, 10);
}

// Heure exacte (en millisecondes) du prochain minuit à l'heure du Pacifique :
// c'est le moment où les quotas du jour reviennent à zéro.
// Les changements d'heure ont lieu à 2 h : à minuit, le décalage est encore celui de la veille.
export function nextPacificReset(nowMs: number): number {
  const [y, m, d] = pacificDay(nowMs).split('-').map(Number);
  const nextDayUtc = Date.UTC(y, m - 1, d + 1);
  return nextDayUtc + pacificOffsetHours(nextDayUtc + 8 * HOUR_MS) * HOUR_MS;
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
  // Modèle mis de côté après une panne (surcharge, modèle introuvable), en mémoire seulement :
  // au redémarrage de l'app, il est de nouveau essayé.
  private sidelined: Record<string, { until: number; reason: SidelineReason }> = {};
  // Dernier modèle qui a répondu, pour l'écran Paramètres (en mémoire seulement).
  private lastUsed: { model: string; at: number } | null = null;

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

  // Panne de ce modèle : il n'est plus essayé pendant un moment.
  // Surcharge : quelques minutes. Modèle introuvable ou sans quota gratuit : jusqu'à minuit (Pacifique).
  sideline(model: string, reason: SidelineReason): void {
    const now = this.now();
    const until = reason === 'SURCHARGE' ? now + OVERLOAD_SIDELINE_MS : nextPacificReset(now);
    this.sidelined[model] = { until, reason };
  }

  // Raison de la mise de côté, ou null si le modèle peut être essayé.
  sidelineReason(model: string): SidelineReason | null {
    const entry = this.sidelined[model];
    if (!entry) return null;
    if (this.now() >= entry.until) {
      delete this.sidelined[model];
      return null;
    }
    return entry.reason;
  }

  noteSuccess(model: string): void {
    this.lastUsed = { model, at: this.now() };
  }

  // État de chaque modèle, pour l'écran Paramètres. Ne contacte pas Google.
  async status(models: readonly string[]): Promise<AiUsageStatus> {
    const now = this.now();
    const usage = await this.today();
    const resetAt = nextPacificReset(now);
    const list = await Promise.all(
      models.map(async (model): Promise<ModelStatus> => {
        const limits = MODEL_LIMITS[model];
        const used = usage.counts[model] ?? 0;
        const base = { model, used: limits ? Math.min(used, limits.perDay) : used, perDay: limits?.perDay ?? null };
        const reason = this.sidelineReason(model);
        if (limits && used >= limits.perDay) return { ...base, state: 'jour', until: resetAt };
        if (reason === 'MODÈLE_INTROUVABLE') return { ...base, state: 'indisponible', until: this.sidelined[model].until };
        if (reason === 'SURCHARGE') return { ...base, state: 'surcharge', until: this.sidelined[model].until };
        const wait = await this.waitMs(model);
        if (wait > 0) return { ...base, state: 'minute', until: now + wait };
        return { ...base, state: 'disponible', until: null };
      })
    );
    return { models: list, resetAt, lastUsed: this.lastUsed };
  }
}

// Durée de mise de côté d'un modèle surchargé.
export const OVERLOAD_SIDELINE_MS = 5 * MINUTE_MS;

export type SidelineReason = 'SURCHARGE' | 'MODÈLE_INTROUVABLE';

export type ModelStatus = {
  model: string;
  used: number; // demandes du jour comptées par l'app
  perDay: number | null; // limite gratuite du jour, si connue
  state: 'disponible' | 'minute' | 'jour' | 'surcharge' | 'indisponible';
  until: number | null; // heure à laquelle le modèle redevient utilisable
};

export type AiUsageStatus = {
  models: ModelStatus[];
  resetAt: number; // prochain minuit, heure du Pacifique
  lastUsed: { model: string; at: number } | null;
};

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

// Pannes propres à un modèle : on passe au suivant et on met celui-ci de côté.
// « limit: 0 » (aucun quota gratuit pour ce modèle) est classé MODÈLE_INTROUVABLE.
const isModelFailure = (error: unknown): error is AiError & { category: SidelineReason } =>
  error instanceof AiError && (error.category === 'SURCHARGE' || error.category === 'MODÈLE_INTROUVABLE');

export type RotationOptions = {
  // Faux : un modèle mis de côté est quand même essayé (test de la clé dans les paramètres).
  respectSideline?: boolean;
};

// Essaie les modèles dans l'ordre. Passe au suivant (sans attendre) si :
// - le modèle a atteint sa limite d'après le compteur, ou Google répond « quota de la minute »
//   ou « quota du jour » ;
// - Google répond « surchargé » (500, 503) ou « modèle introuvable » (404, quota gratuit à zéro) :
//   le modèle est alors mis de côté (5 min pour une surcharge, jusqu'à minuit sinon).
// Toute autre erreur (clé, accès, hors ligne, délai, réponse bloquée) est renvoyée tout de suite.
// Si aucun modèle ne répond : l'erreur la plus utile pour vous (quota de la minute avec le
// délai le plus court, puis surcharge, puis quota du jour, puis modèle introuvable).
export async function runWithRotation<T>(
  tracker: QuotaTracker,
  models: string[],
  send: (model: string) => Promise<T>,
  options: RotationOptions = {}
): Promise<{ result: T; model: string }> {
  const respectSideline = options.respectSideline ?? true;
  const seen = new Map<string, AiError>(); // une erreur par catégorie rencontrée
  let shortestWait = Infinity;
  let minuteModel: string | null = null;

  for (const model of models) {
    const reason = respectSideline ? tracker.sidelineReason(model) : null;
    if (reason) {
      if (!seen.has(reason)) seen.set(reason, new AiError(reason, model));
      continue;
    }
    const wait = await tracker.waitMs(model);
    if (wait > 0) {
      if (Number.isFinite(wait)) {
        if (wait < shortestWait) minuteModel = model;
        shortestWait = Math.min(shortestWait, wait);
      } else if (!seen.has('QUOTA_JOUR')) {
        seen.set('QUOTA_JOUR', new AiError('QUOTA_JOUR', model));
      }
      continue;
    }
    try {
      const result = await send(model);
      await tracker.record(model);
      tracker.noteSuccess(model);
      return { result, model };
    } catch (error) {
      if (isQuota(error)) {
        if (error.category === 'QUOTA_JOUR') {
          await tracker.markDayExhausted(model);
          seen.set('QUOTA_JOUR', error);
        } else {
          tracker.markMinuteExhausted(model, error.retryAfterMs);
          const retry = error.retryAfterMs ?? MINUTE_MS;
          if (retry < shortestWait) minuteModel = model;
          shortestWait = Math.min(shortestWait, retry);
          seen.set('QUOTA_MINUTE', error);
        }
        continue;
      }
      // Pas de réseau ou délai dépassé : la demande n'a peut-être pas été comptée par Google.
      if (!(error instanceof AiError && (error.category === 'HORS_LIGNE' || error.category === 'DÉLAI_DÉPASSÉ'))) {
        await tracker.record(model);
      }
      if (isModelFailure(error)) {
        tracker.sideline(model, error.category);
        seen.set(error.category, error);
        continue;
      }
      throw error;
    }
  }

  // Aucun modèle n'a répondu.
  const first = models[0];
  if (Number.isFinite(shortestWait)) {
    const quota = seen.get('QUOTA_MINUTE');
    throw new AiError('QUOTA_MINUTE', minuteModel ?? quota?.model ?? first, {
      retryAfterMs: shortestWait,
      httpStatus: quota?.httpStatus ?? null,
    });
  }
  for (const category of ['SURCHARGE', 'QUOTA_JOUR', 'MODÈLE_INTROUVABLE'] as const) {
    const error = seen.get(category);
    if (error) throw error;
  }
  throw new AiError('QUOTA_JOUR', first);
}
