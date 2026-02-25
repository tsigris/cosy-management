export type Theme = 'light' | 'dark'

export function getTheme(): Theme {
  if (typeof window === 'undefined') return 'light'
  const saved = localStorage.getItem('theme') || localStorage.getItem('cosy_theme')
  return saved === 'dark' ? 'dark' : 'light'
}

export function setTheme(theme: Theme) {
  if (typeof window === 'undefined') return

  const normalized: Theme = theme === 'dark' ? 'dark' : 'light'

  document.documentElement.setAttribute('data-theme', normalized)
  document.documentElement.style.colorScheme = normalized

  localStorage.setItem('theme', normalized)
  localStorage.setItem('cosy_theme', normalized)
}
