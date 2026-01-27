import { ipcMain } from 'electron'
import { getSettings, saveSettings } from '../database'
import { keyManager } from '../services/key-manager'
import {
  listApiKeys,
  listAllApiKeys,
  getApiKey,
  updateApiKey,
  deleteApiKey
} from '../database/repositories/apikey.repository'
import {
  getProjectBudget,
  setProjectBudget,
  checkBudget,
  recordSpending,
  resetSpending,
  listProjectBudgets
} from '../database/repositories/budget.repository'
import type { AppSettings, ProviderInfo, ApiKeyEntry, ProjectBudget, KeyRotationStrategy } from '../../shared/types'

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
      // Update key rotation strategy if changed
      if (updates.keyRotationStrategy) {
        keyManager.setRotationStrategy(updates.keyRotationStrategy)
      }
      return saveSettings(updates)
    }
  )

  console.log('[IPC] Settings handlers registered')
}

/**
 * Register API key handlers (using KeyManager for encryption)
 */
export function registerApiKeyHandlers(): void {
  // List all API keys (metadata only, not the actual key values)
  ipcMain.handle('apikey:list', async (_event, providerId?: string): Promise<ApiKeyEntry[]> => {
    if (providerId) {
      return listApiKeys(providerId)
    }
    return listAllApiKeys()
  })

  // Get a specific API key's metadata
  ipcMain.handle('apikey:get', async (_event, keyId: string): Promise<ApiKeyEntry | null> => {
    return getApiKey(keyId)
  })

  // Get API key for provider (for making API calls)
  ipcMain.handle(
    'apikey:getForProvider',
    async (_event, providerId: string): Promise<string | null> => {
      return keyManager.getKey(providerId)
    }
  )

  // Check if provider has valid keys
  ipcMain.handle('apikey:hasValidKeys', async (_event, providerId: string): Promise<boolean> => {
    return keyManager.hasValidKeys(providerId)
  })

  // Save/Add a new API key
  ipcMain.handle(
    'apikey:save',
    async (
      _event,
      providerId: string,
      keyValue: string,
      label?: string,
      priority?: number
    ): Promise<ApiKeyEntry> => {
      return keyManager.addKey(providerId, keyValue, label, priority)
    }
  )

  // Update an existing key's value
  ipcMain.handle(
    'apikey:updateValue',
    async (_event, keyId: string, newKeyValue: string): Promise<void> => {
      await keyManager.updateKey(keyId, newKeyValue)
    }
  )

  // Update key metadata (label, priority, enabled)
  ipcMain.handle(
    'apikey:updateMeta',
    async (
      _event,
      keyId: string,
      updates: Partial<{ label: string | null; priority: number; isEnabled: boolean }>
    ): Promise<void> => {
      updateApiKey(keyId, updates)
    }
  )

  // Delete API key
  ipcMain.handle('apikey:delete', async (_event, keyId: string): Promise<void> => {
    await keyManager.removeKey(keyId)
  })

  // Validate an API key (tests it against the provider)
  ipcMain.handle(
    'apikey:validate',
    async (_event, providerId: string, keyValue: string): Promise<boolean> => {
      return keyManager.validateKey(providerId, keyValue)
    }
  )

  // Validate a stored key
  ipcMain.handle('apikey:validateStored', async (_event, keyId: string): Promise<boolean> => {
    return keyManager.validateStoredKey(keyId)
  })

  // Set key rotation strategy
  ipcMain.handle(
    'apikey:setRotationStrategy',
    async (_event, strategy: KeyRotationStrategy): Promise<void> => {
      keyManager.setRotationStrategy(strategy)
      // Also persist in settings
      const settings = getSettings()
      saveSettings({ ...settings, keyRotationStrategy: strategy })
    }
  )

  // Get current rotation strategy
  ipcMain.handle('apikey:getRotationStrategy', async (): Promise<KeyRotationStrategy> => {
    return keyManager.getRotationStrategy()
  })

  console.log('[IPC] API Key handlers registered')
}

/**
 * Register provider handlers
 */
export function registerProviderHandlers(): void {
  // List available providers
  ipcMain.handle('provider:list', async (): Promise<ProviderInfo[]> => {
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

  console.log('[IPC] Provider handlers registered')
}

/**
 * Register budget handlers
 */
export function registerBudgetHandlers(): void {
  // Get budget for a project
  ipcMain.handle('budget:get', async (_event, projectId: string): Promise<ProjectBudget | null> => {
    return getProjectBudget(projectId)
  })

  // Set/update budget for a project
  ipcMain.handle(
    'budget:set',
    async (
      _event,
      projectId: string,
      budgetUsd: number,
      alertThreshold?: number,
      hardLimit?: boolean
    ): Promise<ProjectBudget> => {
      return setProjectBudget(projectId, budgetUsd, alertThreshold, hardLimit)
    }
  )

  // Check if within budget
  ipcMain.handle(
    'budget:check',
    async (
      _event,
      projectId: string,
      estimatedCostUsd: number
    ): Promise<{ allowed: boolean; warning?: string; remaining?: number }> => {
      return checkBudget(projectId, estimatedCostUsd)
    }
  )

  // Record spending
  ipcMain.handle(
    'budget:recordSpending',
    async (_event, projectId: string, amountUsd: number): Promise<void> => {
      recordSpending(projectId, amountUsd)
    }
  )

  // Reset spending (new billing period)
  ipcMain.handle('budget:resetSpending', async (_event, projectId: string): Promise<void> => {
    resetSpending(projectId)
  })

  // List all project budgets
  ipcMain.handle('budget:list', async (): Promise<ProjectBudget[]> => {
    return listProjectBudgets()
  })

  console.log('[IPC] Budget handlers registered')
}
