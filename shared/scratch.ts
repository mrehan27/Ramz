/**
 * When a scratch entry goes. Worked out, never stored: the clock is the last
 * time you edited or copied it, so changing the number of days applies to
 * everything already there, and anything you keep using never expires.
 */
const DAY = 24 * 60 * 60 * 1000;

type Dated = { kind: string; keep: boolean; createdAt: string; updatedAt: string; lastUsedAt: string };

export const DEFAULT_SCRATCH_DAYS = 30;

/** The last sign of life, in ms. Blank or unparseable dates count for nothing. */
const touched = (e: Dated) =>
  Math.max(0, ...[e.createdAt, e.updatedAt, e.lastUsedAt].map((d) => Date.parse(d)).filter((t) => !Number.isNaN(t)));

/** When it will be deleted, or null if it never will be. */
export function expiresAt(e: Dated, days: number): number | null {
  if (e.kind !== "scratch" || e.keep) return null;
  return touched(e) + days * DAY;
}

export function isExpired(e: Dated, days: number, now = Date.now()) {
  const at = expiresAt(e, days);
  return at !== null && at <= now;
}

/** "expires today", "expires tomorrow", "expires in 12 days". */
export function expiryLabel(e: Dated, days: number, now = Date.now()) {
  const at = expiresAt(e, days);
  if (at === null) return null;
  const left = Math.round((at - now) / DAY);
  return left <= 0 ? "expires today" : left === 1 ? "expires tomorrow" : `expires in ${left} days`;
}
