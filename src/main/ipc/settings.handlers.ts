import { getSettings, saveSettings } from '../database'
import { keyManager } from '../services/key-manager'
import {
  listApiKeys,
  listAllApiKeys,
  getApiKey,
  updateApiKey
} from '../database/repositories/apikey.repository'
import {
  getProjectBudget,
  setProjectBudget,
  checkBudget,
  recordSpending,
  resetSpending,
  listProjectBudgets
} from '../database/repositories/budget.repository'
import { handleIpc } from './utils'
import { logger } from '../services/logger'
import type { AppSettings, ProviderInfo, ApiKeyEntry, ProjectBudget, KeyRotationStrategy } from '../../shared/types'

/**
 * Register settings-related IPC handlers
 */
export function registerSettingsHandlers(): void {
  // Get app settings
  handleIpc('settings:get', (): AppSettings => {
    return getSettings()
  })

  // Save app settings
  handleIpc('settings:save', (updates: Partial<AppSettings>): AppSettings => {
    // Update key rotation strategy if changed
    if (updates.keyRotationStrategy) {
      keyManager.setRotationStrategy(updates.keyRotationStrategy)
    }
    return saveSettings(updates)
  })

  logger.info('[IPC] Settings handlers registered')
}

/**
 * Register API key handlers (using KeyManager for encryption)
 */
export function registerApiKeyHandlers(): void {
  // List all API keys (metadata only, not the actual key values)
  handleIpc('apikey:list', (providerId?: string): ApiKeyEntry[] => {
    if (providerId) {
      return listApiKeys(providerId)
    }
    return listAllApiKeys()
  })

  // Get a specific API key's metadata
  handleIpc('apikey:get', (keyId: string): ApiKeyEntry | null => {
    return getApiKey(keyId)
  })

  // Get API key for provider (for making API calls)
  handleIpc('apikey:getForProvider', async (providerId: string): Promise<string | null> => {
    return keyManager.getKey(providerId)
  })

  // Check if provider has valid keys
  handleIpc('apikey:hasValidKeys', (providerId: string): boolean => {
    return keyManager.hasValidKeys(providerId)
  })

  // Save/Add a new API key
  handleIpc(
    'apikey:save',
    async (
      providerId: string,
      keyValue: string,
      label?: string,
      priority?: number
    ): Promise<ApiKeyEntry> => {
      return keyManager.addKey(providerId, keyValue, label, priority)
    }
  )

  // Update an existing key's value
  handleIpc('apikey:updateValue', async (keyId: string, newKeyValue: string): Promise<void> => {
    await keyManager.updateKey(keyId, newKeyValue)
  })

  // Update key metadata (label, priority, enabled)
  handleIpc(
    'apikey:updateMeta',
    (
      keyId: string,
      updates: Partial<{ label: string | null; priority: number; isEnabled: boolean }>
    ): void => {
      updateApiKey(keyId, updates)
    }
  )

  // Delete API key
  handleIpc('apikey:delete', async (keyId: string): Promise<void> => {
    await keyManager.removeKey(keyId)
  })

  // Validate an API key (tests it against the provider)
  handleIpc(
    'apikey:validate',
    async (providerId: string, keyValue: string): Promise<boolean> => {
      return keyManager.validateKey(providerId, keyValue)
    }
  )

  // Validate a stored key
  handleIpc('apikey:validateStored', async (keyId: string): Promise<boolean> => {
    return keyManager.validateStoredKey(keyId)
  })

  // Set key rotation strategy
  handleIpc('apikey:setRotationStrategy', (strategy: KeyRotationStrategy): void => {
    keyManager.setRotationStrategy(strategy)
    // Also persist in settings
    const settings = getSettings()
    saveSettings({ ...settings, keyRotationStrategy: strategy })
  })

  // Get current rotation strategy
  handleIpc('apikey:getRotationStrategy', (): KeyRotationStrategy => {
    return keyManager.getRotationStrategy()
  })

  logger.info('[IPC] API Key handlers registered')
}

