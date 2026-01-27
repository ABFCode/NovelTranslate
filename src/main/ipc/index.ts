import { ipcMain } from 'electron'
import { registerProjectHandlers } from './project.handlers'
import { registerChapterHandlers } from './chapter.handlers'
import { registerConfigHandlers } from './config.handlers'
import { registerTranslationHandlers } from './translation.handlers'
import {
  registerSettingsHandlers,
  registerApiKeyHandlers,
  registerProviderHandlers,
  registerBudgetHandlers
} from './settings.handlers'
import { registerTestHandlers } from './test.handlers'
import { registerGlossaryHandlers } from './glossary.handlers'
import { registerGlossaryRunHandlers } from './glossary-run.handlers'
import { registerMemoryHandlers } from './memory.handlers'
import { healthCheck } from '../services/sidecar'
import { registerProviders } from '../providers'
import { keyManager } from '../services/key-manager'

/**
 * Register all IPC handlers for main process
 */
export function registerIpcHandlers(): void {
  // Register translation providers
  registerProviders()

  // Migrate legacy API keys
  keyManager.migrateLegacyKeys().then((count) => {
    if (count > 0) {
      console.log(`[IPC] Migrated ${count} legacy API keys`)
    }
  })

  // Ping handler for testing connectivity
  ipcMain.handle('ping', () => 'pong')

  // Project handlers
  registerProjectHandlers()

  // Chapter handlers
  registerChapterHandlers()

  // Config handlers (includes templates and fallbacks)
  registerConfigHandlers()

  // Translation handlers
  registerTranslationHandlers()

  // Test handlers (Testing Center)
  registerTestHandlers()

  // Glossary handlers
  registerGlossaryHandlers()

  // Glossary run handlers
  registerGlossaryRunHandlers()

  // Translation memory handlers
  registerMemoryHandlers()

  // Settings handlers
  registerSettingsHandlers()

  // API Key handlers
  registerApiKeyHandlers()

  // Provider handlers
  registerProviderHandlers()

  // Budget handlers
  registerBudgetHandlers()

  // Sidecar health check
  ipcMain.handle('sidecar:health', async () => {
    return healthCheck()
  })

  console.log('[IPC] All handlers registered')
}
