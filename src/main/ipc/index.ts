import { ipcMain } from 'electron'
import { registerProjectHandlers } from './project.handlers'
import { registerChapterHandlers } from './chapter.handlers'
import { registerConfigHandlers } from './config.handlers'
import { registerTranslationHandlers } from './translation.handlers'
import {
  registerSettingsHandlers,
  registerApiKeyHandlers,
  registerProviderHandlers,
} from './settings.handlers'
import { healthCheck } from '../services/sidecar'
import { registerProviders } from '../providers'

/**
 * Register all IPC handlers for main process
 */
export function registerIpcHandlers(): void {
  // Register translation providers
  registerProviders()

  // Ping handler for testing connectivity
  ipcMain.handle('ping', () => 'pong')

  // Project handlers
  registerProjectHandlers()

  // Chapter handlers
  registerChapterHandlers()

  // Config handlers
  registerConfigHandlers()

  // Translation handlers
  registerTranslationHandlers()

  // Settings handlers
  registerSettingsHandlers()

  // API Key handlers
  registerApiKeyHandlers()

  // Provider handlers
  registerProviderHandlers()

  // Sidecar health check
  ipcMain.handle('sidecar:health', async () => {
    return healthCheck()
  })

  console.log('[IPC] All handlers registered')
}
