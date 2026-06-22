import type {
  ProviderConfig,
  ProviderInfoExtended,
  ModelInfo,
  BuiltinProviderTemplate,
  BuiltinProviderId,
  ProviderSettings
} from '../../shared/types'
import {
  listProviderConfigs,
  getProviderConfig,
  createProviderConfig,
  updateProviderConfig,
  deleteProviderConfig,
  getProviderConfigStats,
  findProviderConfigByBuiltinId
} from '../database/repositories/provider-config.repository'
import { hasValidKeys } from '../database/repositories/apikey.repository'

// ============================================================================
// Built-in Provider Templates
// ============================================================================

const BUILTIN_TEMPLATES: BuiltinProviderTemplate[] = [
  {
    id: 'openai',
    name: 'OpenAI',
    description: 'GPT-4o, GPT-4, GPT-3.5 Turbo models',
    defaultBaseUrl: 'https://api.openai.com/v1',
    supportsBaseUrlOverride: true,
    sdkType: 'openai',
    defaultModels: [
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
    id: 'anthropic',
    name: 'Anthropic',
    description: 'Claude 3.5 Sonnet, Claude 3 Haiku, Claude 3 Opus',
    defaultBaseUrl: 'https://api.anthropic.com',
    supportsBaseUrlOverride: true,
    sdkType: 'anthropic',
    defaultModels: [
      {
        id: 'claude-3-5-sonnet-20241022',
        name: 'Claude 3.5 Sonnet',
        contextWindow: 200000,
        inputPricePerMillion: 3,
        outputPricePerMillion: 15
      },
      {
        id: 'claude-3-5-haiku-20241022',
        name: 'Claude 3.5 Haiku',
        contextWindow: 200000,
        inputPricePerMillion: 1,
        outputPricePerMillion: 5
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
  },
  {
    id: 'gemini',
    name: 'Google Gemini',
    description: 'Gemini 2.0 Flash, Gemini 1.5 Pro, Gemini 1.5 Flash',
    defaultBaseUrl: 'https://generativelanguage.googleapis.com',
    supportsBaseUrlOverride: false,
    sdkType: 'gemini',
    defaultModels: [
      {
        id: 'gemini-2.0-flash',
        name: 'Gemini 2.0 Flash',
        contextWindow: 1000000,
        inputPricePerMillion: 0.1,
        outputPricePerMillion: 0.4
      },
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
      }
    ]
  },
  {
    id: 'groq',
    name: 'Groq',
    description: 'Fast inference with Llama 3, Mixtral models',
    defaultBaseUrl: 'https://api.groq.com/openai/v1',
    supportsBaseUrlOverride: false,
    sdkType: 'openai_compatible',
    defaultModels: [
      {
        id: 'llama-3.3-70b-versatile',
        name: 'Llama 3.3 70B',
        contextWindow: 128000,
        inputPricePerMillion: 0.59,
        outputPricePerMillion: 0.79
      },
      {
        id: 'llama-3.1-8b-instant',
        name: 'Llama 3.1 8B',
        contextWindow: 128000,
        inputPricePerMillion: 0.05,
        outputPricePerMillion: 0.08
      },
      {
        id: 'mixtral-8x7b-32768',
        name: 'Mixtral 8x7B',
        contextWindow: 32768,
        inputPricePerMillion: 0.24,
        outputPricePerMillion: 0.24
      }
    ]
  },
  {
    id: 'openrouter',
    name: 'OpenRouter',
    description: 'Multi-model gateway - access 100+ models',
    defaultBaseUrl: 'https://openrouter.ai/api/v1',
    supportsBaseUrlOverride: false,
    sdkType: 'openai_compatible',
    defaultModels: [
      {
        id: 'openai/gpt-4o',
        name: 'OpenAI GPT-4o',
        contextWindow: 128000,
        inputPricePerMillion: 5,
        outputPricePerMillion: 15
      },
      {
        id: 'anthropic/claude-3.5-sonnet',
        name: 'Claude 3.5 Sonnet',
        contextWindow: 200000,
        inputPricePerMillion: 3,
        outputPricePerMillion: 15
      },
      {
        id: 'meta-llama/llama-3.1-70b-instruct',
        name: 'Llama 3.1 70B',
        contextWindow: 131072,
        inputPricePerMillion: 0.88,
        outputPricePerMillion: 0.88
      }
    ]
  },
  {
    id: 'together',
    name: 'Together AI',
    description: 'Open-source models with competitive pricing',
    defaultBaseUrl: 'https://api.together.xyz/v1',
    supportsBaseUrlOverride: false,
    sdkType: 'openai_compatible',
    defaultModels: [
      {
        id: 'meta-llama/Meta-Llama-3.1-70B-Instruct-Turbo',
        name: 'Llama 3.1 70B Turbo',
        contextWindow: 131072,
        inputPricePerMillion: 0.88,
        outputPricePerMillion: 0.88
      },
      {
        id: 'mistralai/Mixtral-8x7B-Instruct-v0.1',
        name: 'Mixtral 8x7B',
        contextWindow: 32768,
        inputPricePerMillion: 0.6,
        outputPricePerMillion: 0.6
      },
      {
        id: 'Qwen/Qwen2.5-72B-Instruct-Turbo',
        name: 'Qwen 2.5 72B',
        contextWindow: 131072,
        inputPricePerMillion: 1.2,
        outputPricePerMillion: 1.2
      }
    ]
  },
  {
    id: 'ollama',
    name: 'Ollama',
    description: 'Local models - no API key required',
    defaultBaseUrl: 'http://localhost:11434/v1',
    supportsBaseUrlOverride: true,
    sdkType: 'openai_compatible',
    defaultModels: [
      {
        id: 'llama3.2',
        name: 'Llama 3.2',
        contextWindow: 128000
      },
      {
        id: 'mistral',
        name: 'Mistral',
        contextWindow: 32768
      },
      {
        id: 'qwen2.5',
        name: 'Qwen 2.5',
        contextWindow: 32768
      }
    ]
  }
]

// ============================================================================
// Provider Config Service
// ============================================================================

class ProviderConfigService {
  /**
   * Get all built-in provider templates
   */
  getBuiltinTemplates(): BuiltinProviderTemplate[] {
    return BUILTIN_TEMPLATES
  }

  /**
   * Get a specific built-in template
   */
  getBuiltinTemplate(id: BuiltinProviderId): BuiltinProviderTemplate | null {
    return BUILTIN_TEMPLATES.find((t) => t.id === id) || null
  }

  /**
   * List all configured provider configs
   */
  listProviderConfigs(): ProviderConfig[] {
    return listProviderConfigs()
  }

  /**
   * Get a specific provider config
   */
  getProviderConfig(configId: string): ProviderConfig | null {
    return getProviderConfig(configId)
  }

  /**
   * Check if a builtin provider is already configured
   */
  isBuiltinConfigured(builtinId: BuiltinProviderId): boolean {
    return findProviderConfigByBuiltinId(builtinId) !== null
  }

  /**
   * Create a new provider config from a builtin template
   */
  createFromTemplate(
    builtinId: BuiltinProviderId,
    displayName?: string,
    baseUrlOverride?: string
  ): ProviderConfig {
    const template = this.getBuiltinTemplate(builtinId)
    if (!template) {
      throw new Error(`Unknown builtin provider: ${builtinId}`)
    }

    // Get the max sort order
    const existingConfigs = listProviderConfigs()
    const maxSortOrder = existingConfigs.reduce((max, c) => Math.max(max, c.sortOrder), -1)

    return createProviderConfig({
      providerType: 'builtin',
      builtinId,
      displayName: displayName || template.name,
      baseUrl: baseUrlOverride || undefined,
      customModels: undefined, // Use default models from template
      isEnabled: true,
      sortOrder: maxSortOrder + 1,
      settings: {}
    })
  }

  /**
   * Create a custom OpenAI-compatible provider
   */
  createCustomProvider(
    displayName: string,
    baseUrl: string,
    customModels?: ModelInfo[],
    settings?: ProviderSettings
  ): ProviderConfig {
    // Get the max sort order
    const existingConfigs = listProviderConfigs()
    const maxSortOrder = existingConfigs.reduce((max, c) => Math.max(max, c.sortOrder), -1)

    return createProviderConfig({
      providerType: 'openai_compatible',
      builtinId: undefined,
      displayName,
      baseUrl,
      customModels,
      isEnabled: true,
      sortOrder: maxSortOrder + 1,
      settings: settings || {}
    })
  }

  /**
   * Update a provider config
   */
  updateProviderConfig(
    configId: string,
    updates: Partial<Omit<ProviderConfig, 'id' | 'createdAt' | 'updatedAt'>>
  ): void {
    updateProviderConfig(configId, updates)
  }

  /**
   * Delete a provider config
   */
  deleteProviderConfig(configId: string): void {
    deleteProviderConfig(configId)
  }

  /**
   * Get extended provider info for UI display
   */
  listProvidersExtended(): ProviderInfoExtended[] {
    const configs = listProviderConfigs()
    return configs.map((config) => this.getExtendedInfo(config))
  }

  /**
   * Get extended info for a single provider config
   */
  getExtendedInfo(config: ProviderConfig): ProviderInfoExtended {
    const stats = getProviderConfigStats(config.id)
    const models = this.getModelsForProvider(config)

    return {
      id: config.id,
      name: config.displayName,
      models,
      configId: config.id,
      providerType: config.providerType,
      builtinId: config.builtinId,
      baseUrl: config.baseUrl,
      isEnabled: config.isEnabled,
      hasValidKey: hasValidKeys(config.id),
      keyCount: stats.keyCount,
      totalRequests: stats.totalRequests
    }
  }

  /**
   * Get models for a provider config
   */
  getModelsForProvider(config: ProviderConfig): ModelInfo[] {
    // If custom models are defined, use those
    if (config.customModels && config.customModels.length > 0) {
      return config.customModels
    }

    // For builtin providers, get models from template
    if (config.providerType === 'builtin' && config.builtinId) {
      const template = this.getBuiltinTemplate(config.builtinId)
      if (template) {
        return template.defaultModels
      }
    }

    // No models available
    return []
  }

  /**
   * Get the SDK type for a provider config
   */
  getSdkType(config: ProviderConfig): 'openai' | 'anthropic' | 'gemini' | 'openai_compatible' {
    if (config.providerType === 'openai_compatible') {
      return 'openai_compatible'
    }

    if (config.builtinId) {
      const template = this.getBuiltinTemplate(config.builtinId)
      if (template) {
        return template.sdkType
      }
    }

    return 'openai_compatible'
  }

  /**
   * Get the effective base URL for a provider config
   */
  getBaseUrl(config: ProviderConfig): string | undefined {
    // If override is set, use it
    if (config.baseUrl) {
      return config.baseUrl
    }

    // For builtin providers, get default from template
    if (config.providerType === 'builtin' && config.builtinId) {
      const template = this.getBuiltinTemplate(config.builtinId)
      if (template) {
        return template.defaultBaseUrl
      }
    }

    return undefined
  }
}

// Singleton instance
export const providerConfigService = new ProviderConfigService()

// Export for direct imports
export { BUILTIN_TEMPLATES }
