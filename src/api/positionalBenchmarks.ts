import { api } from './client';

export interface ComparisonRow {
  statName: string;
  playerValue: number;
  positionAverage: number;
  difference: number;
  percentageDiff: number;
  result: 'above' | 'below' | 'equal';
}

export interface ComparisonResponse {
  playerId: string;
  playerName: string;
  positionName: string;
  comparisons: ComparisonRow[];
  analysis: string;
  matchedStatsCount: number;
}

export interface UploadResult {
  success: boolean;
  message: string;
  positionsUploaded: string[];
  count: number;
}

export async function listPositions(): Promise<string[]> {
  try {
    const data = await api.get<{ positions: string[] }>('/api/positional-benchmarks');
    return Array.isArray(data?.positions) ? data.positions : [];
  } catch {
    return [];
  }
}

export async function comparePlayer(
  playerId: string,
  positionName: string,
): Promise<ComparisonResponse | null> {
  if (!playerId || !positionName) return null;
  try {
    const encoded = encodeURIComponent(positionName);
    return await api.get<ComparisonResponse>(
      `/api/positional-benchmarks/compare/${playerId}/${encoded}`,
    );
  } catch (e) {
    throw e;
  }
}

export async function uploadBenchmarks(file: any): Promise<UploadResult> {
  return api.upload<UploadResult>('/api/positional-benchmarks/upload', file);
}

export async function deletePosition(positionName: string): Promise<void> {
  const encoded = encodeURIComponent(positionName);
  await api.delete(`/api/positional-benchmarks/${encoded}`);
}
