import { Colors } from '../../theme/colors';
import { PipelineStage, PIPELINE_STAGE_LABELS, WatchList } from '../../types';

// Days after which a "last contact" is considered stale (shown in warning colour).
export const STALE_CONTACT_DAYS = 21;

// Per-stage visual config used by the board columns and stage pills.
export const STAGE_CONFIG: Record<
  PipelineStage,
  { label: string; color: string; icon: string }
> = {
  NOT_CONTACTED: { label: PIPELINE_STAGE_LABELS.NOT_CONTACTED, color: Colors.textMuted, icon: 'ellipse-outline' },
  INITIAL_CALL: { label: PIPELINE_STAGE_LABELS.INITIAL_CALL, color: Colors.accent, icon: 'call-outline' },
  FAMILY_MEETING: { label: PIPELINE_STAGE_LABELS.FAMILY_MEETING, color: Colors.primary, icon: 'people-outline' },
  OFFER_MADE: { label: PIPELINE_STAGE_LABELS.OFFER_MADE, color: Colors.amber, icon: 'document-text-outline' },
  SIGNED: { label: PIPELINE_STAGE_LABELS.SIGNED, color: Colors.green, icon: 'checkmark-circle-outline' },
};

/** True when the entry has an AFL club interested AND is not yet signed. */
export function hasActiveAflInterest(item: Pick<WatchList, 'aflInterestClub' | 'stage'>): boolean {
  return !!item.aflInterestClub && item.stage !== 'SIGNED';
}

/** Whole days since the given ISO timestamp (or null). */
export function daysSince(iso: string | null | undefined): number | null {
  if (!iso) return null;
  const then = new Date(iso).getTime();
  if (Number.isNaN(then)) return null;
  const ms = Date.now() - then;
  return Math.floor(ms / (1000 * 60 * 60 * 24));
}

export function isStale(lastContactAt: string | null | undefined): boolean {
  const d = daysSince(lastContactAt);
  return d !== null && d > STALE_CONTACT_DAYS;
}

/** Human recency label, e.g. "Today", "3d ago", "Never contacted". */
export function lastContactLabel(lastContactAt: string | null | undefined): string {
  const d = daysSince(lastContactAt);
  if (d === null) return 'Never contacted';
  if (d <= 0) return 'Today';
  if (d === 1) return 'Yesterday';
  if (d < 7) return `${d}d ago`;
  if (d < 30) return `${Math.floor(d / 7)}w ago`;
  if (d < 365) return `${Math.floor(d / 30)}mo ago`;
  return `${Math.floor(d / 365)}y ago`;
}

/** Formats a date/time for contact-log rows. */
export function formatContactDate(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  return d.toLocaleDateString(undefined, {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  });
}

/** Draft year derived value used across views. */
export function draftYearOf(item: WatchList): number | null {
  return item.draftYear ?? item.player?.draftYear ?? null;
}

// Rating scale label (overall rating is the mean of trait sliders, scale 1–5).
export const RATING_SCALE_MAX = 5;

/** Overall rating display, e.g. "3.8 / 5" or "Not rated" for missing (never 0). */
export function overallRatingLabel(avgRating: number | null | undefined): string {
  if (avgRating == null) return 'Not rated';
  return `${avgRating.toFixed(1)} / ${RATING_SCALE_MAX}`;
}
