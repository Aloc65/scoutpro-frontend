export const COMPETITIONS = ['Futures', 'Colts', 'Reserves', 'League', 'State 18s'] as const;
export const POSITIONS = ['Forward', 'High Forward', 'Hybrid Fwd', 'Inside Mid', 'Outside Mid', 'Ruck', 'Key Defender', 'Mid Defender', 'Sml Defender', 'Hybrid Back'] as const;
export const PROJECTIONS = ['Strong Prospect', 'Watch Player', 'Not Recommended'] as const;
export const SIGNING_STATUSES = ['SIGNED', 'NOT_SIGNED'] as const;
export type SigningStatus = typeof SIGNING_STATUSES[number];
export const SIGNING_STATUS_LABELS: Record<SigningStatus, string> = {
  SIGNED: 'Signed',
  NOT_SIGNED: 'Not Signed',
};

export interface User {
  id: string;
  email: string;
  name: string;
  role: 'ADMIN' | 'SCOUT';
  mustChangePassword?: boolean;
}

export interface Player {
  id: string;
  fullName: string;
  team: string | null;
  dateOfBirth: string | null;
  age: number | null;
  competition: string | null;
  dominantFoot: string | null;
  height: number | null;
  weight: number | null;
  draftYear: number | null;
  signingStatus: 'SIGNED' | 'NOT_SIGNED';
  notes: string | null;
  createdAt: string;
}

export interface Ratings {
  id?: string;
  kicking: number | null;
  handball: number | null;
  marking: number | null;
  workRate: number | null;
  decisionMaking: number | null;
  composure: number | null;
  speed: number | null;
  flexibility: number | null;
  defensiveEffort: number | null;
  contestWork: number | null;
  gameAwareness: number | null;
}

export interface ReportListItem {
  id: string;
  playerName: string;
  playerTeam: string | null;
  matchDate: string;
  opponent: string;
  competition: string | null;
  scoutName: string;
  overallProjection: string | null;
  primaryPosition: string;
  createdAt: string;
}

export interface GameStats {
  goals: number | null;
  behinds: number | null;
  disposals: number | null;
  kicks: number | null;
  handballs: number | null;
  marks: number | null;
  tackles: number | null;
  clearances: number | null;
  inside50s: number | null;
}

export const GAME_STAT_KEYS: [keyof GameStats, string][] = [
  ['goals', 'Goals'], ['behinds', 'Behinds'], ['disposals', 'Disposals'],
  ['kicks', 'Kicks'], ['handballs', 'Handballs'], ['marks', 'Marks'],
  ['tackles', 'Tackles'], ['clearances', 'Clearances'], ['inside50s', 'Inside 50s'],
];

export interface FullReport {
  id: string;
  playerId: string;
  playerName: string;
  playerTeam: string | null;
  scoutId: string;
  scoutName: string;
  matchDate: string;
  opponent: string;
  venue: string | null;
  competition: string | null;
  result: string | null;
  minutesPlayed: number | null;
  positionsPlayed: string[];
  primaryPosition: string;
  summary: string;
  strengths: string | null;
  weaknesses: string | null;
  developmentAreas: string | null;
  overallProjection: string | null;
  generalMatchNotes: string | null;
  goals: number | null;
  behinds: number | null;
  disposals: number | null;
  kicks: number | null;
  handballs: number | null;
  marks: number | null;
  tackles: number | null;
  clearances: number | null;
  inside50s: number | null;
  ratings: Ratings;
  createdAt: string;
  updatedAt: string;
}

export const MEETING_TYPES = ['INITIAL', 'FOLLOW_UP', 'CONTRACT', 'REVIEW', 'OTHER'] as const;
export type MeetingType = typeof MEETING_TYPES[number];

export const MEETING_TYPE_LABELS: Record<MeetingType, string> = {
  INITIAL: 'Initial Meeting',
  FOLLOW_UP: 'Follow Up',
  CONTRACT: 'Contract Discussion',
  REVIEW: 'Review',
  OTHER: 'Other',
};

export interface Meeting {
  id: string;
  playerId: string;
  meetingDate: string;
  meetingType: MeetingType;
  notes: string;
  attendees: string | null;
  location: string | null;
  actionItems: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface DashboardData {
  totalPlayers: number;
  totalReports: number;
  myReports: number;
  recentReports: ReportListItem[];
}
