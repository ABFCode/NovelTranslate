import type { ProviderConfig } from '../../shared/types'
import { logger } from '../services/logger'
import { AnthropicProvider } from './anthropic.provider'
import { GeminiProvider } from './gemini.provider'
import { OpenAIProvider } from './openai.provider'
import { OpenAICompatibleProvider } from './openai-compatible.provider'
import { providerConfigService } from './provider-config.service'
import { providerRegistry, type TranslationProvider } from './types'

export * from './openai-compatible.provider'
export * from './provider-config.service'
export * from './types'

// Cache of provider instances by provider config ID
const providerInstances = new Map<string, TranslationProvider>()

// Factories for the SDK-specific builtin providers. A fresh instance is created
// per provider config so that per-config settings (timeout, headers, base URL)
// never leak between configs that happen to share an SDK.
const builtinFactories: Record<'openai' | 'anthropic' | 'gemini', () => TranslationProvider> = {
  openai: () => new OpenAIProvider(),
  anthropic: () => new AnthropicProvider(),
  gemini: () => new GeminiProvider(),
}

/**
 * Register all available translation providers (legacy support)
 */
export function registerProviders(): void {
  // Register one instance of each SDK provider for backward compatibility.
  for (const factory of Object.values(builtinFactories)) {
    providerRegistry.register(factory())
  }

  logger.info('[Providers] Base providers registered')
}

/**
 * Get a provider instance for a provider config.
 *
 * Resolution is driven by the config's SDK type (not its provider type) so that
 * builtin templates whose SDK is OpenAI-compatible (Groq, OpenRouter, Together,
 * Ollama, xAI, DeepSeek, …) are served by the generic OpenAI-compatible provider.
 */
export function getProviderForConfig(config: ProviderConfig): TranslationProvider | null {
  // Check cache first
  const cached = providerInstances.get(config.id)
  if (cached) {
    return cached
  }

  const sdkType = providerConfigService.getSdkType(config)
  const baseUrl = providerConfigService.getBaseUrl(config)

  let provider: TranslationProvider | null = null

  if (sdkType === 'openai_compatible') {
    if (!baseUrl) {
      logger.error(`[Providers] OpenAI-compatible provider ${config.id} missing base URL`)
      return null
    }
    provider = new OpenAICompatibleProvider(config.id, config.displayName, baseUrl, config.settings)
  } else {
    provider = builtinFactories[sdkType]()
    provider.configure?.(baseUrl, config.settings)
  }

  providerInstances.set(config.id, provider)
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
export async function validateKeyForConfig(configId: string, keyValue: string): Promise<boolean> {
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
