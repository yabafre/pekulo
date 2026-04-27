"use client"

import { createContext, useContext, useEffect, useState, useCallback } from "react"

type Theme = "light" | "dark" | "system"
type ResolvedTheme = "light" | "dark"

interface ThemeContextValue {
  theme: ResolvedTheme
  setTheme: (theme: Theme) => void
}

const ThemeContext = createContext<ThemeContextValue | undefined>(undefined)

function getSystemTheme(): ResolvedTheme {
  if (typeof window === "undefined") return "light"
  return window.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light"
}

function getStoredTheme(): Theme {
  if (typeof window === "undefined") return "system"
  return (localStorage.getItem("theme") as Theme) || "system"
}

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  const [storedTheme, setStoredTheme] = useState<Theme>(getStoredTheme)
  const [resolvedTheme, setResolvedTheme] = useState<ResolvedTheme>(() => {
    const initial = getStoredTheme()
    return initial === "system" ? getSystemTheme() : initial
  })

  const setTheme = useCallback((newTheme: Theme) => {
    setStoredTheme(newTheme)
    localStorage.setItem("theme", newTheme)
  }, [])

  useEffect(() => {
    const resolved = storedTheme === "system" ? getSystemTheme() : storedTheme
    setResolvedTheme(resolved)
    document.documentElement.classList.toggle("dark", resolved === "dark")
  }, [storedTheme])

  useEffect(() => {
    const mq = window.matchMedia("(prefers-color-scheme: dark)")
    const handler = () => {
      if (storedTheme === "system") {
        const resolved = getSystemTheme()
        setResolvedTheme(resolved)
        document.documentElement.classList.toggle("dark", resolved === "dark")
      }
    }
    mq.addEventListener("change", handler)
    return () => mq.removeEventListener("change", handler)
  }, [storedTheme])

  return (
    <ThemeContext.Provider value={{ theme: resolvedTheme, setTheme }}>
      {children}
    </ThemeContext.Provider>
  )
}

export function useTheme() {
  const context = useContext(ThemeContext)
  if (context === undefined) {
    throw new Error("useTheme must be used within a ThemeProvider")
  }
  return context
}
