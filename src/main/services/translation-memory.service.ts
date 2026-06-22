/**
 * Translation Memory Service
 *
 * Manages cached translations and manual overrides for efficiency.
 */

import { createHash } from 'crypto'
import type { TranslationMemoryEntry, TranslationOverride } from '../../shared/types'
import {
  cacheTranslation,
  createOverride,
  deleteMemoryEntry,
  deleteOverride,
  getMemoryEntry,
  getMemoryStats,
  getOverride,
  getOverrideById,
  incrementMemoryUsage,
  listMemoryEntries,
  listOverrides,
  searchMemory,
  updateMemoryConfidence,
  verifyMemoryEntry,
} from '../database/repositories/memory.repository'

/**
 * Translation Memory Service
 */
export class TranslationMemoryService {
  // ============================================================================
  // Memory Operations
  // ============================================================================

  /**
   * Check if we have a cached translation for the given text
   */
  checkCache(
    sourceText: string,
    configId?: string,
    projectId?: string
  ): TranslationMemoryEntry | null {
    const hash = this.hashText(sourceText)
    return getMemoryEntry(hash, configId, projectId)
  }

  /**
   * Cache a translation result
   */
  cache(
    sourceText: string,
    targetText: string,
    providerConfigId: string,
    modelId: string,
    configId?: string,
    projectId?: string
  ): TranslationMemoryEntry {
    return cacheTranslation(sourceText, targetText, providerConfigId, modelId, configId, projectId)
  }

  /**
   * Get translation with memory and override support
   */
  getTranslation(
    sourceText: string,
    projectId: string,
    chapterId?: string,
    configId?: string
  ): { text: string; source: 'override' | 'memory' | 'none' } | null {
    // 1. Check overrides first (highest priority)
    const override = getOverride(sourceText, projectId, chapterId)
    if (override) {
      return { text: override.overrideTranslation, source: 'override' }
    }

    // 2. Check translation memory
    const cached = this.checkCache(sourceText, configId, projectId)
    if (cached && cached.confidence >= 0.8) {
      incrementMemoryUsage(cached.id)
      return { text: cached.targetText, source: 'memory' }
    }

    return null
  }

  /**
   * Mark a memory entry as verified
   */
  verifyEntry(id: string): void {
    verifyMemoryEntry(id)
  }

  /**
   * Downgrade confidence of a memory entry
   */
  downgradeEntry(id: string, newConfidence: number): void {
    updateMemoryConfidence(id, Math.max(0, Math.min(1, newConfidence)))
  }

  /**
   * Delete a memory entry
   */
  deleteEntry(id: string): void {
    deleteMemoryEntry(id)
  }

  /**
   * List memory entries
   */
  listEntries(projectId?: string, limit = 100, offset = 0): TranslationMemoryEntry[] {
    return listMemoryEntries(projectId, limit, offset)
  }

  /**
   * Search memory entries
   */
  search(query: string, projectId?: string): TranslationMemoryEntry[] {
    return searchMemory(query, projectId)
  }

  /**
   * Get memory statistics
   */
  getStats(projectId?: string): {
    totalEntries: number
    verifiedEntries: number
    totalUsageCount: number
  } {
    return getMemoryStats(projectId)
  }

  /**
   * Clear memory for a project
   */
  clearProjectMemory(projectId: string): number {
    const entries = listMemoryEntries(projectId, 10000, 0)
    let deleted = 0
    for (const entry of entries) {
      deleteMemoryEntry(entry.id)
      deleted++
    }
    return deleted
  }

  // ============================================================================
  // Override Operations
  // ============================================================================

  /**
   * Create a translation override
   */
  createOverride(override: Omit<TranslationOverride, 'id' | 'createdAt'>): TranslationOverride {
    return createOverride(override)
  }

  /**
   * Get an override by ID
   */
  getOverrideById(id: string): TranslationOverride | null {
    return getOverrideById(id)
  }

  /**
   * Get the applicable override for a source segment
   */
  getApplicableOverride(
    sourceSegment: string,
    projectId: string,
    chapterId?: string
  ): TranslationOverride | null {
    return getOverride(sourceSegment, projectId, chapterId)
  }

  /**
   * List overrides for a project
   */
  listOverrides(projectId: string, chapterId?: string): TranslationOverride[] {
    return listOverrides(projectId, chapterId)
  }

  /**
   * Delete an override
   */
  deleteOverride(id: string): void {
    deleteOverride(id)
  }

  // ============================================================================
  // Private Helpers
  // ============================================================================

  /**
   * Hash text for consistent lookup
   */
  private hashText(text: string): string {
    const normalized = this.normalizeText(text)
    return createHash('sha256').update(normalized).digest('hex')
  }

  /**
   * Normalize text for consistent hashing
   */
  private normalizeText(text: string): string {
    return text
      .trim()
      .toLowerCase()
      .replace(/\s+/g, ' ') // Collapse whitespace
      .replace(/[\r\n]+/g, '\n') // Normalize line endings
  }
}

// Singleton instance
export const translationMemoryService = new TranslationMemoryService()
