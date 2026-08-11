export const COMPETITIONS = ['Futures', 'Colts', 'Reserves', 'League', 'PSA', 'State 18s', "Under 16's"] as const;
export const POSITIONS = ['Small Forward', 'Key Forward', 'High Forward', 'Medium Forward', 'Ruck', 'Outside Mid', 'Inside Mid', 'Key Back', 'Rebound Defender', 'Small Defender', 'Mid Defender'] as const;
export const PROJECTIONS = ['Strong Prospect', 'Watch Player', 'Not Recommended'] as const;
export const SIGNING_STATUSES = ['SIGNED', 'NOT_SIGNED'] as const;
export type SigningStatus = typeof SIGNING_STATUSES[number];
export const SIGNING_STATUS_LABELS: Record<SigningStatus, string> = {
  SIGNED: 'Signed',
  NOT_SIGNED: 'Not Signed',
};

export const REPORT_VIEWING_METHODS = ['LIVE', 'OFF_VISION'] as const;
export type ReportViewingMethod = typeof REPORT_VIEWING_METHODS[number];
export const REPORT_VIEWING_METHOD_LABELS: Record<ReportViewingMethod, string> = {
  LIVE: 'Live',
  OFF_VISION: 'Off Vision',
};

export const WATCH_LIST_SIGNED_STATUSES = ['Signed', 'Unsigned'] as const;
export type SignedStatus = typeof WATCH_LIST_SIGNED_STATUSES[number];

// ─── Recruitment pipeline ────────────────────────────────────────────
// Ordered funnel stages. Order here defines column order on the Board and
// the "advance" order in the quick-view stage selector.
export const PIPELINE_STAGES = [
  'NOT_CONTACTED',
  'INITIAL_CALL',
  'FAMILY_MEETING',
  'OFFER_MADE',
  'SIGNED',
] as const;
export type PipelineStage = typeof PIPELINE_STAGES[number];

export const PIPELINE_STAGE_LABELS: Record<PipelineStage, string> = {
  NOT_CONTACTED: 'Not Contacted',
  INITIAL_CALL: 'Initial Call',
  FAMILY_MEETING: 'Family Meeting',
  OFFER_MADE: 'Offer Made',
  SIGNED: 'Signed',
};

// A single contact-history entry. `stageAfter` is set when the entry was
// created by a stage change (null for a manually logged contact).
export interface ContactLogEntry {
  id: string;
  playerId: string;
  userId: string;
  occurredAt: string;
  note: string;
  stageAfter: PipelineStage | null;
  // Unified contact/meeting fields (merged from the legacy `meeting` model).
  // All optional: quick watch-list touchpoints leave these null.
  contactType?: ContactType | null;
  attendees?: string | null;
  location?: string | null;
  actionItems?: string | null;
  createdAt: string;
  updatedAt?: string;
  user?: { id: string; name: string | null; email: string | null } | null;
}

// Type of a contact/meeting touchpoint (reused from the legacy meeting model).
export const CONTACT_TYPES = ['INITIAL', 'FOLLOW_UP', 'CONTRACT', 'REVIEW', 'OTHER'] as const;
export type ContactType = typeof CONTACT_TYPES[number];

export const CONTACT_TYPE_LABELS: Record<ContactType, string> = {
  INITIAL: 'Initial Meeting',
  FOLLOW_UP: 'Follow Up',
  CONTRACT: 'Contract Discussion',
  REVIEW: 'Review',
  OTHER: 'Other',
};

// Follow-up item (player needing attention: never contacted or stale contact).
export interface FollowUpItem {
  playerId: string;
  playerName: string;
  team: string | null;
  state: AustralianState | null;
  stage: PipelineStage;
  aflTeamsInterested: string[];
  aflInterestClub: string | null;
  hasAflInterest: boolean;
  lastContactAt: string | null;
  reason: string; // "Never contacted" or "Last contact X weeks ago"
}

export interface FollowUpsResponse {
  items: FollowUpItem[];
  total: number;
  homeStateUnset?: boolean;
}

export const AUSTRALIAN_STATES = ['WA', 'SA', 'VIC', 'NSW', 'QLD', 'TAS', 'ACT', 'NT'] as const;
export type AustralianState = typeof AUSTRALIAN_STATES[number];

