import type { ThemeMode } from './ThemeProvider'

export function getThemeTokens(theme: ThemeMode) {
  const isDark = theme === 'dark'

  return {
    isDark,

    // backgrounds
    bg: isDark ? '#0b1220' : '#f8fafc',
    surface: isDark ? 'rgba(15,23,42,0.72)' : 'rgba(255,255,255,0.92)',
    surfaceSolid: isDark ? '#0f172a' : '#ffffff',

    // borders/text
    border: isDark ? 'rgba(148,163,184,0.22)' : '#e2e8f0',
    text: isDark ? '#e5e7eb' : '#0f172a',
    muted: isDark ? '#94a3b8' : '#64748b',

    // shadows (κρατάμε ίδια φιλοσοφία)
    shadow: isDark ? '0 10px 22px rgba(0,0,0,0.35)' : '0 10px 22px rgba(15, 23, 42, 0.05)',
  }
}