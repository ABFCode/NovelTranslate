/**
 * Glossary Service
 *
 * Manages glossary terms, suggestions, and injection into prompts.
 */

import type {
  GlossaryTerm,
  GlossarySuggestion,
  TermType,
  GlossaryGender
} from '../../shared/types'
import {
  createGlossaryTerm,
  getGlossaryTerm,
  listGlossaryTerms,
  searchGlossaryTerms,
  updateGlossaryTerm,
  deleteGlossaryTerm,
  incrementTermUsage,
  findTermBySource,
  createGlossarySuggestion,
  getPendingSuggestions,
  acceptSuggestion,
  rejectSuggestion,
  mergeSuggestion,
  getSuggestion,
  importGlossaryTerms,
  exportGlossaryTerms
} from '../database/repositories/glossary.repository'

/**
 * Glossary Service class for managing terminology
 */
export class GlossaryService {
  // ============================================================================
  // Term CRUD
  // ============================================================================

  /**
   * Create a new glossary term
   */
  createTerm(
    term: Omit<GlossaryTerm, 'id' | 'usageCount' | 'createdAt' | 'updatedAt'>
  ): GlossaryTerm {
    return createGlossaryTerm(term)
  }

  /**
   * Get a term by ID
   */
  getTerm(id: string): GlossaryTerm | null {
    return getGlossaryTerm(id)
  }

  /**
   * List terms for a project (including global terms)
   */
  listTerms(projectId: string | null): GlossaryTerm[] {
    return listGlossaryTerms(projectId)
  }

  /**
   * Search terms
   */
  searchTerms(query: string, projectId?: string, termType?: TermType): GlossaryTerm[] {
    return searchGlossaryTerms(query, projectId, termType)
  }

  /**
   * Update a term
   */
  updateTerm(
    id: string,
    updates: Partial<Omit<GlossaryTerm, 'id' | 'usageCount' | 'createdAt' | 'updatedAt'>>
  ): void {
    updateGlossaryTerm(id, updates)
  }

  /**
   * Delete a term
   */
  deleteTerm(id: string): void {
    deleteGlossaryTerm(id)
  }

  /**
   * Find a term by exact source match
   */
  findBySource(sourceTerm: string, projectId?: string): GlossaryTerm | null {
    return findTermBySource(sourceTerm, projectId)
  }

  // ============================================================================
  // Suggestion Management
  // ============================================================================

  /**
   * Create a suggestion from AI extraction
   */
  createSuggestion(
    suggestion: Omit<GlossarySuggestion, 'id' | 'status' | 'reviewedAt' | 'createdAt'>
  ): GlossarySuggestion {
    return createGlossarySuggestion(suggestion)
  }

  /**
   * Get pending suggestions for review
   */
  getPending(projectId: string): GlossarySuggestion[] {
    return getPendingSuggestions(projectId)
  }

  /**
   * Accept a suggestion (creates a term)
   */
  acceptSuggestion(id: string): GlossaryTerm {
    return acceptSuggestion(id)
  }

  /**
   * Reject a suggestion
   */
  rejectSuggestion(id: string): void {
    rejectSuggestion(id)
  }

  /**
   * Merge a suggestion with an existing term
   */
  mergeSuggestion(id: string, existingTermId: string): void {
    mergeSuggestion(id, existingTermId)
  }

  /**
   * Get a specific suggestion
   */
  getSuggestion(id: string): GlossarySuggestion | null {
    return getSuggestion(id)
  }

  // ============================================================================
  // Prompt Injection
  // ============================================================================

  /**
   * Build glossary section for injection into prompts
   */
  buildGlossaryPromptSection(projectId: string): string {
    const terms = this.listTerms(projectId)

    if (terms.length === 0) {
      return ''
    }

    // Group terms by type for better organization
    const groupedTerms = this.groupTermsByType(terms)

    const sections: string[] = ['## Glossary of Terms', '']
    sections.push('Use the following translations consistently:')
    sections.push('')

    // Add names first (most important for consistency)
    if (groupedTerms.name.length > 0) {
      sections.push('### Character Names')
      for (const term of groupedTerms.name) {
        sections.push(this.formatTermForPrompt(term))
      }
      sections.push('')
    }

    // Add places
    if (groupedTerms.place.length > 0) {
      sections.push('### Places')
      for (const term of groupedTerms.place) {
        sections.push(this.formatTermForPrompt(term))
      }
      sections.push('')
    }

    // Add skills/abilities
    if (groupedTerms.skill.length > 0) {
      sections.push('### Skills/Abilities')
      for (const term of groupedTerms.skill) {
        sections.push(this.formatTermForPrompt(term))
      }
      sections.push('')
    }

    // Add items
    if (groupedTerms.item.length > 0) {
      sections.push('### Items')
      for (const term of groupedTerms.item) {
        sections.push(this.formatTermForPrompt(term))
      }
      sections.push('')
    }

    // Add honorifics
    if (groupedTerms.honorific.length > 0) {
      sections.push('### Honorifics')
      for (const term of groupedTerms.honorific) {
        sections.push(this.formatTermForPrompt(term))
      }
      sections.push('')
    }

    // Add other terms
    if (groupedTerms.other.length > 0) {
      sections.push('### Other Terms')
      for (const term of groupedTerms.other) {
        sections.push(this.formatTermForPrompt(term))
      }
      sections.push('')
    }

    return sections.join('\n')
  }

