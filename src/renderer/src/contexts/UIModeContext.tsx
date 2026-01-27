import React, { createContext, useContext, useEffect, useState, useCallback } from 'react'
import type { UIMode } from '../../../shared/types'

// Features that support mode switching
export type Feature = 'configs' | 'testing' | 'glossary' | 'settings' | 'project'

interface UIModeContextValue {
  /** Global UI mode */
  globalMode: UIMode
  /** Set the global UI mode */
  setGlobalMode: (mode: UIMode) => void
  /** Per-feature mode overrides */
  featureModes: Record<Feature, UIMode | null>
  /** Set mode for a specific feature (null to use global) */
  setFeatureMode: (feature: Feature, mode: UIMode | null) => void
  /** Get the effective mode for a feature (feature override or global) */
  getEffectiveMode: (feature: Feature) => UIMode
  /** Check if a feature is in advanced mode */
  isAdvanced: (feature?: Feature) => boolean
}

const UIModeContext = createContext<UIModeContextValue | null>(null)

const STORAGE_KEY = 'noveltranslate:ui-mode'
const FEATURE_MODES_KEY = 'noveltranslate:feature-modes'

interface UIModeProviderProps {
  children: React.ReactNode
}

export function UIModeProvider({ children }: UIModeProviderProps): JSX.Element {
  const [globalMode, setGlobalModeState] = useState<UIMode>(() => {
    try {
      const stored = localStorage.getItem(STORAGE_KEY)
      return (stored as UIMode) || 'simple'
    } catch {
      return 'simple'
    }
  })

  const [featureModes, setFeatureModes] = useState<Record<Feature, UIMode | null>>(() => {
    try {
      const stored = localStorage.getItem(FEATURE_MODES_KEY)
      if (stored) {
        return JSON.parse(stored)
      }
    } catch {
      // Ignore
    }
    return {
      configs: null,
      testing: null,
      glossary: null,
      settings: null,
      project: null
    }
  })

  // Persist global mode to localStorage
  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEY, globalMode)
    } catch {
      // Ignore storage errors
    }
  }, [globalMode])

  // Persist feature modes to localStorage
  useEffect(() => {
    try {
      localStorage.setItem(FEATURE_MODES_KEY, JSON.stringify(featureModes))
    } catch {
      // Ignore storage errors
    }
  }, [featureModes])

  const setGlobalMode = useCallback((mode: UIMode) => {
    setGlobalModeState(mode)
    // Also update settings in the backend
    window.api?.settings?.save?.({ uiMode: mode })?.catch(console.error)
  }, [])

  const setFeatureMode = useCallback((feature: Feature, mode: UIMode | null) => {
    setFeatureModes((prev) => ({
      ...prev,
      [feature]: mode
    }))
  }, [])

  const getEffectiveMode = useCallback(
    (feature: Feature): UIMode => {
      return featureModes[feature] ?? globalMode
    },
    [featureModes, globalMode]
  )

  const isAdvanced = useCallback(
    (feature?: Feature): boolean => {
      if (feature) {
        return getEffectiveMode(feature) === 'advanced'
      }
      return globalMode === 'advanced'
    },
    [globalMode, getEffectiveMode]
  )

  const value: UIModeContextValue = {
    globalMode,
    setGlobalMode,
    featureModes,
    setFeatureMode,
    getEffectiveMode,
    isAdvanced
  }

  return <UIModeContext.Provider value={value}>{children}</UIModeContext.Provider>
}

export function useUIMode(): UIModeContextValue {
  const context = useContext(UIModeContext)
  if (!context) {
    throw new Error('useUIMode must be used within a UIModeProvider')
  }
  return context
}

/**
 * Hook to get mode for a specific feature
 */
export function useFeatureMode(feature: Feature): {
  mode: UIMode
  isAdvanced: boolean
  setMode: (mode: UIMode | null) => void
  toggleMode: () => void
} {
  const { getEffectiveMode, setFeatureMode } = useUIMode()

  const mode = getEffectiveMode(feature)
  const isAdvanced = mode === 'advanced'

  const setMode = useCallback(
    (newMode: UIMode | null) => {
      setFeatureMode(feature, newMode)
    },
    [feature, setFeatureMode]
  )

  const toggleMode = useCallback(() => {
    setFeatureMode(feature, isAdvanced ? 'simple' : 'advanced')
  }, [feature, isAdvanced, setFeatureMode])

  return { mode, isAdvanced, setMode, toggleMode }
}
