'use client'

import { createContext, useContext, useState, useEffect, ReactNode } from 'react'

interface AuthContextType {
  isAuthenticated: boolean
  username: string | null
  login: (username: string, password: string) => void
  logout: () => void
}

const AuthContext = createContext<AuthContextType | undefined>(undefined)

export function AuthProvider({ children }: { children: ReactNode }) {
  const [isAuthenticated, setIsAuthenticated] = useState(false)
  const [username, setUsername] = useState<string | null>(null)

  const login = (username: string, password: string) => {
    if (typeof window !== 'undefined') {
      if (username === 'admin' && password === 'admin123') {
        setIsAuthenticated(true)
        setUsername(username)
        localStorage.setItem('isAuthenticated', 'true')
        localStorage.setItem('username', username)
      }
    }
  }

  const logout = () => {
    if (typeof window !== 'undefined') {
      setIsAuthenticated(false)
      setUsername(null)
      localStorage.removeItem('isAuthenticated')
      localStorage.removeItem('username')
    }
  }

  useEffect(() => {
    if (typeof window !== 'undefined') {
      const storedAuth = localStorage.getItem('isAuthenticated')
      const storedUsername = localStorage.getItem('username')
      if (storedAuth === 'true' && storedUsername) {
        setIsAuthenticated(true)
        setUsername(storedUsername)
      }
    }
  }, [])

  return (
    <AuthContext.Provider value={{ isAuthenticated, username, login, logout }}>
      {children}
    </AuthContext.Provider>
  )
}

export function useAuth() {
  const context = useContext(AuthContext)
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider')
  }
  return context
} 