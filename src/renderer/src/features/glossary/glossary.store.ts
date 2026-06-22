import { create } from 'zustand'
import type { GlossarySuggestion, GlossaryTerm, TermType } from '../../../../shared/types'

interface GlossaryState {
  // Data
  terms: GlossaryTerm[]
  suggestions: GlossarySuggestion[]
  selectedProjectId: string | null

  // Filters
  searchQuery: string
  filterType: TermType | 'all'
  showGlobalOnly: boolean

  // Loading states
  isLoading: boolean
  isSaving: boolean

  // Selected term for editing
  selectedTerm: GlossaryTerm | null

  // Actions
  fetchTerms: (projectId?: string) => Promise<void>
  fetchSuggestions: (projectId: string) => Promise<void>
  clearSuggestions: () => void
  setSelectedProjectId: (projectId: string | null) => void
  setSearchQuery: (query: string) => void
  setFilterType: (type: TermType | 'all') => void
  setShowGlobalOnly: (show: boolean) => void
  selectTerm: (term: GlossaryTerm | null) => void

  // CRUD actions
  createTerm: (
    term: Omit<GlossaryTerm, 'id' | 'usageCount' | 'createdAt' | 'updatedAt'>
  ) => Promise<GlossaryTerm>
  updateTerm: (
    id: string,
    updates: Partial<Omit<GlossaryTerm, 'id' | 'usageCount' | 'createdAt' | 'updatedAt'>>
  ) => Promise<void>
  deleteTerm: (id: string) => Promise<void>

  // Suggestion actions
  acceptSuggestion: (id: string) => Promise<GlossaryTerm>
  rejectSuggestion: (id: string) => Promise<void>
  mergeSuggestion: (id: string, existingTermId: string) => Promise<void>

  // Import/Export
  importCSV: (
    csvData: string,
    projectId: string | null
  ) => Promise<{ imported: number; skipped: number; errors: string[] }>
  exportCSV: (projectId?: string) => Promise<string>

  // Filtered terms getter
  getFilteredTerms: () => GlossaryTerm[]
}

export const useGlossaryStore = create<GlossaryState>((set, get) => ({
  terms: [],
  suggestions: [],
  selectedProjectId: null,
  searchQuery: '',
  filterType: 'all',
  showGlobalOnly: false,
  isLoading: false,
  isSaving: false,
  selectedTerm: null,

  fetchTerms: async (projectId) => {
    set({ isLoading: true, selectedProjectId: projectId || null })
    try {
      const terms = await window.api.glossary.list(projectId || null)
      set({ terms, isLoading: false })
    } catch (error) {
      console.error('Failed to fetch glossary terms:', error)
      set({ isLoading: false })
    }
  },

  fetchSuggestions: async (projectId) => {
    try {
      const suggestions = await window.api.glossary.getPendingSuggestions(projectId)
      set({ suggestions })
    } catch (error) {
      console.error('Failed to fetch suggestions:', error)
    }
  },
  clearSuggestions: () => set({ suggestions: [] }),
  setSelectedProjectId: (projectId) => set({ selectedProjectId: projectId }),

  setSearchQuery: (query) => set({ searchQuery: query }),
  setFilterType: (type) => set({ filterType: type }),
  setShowGlobalOnly: (show) => set({ showGlobalOnly: show }),
  selectTerm: (term) => set({ selectedTerm: term }),

  createTerm: async (term) => {
    set({ isSaving: true })
    try {
      const newTerm = await window.api.glossary.create(term)
      const { terms } = get()
      set({ terms: [newTerm, ...terms], isSaving: false })
      return newTerm
    } catch (error) {
      set({ isSaving: false })
      throw error
    }
  },

  updateTerm: async (id, updates) => {
    set({ isSaving: true })
    try {
      await window.api.glossary.update(id, updates)
      const { selectedProjectId } = get()
      // Refresh terms
      const refreshedTerms = await window.api.glossary.list(selectedProjectId)
      set({ terms: refreshedTerms, isSaving: false, selectedTerm: null })
    } catch (error) {
      set({ isSaving: false })
      throw error
    }
  },

  deleteTerm: async (id) => {
    try {
      await window.api.glossary.delete(id)
      const { terms } = get()
      set({ terms: terms.filter((t) => t.id !== id), selectedTerm: null })
    } catch (error) {
      console.error('Failed to delete term:', error)
      throw error
    }
  },

  acceptSuggestion: async (id) => {
    try {
      const term = await window.api.glossary.acceptSuggestion(id)
      const { terms, suggestions } = get()
      set({
        terms: [term, ...terms],
        suggestions: suggestions.filter((s) => s.id !== id),
      })
      return term
    } catch (error) {
      console.error('Failed to accept suggestion:', error)
      throw error
    }
  },

  rejectSuggestion: async (id) => {
    try {
      await window.api.glossary.rejectSuggestion(id)
      const { suggestions } = get()
      set({ suggestions: suggestions.filter((s) => s.id !== id) })
    } catch (error) {
      console.error('Failed to reject suggestion:', error)
      throw error
    }
  },

  mergeSuggestion: async (id, existingTermId) => {
    try {
      await window.api.glossary.mergeSuggestion(id, existingTermId)
      const { suggestions, selectedProjectId } = get()
      // Refresh terms to get updated aliases
      const refreshedTerms = await window.api.glossary.list(selectedProjectId)
      set({
        terms: refreshedTerms,
        suggestions: suggestions.filter((s) => s.id !== id),
      })
    } catch (error) {
      console.error('Failed to merge suggestion:', error)
      throw error
    }
  },

  importCSV: async (csvData, projectId) => {
    set({ isSaving: true })
    try {
      const result = await window.api.glossary.importCSV(csvData, projectId, true)
      // Refresh terms
      const terms = await window.api.glossary.list(projectId)
      set({ terms, isSaving: false })
      return result
    } catch (error) {
      set({ isSaving: false })
      throw error
    }
  },

  exportCSV: async (projectId) => {
    const terms = await window.api.glossary.export(projectId)

    // Convert to CSV
    const headers = ['Source Term', 'Target Term', 'Type', 'Gender', 'Notes']
    const rows = terms.map((t) => [
      escapeCSV(t.sourceTerm),
      escapeCSV(t.targetTerm),
      t.termType,
      t.gender || '',
      escapeCSV(t.notes || ''),
    ])

    return [headers.join(','), ...rows.map((r) => r.join(','))].join('\n')
  },

  getFilteredTerms: () => {
    const { terms, searchQuery, filterType, showGlobalOnly } = get()

    return terms.filter((term) => {
      // Filter by global only
      if (showGlobalOnly && term.projectId !== null) {
        return false
      }

      // Filter by type
      if (filterType !== 'all' && term.termType !== filterType) {
        return false
      }

      // Filter by search query
      if (searchQuery) {
        const query = searchQuery.toLowerCase()
        return (
          term.sourceTerm.toLowerCase().includes(query) ||
          term.targetTerm.toLowerCase().includes(query) ||
          term.aliases.some((a) => a.toLowerCase().includes(query))
        )
      }

      return true
    })
  },
}))

function escapeCSV(value: string): string {
  if (value.includes(',') || value.includes('"') || value.includes('\n')) {
    return `"${value.replace(/"/g, '""')}"`
  }
  return value
}
