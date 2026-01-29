import {
  startTranslation,
  pauseTranslation,
  resumeTranslation,
  cancelTranslation,
  setApiKey,
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

  logger.info('[IPC] Translation handlers registered')
}

// Export setApiKey for use in settings handlers
export { setApiKey }
