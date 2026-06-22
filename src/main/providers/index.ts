import { providerRegistry, TranslationProvider } from './types'
import { OpenAIProvider } from './openai.provider'
import { GeminiProvider } from './gemini.provider'
import { AnthropicProvider } from './anthropic.provider'
import { OpenAICompatibleProvider } from './openai-compatible.provider'
import { providerConfigService } from './provider-config.service'
import { logger } from '../services/logger'
import type { ProviderConfig } from '../../shared/types'

export * from './types'
export * from './openai-compatible.provider'
export * from './provider-config.service'

// Cache of provider instances by provider config ID
const providerInstances = new Map<string, TranslationProvider>()

// Base provider instances (singletons for builtin types)
const builtinProviders: Record<string, TranslationProvider> = {
  openai: new OpenAIProvider(),
  anthropic: new AnthropicProvider(),
  gemini: new GeminiProvider()
}

/**
 * Register all available translation providers (legacy support)
 */
export function registerProviders(): void {
  // Register base providers for backward compatibility
  Object.values(builtinProviders).forEach((provider) => {
    providerRegistry.register(provider)
  })

  logger.info('[Providers] Base providers registered')
}

/**
 * Get a provider instance for a provider config
 */
export function getProviderForConfig(config: ProviderConfig): TranslationProvider | null {
  // Check cache first
  const cached = providerInstances.get(config.id)
  if (cached) {
    return cached
  }

  let provider: TranslationProvider | null = null

  if (config.providerType === 'builtin' && config.builtinId) {
    // Get the builtin provider
    provider = builtinProviders[config.builtinId] || null

    if (provider && provider.configure) {
      // Configure with any overrides
      const baseUrl = providerConfigService.getBaseUrl(config)
      provider.configure(baseUrl, config.settings)
    }
  } else if (config.providerType === 'openai_compatible') {
    // Create a new OpenAI-compatible provider instance
    const baseUrl = config.baseUrl
    if (!baseUrl) {
      logger.error(`[Providers] OpenAI-compatible provider ${config.id} missing base URL`)
      return null
    }

    provider = new OpenAICompatibleProvider(
      config.id,
      config.displayName,
      baseUrl,
      config.settings
    )
  }

  if (provider) {
    providerInstances.set(config.id, provider)
  }

  return provider
}

/**
 * Get a provider by provider config ID
 */
export function getProviderByConfigId(configId: string): TranslationProvider | null {
  // Check cache first
  const cached = providerInstances.get(configId)
  if (cached) {
    return cached
  }

  // Load the config and create the provider
  const config = providerConfigService.getProviderConfig(configId)
  if (!config) {
    return null
  }

  return getProviderForConfig(config)
}

/**
 * Clear the provider cache (useful when config is updated)
 */
export function clearProviderCache(configId?: string): void {
  if (configId) {
    providerInstances.delete(configId)
  } else {
    providerInstances.clear()
  }
}

/**
 * Validate a key for a provider config
 */
export async function validateKeyForConfig(
  configId: string,
  keyValue: string
): Promise<boolean> {
  const config = providerConfigService.getProviderConfig(configId)
  if (!config) {
    return false
  }

  const provider = getProviderForConfig(config)
  if (!provider) {
    return false
  }

  const baseUrl = providerConfigService.getBaseUrl(config)
  return provider.validateKey(keyValue, baseUrl)
}
