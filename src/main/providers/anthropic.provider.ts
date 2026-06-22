import Anthropic from '@anthropic-ai/sdk'
import {
  describeProviderError,
  type TranslationProvider,
  type ProviderTranslationRequest,
  type ProviderTranslationResult,
} from './types'
import type { ModelInfo, ProviderSettings } from '../../shared/types'

export class AnthropicProvider implements TranslationProvider {
  readonly id = 'anthropic'
  readonly name = 'Anthropic'
  private baseUrl?: string
  private settings: ProviderSettings = {}

  /**
   * Configure the provider with custom base URL and settings
   */
  configure(baseUrl?: string, settings?: ProviderSettings): void {
    this.baseUrl = baseUrl
    if (settings) {
      this.settings = settings
    }
  }

  async translate(request: ProviderTranslationRequest): Promise<ProviderTranslationResult> {
    const client = new Anthropic({
      apiKey: request.apiKey,
      baseURL: request.baseUrl || this.baseUrl,
      timeout: this.settings.timeout,
      defaultHeaders: this.settings.customHeaders
    })

    try {
      const response = await client.messages.create({
        model: request.modelId,
        system: request.systemPrompt,
        messages: [{ role: 'user', content: request.userPrompt }],
        temperature: request.temperature,
        max_tokens: request.maxTokens || 4096,
      })

      const textContent = response.content.find((c) => c.type === 'text')
      const text = textContent?.type === 'text' ? textContent.text : ''

      return {
        translatedText: text,
        tokensUsed: {
          input: response.usage.input_tokens,
          output: response.usage.output_tokens,
          total: response.usage.input_tokens + response.usage.output_tokens,
        },
        finishReason: response.stop_reason === 'end_turn' ? 'stop' : 'length',
      }
    } catch (error) {
      return {
        translatedText: '',
        tokensUsed: { input: 0, output: 0, total: 0 },
        finishReason: 'error',
        error: error instanceof Error ? error.message : String(error),
      }
    }
  }

  estimateTokens(text: string, _modelId: string): number {
    // Rough estimation for Anthropic
    return Math.ceil(text.length / 4)
  }

  async validateKey(key: string, baseUrl?: string): Promise<boolean> {
    const client = new Anthropic({
      apiKey: key,
      baseURL: baseUrl || this.baseUrl,
      timeout: this.settings.timeout
    })

    try {
      // A lightweight, read-only call is enough to validate the key
      await client.models.list({ limit: 1 })
      return true
    } catch {
      return false
    }
  }

  async listModels(apiKey: string, baseUrl?: string): Promise<ModelInfo[]> {
    const client = new Anthropic({
      apiKey,
      baseURL: baseUrl || this.baseUrl,
      timeout: this.settings.timeout,
      defaultHeaders: this.settings.customHeaders
    })

    try {
      const models: ModelInfo[] = []
      // The SDK paginates; iterate all pages.
      for await (const model of client.models.list({ limit: 100 })) {
        models.push({
          id: model.id,
          name: model.display_name ?? model.id,
          contextWindow: 200000
        })
      }
      return models
    } catch (error) {
      throw new Error(describeProviderError(error))
    }
  }
}
