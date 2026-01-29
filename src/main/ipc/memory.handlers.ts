import type { TranslationOverride, TranslationMemoryEntry } from '../../shared/types'
import {
  listMemoryEntries,
  getMemoryStats,
  verifyMemoryEntry,
  updateMemoryConfidence,
  deleteMemoryEntry,
  listOverrides,
  createOverride,
  updateOverride,
  deleteOverride
} from '../database/repositories/memory.repository'
import { handleIpc } from './utils'
import { logger } from '../services/logger'

/**
 * Register translation memory and override IPC handlers
 */
export function registerMemoryHandlers(): void {
  // ============================================================================
  // Translation Memory
  // ============================================================================
  handleIpc(
    'memory:list',
    (
      projectId?: string,
      limit?: number,
      offset?: number
    ): TranslationMemoryEntry[] => {
      return listMemoryEntries(projectId, limit ?? 100, offset ?? 0)
    }
  )

  handleIpc(
    'memory:stats',
    (projectId?: string): { totalEntries: number; verifiedEntries: number; totalUsageCount: number } => {
      return getMemoryStats(projectId)
    }
  )

  handleIpc('memory:verify', (id: string): void => {
    verifyMemoryEntry(id)
  })

  handleIpc('memory:updateConfidence', (id: string, confidence: number): void => {
    updateMemoryConfidence(id, confidence)
  })

  handleIpc('memory:delete', (id: string): void => {
    deleteMemoryEntry(id)
  })

  // ============================================================================
  // Overrides
  // ============================================================================
  handleIpc(
    'override:list',
    (projectId: string, chapterId?: string): TranslationOverride[] => {
      return listOverrides(projectId, chapterId)
    }
  )

  handleIpc(
    'override:create',
    (override: Omit<TranslationOverride, 'id' | 'createdAt'>): TranslationOverride => {
      return createOverride(override)
    }
  )

  handleIpc(
    'override:update',
    (
      id: string,
      updates: Partial<Omit<TranslationOverride, 'id' | 'projectId' | 'createdAt'>>
    ): void => {
      updateOverride(id, updates)
    }
  )

  handleIpc('override:delete', (id: string): void => {
    deleteOverride(id)
  })

  logger.info('[IPC] Translation memory handlers registered')
}
