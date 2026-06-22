import type { Chapter, ChapterContent, ChapterStatus, TranslationVersion } from '../../shared/types'
import {
  clearChapterTranslationsBulk,
  getChapter,
  getChapterContent,
  getTranslationVersion,
  listChapters,
  listTranslationVersions,
  updateChapterStatus,
  updateChapterTranslation,
} from '../database'
import { logger } from '../services/logger'
import { handleIpc } from './utils'

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

  // Clear translations for multiple chapters (batch)
  handleIpc('chapter:clear-translations', (chapterIds: string[]): number => {
    return clearChapterTranslationsBulk(chapterIds)
  })

  // List translation versions for a chapter
  handleIpc('chapter:list-versions', (chapterId: string): TranslationVersion[] => {
    return listTranslationVersions(chapterId)
  })

  // Get a specific translation version
  handleIpc('chapter:get-version', (versionId: string): TranslationVersion | null => {
    return getTranslationVersion(versionId)
  })

  // Restore a translation version
  handleIpc('chapter:restore-version', (versionId: string): boolean => {
    const version = getTranslationVersion(versionId)
    if (!version) return false

    updateChapterTranslation(version.chapterId, version.translatedText)
    updateChapterStatus(version.chapterId, 'translated')
    return true
  })

  logger.info('[IPC] Chapter handlers registered')
}
