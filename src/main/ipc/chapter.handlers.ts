import { ipcMain } from 'electron'
import {
  getChapter,
  listChapters,
  getChapterContent,
  updateChapterStatus,
} from '../database'
import type { Chapter, ChapterContent, ChapterStatus } from '../../shared/types'

/**
 * Register chapter-related IPC handlers
 */
export function registerChapterHandlers(): void {
  // List chapters for a project
  ipcMain.handle('chapter:list', async (_event, projectId: string): Promise<Chapter[]> => {
    return listChapters(projectId)
  })

  // Get a chapter by ID
  ipcMain.handle('chapter:get', async (_event, id: string): Promise<Chapter | null> => {
    return getChapter(id)
  })

  // Get chapter content (lazy loaded)
  ipcMain.handle('chapter:get-content', async (_event, id: string): Promise<ChapterContent | null> => {
    return getChapterContent(id)
  })

  // Update chapter status
  ipcMain.handle(
    'chapter:update-status',
    async (_event, id: string, status: ChapterStatus): Promise<void> => {
      updateChapterStatus(id, status)
    }
  )

  console.log('[IPC] Chapter handlers registered')
}