  /**
   * Inject glossary into a prompt template
   */
  injectGlossaryIntoPrompt(systemPrompt: string, projectId: string): string {
    const glossarySection = this.buildGlossaryPromptSection(projectId)

    if (!glossarySection) {
      return systemPrompt
    }

    // Append glossary to the end of system prompt
    return `${systemPrompt}\n\n${glossarySection}`
  }

  /**
   * Find terms that appear in the given text
   */
  findTermsInText(text: string, projectId: string): GlossaryTerm[] {
    const terms = this.listTerms(projectId)
    const foundTerms: GlossaryTerm[] = []

    for (const term of terms) {
      // Check source term
      if (text.includes(term.sourceTerm)) {
        foundTerms.push(term)
        continue
      }

      // Check aliases
      for (const alias of term.aliases) {
        if (text.includes(alias)) {
          foundTerms.push(term)
          break
        }
      }
    }

    // Track usage
    if (foundTerms.length > 0) {
      incrementTermUsage(foundTerms.map((t) => t.id))
    }

    return foundTerms
  }

  // ============================================================================
  // Import/Export
  // ============================================================================

  /**
   * Import terms from an array
   */
  importTerms(
    terms: Array<Omit<GlossaryTerm, 'id' | 'usageCount' | 'createdAt' | 'updatedAt'>>,
    skipDuplicates = true
  ): { imported: number; skipped: number } {
    return importGlossaryTerms(terms, skipDuplicates)
  }

  /**
   * Export terms for a project
   */
  exportTerms(projectId?: string): GlossaryTerm[] {
    return exportGlossaryTerms(projectId)
  }

  /**
   * Parse CSV data and import terms
   */
  importFromCSV(
    csvData: string,
    projectId: string | null,
    skipDuplicates = true
  ): { imported: number; skipped: number; errors: string[] } {
    const errors: string[] = []
    const terms: Array<Omit<GlossaryTerm, 'id' | 'usageCount' | 'createdAt' | 'updatedAt'>> = []

    const lines = csvData.split('\n')
    const hasHeader = lines[0]?.toLowerCase().includes('source')

    const startLine = hasHeader ? 1 : 0

    for (let i = startLine; i < lines.length; i++) {
      const line = lines[i].trim()
      if (!line) continue

      // Simple CSV parsing (handles quoted fields)
      const fields = this.parseCSVLine(line)

      if (fields.length < 2) {
        errors.push(`Line ${i + 1}: Not enough fields`)
        continue
      }

      const [sourceTerm, targetTerm, termTypeRaw, genderRaw, notes] = fields

      // Validate term type
      const validTypes: TermType[] = ['name', 'place', 'skill', 'item', 'honorific', 'other']
      const termType = validTypes.includes(termTypeRaw as TermType)
        ? (termTypeRaw as TermType)
        : 'other'

      // Validate gender
      const validGenders: GlossaryGender[] = ['male', 'female', 'neutral', 'unknown']
      const gender = validGenders.includes(genderRaw as GlossaryGender)
        ? (genderRaw as GlossaryGender)
        : undefined

      terms.push({
        projectId,
        sourceTerm: sourceTerm.trim(),
        targetTerm: targetTerm.trim(),
        termType,
        gender,
        aliases: [],
        autoGenerated: false,
        confidence: 1.0,
        notes: notes?.trim()
      })
    }

    const result = this.importTerms(terms, skipDuplicates)

    return {
      imported: result.imported,
      skipped: result.skipped,
      errors
    }
  }

  // ============================================================================
  // Private Helpers
  // ============================================================================

  private groupTermsByType(terms: GlossaryTerm[]): Record<TermType, GlossaryTerm[]> {
    const groups: Record<TermType, GlossaryTerm[]> = {
      name: [],
      place: [],
      skill: [],
      item: [],
      honorific: [],
      other: []
    }

    for (const term of terms) {
      groups[term.termType].push(term)
    }

    // Sort each group by usage count (most used first)
    for (const type of Object.keys(groups) as TermType[]) {
      groups[type].sort((a, b) => b.usageCount - a.usageCount)
    }

    return groups
  }

  private formatTermForPrompt(term: GlossaryTerm): string {
    let line = `- "${term.sourceTerm}" → "${term.targetTerm}"`

    // Add gender/pronoun info for names
    if (term.termType === 'name') {
      const genderInfo: string[] = []
      if (term.gender) {
        genderInfo.push(term.gender)
      }
      if (term.pronouns) {
        genderInfo.push(`[${term.pronouns}]`)
      }
      if (genderInfo.length > 0) {
        line += ` (${genderInfo.join(' ')})`
      }
    }

    // Add context note if available
    if (term.context) {
      line += ` — ${term.context}`
    }

    return line
  }

  private parseCSVLine(line: string): string[] {
    const result: string[] = []
    let current = ''
    let inQuotes = false

    for (let i = 0; i < line.length; i++) {
      const char = line[i]
      const nextChar = line[i + 1]

      if (char === '"') {
        if (inQuotes && nextChar === '"') {
          // Escaped quote
          current += '"'
          i++
        } else {
          // Toggle quote mode
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
}

// Singleton instance
export const glossaryService = new GlossaryService()
