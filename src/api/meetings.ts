import { api } from './client';
import { Meeting } from '../types';

export async function getMeetingsByPlayer(playerId: string): Promise<Meeting[]> {
  // Backend route is GET /api/meetings/player/:playerId (path param, not a query string)
  return api.get<Meeting[]>(`/api/meetings/player/${playerId}`);
}

export async function createMeeting(data: {
  playerId: string;
  meetingDate: string;
  meetingType: string;
  notes: string;
  attendees?: string;
  location?: string;
  actionItems?: string;
}): Promise<Meeting> {
  return api.post<Meeting>('/api/meetings', data);
}

export async function updateMeeting(
  id: string,
  data: Partial<{
    meetingDate: string;
    meetingType: string;
    notes: string;
    attendees: string;
    location: string;
    actionItems: string;
  }>
): Promise<Meeting> {
  return api.patch<Meeting>(`/api/meetings/${id}`, data);
}

export async function deleteMeeting(id: string): Promise<void> {
  return api.delete<void>(`/api/meetings/${id}`);
}
