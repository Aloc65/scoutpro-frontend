export const Colors = {
  // ── Surfaces (slate, not pure black) ──────────────────────────────
  // Three visibly-distinct layers give the dark theme depth:
  //   background (app canvas) < card (raised) < elevated (nested/inset).
  background: '#161A22',   // app canvas
  card: '#232833',         // raised surface: game cards, follow-up rows, report rows
  elevated: '#1C212B',     // nested / inset row: "N more" footer, inset strips
  surfaceHigh: '#2B313D',  // highest surface (menus, active chips) — above card

  // ── Brand / interactive ───────────────────────────────────────────
  primary: '#3B82F6',      // single accent for interactive things (links, +Session, watched counts, primary button) — muted blue on slate
  accent: '#3B82F6',       // alias: keep one accent across the app
  accentCyan: '#06B6D4',   // legacy cyan, retained for a few non-interactive accents

  // ── Text ──────────────────────────────────────────────────────────
  text: '#EEF1F6',         // primary text — warm white (names, headings)
  textSecondary: '#8B93A7',// muted / label text
  textMuted: '#6B7386',    // lowest-emphasis metadata

  // ── Borders ────────────────────────────────────────────────────────
  border: '#38414F',       // hairline separating card from page (~0.5px visual)
  borderSubtle: 'rgba(255,255,255,0.06)', // very faint internal dividers

  // ── Status (semantic only — never decorative) ──────────────────────
  error: '#EF4444',        // red  = AFL interest / urgent
  amber: '#F59E0B',        // amber = stale contact
  green: '#10B981',        // green = signed / strong prospect
  orange: '#F97316',

  // ── Gradients ───────────────────────────────────────────────────────
  gradientStart: '#3B82F6',
  gradientEnd: '#06B6D4',
};

export const ProjectionColors: Record<string, string> = {
  'Strong Prospect': Colors.green,
  'Watch Player': Colors.amber,
  'Not Recommended': Colors.error,
};

export const ratingColor = (v: number) =>
  v <= 2 ? Colors.error : v <= 3.5 ? Colors.amber : Colors.green;
