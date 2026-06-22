import { logger } from '../services/logger'
import {
  cancelTranslation,
  type PreviewResult,
  pauseTranslation,
  previewTranslation,
  resumeTranslation,
  startTranslation,
} from '../services/translation'
import { handleIpc } from './utils'

/**
 * Register translation-related IPC handlers
 */
export function registerTranslationHandlers(): void {
  // Start translation
  handleIpc(
    'translation:start',
    async (projectId: string, chapterIds: string[], configId: string): Promise<void> => {
      await startTranslation(projectId, chapterIds, configId)
    }
  )

  // Pause translation
  handleIpc('translation:pause', (projectId: string): void => {
    pauseTranslation(projectId)
  })

  // Resume translation
  handleIpc('translation:resume', (projectId: string): void => {
    resumeTranslation(projectId)
  })

  // Cancel translation
  handleIpc('translation:cancel', (projectId: string): void => {
    cancelTranslation(projectId)
  })

  // Preview translation
  handleIpc(
    'translation:preview',
    async (
      text: string,
      configId: string,
      sourceLanguage: string,
      targetLanguage: string
    ): Promise<PreviewResult> => {
      return previewTranslation(text, configId, sourceLanguage, targetLanguage)
    }
  )

  logger.info('[IPC] Translation handlers registered')
}