/**
 * Register provider handlers
 */
export function registerProviderHandlers(): void {
  // List available providers
  handleIpc('provider:list', (): ProviderInfo[] => {
    // Return static list of supported providers with updated pricing
    return [
      {
        id: 'openai',
        name: 'OpenAI',
        models: [
          {
            id: 'gpt-4o',
            name: 'GPT-4o',
            contextWindow: 128000,
            inputPricePerMillion: 5,
            outputPricePerMillion: 15
          },
          {
            id: 'gpt-4o-mini',
            name: 'GPT-4o Mini',
            contextWindow: 128000,
            inputPricePerMillion: 0.15,
            outputPricePerMillion: 0.6
          },
          {
            id: 'gpt-4-turbo',
            name: 'GPT-4 Turbo',
            contextWindow: 128000,
            inputPricePerMillion: 10,
            outputPricePerMillion: 30
          },
          {
            id: 'gpt-3.5-turbo',
            name: 'GPT-3.5 Turbo',
            contextWindow: 16385,
            inputPricePerMillion: 0.5,
            outputPricePerMillion: 1.5
          }
        ]
      },
      {
        id: 'gemini',
        name: 'Google Gemini',
        models: [
          {
            id: 'gemini-1.5-pro',
            name: 'Gemini 1.5 Pro',
            contextWindow: 2000000,
            inputPricePerMillion: 3.5,
            outputPricePerMillion: 10.5
          },
          {
            id: 'gemini-1.5-flash',
            name: 'Gemini 1.5 Flash',
            contextWindow: 1000000,
            inputPricePerMillion: 0.075,
            outputPricePerMillion: 0.3
          },
          {
            id: 'gemini-2.0-flash',
            name: 'Gemini 2.0 Flash',
            contextWindow: 1000000,
            inputPricePerMillion: 0.1,
            outputPricePerMillion: 0.4
          }
        ]
      },
      {
        id: 'anthropic',
        name: 'Anthropic',
        models: [
          {
            id: 'claude-3-5-sonnet-20241022',
            name: 'Claude 3.5 Sonnet',
            contextWindow: 200000,
            inputPricePerMillion: 3,
            outputPricePerMillion: 15
          },
          {
            id: 'claude-3-haiku-20240307',
            name: 'Claude 3 Haiku',
            contextWindow: 200000,
            inputPricePerMillion: 0.25,
            outputPricePerMillion: 1.25
          },
          {
            id: 'claude-3-opus-20240229',
            name: 'Claude 3 Opus',
            contextWindow: 200000,
            inputPricePerMillion: 15,
            outputPricePerMillion: 75
          }
        ]
      }
    ]
  })

  logger.info('[IPC] Provider handlers registered')
}

/**
 * Register budget handlers
 */
export function registerBudgetHandlers(): void {
  // Get budget for a project
  handleIpc('budget:get', (projectId: string): ProjectBudget | null => {
    return getProjectBudget(projectId)
  })

  // Set/update budget for a project
  handleIpc(
    'budget:set',
    (
      projectId: string,
      budgetUsd: number,
      alertThreshold?: number,
      hardLimit?: boolean
    ): ProjectBudget => {
      return setProjectBudget(projectId, budgetUsd, alertThreshold, hardLimit)
    }
  )

  // Check if within budget
  handleIpc(
    'budget:check',
    (
      projectId: string,
      estimatedCostUsd: number
    ): { allowed: boolean; warning?: string; remaining?: number } => {
      return checkBudget(projectId, estimatedCostUsd)
    }
  )

  // Record spending
  handleIpc('budget:recordSpending', (projectId: string, amountUsd: number): void => {
    recordSpending(projectId, amountUsd)
  })

  // Reset spending (new billing period)
  handleIpc('budget:resetSpending', (projectId: string): void => {
    resetSpending(projectId)
  })

  // List all project budgets
  handleIpc('budget:list', (): ProjectBudget[] => {
    return listProjectBudgets()
  })

  logger.info('[IPC] Budget handlers registered')
}