// National Championships is a cross-state competition. It is selectable
// independently of any state and is always offered as an option.
export const NATIONAL_CHAMPIONSHIPS = 'National Championships';

// Competitions are state-specific. Each state has its own predefined list below.
// WA reuses the COMPETITIONS const above. States without a predefined list (TAS,
// ACT, NT) are intentionally omitted — callers fall back to the free-text
// "Other Competition" (plus the always-available National Championships option).
export const STATE_COMPETITIONS: Record<string, readonly string[]> = {
  WA: COMPETITIONS,
  VIC: ['Talent League', 'APS School Football', 'AGS School Football', 'APS'],
  SA: ['Seniors', 'Reserves', 'U18s', 'SAAS'],
  QLD: ['Talent League'],
  NSW: ['Talent League', 'VFL'],
};

// Deduplicated union of every state's predefined competitions plus National
// Championships. Used by the player list filter's "All" option so users can
// filter by any competition across states.
export const ALL_COMPETITIONS: string[] = Array.from(
  new Set([...Object.values(STATE_COMPETITIONS).flat(), NATIONAL_CHAMPIONSHIPS]),
);

// Returns the predefined competitions available for a given state. National
// Championships is always appended because it is selectable independently of
// state. When no state is selected, only National Championships is returned.
export function getCompetitionsForState(state: string | null | undefined): string[] {
  const comps = state ? STATE_COMPETITIONS[state] : undefined;
  const list = comps && comps.length > 0 ? [...comps] : [];
  return [...list, NATIONAL_CHAMPIONSHIPS];
}

export interface User {
  id: string;
  email: string;
  name: string;
  role: 'ADMIN' | 'SCOUT';
  mustChangePassword?: boolean;
  acceptedNdaAt?: string | null;
  ndaVersion?: string;
  // Home state/territory this user scouts. Null = unscoped (sees everything).
  homeState?: AustralianState | null;
}

export interface Player {
  id: string;
  fullName: string;
  team: string | null;
  state: AustralianState | null;
  dateOfBirth: string | null;
  age: number | null;
  competition: string | null;
  customCompetition: string | null;
  dominantFoot: string | null;
  height: number | null;
  weight: number | null;
  draftYear: number | null;
  signingStatus: 'SIGNED' | 'NOT_SIGNED';
  notes: string | null;
  photoUrl: string | null;
  photoLastUpdated: string | null;
  createdAt: string;
}

export interface WatchList {
  id: string;
  playerId: string;
  signedStatus: SignedStatus;
  aflTeamsInterested: string[];
  createdAt: string;
  updatedAt: string;
  draftYear: number | null;
  // Recruitment pipeline fields
  stage: PipelineStage;
  priorityRank: number | null;
  aflInterestClub: string | null;
  aflInterestNotedAt: string | null;
  lastContactAt: string | null;
  // Quick-view metrics (only populated by GET /watch-list/player/:playerId)
  reportCount?: number;
  avgRating?: number | null;
  primaryPosition?: string | null;
  player: {
    id: string;
    fullName: string;
    team: string | null;
    dateOfBirth: string | null;
    draftYear?: number | null;
    competition: string | null;
    state: AustralianState | null;
  };
}

export interface Ratings {
  id?: string;
  kicking: number | null;
  handball: number | null;
  marking: number | null;
  cleanBelowKnees: number | null;
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
  representingTeam: string | null;
  primaryPosition: string;
  viewingMethod: ReportViewingMethod;
  createdAt: string;
}

