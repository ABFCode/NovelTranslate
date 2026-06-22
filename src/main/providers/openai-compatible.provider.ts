import OpenAI from 'openai'
import {
  describeProviderError,
  type TranslationProvider,
  type ProviderTranslationRequest,
  type ProviderTranslationResult
} from './types'
import type { ModelInfo, ProviderSettings } from '../../shared/types'

/**
 * Generic OpenAI-compatible provider that works with any OpenAI API-compatible endpoint.
 * Used for: Groq, OpenRouter, Together AI, Ollama, custom proxies, etc.
 */
export class OpenAICompatibleProvider implements TranslationProvider {
  readonly id: string
  readonly name: string
  private baseUrl: string
  private settings: ProviderSettings

  constructor(id: string, name: string, baseUrl: string, settings: ProviderSettings = {}) {
    this.id = id
    this.name = name
    this.baseUrl = baseUrl
    this.settings = settings
  }

  /**
   * Update the provider configuration
   */
  configure(baseUrl?: string, settings?: ProviderSettings): void {
    if (baseUrl) {
      this.baseUrl = baseUrl
    }
    if (settings) {
      this.settings = { ...this.settings, ...settings }
    }
  }

  async translate(request: ProviderTranslationRequest): Promise<ProviderTranslationResult> {
    const client = new OpenAI({
      apiKey: request.apiKey,
      baseURL: this.baseUrl,
      timeout: this.settings.timeout || 60000,
      defaultHeaders: this.settings.customHeaders,
      organization: this.settings.organizationId
    })

    try {
      const response = await client.chat.completions.create({
        model: request.modelId,
        messages: [
          { role: 'system', content: request.systemPrompt },
          { role: 'user', content: request.userPrompt }
        ],
        temperature: request.temperature,
        max_tokens: request.maxTokens
      })

      const choice = response.choices[0]
      const usage = response.usage

      return {
        translatedText: choice.message.content || '',
        tokensUsed: {
          input: usage?.prompt_tokens || 0,
          output: usage?.completion_tokens || 0,
          total: usage?.total_tokens || 0
        },
        finishReason: choice.finish_reason === 'stop' ? 'stop' : 'length'
      }
    } catch (error) {
      return {
        translatedText: '',
        tokensUsed: { input: 0, output: 0, total: 0 },
        finishReason: 'error',
        error: error instanceof Error ? error.message : String(error)
      }
    }
  }

  estimateTokens(text: string, _modelId: string): number {
    // Rough estimation: ~4 characters per token for English
    return Math.ceil(text.length / 4)
  }

  async validateKey(key: string, baseUrl?: string): Promise<boolean> {
    const client = new OpenAI({
      apiKey: key,
      baseURL: baseUrl || this.baseUrl,
      timeout: this.settings.timeout || 30000,
      defaultHeaders: this.settings.customHeaders,
      organization: this.settings.organizationId
    })

    try {
      // Try to list models as a validation check
      await client.models.list()
      return true
    } catch {
      // Some providers don't support models.list, try a minimal completion
      try {
        await client.chat.completions.create({
          model: 'gpt-3.5-turbo', // Fallback model - may not work for all providers
          messages: [{ role: 'user', content: 'test' }],
          max_tokens: 1
        })
        return true
      } catch {
        return false
      }
    }
  }

  /**
   * Fetch available models from the provider API
   */
  async listModels(apiKey: string, baseUrl?: string): Promise<ModelInfo[]> {
    const client = new OpenAI({
      apiKey,
      baseURL: baseUrl || this.baseUrl,
      timeout: this.settings.timeout || 30000,
      defaultHeaders: this.settings.customHeaders
    })

    try {
      const response = await client.models.list()
      const models: ModelInfo[] = []

      for await (const model of response) {
        // Filter to only include chat/completion models
        if (this.isCompletionModel(model.id)) {
          models.push({
            id: model.id,
            name: this.formatModelName(model.id),
            contextWindow: this.estimateContextWindow(model.id)
          })
        }
      }

      return models.sort((a, b) => a.name.localeCompare(b.name))
    } catch (error) {
      throw new Error(describeProviderError(error))
    }
  }

  /**
   * Test connection to the provider
   */
  async testConnection(
    apiKey: string,
    baseUrl?: string
  ): Promise<{ valid: boolean; error?: string; models?: number }> {
    const client = new OpenAI({
      apiKey,
      baseURL: baseUrl || this.baseUrl,
      timeout: this.settings.timeout || 30000,
      defaultHeaders: this.settings.customHeaders
    })

    try {
      const response = await client.models.list()
      let modelCount = 0
      for await (const _model of response) {
        modelCount++
      }
      return { valid: true, models: modelCount }
    } catch (error) {
      return {
        valid: false,
        error: error instanceof Error ? error.message : String(error)
      }
    }
  }

  private isCompletionModel(modelId: string): boolean {
    const id = modelId.toLowerCase()
    // Include common completion model patterns
    return (
      id.includes('gpt') ||
      id.includes('claude') ||
      id.includes('llama') ||
      id.includes('mixtral') ||
      id.includes('mistral') ||
      id.includes('gemma') ||
      id.includes('qwen') ||
      id.includes('yi') ||
      id.includes('chat') ||
      id.includes('instruct')
    )
  }

  private formatModelName(modelId: string): string {
    // Convert model IDs to more readable names
    return modelId
      .replace(/-/g, ' ')
      .replace(/([a-z])([A-Z])/g, '$1 $2')
      .replace(/\b\w/g, (c) => c.toUpperCase())
  }

  private estimateContextWindow(modelId: string): number {
    const id = modelId.toLowerCase()
    // Estimate context windows based on common patterns
    if (id.includes('128k') || id.includes('gpt-4o') || id.includes('gpt-4-turbo')) {
      return 128000
    }
    if (id.includes('32k')) {
      return 32768
    }
    if (id.includes('16k') || id.includes('gpt-3.5-turbo')) {
      return 16384
    }
    if (id.includes('8k') || id.includes('llama-3')) {
      return 8192
    }
    // Default context window
    return 4096
  }
}

/**
 * Create an OpenAI-compatible provider instance
 */
export function createOpenAICompatibleProvider(
  id: string,
  name: string,
  baseUrl: string,
  settings?: ProviderSettings
): OpenAICompatibleProvider {
  return new OpenAICompatibleProvider(id, name, baseUrl, settings)
}
