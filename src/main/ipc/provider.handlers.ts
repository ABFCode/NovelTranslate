import type {
  BuiltinProviderId,
  BuiltinProviderTemplate,
  ModelInfo,
  ProviderConfig,
  ProviderInfoExtended,
  ProviderSettings,
} from '../../shared/types'
import { clearProviderCache, getProviderForConfig } from '../providers'
import { OpenAICompatibleProvider } from '../providers/openai-compatible.provider'
import { providerConfigService } from '../providers/provider-config.service'
import { keyManager } from '../services/key-manager'
import { logger } from '../services/logger'
import { handleIpc } from './utils'

/**
 * Register provider config IPC handlers
 */
export function registerProviderConfigHandlers(): void {
  // Get all built-in provider templates
  handleIpc('providerConfig:getTemplates', (): BuiltinProviderTemplate[] => {
    return providerConfigService.getBuiltinTemplates()
  })

  // List all configured providers with extended info
  handleIpc('providerConfig:list', (): ProviderInfoExtended[] => {
    return providerConfigService.listProvidersExtended()
  })

  // Get a specific provider config
  handleIpc('providerConfig:get', (configId: string): ProviderConfig | null => {
    return providerConfigService.getProviderConfig(configId)
  })

  // Create a new provider config from template
  handleIpc(
    'providerConfig:create',
    (params: {
      builtinId?: BuiltinProviderId
      displayName: string
      baseUrl?: string
      customModels?: ModelInfo[]
      settings?: ProviderSettings
    }): ProviderConfig => {
      if (params.builtinId) {
        // Create from builtin template
        return providerConfigService.createFromTemplate(
          params.builtinId,
          params.displayName,
          params.baseUrl
        )
      } else if (params.baseUrl) {
        // Create custom OpenAI-compatible provider
        return providerConfigService.createCustomProvider(
          params.displayName,
          params.baseUrl,
          params.customModels,
          params.settings
        )
      } else {
        throw new Error('Either builtinId or baseUrl must be provided')
      }
    }
  )

  // Update a provider config
  handleIpc(
    'providerConfig:update',
    (
      configId: string,
      updates: Partial<Omit<ProviderConfig, 'id' | 'createdAt' | 'updatedAt'>>
    ): void => {
      providerConfigService.updateProviderConfig(configId, updates)
      // Clear the provider cache to pick up changes
      clearProviderCache(configId)
    }
  )

  // Delete a provider config
  handleIpc('providerConfig:delete', (configId: string): void => {
    providerConfigService.deleteProviderConfig(configId)
    clearProviderCache(configId)
  })

  // Get models for a provider config (from config or template)
  handleIpc('providerConfig:getModels', (configId: string): ModelInfo[] => {
    const config = providerConfigService.getProviderConfig(configId)
    if (!config) {
      return []
    }
    return providerConfigService.getModelsForProvider(config)
  })

  // Fetch models from the provider API (for OpenAI-compatible providers).
  // If no key is passed, fall back to a stored key for this provider config.
  handleIpc(
    'providerConfig:fetchModels',
    async (configId: string, apiKey?: string): Promise<ModelInfo[]> => {
      const config = providerConfigService.getProviderConfig(configId)
      if (!config) {
        throw new Error(`Provider config not found: ${configId}`)
      }

      const provider = getProviderForConfig(config)
      if (!provider) {
        throw new Error(`Failed to create provider for config: ${configId}`)
      }

      // Every provider can list models live; fall back to the seed only if an
      // implementation is somehow missing.
      if (typeof provider.listModels !== 'function') {
        return providerConfigService.getModelsForProvider(config)
      }

      const key = apiKey || (await keyManager.getKey(configId))
      if (!key) {
        throw new Error('No API key available to fetch models. Add a key first.')
      }

      const baseUrl = providerConfigService.getBaseUrl(config)
      try {
        return await provider.listModels(key, baseUrl)
      } catch (error) {
        // Surface a clean, actionable message (e.g. HTTP 500, auth failure, or a
        // changed response shape) instead of leaking a raw SDK stack trace.
        const reason = error instanceof Error ? error.message : String(error)
        throw new Error(`Could not fetch models from ${config.displayName}: ${reason}`)
      }
    }
  )

  // Validate connection to a provider. If no key is passed, fall back to a
  // stored key for this provider config.
  handleIpc(
    'providerConfig:validateConnection',
    async (
      configId: string,
      apiKey?: string
    ): Promise<{ valid: boolean; error?: string; models?: number }> => {
      const config = providerConfigService.getProviderConfig(configId)
      if (!config) {
        return { valid: false, error: `Provider config not found: ${configId}` }
      }

      const provider = getProviderForConfig(config)
      if (!provider) {
        return { valid: false, error: `Failed to create provider for config: ${configId}` }
      }

      const key = apiKey || (await keyManager.getKey(configId))
      if (!key) {
        return { valid: false, error: 'No API key configured for this provider' }
      }

      // For OpenAI-compatible providers, use testConnection
      if (provider instanceof OpenAICompatibleProvider) {
        const baseUrl = providerConfigService.getBaseUrl(config)
        return provider.testConnection(key, baseUrl)
      }

      // For other providers, just validate the key
      try {
        const baseUrl = providerConfigService.getBaseUrl(config)
        const valid = await provider.validateKey(key, baseUrl)
        return { valid, error: valid ? undefined : 'API key validation failed' }
      } catch (error) {
        return {
          valid: false,
          error: error instanceof Error ? error.message : String(error),
        }
      }
    }
  )

  // Check if a builtin provider is already configured
  handleIpc('providerConfig:isBuiltinConfigured', (builtinId: BuiltinProviderId): boolean => {
    return providerConfigService.isBuiltinConfigured(builtinId)
  })

  logger.info('[IPC] Provider config handlers registered')
}
