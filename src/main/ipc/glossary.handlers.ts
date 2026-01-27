import { ipcMain } from 'electron'
import {
  createGlossaryTerm,
  getGlossaryTerm,
  listGlossaryTerms,
  searchGlossaryTerms,
  updateGlossaryTerm,
  deleteGlossaryTerm,
  findTermBySource,
  getPendingSuggestions,
  acceptSuggestion,
  rejectSuggestion,
  mergeSuggestion,
  getSuggestion,
  importGlossaryTerms,
  exportGlossaryTerms
} from '../database/repositories/glossary.repository'
import type { GlossaryTerm, GlossarySuggestion, TermType } from '../../shared/types'

/**
 * Register glossary-related IPC handlers
 */
export function registerGlossaryHandlers(): void {
  // ============================================================================
  // Glossary Term CRUD
  // ============================================================================

  // List glossary terms for a project
  ipcMain.handle(
    'glossary:list',
    async (_event, projectId: string | null): Promise<GlossaryTerm[]> => {
      return listGlossaryTerms(projectId)
    }
  )

  // Get a specific term
  ipcMain.handle('glossary:get', async (_event, id: string): Promise<GlossaryTerm | null> => {
    return getGlossaryTerm(id)
  })

  // Search terms
  ipcMain.handle(
    'glossary:search',
    async (
      _event,
      query: string,
      projectId?: string,
      termType?: TermType
    ): Promise<GlossaryTerm[]> => {
      return searchGlossaryTerms(query, projectId, termType)
    }
  )

  // Find term by source text
  ipcMain.handle(
    'glossary:findBySource',
    async (_event, sourceTerm: string, projectId?: string): Promise<GlossaryTerm | null> => {
      return findTermBySource(sourceTerm, projectId)
    }
  )

  // Create a term
  ipcMain.handle(
    'glossary:create',
    async (
      _event,
      term: Omit<GlossaryTerm, 'id' | 'usageCount' | 'createdAt' | 'updatedAt'>
    ): Promise<GlossaryTerm> => {
      return createGlossaryTerm(term)
    }
  )

  // Update a term
  ipcMain.handle(
    'glossary:update',
    async (
      _event,
      id: string,
      updates: Partial<Omit<GlossaryTerm, 'id' | 'usageCount' | 'createdAt' | 'updatedAt'>>
    ): Promise<void> => {
      updateGlossaryTerm(id, updates)
    }
  )

  // Delete a term
  ipcMain.handle('glossary:delete', async (_event, id: string): Promise<void> => {
    deleteGlossaryTerm(id)
  })

  // ============================================================================
  // Suggestions
  // ============================================================================

  // Get pending suggestions for a project
  ipcMain.handle(
    'glossary:getPendingSuggestions',
    async (_event, projectId: string): Promise<GlossarySuggestion[]> => {
      return getPendingSuggestions(projectId)
    }
  )

  // Get a specific suggestion
  ipcMain.handle(
    'glossary:getSuggestion',
    async (_event, id: string): Promise<GlossarySuggestion | null> => {
      return getSuggestion(id)
    }
  )

  // Accept a suggestion
  ipcMain.handle(
    'glossary:acceptSuggestion',
    async (_event, id: string): Promise<GlossaryTerm> => {
      return acceptSuggestion(id)
    }
  )

  // Reject a suggestion
  ipcMain.handle('glossary:rejectSuggestion', async (_event, id: string): Promise<void> => {
    rejectSuggestion(id)
  })

  // Merge a suggestion with an existing term
  ipcMain.handle(
    'glossary:mergeSuggestion',
    async (_event, suggestionId: string, existingTermId: string): Promise<void> => {
      mergeSuggestion(suggestionId, existingTermId)
    }
  )

  // ============================================================================
  // Import/Export
  // ============================================================================

  // Import terms from array
  ipcMain.handle(
    'glossary:import',
    async (
      _event,
      terms: Array<Omit<GlossaryTerm, 'id' | 'usageCount' | 'createdAt' | 'updatedAt'>>,
      skipDuplicates?: boolean
    ): Promise<{ imported: number; skipped: number }> => {
      return importGlossaryTerms(terms, skipDuplicates ?? true)
    }
  )

  // Export terms for a project
  ipcMain.handle(
    'glossary:export',
    async (_event, projectId?: string): Promise<GlossaryTerm[]> => {
      return exportGlossaryTerms(projectId)
    }
  )

  // Parse CSV and import
  ipcMain.handle(
    'glossary:importCSV',
    async (
      _event,
      csvData: string,
      projectId: string | null,
      skipDuplicates?: boolean
    ): Promise<{ imported: number; skipped: number; errors: string[] }> => {
      const errors: string[] = []
      const terms: Array<Omit<GlossaryTerm, 'id' | 'usageCount' | 'createdAt' | 'updatedAt'>> = []

      // Simple CSV parsing (header row expected)
      const lines = csvData.split('\n').filter((line) => line.trim())
      if (lines.length === 0) {
        return { imported: 0, skipped: 0, errors: ['Empty CSV file'] }
      }

      // Parse header
      const header = lines[0].split(',').map((h) => h.trim().toLowerCase())
      const sourceIndex = header.findIndex((h) => h === 'source' || h === 'source_term')
      const targetIndex = header.findIndex((h) => h === 'target' || h === 'target_term')
      const typeIndex = header.findIndex((h) => h === 'type' || h === 'term_type')
      const contextIndex = header.findIndex((h) => h === 'context')
      const notesIndex = header.findIndex((h) => h === 'notes')
      const genderIndex = header.findIndex((h) => h === 'gender')

      if (sourceIndex === -1 || targetIndex === -1) {
        return {
          imported: 0,
          skipped: 0,
          errors: ['CSV must have "source" and "target" columns']
        }
      }

      // Parse data rows
      for (let i = 1; i < lines.length; i++) {
        const values = parseCSVLine(lines[i])
        if (values.length <= Math.max(sourceIndex, targetIndex)) {
          errors.push(`Line ${i + 1}: Not enough columns`)
          continue
        }

        const sourceTerm = values[sourceIndex]?.trim()
        const targetTerm = values[targetIndex]?.trim()

        if (!sourceTerm || !targetTerm) {
          errors.push(`Line ${i + 1}: Missing source or target term`)
          continue
        }

        const term: Omit<GlossaryTerm, 'id' | 'usageCount' | 'createdAt' | 'updatedAt'> = {
          projectId,
          sourceTerm,
          targetTerm,
          termType: (typeIndex >= 0 ? validateTermType(values[typeIndex]) : 'other') as TermType,
          context: contextIndex >= 0 ? values[contextIndex]?.trim() : undefined,
          notes: notesIndex >= 0 ? values[notesIndex]?.trim() : undefined,
          gender: genderIndex >= 0 ? validateGender(values[genderIndex]) : undefined,
          aliases: [],
          autoGenerated: false,
          confidence: 1.0
        }

        terms.push(term)
      }

      if (terms.length === 0) {
        return { imported: 0, skipped: 0, errors: ['No valid terms found in CSV'] }
      }

      const result = importGlossaryTerms(terms, skipDuplicates ?? true)
      return { ...result, errors }
    }
  )

  console.log('[IPC] Glossary handlers registered')
}

// ============================================================================
// Helper Functions
// ============================================================================

function parseCSVLine(line: string): string[] {
  const result: string[] = []
  let current = ''
  let inQuotes = false

  for (let i = 0; i < line.length; i++) {
    const char = line[i]

    if (char === '"') {
      if (inQuotes && line[i + 1] === '"') {
        current += '"'
        i++
      } else {
        inQuotes = !inQuotes
      }
    } else if (char === ',' && !inQuotes) {
      result.push(current)
      current = ''
    } else {
      current += char
    }
  }

  result.push(current)
  return result
}

function validateTermType(value?: string): string {
  const valid = ['name', 'place', 'skill', 'item', 'honorific', 'other']
  const lower = value?.toLowerCase().trim()
  return valid.includes(lower || '') ? lower! : 'other'
}

function validateGender(value?: string): 'male' | 'female' | 'neutral' | 'unknown' | undefined {
  const lower = value?.toLowerCase().trim()
  if (lower === 'male' || lower === 'm') return 'male'
  if (lower === 'female' || lower === 'f') return 'female'
  if (lower === 'neutral' || lower === 'n') return 'neutral'
  if (lower === 'unknown' || lower === 'u') return 'unknown'
  return undefined
}
