/**
 * GarmentOS design-system tokens.
 *
 * Components should consume these semantic names instead of inventing local
 * spacing, radius, typography or status values. The CSS variables with the
 * same names are the runtime source of truth for the white product UI.
 */
export const designTokens = {
  color: {
    background: 'var(--bg-primary)',
    surface: 'var(--bg-secondary)',
    surfaceMuted: 'var(--bg-tertiary)',
    surfaceHover: 'var(--bg-hover)',
    border: 'var(--border)',
    borderStrong: 'var(--border-light)',
    text: 'var(--text-primary)',
    textSecondary: 'var(--text-secondary)',
    textMuted: 'var(--text-muted)',
    accent: 'var(--accent)',
    accentHover: 'var(--accent-hover)',
    accentSoft: 'var(--accent-dim)',
  },
  space: {
    xs: 'var(--space-xs)',
    sm: 'var(--space-sm)',
    md: 'var(--space-md)',
    lg: 'var(--space-lg)',
    xl: 'var(--space-xl)',
  },
  radius: {
    sm: 'var(--radius-sm)',
    md: 'var(--radius-md)',
    lg: 'var(--radius-lg)',
  },
  control: {
    heightSm: 'var(--control-height-sm)',
    heightMd: 'var(--control-height-md)',
  },
} as const;

export type DesignTokens = typeof designTokens;
