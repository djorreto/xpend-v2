'use client'

import { createContext, useContext, useState, useEffect, ReactNode } from 'react'

type AppVersion = 'functional' | 'mockup'

interface VersionContextType {
  version: AppVersion
  setVersion: (version: AppVersion) => void
  isFunctional: boolean
  isMockup: boolean
}

const VersionContext = createContext<VersionContextType | undefined>(undefined)

interface VersionProviderProps {
  children: ReactNode
}

export function VersionProvider({ children }: VersionProviderProps) {
  const [version, setVersion] = useState<AppVersion>('functional')

  // Load version from localStorage on mount
  useEffect(() => {
    const savedVersion = localStorage.getItem('spendora-version') as AppVersion
    if (savedVersion && (savedVersion === 'functional' || savedVersion === 'mockup')) {
      setVersion(savedVersion)
    }
  }, [])

  // Save version to localStorage when it changes
  useEffect(() => {
    localStorage.setItem('spendora-version', version)
  }, [version])

  const value: VersionContextType = {
    version,
    setVersion,
    isFunctional: version === 'functional',
    isMockup: version === 'mockup'
  }

  return (
    <VersionContext.Provider value={value}>
      {children}
    </VersionContext.Provider>
  )
}

export function useVersion() {
  const context = useContext(VersionContext)
  if (context === undefined) {
    throw new Error('useVersion must be used within a VersionProvider')
  }
  return context
}

