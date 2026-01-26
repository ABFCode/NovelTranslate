import { ipcMain } from 'electron'
import {
  startTranslation,
  pauseTranslation,
  resumeTranslation,
  cancelTranslation,
  setApiKey,
} from '../services/translation'

/**
 * Register translation-related IPC handlers
 */
export function registerTranslationHandlers(): void {
  // Start translation
  ipcMain.handle(
    'translation:start',
    async (
      _event,
      projectId: string,
      chapterIds: string[],
      configId: string
    ): Promise<void> => {
      await startTranslation(projectId, chapterIds, configId)
    }
  )

  // Pause translation
  ipcMain.handle('translation:pause', async (_event, projectId: string): Promise<void> => {
    pauseTranslation(projectId)
  })

  // Resume translation
  ipcMain.handle('translation:resume', async (_event, projectId: string): Promise<void> => {
    resumeTranslation(projectId)
  })

  // Cancel translation
  ipcMain.handle('translation:cancel', async (_event, projectId: string): Promise<void> => {
    cancelTranslation(projectId)
  })

  console.log('[IPC] Translation handlers registered')
}

// Export setApiKey for use in settings handlers
export { setApiKey }
