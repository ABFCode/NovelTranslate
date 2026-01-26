import { ipcMain } from 'electron'
import { getSettings, saveSettings } from '../database'
import { setApiKey as setTranslationApiKey } from '../services/translation'
import type { AppSettings, ProviderInfo } from '../../shared/types'

// In-memory cache for API keys (decrypted)
const apiKeyCache = new Map<string, string>()

/**
 * Register settings-related IPC handlers
 */
export function registerSettingsHandlers(): void {
  // Get app settings
  ipcMain.handle('settings:get', async (): Promise<AppSettings> => {
    return getSettings()
  })

  // Save app settings
  ipcMain.handle(
    'settings:save',
    async (_event, updates: Partial<AppSettings>): Promise<AppSettings> => {
      return saveSettings(updates)
    }
  )

  console.log('[IPC] Settings handlers registered')
}

/**
 * Register API key handlers (using safeStorage for encryption)
 */
export function registerApiKeyHandlers(): void {
  // Get API key for a provider
  ipcMain.handle('apikey:get', async (_event, providerId: string): Promise<string | null> => {
    // Check cache first
    if (apiKeyCache.has(providerId)) {
      return apiKeyCache.get(providerId)!
    }

    // Note: In production, you'd store encrypted keys in a file or database
    // and use safeStorage to decrypt them. For now, we just use the cache.
    return null
  })

  // Save API key for a provider
  ipcMain.handle(
    'apikey:save',
    async (_event, providerId: string, apiKey: string): Promise<void> => {
      // Store in cache
      apiKeyCache.set(providerId, apiKey)

      // Also set in translation service
      setTranslationApiKey(providerId, apiKey)

      // In production, you'd encrypt and persist this using safeStorage:
      // if (safeStorage.isEncryptionAvailable()) {
      //   const encrypted = safeStorage.encryptString(apiKey)
      //   await saveEncryptedKey(providerId, encrypted)
      // }

      console.log(`[APIKey] Saved key for provider: ${providerId}`)
    }
  )

  // Delete API key for a provider
  ipcMain.handle('apikey:delete', async (_event, providerId: string): Promise<void> => {
    apiKeyCache.delete(providerId)
    console.log(`[APIKey] Deleted key for provider: ${providerId}`)
  })

  // Validate API key (placeholder - will be implemented per provider)
  ipcMain.handle(
    'apikey:validate',
    async (_event, providerId: string, apiKey: string): Promise<boolean> => {
      // TODO: Implement actual validation per provider
      console.log(`[APIKey] Validating key for provider: ${providerId}`)
      return apiKey.length > 0
    }
  )

  console.log('[IPC] API Key handlers registered')
}

/**
 * Register provider handlers
 */
export function registerProviderHandlers(): void {
  // List available providers
  ipcMain.handle('provider:list', async (): Promise<ProviderInfo[]> => {
    // Return static list of supported providers
    return [
      {
        id: 'openai',
        name: 'OpenAI',
        models: [
          { id: 'gpt-4o', name: 'GPT-4o', contextWindow: 128000, inputPricePerMillion: 2.5, outputPricePerMillion: 10 },
          { id: 'gpt-4o-mini', name: 'GPT-4o Mini', contextWindow: 128000, inputPricePerMillion: 0.15, outputPricePerMillion: 0.6 },
          { id: 'gpt-4-turbo', name: 'GPT-4 Turbo', contextWindow: 128000, inputPricePerMillion: 10, outputPricePerMillion: 30 },
        ],
      },
      {
        id: 'gemini',
        name: 'Google Gemini',
        models: [
          { id: 'gemini-1.5-pro', name: 'Gemini 1.5 Pro', contextWindow: 2000000, inputPricePerMillion: 1.25, outputPricePerMillion: 5 },
          { id: 'gemini-1.5-flash', name: 'Gemini 1.5 Flash', contextWindow: 1000000, inputPricePerMillion: 0.075, outputPricePerMillion: 0.3 },
          { id: 'gemini-2.0-flash', name: 'Gemini 2.0 Flash', contextWindow: 1000000, inputPricePerMillion: 0.1, outputPricePerMillion: 0.4 },
        ],
      },
      {
        id: 'anthropic',
        name: 'Anthropic',
        models: [
          { id: 'claude-3-5-sonnet', name: 'Claude 3.5 Sonnet', contextWindow: 200000, inputPricePerMillion: 3, outputPricePerMillion: 15 },
          { id: 'claude-3-5-haiku', name: 'Claude 3.5 Haiku', contextWindow: 200000, inputPricePerMillion: 0.25, outputPricePerMillion: 1.25 },
          { id: 'claude-3-opus', name: 'Claude 3 Opus', contextWindow: 200000, inputPricePerMillion: 15, outputPricePerMillion: 75 },
        ],
      },
    ]
  })

  console.log('[IPC] Provider handlers registered')
}
