/**
 * Monthly editorial publishing schedule rules.
 *
 * Persisted in localStorage so the user's preferences survive reloads without
 * needing a server round-trip. Used by the duplicate-publication flow to
 * validate the chosen "Issue Date".
 */

export type ScheduleRules = {
  /** Earliest day-of-month allowed for an issue date (1–31). */
  minDay: number;
  /** Latest day-of-month allowed for an issue date (1–31). */
  maxDay: number;
  /** How many months in the past an issue date may sit (>= 0). */
  pastMonths: number;
  /** How many months in the future an issue date may sit (>= 0). */
  futureMonths: number;
};

export const DEFAULT_SCHEDULE_RULES: ScheduleRules = {
  minDay: 1,
  maxDay: 28,
  pastMonths: 1,
  futureMonths: 12,
};

const STORAGE_KEY = "pageluxe.schedule-rules.v1";

const clampInt = (n: unknown, min: number, max: number, fallback: number): number => {
  const v = Number(n);
  if (!Number.isFinite(v)) return fallback;
  return Math.min(max, Math.max(min, Math.round(v)));
};

export const normalizeRules = (raw: Partial<ScheduleRules> | null | undefined): ScheduleRules => {
  const minDay = clampInt(raw?.minDay, 1, 31, DEFAULT_SCHEDULE_RULES.minDay);
  const maxDayRaw = clampInt(raw?.maxDay, 1, 31, DEFAULT_SCHEDULE_RULES.maxDay);
  const maxDay = Math.max(minDay, maxDayRaw);
  return {
    minDay,
    maxDay,
    pastMonths: clampInt(raw?.pastMonths, 0, 120, DEFAULT_SCHEDULE_RULES.pastMonths),
    futureMonths: clampInt(raw?.futureMonths, 0, 120, DEFAULT_SCHEDULE_RULES.futureMonths),
  };
};

export const loadScheduleRules = (): ScheduleRules => {
  if (typeof window === "undefined") return DEFAULT_SCHEDULE_RULES;
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return DEFAULT_SCHEDULE_RULES;
    return normalizeRules(JSON.parse(raw));
  } catch {
    return DEFAULT_SCHEDULE_RULES;
  }
};

export const saveScheduleRules = (rules: ScheduleRules): void => {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(normalizeRules(rules)));
  } catch {
    /* ignore quota / privacy-mode failures */
  }
};

/**
 * Validate a chosen issue date against the rules. Returns a human-readable
 * error message, or `null` when the date is acceptable.
 */
export const validateIssueDateAgainstRules = (
  d: Date,
  rules: ScheduleRules,
): string | null => {
  const day = d.getDate();
  if (day < rules.minDay || day > rules.maxDay) {
    return `Issue date must fall on day ${rules.minDay}–${rules.maxDay} of the month (monthly editorial schedule).`;
  }
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const minDate = new Date(today);
  minDate.setMonth(minDate.getMonth() - rules.pastMonths);
  const maxDate = new Date(today);
  maxDate.setMonth(maxDate.getMonth() + rules.futureMonths);
  const picked = new Date(d);
  picked.setHours(0, 0, 0, 0);
  if (picked < minDate) {
    return `Issue date is too far in the past (more than ${rules.pastMonths} month${rules.pastMonths === 1 ? "" : "s"} ago).`;
  }
  if (picked > maxDate) {
    return `Issue date is too far ahead (more than ${rules.futureMonths} month${rules.futureMonths === 1 ? "" : "s"} from today).`;
  }
  return null;
};
