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

// Model lists and prices reflect provider catalogs as of mid-2026. For the
// OpenAI-compatible gateways (Groq, OpenRouter, Together) and local Ollama,
// catalogs change frequently and are best refreshed via the live `/models`
// endpoint (providerConfig.fetchModels); the entries below are sensible starting
// points rather than an exhaustive list.
const BUILTIN_TEMPLATES: BuiltinProviderTemplate[] = [
  {
    id: 'openai',
    name: 'OpenAI',
    description: 'GPT-5.5 and the GPT-5.4 family (mini, nano)',
    defaultBaseUrl: 'https://api.openai.com/v1',
    supportsBaseUrlOverride: true,
    sdkType: 'openai',
    defaultModels: [
      {
        id: 'gpt-5.5',
        name: 'GPT-5.5',
        contextWindow: 1000000,
        inputPricePerMillion: 5,
        outputPricePerMillion: 30
      },
      {
        id: 'gpt-5.4',
        name: 'GPT-5.4',
        contextWindow: 400000,
        inputPricePerMillion: 2.5,
        outputPricePerMillion: 15
      },
      {
        id: 'gpt-5.4-mini',
        name: 'GPT-5.4 Mini',
        contextWindow: 128000,
        inputPricePerMillion: 0.75,
        outputPricePerMillion: 4.5
      },
      {
        id: 'gpt-5.4-nano',
        name: 'GPT-5.4 Nano',
        contextWindow: 128000,
        inputPricePerMillion: 0.2,
        outputPricePerMillion: 1.25
      }
    ]
  },
  {
    id: 'anthropic',
    name: 'Anthropic',
    description: 'Claude Sonnet 4.6, Haiku 4.5, and Opus 4.8',
    defaultBaseUrl: 'https://api.anthropic.com',
    supportsBaseUrlOverride: true,
    sdkType: 'anthropic',
    defaultModels: [
      {
        id: 'claude-sonnet-4-6',
        name: 'Claude Sonnet 4.6',
        contextWindow: 1000000,
        inputPricePerMillion: 3,
        outputPricePerMillion: 15
      },
      {
        id: 'claude-haiku-4-5',
        name: 'Claude Haiku 4.5',
        contextWindow: 200000,
        inputPricePerMillion: 1,
        outputPricePerMillion: 5
      },
      {
        id: 'claude-opus-4-8',
        name: 'Claude Opus 4.8',
        contextWindow: 1000000,
        inputPricePerMillion: 5,
        outputPricePerMillion: 25
      }
    ]
  },
  {
    id: 'gemini',
    name: 'Google Gemini',
    description: 'Gemini 3.5 Flash, 3.1 Flash-Lite, and the 2.5 family',
    defaultBaseUrl: 'https://generativelanguage.googleapis.com',
    supportsBaseUrlOverride: false,
    sdkType: 'gemini',
    defaultModels: [
      {
        id: 'gemini-3.5-flash',
        name: 'Gemini 3.5 Flash',
        contextWindow: 1000000,
        inputPricePerMillion: 1.5,
        outputPricePerMillion: 9
      },
      {
        id: 'gemini-3.1-flash-lite',
        name: 'Gemini 3.1 Flash-Lite',
        contextWindow: 1000000,
        inputPricePerMillion: 0.25,
        outputPricePerMillion: 1.5
      },
      {
        id: 'gemini-2.5-pro',
        name: 'Gemini 2.5 Pro',
        contextWindow: 1000000,
        inputPricePerMillion: 1.25,
        outputPricePerMillion: 10
      },
      {
        id: 'gemini-2.5-flash',
        name: 'Gemini 2.5 Flash',
        contextWindow: 1000000,
        inputPricePerMillion: 0.3,
        outputPricePerMillion: 2.5
      },
      {
        id: 'gemini-2.5-flash-lite',
        name: 'Gemini 2.5 Flash-Lite',
        contextWindow: 1000000,
        inputPricePerMillion: 0.1,
        outputPricePerMillion: 0.4
      }
    ]
  },
  {
    id: 'xai',
    name: 'xAI (Grok)',
    description: 'Grok 4.20 and Grok 4.1 Fast',
    defaultBaseUrl: 'https://api.x.ai/v1',
    supportsBaseUrlOverride: false,
    sdkType: 'openai_compatible',
    defaultModels: [
      {
        id: 'grok-4.20',
        name: 'Grok 4.20',
        contextWindow: 2000000,
        inputPricePerMillion: 2,
        outputPricePerMillion: 6
      },
      {
        id: 'grok-4.1-fast',
        name: 'Grok 4.1 Fast',
        contextWindow: 2000000,
        inputPricePerMillion: 0.2,
        outputPricePerMillion: 0.5
      }
    ]
  },
  {
    id: 'deepseek',
    name: 'DeepSeek',
    description: 'DeepSeek V4 Flash and V4 Pro - very low cost',
    defaultBaseUrl: 'https://api.deepseek.com',
    supportsBaseUrlOverride: false,
    sdkType: 'openai_compatible',
    defaultModels: [
      {
        id: 'deepseek-v4-flash',
        name: 'DeepSeek V4 Flash',
        contextWindow: 1000000,
        inputPricePerMillion: 0.14,
        outputPricePerMillion: 0.28
      },
      {
        id: 'deepseek-v4-pro',
        name: 'DeepSeek V4 Pro',
        contextWindow: 1000000,
        inputPricePerMillion: 0.44,
        outputPricePerMillion: 0.87
      }
    ]
  },
  {
    id: 'groq',
    name: 'Groq',
    description: 'Ultra-fast inference for open models (Llama, GPT-OSS)',
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
        id: 'openai/gpt-oss-120b',
        name: 'GPT-OSS 120B',
        contextWindow: 128000
      },
      {
        id: 'openai/gpt-oss-20b',
        name: 'GPT-OSS 20B',
        contextWindow: 128000
      }
    ]
  },
  {
    id: 'openrouter',
    name: 'OpenRouter',
    description: 'Multi-model gateway - access hundreds of models',
    defaultBaseUrl: 'https://openrouter.ai/api/v1',
    supportsBaseUrlOverride: false,
    sdkType: 'openai_compatible',
    defaultModels: [
      {
        id: 'anthropic/claude-sonnet-4.6',
        name: 'Claude Sonnet 4.6',
        contextWindow: 1000000
      },
      {
        id: 'openai/gpt-5.5',
        name: 'GPT-5.5',
        contextWindow: 1000000
      },
      {
        id: 'google/gemini-3.5-flash',
        name: 'Gemini 3.5 Flash',
        contextWindow: 1000000
      },
      {
        id: 'deepseek/deepseek-v4',
        name: 'DeepSeek V4',
        contextWindow: 1000000
      },
      {
        id: 'x-ai/grok-4.20',
        name: 'Grok 4.20',
        contextWindow: 2000000
      }
    ]
  },
  {
    id: 'together',
    name: 'Together AI',
    description: 'Hosted open models (Llama, Qwen, DeepSeek)',
    defaultBaseUrl: 'https://api.together.xyz/v1',
    supportsBaseUrlOverride: false,
    sdkType: 'openai_compatible',
    defaultModels: [
      {
        id: 'meta-llama/Llama-3.3-70B-Instruct-Turbo',
        name: 'Llama 3.3 70B Turbo',
        contextWindow: 131072
      },
      {
        id: 'Qwen/Qwen3-235B-A22B-Instruct',
        name: 'Qwen3 235B',
        contextWindow: 256000
      },
      {
        id: 'deepseek-ai/DeepSeek-V3.1',
        name: 'DeepSeek V3.1',
        contextWindow: 131072
      }
    ]
  },
  {
    id: 'ollama',
    name: 'Ollama',
    description: 'Run local models on your machine - no API key required',
    defaultBaseUrl: 'http://localhost:11434/v1',
    supportsBaseUrlOverride: true,
    sdkType: 'openai_compatible',
    defaultModels: [
      {
        id: 'llama3.3',
        name: 'Llama 3.3',
        contextWindow: 128000
      },
      {
        id: 'qwen3',
        name: 'Qwen 3',
        contextWindow: 128000
      },
      {
        id: 'deepseek-r1',
        name: 'DeepSeek-R1',
        contextWindow: 128000
      },
      {
        id: 'gemma3',
        name: 'Gemma 3',
        contextWindow: 128000
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
