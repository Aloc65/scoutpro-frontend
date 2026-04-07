export const Colors = {
  background: '#0D0D12',
  card: '#14141B',
  elevated: '#1C1C26',
  primary: '#4F46E5',
  accent: '#06B6D4',
  text: '#E8E8ED',
  textSecondary: '#9494A3',
  textMuted: '#5C5C6E',
  border: 'rgba(255,255,255,0.06)',
  error: '#EF4444',
  amber: '#F59E0B',
  green: '#10B981',
  orange: '#F97316',
  gradientStart: '#4F46E5',
  gradientEnd: '#06B6D4',
};

export const ProjectionColors: Record<string, string> = {
  'Strong Prospect': Colors.green,
  'Watch Player': Colors.amber,
  'Not Recommended': Colors.error,
};

export const ratingColor = (v: number) =>
  v <= 2 ? Colors.error : v <= 3.5 ? Colors.amber : Colors.green;
