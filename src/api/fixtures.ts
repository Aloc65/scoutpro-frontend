import { api } from './client';
import { Fixture, FixtureListResponse } from '../types';

export interface FixtureDatesResponse {
  dates: string[];
}

export async function listFixtures(params: {
  competition?: string;
  status?: string;
  date?: string;
  dateFrom?: string;
  dateTo?: string;
  limit?: number;
  offset?: number;
}): Promise<FixtureListResponse> {
  const query = new URLSearchParams();
  if (params?.competition) query.set('competition', params.competition);
  if (params?.status) query.set('status', params.status);
  if (params?.date) query.set('date', params.date);
  if (params?.dateFrom) query.set('dateFrom', params.dateFrom);
  if (params?.dateTo) query.set('dateTo', params.dateTo);
  if (params?.limit) query.set('limit', params.limit.toString());
  if (params?.offset) query.set('offset', params.offset.toString());
  const qs = query.toString();
  return api.get<FixtureListResponse>(`/api/fixtures${qs ? `?${qs}` : ''}`);
}

export async function getFixtureDates(competition?: string): Promise<string[]> {
  try {
    const query = competition ? `?competition=${encodeURIComponent(competition)}` : '';
    const res = await api.get<FixtureDatesResponse>(`/api/fixtures/dates${query}`);
    return res?.dates ?? [];
  } catch {
    return [];
  }
}
