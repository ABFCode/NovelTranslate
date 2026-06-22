import { create } from 'zustand'
import type { TranslationMemoryEntry, TranslationOverride } from '../../../../shared/types'

interface MemoryStats {
  totalEntries: number
  verifiedEntries: number
  totalUsageCount: number
}

interface MemoryState {
  entries: TranslationMemoryEntry[]
  overrides: TranslationOverride[]
  stats: MemoryStats | null
  isLoading: boolean
  isUpdating: boolean
  selectedProjectId: string | null

  loadEntries: (projectId?: string) => Promise<void>
  loadStats: (projectId?: string) => Promise<void>
  loadOverrides: (projectId?: string) => Promise<void>

  verifyEntry: (id: string) => Promise<void>
  updateConfidence: (id: string, confidence: number) => Promise<void>
  deleteEntry: (id: string) => Promise<void>
  deleteOverride: (id: string) => Promise<void>

  setSelectedProjectId: (projectId: string | null) => void
}

export const useMemoryStore = create<MemoryState>((set, get) => ({
  entries: [],
  overrides: [],
  stats: null,
  isLoading: false,
  isUpdating: false,
  selectedProjectId: null,

  loadEntries: async (projectId) => {
    set({ isLoading: true, selectedProjectId: projectId || null })
    try {
      const entries = await window.api.memory.list(projectId)
      set({ entries, isLoading: false })
    } catch (error) {
      console.error('Failed to load memory entries:', error)
      set({ isLoading: false })
    }
  },

  loadStats: async (projectId) => {
    try {
      const stats = await window.api.memory.stats(projectId)
      set({ stats })
    } catch (error) {
      console.error('Failed to load memory stats:', error)
      set({ stats: null })
    }
  },

  loadOverrides: async (projectId) => {
    if (!projectId) {
      set({ overrides: [] })
      return
    }

    try {
      const overrides = await window.api.override.list(projectId)
      set({ overrides })
    } catch (error) {
      console.error('Failed to load overrides:', error)
      set({ overrides: [] })
    }
  },

  verifyEntry: async (id) => {
    set({ isUpdating: true })
    try {
      await window.api.memory.verify(id)
      const { entries } = get()
      set({
        entries: entries.map((entry) =>
          entry.id === id ? { ...entry, manuallyVerified: true } : entry
        ),
        isUpdating: false,
      })
    } catch (error) {
      console.error('Failed to verify entry:', error)
      set({ isUpdating: false })
      throw error
    }
  },

  updateConfidence: async (id, confidence) => {
    set({ isUpdating: true })
    try {
      await window.api.memory.updateConfidence(id, confidence)
      const { entries } = get()
      set({
        entries: entries.map((entry) => (entry.id === id ? { ...entry, confidence } : entry)),
        isUpdating: false,
      })
    } catch (error) {
      console.error('Failed to update confidence:', error)
      set({ isUpdating: false })
      throw error
    }
  },

  deleteEntry: async (id) => {
    set({ isUpdating: true })
    try {
      await window.api.memory.delete(id)
      const { entries } = get()
      set({ entries: entries.filter((entry) => entry.id !== id), isUpdating: false })
    } catch (error) {
      console.error('Failed to delete entry:', error)
      set({ isUpdating: false })
      throw error
    }
  },

  deleteOverride: async (id) => {
    set({ isUpdating: true })
    try {
      await window.api.override.delete(id)
      const { overrides } = get()
      set({ overrides: overrides.filter((override) => override.id !== id), isUpdating: false })
    } catch (error) {
      console.error('Failed to delete override:', error)
      set({ isUpdating: false })
      throw error
    }
  },

  setSelectedProjectId: (projectId) => set({ selectedProjectId: projectId }),
}))
