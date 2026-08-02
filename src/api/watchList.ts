import { api } from './client';
import { FollowUpsResponse } from '../types';

/**
 * Get prospects needing follow-up (stale or never contacted).
 * @param scope 'mine' = scoped to user's homeState, 'all' = all states (admin)
 */
export async function getFollowUps(scope: 'mine' | 'all' = 'mine'): Promise<FollowUpsResponse> {
  return api.get<FollowUpsResponse>(`/api/watch-list/followups?scope=${scope}`);
}