export interface Fixture {
  id: string;
  competition: string;
  round: string;
  date: string;
  time: string | null;
  homeTeam: string;
  awayTeam: string;
  venue: string | null;
  status: 'SCHEDULED' | 'COMPLETED' | 'POSTPONED' | 'CANCELLED';
  notes: string | null;
  homeScore: string | null;
  awayScore: string | null;
  createdById: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface FixtureListResponse {
  fixtures: Fixture[];
  total: number;
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


export interface ChampionDataStat {
  id: string;
  playerId: string;
  season: number | null;
  sourceFile: string | null;
  sourceSheet: string | null;
  sourcePlayerName: string;
  normalizedPlayerName: string;
  roundLabel: string | null;
  roundNumber: number | null;
  isFinals: boolean | null;
  matchDate: string | null;
  opponent: string | null;
  age: number | null;
  position: string | null;
  squad: string | null;
  matchesPlayed: number | null;
  rankingPoints: number | null;
  disposals: number | null;
  kicks: number | null;
  handballs: number | null;
  kickHandballRatio: number | null;
  kickingEfficiency: number | null;
  contestedPossessions: number | null;
  uncontestedPossessions: number | null;
  contestedPossessionRate: number | null;
  marks: number | null;
  interceptMarks: number | null;
  inside50s: number | null;
  clearances: number | null;
  goals: number | null;
  accuracy: number | null;
  scoreAssists: number | null;
  scoreInvolvements: number | null;
  tackles: number | null;
  createdAt: string;
  updatedAt: string;
}

export interface ChampionDataColumn {
  key: string;
  label: string;
}

export interface ChampionDataSeasonAverage {
  season: number | null;
  grade?: string;
  gradeDisplayName?: string;
  rows: number;
  averages: Record<string, number | null>;
}

export interface ChampionDataPlayerResponse {
  player: { id: string; fullName: string };
  columns: ChampionDataColumn[];
  stats: ChampionDataStat[];
  seasonAverages: ChampionDataSeasonAverage[];
}

// ─── National Championships Stats ─────────────────────────────────────
// Mirrors Champion Data types — same stat structure
export type NationalChampionshipsStat = ChampionDataStat;
export type NationalChampionshipsColumn = ChampionDataColumn;
export type NationalChampionshipsSeasonAverage = ChampionDataSeasonAverage;

export interface NationalChampionshipsPlayerResponse {
  player: { id: string; fullName: string };
  columns: NationalChampionshipsColumn[];
  stats: NationalChampionshipsStat[];
  seasonAverages: NationalChampionshipsSeasonAverage[];
}
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
  viewingMethod: ReportViewingMethod;
  summary: string;
  strengths: string | null;
  weaknesses: string | null;
  developmentAreas: string | null;
  overallProjection: string | null;
  representingTeam: string | null;
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

export interface UpcomingGame {
  id: string;
  homeTeam: string;
  awayTeam: string;
  venue: string | null;
  competition: string;
  round: string;
  date: string;
  time: string | null;
  sessionId: string | null;
  sessionStatus: string | null;
  playerCount: number;
}

export interface UpcomingGamesData {
  weekendLabel: string;
  weekendStart: string;
  weekendEnd: string;
  games: UpcomingGame[];
  totalGames: number;
}

export interface DashboardKPIs {
  watchListCount: number;
  followUpsDue: number;
  strongProspects: number;
}

export interface PlayerToWatch {
  playerId: string;
  playerName: string;
  team: string | null;
  photoUrl: string | null;
  draftYear: number | null;
  position: string | null;
  stage: PipelineStage;
}

export interface ScoutingActivity {
  reportsThisMonth: number;
  playersWatched: number;
  clubsCovered: number;
  scoutingSessions: number;
}

export interface DashboardData {
  totalPlayers: number;
  totalReports: number;
  myReports: number;
  recentReports: ReportListItem[];
  upcomingGames?: UpcomingGamesData;
  kpis?: DashboardKPIs;
  playersToWatch?: PlayerToWatch[];
  activity?: ScoutingActivity;
}

// ─── Weekly Watch Plan ───────────────────────────────────────────────

export interface WeeklyWatchPlanGame {
  id: string;
  competition: string;
  round: string;
  homeTeam: string;
  awayTeam: string;
  venue: string | null;
  date: string;
  time: string | null;
}

export interface WeeklyWatchPlanEntry {
  id: string;
  playerId: string;
  playerName: string;
  team: string | null;
  photoUrl: string | null;
  draftYear: number | null;
  state: AustralianState | null;
  position: string | null;
  priority: number | null;
  notes: string | null;
  assignedScoutId: string | null;
  assignedScoutName: string | null;
  fixtureId: string | null;
  fixtureLabel: string | null;
  fixtureDate: string | null;
}

export interface WeeklyWatchPlan {
  weekendAnchor: string;
  weekendStart: string;
  weekendEnd: string;
  weekendLabel: string;
  totalEntries: number;
  entries: WeeklyWatchPlanEntry[];
  games: WeeklyWatchPlanGame[];
}

export interface WeeklyWatchPlanCandidate {
  playerId: string;
  playerName: string;
  team: string | null;
  photoUrl: string | null;
  draftYear: number | null;
  state: AustralianState | null;
  position: string | null;
  stage: PipelineStage;
  aflInterestClub: string | null;
  playsThisWeekend: boolean;
  inPlan: boolean;
}

export interface WeeklyWatchPlanCandidates {
  weekendLabel: string;
  teamsPlaying: string[];
  candidates: WeeklyWatchPlanCandidate[];
}

// ─── Live Scouting Types ─────────────────────────────────────────────

export const SCOUTING_TRAITS = [
  'Kicking', 'Marking', 'GBG', 'Handballing', 'Work Rate',
  'Decision Making', 'Composure', 'Contest Work', 'Defensive Effort',
] as const;

export type ScoutingTrait = typeof SCOUTING_TRAITS[number];

export type LiveScoutingStatus = 'ACTIVE' | 'COMPLETED' | 'ABANDONED';


// ─── Audit Log Types ─────────────────────────────────────────────────

export const AUDIT_ACTIONS = [
  'LOGIN',
  'FAILED_LOGIN',
  'PASSWORD_RESET',
  'USER_CREATED',
  'USER_DELETED',
  'REPORT_CREATED',
  'REPORT_EDITED',
  'REPORT_DELETED',
  'DATA_EXPORTED',
  'ADMIN_ACTION',
] as const;

export type AuditAction = typeof AUDIT_ACTIONS[number];

export const AUDIT_ACTION_LABELS: Record<AuditAction, string> = {
  LOGIN: 'Login',
  FAILED_LOGIN: 'Failed Login',
  PASSWORD_RESET: 'Password Reset',
  USER_CREATED: 'User Created',
  USER_DELETED: 'User Deleted',
  REPORT_CREATED: 'Report Created',
  REPORT_EDITED: 'Report Edited',
  REPORT_DELETED: 'Report Deleted',
  DATA_EXPORTED: 'Data Exported',
  ADMIN_ACTION: 'Admin Action',
};

export interface AuditLog {
  id: string;
  timestamp: string;
  userId: string | null;
  username: string | null;
  action: AuditAction;
  entity: string | null;
  entityId: string | null;
  details: Record<string, any> | null;
  ipAddress: string | null;
  userAgent: string | null;
  success: boolean;
}

export interface AuditLogListResponse {
  items: AuditLog[];
  total: number;
  page: number;
  limit: number;
  totalPages: number;
}

// ─── Security Monitoring & Alerting ──────────────────────────────────

export const SECURITY_ALERT_TYPES = ['FAILED_LOGIN', 'LARGE_EXPORT', 'UNUSUAL_ACTIVITY'] as const;
export type SecurityAlertType = typeof SECURITY_ALERT_TYPES[number];

export const SECURITY_ALERT_TYPE_LABELS: Record<SecurityAlertType, string> = {
  FAILED_LOGIN: 'Repeated Failed Logins',
  LARGE_EXPORT: 'Large Data Export',
  UNUSUAL_ACTIVITY: 'Unusual Activity',
};

export type SecurityAlertSeverity = 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';
export type SecurityAlertStatus = 'NEW' | 'ACKNOWLEDGED';

export interface SecurityAlert {
  id: string;
  createdAt: string;
  type: SecurityAlertType;
  severity: SecurityAlertSeverity;
  title: string;
  message: string;
  userId: string | null;
  username: string | null;
  ipAddress: string | null;
  details: Record<string, any> | null;
  emailSent: boolean;
  smsSent: boolean;
  status: SecurityAlertStatus;
  acknowledgedAt: string | null;
  acknowledgedBy: string | null;
}

export interface SecurityAlertListResponse {
  items: SecurityAlert[];
  total: number;
  page: number;
  limit: number;
  totalPages: number;
  newCount: number;
}
