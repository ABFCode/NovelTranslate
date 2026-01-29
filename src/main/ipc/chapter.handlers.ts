import {
  getChapter,
  listChapters,
  getChapterContent,
  updateChapterStatus,
} from '../database'
import { handleIpc } from './utils'
import { logger } from '../services/logger'
import type { Chapter, ChapterContent, ChapterStatus } from '../../shared/types'

/**
 * Register chapter-related IPC handlers
 */
export function registerChapterHandlers(): void {
  // List chapters for a project
  handleIpc('chapter:list', (projectId: string): Chapter[] => {
    return listChapters(projectId)
  })

  // Get a chapter by ID
  handleIpc('chapter:get', (id: string): Chapter | null => {
    return getChapter(id)
  })

  // Get chapter content (lazy loaded)
  handleIpc('chapter:get-content', (id: string): ChapterContent | null => {
    return getChapterContent(id)
  })

  // Update chapter status
  handleIpc('chapter:update-status', (id: string, status: ChapterStatus): void => {
    updateChapterStatus(id, status)
  })

  logger.info('[IPC] Chapter handlers registered')
}
