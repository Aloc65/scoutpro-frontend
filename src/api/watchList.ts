import { api } from './client';
import {
  FollowUpsResponse,
  WatchList,
  ContactPermission,
  ContactPermissionAudit,
  Player,
} from '../types';

/**
 * Get prospects needing follow-up (stale or never contacted).
 * @param scope 'mine' = scoped to user's homeState, 'all' = all states (admin)
 */
export async function getFollowUps(scope: 'mine' | 'all' = 'mine'): Promise<FollowUpsResponse> {
  return api.get<FollowUpsResponse>(`/api/watch-list/followups?scope=${scope}`);
}

/**
 * Set the per-watchlist-entry priority tier (1 High..4 Hold, null = Not set)
 * and optional reason. Returns the updated entry (incl. avgRating) so the caller
 * can reposition the card without a full refetch.
 */
export async function updatePriority(
  playerId: string,
  priority: number | null,
  priorityReason?: string | null,
): Promise<WatchList> {
  return api.patch<WatchList>(`/api/watch-list/${playerId}/priority`, {
    priority,
    priorityReason,
  });
}

// ─── Agent contact permission (player-level) ──────────────────────────

export interface UpdateContactPermissionPayload {
  permission: ContactPermission;
  confirmedAt?: string | null;
  source?: string | null;
  note?: string | null;
}

/** Record / update a player's agent-contact permission (writes an audit row). */
export async function updateContactPermission(
  playerId: string,
  payload: UpdateContactPermissionPayload,
): Promise<{ player: Player }> {
  return api.patch<{ player: Player }>(
    `/api/players/${playerId}/contact-permission`,
    payload,
  );
}

/** Full audit history of a player's contact-permission changes (newest first). */
export async function getContactPermissionHistory(
  playerId: string,
): Promise<{ history: ContactPermissionAudit[] }> {
  return api.get<{ history: ContactPermissionAudit[] }>(
    `/api/players/${playerId}/contact-permission/history`,
  );
}
