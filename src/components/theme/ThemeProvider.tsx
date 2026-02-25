'use client'

import React, { createContext, useContext, useEffect, useMemo, useState } from 'react'

export type ThemeMode = 'light' | 'dark'

type ThemeContextValue = {
  theme: ThemeMode
  setTheme: (next: ThemeMode) => void
  toggleTheme: () => void
}

const ThemeContext = createContext<ThemeContextValue | null>(null)

const STORAGE_KEY = 'cosy_theme'

function applyThemeToDom(theme: ThemeMode) {
  // Στο html για global styling (CSS variables)
  document.documentElement.setAttribute('data-theme', theme)

  // Hint για browsers (scrollbars/forms) - δεν πειράζει layout
  document.documentElement.style.colorScheme = theme
}

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  const [theme, setThemeState] = useState<ThemeMode>('light')

  // 1) Διαβάζουμε localStorage ΜΟΝΟ στο client
  useEffect(() => {
    try {
      const saved = window.localStorage.getItem(STORAGE_KEY)
      const next: ThemeMode = saved === 'dark' ? 'dark' : 'light'
      setThemeState(next)
      applyThemeToDom(next)
    } catch {
      // αν κάτι πάει στραβά, μένουμε light
      applyThemeToDom('light')
    }
  }, [])

  const setTheme = (next: ThemeMode) => {
    setThemeState(next)
    try {
      window.localStorage.setItem(STORAGE_KEY, next)
    } catch {}
    applyThemeToDom(next)
  }

  const toggleTheme = () => setTheme(theme === 'dark' ? 'light' : 'dark')

  const value = useMemo(() => ({ theme, setTheme, toggleTheme }), [theme])

  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>
}

export function useTheme() {
  const ctx = useContext(ThemeContext)
  if (!ctx) throw new Error('useTheme must be used inside <ThemeProvider />')
  return ctx
}