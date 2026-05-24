import { api } from './client';

// ─── Trait definitions ──────────────────────────────────────────────

export const TRAITS = [
  { posKey: 'kickingPositive', negKey: 'kickingNegative', label: 'Kicking', icon: '🦶' },
  { posKey: 'markingPositive', negKey: 'markingNegative', label: 'Marking', icon: '🙌' },
  { posKey: 'gbgPositive', negKey: 'gbgNegative', label: 'GBG', icon: '💪' },
  { posKey: 'handballingPositive', negKey: 'handballingNegative', label: 'Handballing', icon: '🤾' },
  { posKey: 'workRatePositive', negKey: 'workRateNegative', label: 'Work Rate', icon: '🏃' },
  { posKey: 'decisionMakingPositive', negKey: 'decisionMakingNegative', label: 'Decision Making', icon: '🧭' },
  { posKey: 'composurePositive', negKey: 'composureNegative', label: 'Composure', icon: '🧠' },
  { posKey: 'contestWorkPositive', negKey: 'contestWorkNegative', label: 'Contest Work', icon: '⚔️' },
  { posKey: 'defensiveEffortPositive', negKey: 'defensiveEffortNegative', label: 'Defensive Effort', icon: '🛡️' },
] as const;

export type TraitPosKey = typeof TRAITS[number]['posKey'];
export type TraitNegKey = typeof TRAITS[number]['negKey'];

/** Athletic/holistic traits rated per-quarter via slider (1.0-5.0) */
export const SLIDER_TRAITS = [
  { key: 'speedRating' as const, label: 'Speed', icon: '⚡', description: 'Raw pace, acceleration, and ability to break away from opponents' },
  { key: 'flexibilityRating' as const, label: 'Flexibility', icon: '🤸', description: 'Agility, body flexibility, and ability to adapt to different positions' },
  { key: 'gameAwarenessRating' as const, label: 'Game Awareness', icon: '👁️', description: 'Football IQ, spatial awareness, and ability to read the play' },
] as const;

export type SliderTraitKey = typeof SLIDER_TRAITS[number]['key'];

/** Calculate trait rating: 1 + 4*(pos/(pos+neg)), rounded to 1dp. Returns null if no observations. */
export function calcTraitRating(pos: number, neg: number): number | null {
  const total = pos + neg;
  if (total === 0) return null;
  return Math.round((1 + 4 * (pos / total)) * 10) / 10;
}

// ─── Types ───────────────────────────────────────────────────────────

export interface QuarterData {
  id: string;
  sessionPlayerId: string;
  quarter: number;
  goals: number;
  behinds: number;
  kickingPositive: number;
  kickingNegative: number;
  markingPositive: number;
  markingNegative: number;
  gbgPositive: number;
  gbgNegative: number;
  handballingPositive: number;
  handballingNegative: number;
  workRatePositive: number;
  workRateNegative: number;
  decisionMakingPositive: number;
  decisionMakingNegative: number;
  composurePositive: number;
  composureNegative: number;
  contestWorkPositive: number;
  contestWorkNegative: number;
  defensiveEffortPositive: number;
  defensiveEffortNegative: number;
  // Athletic/holistic slider ratings (1.0-5.0)
  speedRating: number | null;
  flexibilityRating: number | null;
  gameAwarenessRating: number | null;
  position: string | null;
  notes: string | null;
  reviewCompleted: boolean;
}

export type PlayerStatus = 'DNP' | 'INJ' | null;

export interface SessionPlayerData {
  id: string;
  sessionId: string;
  playerId: string;
  position: string | null;
  representingTeam: string | null;
  orderIndex: number;
  isNewPlayer: boolean;
  status: PlayerStatus;
  injuryQuarter: number | null;
  injuryNotes: string | null;
  player: {
    id: string;
    fullName: string;
    team: string | null;
    draftYear: number | null;
    competition?: string | null;
  };
  quarterData: QuarterData[];
}

export interface AiAnalysisPlayer {
  playerName: string;
  playerId: string;
  position: string | null;
  performanceSummary: string;
  keyStrengths: Array<{ title: string; detail: string }>;
  areasForDevelopment: Array<{ title: string; detail: string }>;
  traitAnalysis: Array<{ trait: string; rating: number; analysis: string }>;
  recommendations: string[];
  overallRating: number;
}

export interface AiAnalysis {
  summary: string;
  players: AiAnalysisPlayer[];
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
  aiPlayers?: AiAnalysisPlayer[] | null;
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
    representingTeam?: string;
    newPlayerFirstName?: string;
    newPlayerLastName?: string;
    newPlayerDraftYear?: number;
    newPlayerTeam?: string;
    isNewPlayer?: boolean;
  }) => api.post<SessionPlayerData>(`/api/live-scouting/sessions/${sessionId}/players`, data),

  removePlayer: (sessionId: string, playerId: string) =>
    api.delete(`/api/live-scouting/sessions/${sessionId}/players/${playerId}`),

  updatePlayerStatus: (sessionId: string, playerId: string, data: {
    status: 'DNP' | 'INJ' | null;
    injuryQuarter?: number;
    injuryNotes?: string;
  }) => api.patch<SessionPlayerData>(
    `/api/live-scouting/sessions/${sessionId}/players/${playerId}/status`,
    data,
  ),

  updateStats: (sessionId: string, playerId: string, quarter: number, field: string, delta: number) =>
    api.post<QuarterData>(
      `/api/live-scouting/sessions/${sessionId}/players/${playerId}/quarters/${quarter}/stats`,
      { field, delta },
    ),

  saveReview: (sessionId: string, playerId: string, quarter: number, data: Record<string, any>) =>
    api.post<QuarterData>(
      `/api/live-scouting/sessions/${sessionId}/players/${playerId}/quarters/${quarter}/review`,
      data,
    ),

  saveNotes: (sessionId: string, playerId: string, quarter: number, notes: string) =>
    api.post<QuarterData>(
      `/api/live-scouting/sessions/${sessionId}/players/${playerId}/quarters/${quarter}/notes`,
      { notes },
    ),

  completeSession: (id: string) =>
    api.patch<LiveScoutingSession>(`/api/live-scouting/sessions/${id}/complete`),

  // ─── Phase 2 APIs ─────────────────────────────────────────────────

  updateSession: (id: string, data: {
    gameTitle?: string;
    homeTeam?: string;
    awayTeam?: string;
    venue?: string;
    competition?: string;
    gameDate?: string;
  }) => api.patch(`/api/live-scouting/sessions/${id}`, data),

  analyzeSession: (id: string) =>
    api.post<AiAnalysis>(`/api/live-scouting/sessions/${id}/analyze`),

  exportPdfUrl: (id: string) =>
    `${api.baseUrl}/api/live-scouting/sessions/${id}/export/pdf`,

  convertToReport: (id: string, force = false) =>
    api.post<{
      reportIds: string[];
      reportId: string;
      alreadyConverted: boolean;
      updated: boolean;
      updatedCount: number;
      createdCount: number;
      playerCount: number;
    }>(
      `/api/live-scouting/sessions/${id}/convert-to-report${force ? '?force=true' : ''}`,
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
