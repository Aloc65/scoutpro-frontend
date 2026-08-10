import { api } from './client';
import { WeeklyWatchPlan, WeeklyWatchPlanCandidates } from '../types';

/** Get the current weekend's curated watch plan (all authenticated users). */
export async function getWeeklyWatchPlan(): Promise<WeeklyWatchPlan> {
  return api.get<WeeklyWatchPlan>('/api/weekly-watch-plan');
}

/** Get watch-list candidates to add to the plan (admin). */
export async function getWatchPlanCandidates(): Promise<WeeklyWatchPlanCandidates> {
  return api.get<WeeklyWatchPlanCandidates>('/api/weekly-watch-plan/candidates');
}

export interface AddWatchPlanEntryData {
  playerId: string;
  fixtureId?: string;
  assignedScoutId?: string;
  notes?: string;
  priority?: number;
}

/** Add a player to the current weekend plan (admin). */
export async function addWatchPlanEntry(data: AddWatchPlanEntryData) {
  return api.post('/api/weekly-watch-plan', data);
}

export interface UpdateWatchPlanEntryData {
  fixtureId?: string | null;
  assignedScoutId?: string | null;
  notes?: string | null;
  priority?: number;
}

/** Update a plan entry (admin). Empty string clears fixture/scout/notes. */
export async function updateWatchPlanEntry(id: string, data: UpdateWatchPlanEntryData) {
  return api.patch(`/api/weekly-watch-plan/${id}`, data);
}

/** Remove a player from the plan (admin). */
export async function removeWatchPlanEntry(id: string) {
  return api.delete(`/api/weekly-watch-plan/${id}`);
}

/** Auto-add all watch-list players whose team plays this weekend (admin). */
export async function autoPopulateWatchPlan(): Promise<{ added: number }> {
  return api.post('/api/weekly-watch-plan/auto-populate', {});
}

/** Clear the entire plan for this weekend (admin). */
export async function clearWatchPlan(): Promise<{ removed: number }> {
  return api.delete('/api/weekly-watch-plan/clear');
}
