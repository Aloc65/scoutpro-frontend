import { api } from './client';
import { ContactLogEntry } from '../types';

export interface ContactLogInput {
  occurredAt: string;
  note: string;
  contactType?: string | null;
  attendees?: string | null;
  location?: string | null;
  actionItems?: string | null;
}

/** Full contact history for a player, most recent first. */
export async function getContactLog(playerId: string): Promise<ContactLogEntry[]> {
  const res = await api.get<{ items: ContactLogEntry[]; total: number }>(
    `/api/players/${playerId}/contact-log`,
  );
  return res.items || [];
}

export async function createContactLogEntry(
  playerId: string,
  data: ContactLogInput,
): Promise<ContactLogEntry> {
  return api.post<ContactLogEntry>(`/api/players/${playerId}/contact-log`, data);
}

export async function updateContactLogEntry(
  playerId: string,
  entryId: string,
  data: Partial<ContactLogInput>,
): Promise<ContactLogEntry> {
  return api.patch<ContactLogEntry>(
    `/api/players/${playerId}/contact-log/${entryId}`,
    data,
  );
}

export async function deleteContactLogEntry(
  playerId: string,
  entryId: string,
): Promise<void> {
  return api.delete<void>(`/api/players/${playerId}/contact-log/${entryId}`);
}
