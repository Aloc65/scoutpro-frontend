import { api } from './client';

// ─── Types ───────────────────────────────────────────────────────────

export const TRAITS = [
  { key: 'kickCount', ratingKey: 'kickRating', label: 'Kick', icon: '🦶' },
  { key: 'handballCount', ratingKey: 'handballRating', label: 'HB', icon: '🤾' },
  { key: 'markCount', ratingKey: 'markRating', label: 'Marks', icon: '🙌' },
  { key: 'cleanGbgCount', ratingKey: 'cleanGbgRating', label: 'Clean GBG', icon: '💪' },
  { key: 'workRateCount', ratingKey: 'workRateRating', label: 'Work Rate', icon: '🏃' },
  { key: 'contestCount', ratingKey: 'contestRating', label: 'Contest', icon: '⚔️' },
  { key: 'defCount', ratingKey: 'defRating', label: 'Def', icon: '🛡️' },
  { key: 'speedCount', ratingKey: 'speedRating', label: 'Speed', icon: '⚡' },
  { key: 'composureCount', ratingKey: 'composureRating', label: 'Composure', icon: '🧠' },
] as const;

export type TraitKey = typeof TRAITS[number]['key'];
export type RatingKey = typeof TRAITS[number]['ratingKey'];

export interface QuarterData {
  id: string;
  sessionPlayerId: string;
  quarter: number;
  goals: number;
  kickCount: number;
  handballCount: number;
  markCount: number;
  cleanGbgCount: number;
  workRateCount: number;
  contestCount: number;
  defCount: number;
  speedCount: number;
  composureCount: number;
  kickRating: number | null;
  handballRating: number | null;
  markRating: number | null;
  cleanGbgRating: number | null;
  workRateRating: number | null;
  contestRating: number | null;
  defRating: number | null;
  speedRating: number | null;
  composureRating: number | null;
  notes: string | null;
  reviewCompleted: boolean;
}

export interface SessionPlayerData {
  id: string;
  sessionId: string;
  playerId: string;
  position: string | null;
  orderIndex: number;
  isNewPlayer: boolean;
  player: {
    id: string;
    fullName: string;
    team: string | null;
    draftYear: number | null;
    competition?: string | null;
  };
  quarterData: QuarterData[];
}

export interface AiAnalysis {
  summary: string;
  strengths: Array<{ trait: string; evidence: string; rating: number }>;
  weaknesses: Array<{ trait: string; evidence: string; rating: number }>;
  suggestedRatings: Record<string, number>;
  analyzedAt: string | null;
}

export interface ProfileSuggestion {
  playerId: string;
  playerName: string;
  updates: Array<{
    field: string;
    label: string;
    currentValue: any;
    suggestedValue: any;
    reason: string;
  }>;
}

export interface LiveScoutingSession {
  id: string;
  scoutId: string;
  gameTitle: string;
  homeTeam: string;
  awayTeam: string;
  venue: string | null;
  competition: string | null;
  gameDate: string;
  currentQuarter: number;
  status: 'ACTIVE' | 'COMPLETED' | 'ABANDONED';
  completedAt: string | null;
  createdAt: string;
  aiSummary?: string | null;
  aiStrengths?: any[] | null;
  aiWeaknesses?: any[] | null;
  aiSuggestedRatings?: Record<string, number> | null;
  aiAnalyzedAt?: string | null;
  convertedReportId?: string | null;
  scout?: { id: string; name: string; email: string };
  sessionPlayers: SessionPlayerData[];
}

// ─── API Functions ───────────────────────────────────────────────────

export const liveScoutingApi = {
  createSession: (data: {
    gameTitle: string;
    homeTeam: string;
    awayTeam: string;
    venue?: string;
    competition?: string;
    gameDate: string;
  }) => api.post<LiveScoutingSession>('/api/live-scouting/sessions', data),

  getSessions: () => api.get<LiveScoutingSession[]>('/api/live-scouting/sessions'),

  getSession: (id: string) => api.get<LiveScoutingSession>(`/api/live-scouting/sessions/${id}`),

  addPlayer: (sessionId: string, data: {
    playerId?: string;
    position?: string;
    newPlayerFirstName?: string;
    newPlayerLastName?: string;
    newPlayerDraftYear?: number;
    newPlayerTeam?: string;
    isNewPlayer?: boolean;
  }) => api.post<SessionPlayerData>(`/api/live-scouting/sessions/${sessionId}/players`, data),

  removePlayer: (sessionId: string, playerId: string) =>
    api.delete(`/api/live-scouting/sessions/${sessionId}/players/${playerId}`),

  updateStats: (sessionId: string, playerId: string, quarter: number, field: string, delta: number) =>
    api.post<QuarterData>(
      `/api/live-scouting/sessions/${sessionId}/players/${playerId}/quarters/${quarter}/stats`,
      { field, delta },
    ),

  saveReview: (sessionId: string, playerId: string, quarter: number, ratings: Record<string, number>) =>
    api.post<QuarterData>(
      `/api/live-scouting/sessions/${sessionId}/players/${playerId}/quarters/${quarter}/review`,
      ratings,
    ),

  saveNotes: (sessionId: string, playerId: string, quarter: number, notes: string) =>
    api.post<QuarterData>(
      `/api/live-scouting/sessions/${sessionId}/players/${playerId}/quarters/${quarter}/notes`,
      { notes },
    ),

  completeSession: (id: string) =>
    api.patch<LiveScoutingSession>(`/api/live-scouting/sessions/${id}/complete`),

  // ─── Phase 2 APIs ─────────────────────────────────────────────────

  analyzeSession: (id: string) =>
    api.post<AiAnalysis>(`/api/live-scouting/sessions/${id}/analyze`),

  exportPdfUrl: (id: string) =>
    `${api.baseUrl}/api/live-scouting/sessions/${id}/export/pdf`,

  convertToReport: (id: string) =>
    api.post<{ reportIds: string[]; reportId: string; alreadyConverted: boolean; playerCount: number }>(
      `/api/live-scouting/sessions/${id}/convert-to-report`,
    ),

  suggestProfileUpdates: (id: string) =>
    api.post<{ suggestions: ProfileSuggestion[] }>(
      `/api/live-scouting/sessions/${id}/suggest-profile-updates`,
    ),

  applyProfileUpdate: (playerId: string, field: string, value: any) =>
    api.patch(`/api/live-scouting/players/${playerId}/apply-suggestion`, { field, value }),

  // ─── Admin APIs ───────────────────────────────────────────────────

  deleteSession: (id: string) =>
    api.delete(`/api/live-scouting/sessions/${id}`),
};
