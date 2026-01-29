import {
  startTranslation,
  pauseTranslation,
  resumeTranslation,
  cancelTranslation,
  setApiKey,
  previewTranslation,
  type PreviewResult
} from '../services/translation'
import { handleIpc } from './utils'
import { logger } from '../services/logger'

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

// Export setApiKey for use in settings handlers
export { setApiKey }
