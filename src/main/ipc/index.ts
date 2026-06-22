import { registerProjectHandlers } from './project.handlers'
import { registerChapterHandlers } from './chapter.handlers'
import { registerConfigHandlers } from './config.handlers'
import { registerTranslationHandlers } from './translation.handlers'
import {
  registerSettingsHandlers,
  registerApiKeyHandlers,
  registerBudgetHandlers
} from './settings.handlers'
import { registerProviderConfigHandlers } from './provider.handlers'
import { registerTestHandlers } from './test.handlers'
import { registerGlossaryHandlers } from './glossary.handlers'
import { registerGlossaryRunHandlers } from './glossary-run.handlers'
import { registerMemoryHandlers } from './memory.handlers'
import { healthCheck } from '../services/sidecar'
import { registerProviders } from '../providers'
import { handleIpc } from './utils'
import { logger } from '../services/logger'

/**
 * Register all IPC handlers for main process
 */
export function registerIpcHandlers(): void {
  // Register translation providers
  registerProviders()

  // Ping handler for testing connectivity
  handleIpc('ping', () => 'pong')

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

  // Provider config handlers
  registerProviderConfigHandlers()

  // Budget handlers
  registerBudgetHandlers()

  // Sidecar health check
  handleIpc('sidecar:health', async () => {
    return healthCheck()
  })

  logger.info('[IPC] All handlers registered')
}
