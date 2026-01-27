import { ipcMain } from 'electron'
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

/**
 * Register translation memory and override IPC handlers
 */
export function registerMemoryHandlers(): void {
  // ============================================================================
  // Translation Memory
  // ============================================================================
  ipcMain.handle(
    'memory:list',
    async (
      _event,
      projectId?: string,
      limit?: number,
      offset?: number
    ): Promise<TranslationMemoryEntry[]> => {
      return listMemoryEntries(projectId, limit ?? 100, offset ?? 0)
    }
  )

  ipcMain.handle(
    'memory:stats',
    async (
      _event,
      projectId?: string
    ): Promise<{ totalEntries: number; verifiedEntries: number; totalUsageCount: number }> => {
      return getMemoryStats(projectId)
    }
  )

  ipcMain.handle('memory:verify', async (_event, id: string): Promise<void> => {
    verifyMemoryEntry(id)
  })

  ipcMain.handle(
    'memory:updateConfidence',
    async (_event, id: string, confidence: number): Promise<void> => {
      updateMemoryConfidence(id, confidence)
    }
  )

  ipcMain.handle('memory:delete', async (_event, id: string): Promise<void> => {
    deleteMemoryEntry(id)
  })

  // ============================================================================
  // Overrides
  // ============================================================================
  ipcMain.handle(
    'override:list',
    async (_event, projectId: string, chapterId?: string): Promise<TranslationOverride[]> => {
      return listOverrides(projectId, chapterId)
    }
  )

  ipcMain.handle(
    'override:create',
    async (
      _event,
      override: Omit<TranslationOverride, 'id' | 'createdAt'>
    ): Promise<TranslationOverride> => {
      return createOverride(override)
    }
  )

  ipcMain.handle(
    'override:update',
    async (
      _event,
      id: string,
      updates: Partial<Omit<TranslationOverride, 'id' | 'projectId' | 'createdAt'>>
    ): Promise<void> => {
      updateOverride(id, updates)
    }
  )

  ipcMain.handle('override:delete', async (_event, id: string): Promise<void> => {
    deleteOverride(id)
  })

  console.log('[IPC] Translation memory handlers registered')
}
