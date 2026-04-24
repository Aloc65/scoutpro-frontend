import { api } from './client';

export interface AflPlayerBenchmark {
  name: string;
  team: string | null;
}

export interface AflPlayerComparisonRow {
  statName: string;
  scoutingPlayerValue: number;
  aflPlayerValue: number;
  difference: number;
  percentageDiff: number;
  result: 'above' | 'below' | 'equal';
}

export interface AflPlayerComparisonResponse {
  scoutingPlayerId: string;
  scoutingPlayerName: string;
  aflPlayerName: string;
  aflPlayerTeam: string | null;
  comparisons: AflPlayerComparisonRow[];
  analysis: string;
  matchedStatsCount: number;
}

export interface UploadAflResult {
  message: string;
  playersUploaded: number;
}

export async function listAflPlayers(): Promise<AflPlayerBenchmark[]> {
  try {
    const data = await api.get<{ players: AflPlayerBenchmark[] }>(
      '/api/afl-player-benchmarks',
    );
    return Array.isArray(data?.players) ? data.players : [];
  } catch {
    return [];
  }
}

export async function compareWithAflPlayer(
  scoutingPlayerId: string,
  aflPlayerName: string,
): Promise<AflPlayerComparisonResponse | null> {
  if (!scoutingPlayerId || !aflPlayerName) return null;
  const encoded = encodeURIComponent(aflPlayerName);
  return api.get<AflPlayerComparisonResponse>(
    `/api/afl-player-benchmarks/compare/${scoutingPlayerId}/${encoded}`,
  );
}

export async function uploadAflPlayerBenchmarks(
  file: any,
): Promise<UploadAflResult> {
  return api.upload<UploadAflResult>('/api/afl-player-benchmarks/upload', file);
}

export async function deleteAflPlayer(playerName: string): Promise<void> {
  const encoded = encodeURIComponent(playerName);
  await api.delete(`/api/afl-player-benchmarks/${encoded}`);
}
